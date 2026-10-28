"""VRAM fit estimator for local LLMs:  M = W_gpu + KV + B + O.

W_gpu  weights placed on the GPU, summed from real tensor sizes in the GGUF
       (llama.cpp offloads the *last* n_gpu_layers blocks; the output head goes to
       the GPU once every block is offloaded; with tied embeddings the output head
       is a copy of token_embd).
KV     2 x layers_on_gpu x n_ctx x n_head_kv x head_dim x bytes/elem x n_parallel
B      compute buffer: logits (n_vocab x n_ubatch x 4 B) + attention scratch
       (n_head x n_ctx x n_ubatch x 4 B, only without flash attention) + calibrated
       slack (+ per-context term, + image-encoder buffer for vision models)
       Vision models also place their encoder weights (v.*, mm.*) on the GPU.
O      CUDA context + runtime overhead

B's slack and O are machine/runtime dependent and are loaded from
calibration.json (written by bench/calibrate_fit.py) rather than guessed.
Only header metadata is read; weights are never loaded (the file is mmapped).
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, asdict, field
from pathlib import Path

MB = 2**20

# Bytes per element of the KV cache (ggml block formats: q8_0 = 34 B / 32, q4_0 = 18 B / 32).
KV_BYTES = {"f16": 2.0, "q8_0": 34 / 32, "q4_0": 18 / 32}

# Approximate bits per weight, for estimates without a GGUF file.
QUANT_BPW = {"Q2_K": 3.35, "Q3_K_M": 3.91, "IQ4_XS": 4.25, "Q4_0": 4.55, "Q4_K_M": 4.85,
             "Q5_K_M": 5.69, "Q6_K": 6.56, "Q8_0": 8.5, "F16": 16.0}

CALIBRATION_FILE = Path(__file__).resolve().parent.parent / "calibration.json"
DEFAULT_CAL = {"overhead_mb": 350, "buffer_slack_mb": 64, "buffer_per_kctx_mb": 0.0, "vision_buffer_mb": 0.0,
               "n_ubatch": 512, "source": "default (uncalibrated)"}


def load_calibration() -> dict:
    try:
        return {**DEFAULT_CAL, **json.loads(CALIBRATION_FILE.read_text())}
    except Exception:
        return dict(DEFAULT_CAL)


@dataclass
class ModelInfo:
    name: str
    arch: str
    n_layer: int
    n_head: int
    n_head_kv: int
    n_embd: int
    head_dim_k: int
    head_dim_v: int
    n_vocab: int
    ctx_train: int
    file_mb: int
    quant: str
    layer_mb: list[float] = field(default_factory=list)   # per block, index = layer id
    output_mb: float = 0.0                                # output head (+ norm) placed with last layer
    embd_mb: float = 0.0                                  # token_embd (stays on CPU in llama.cpp)
    vision_mb: float = 0.0                                # vision encoder/projector ("v.*", "mm.*") on GPU
    sliding_window: int | None = None
    source: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("layer_mb")
        return d


def _field(r, key, default=None):
    f = r.fields.get(key)
    if f is None:
        return default
    try:
        return f.contents()
    except Exception:
        return default


FILE_TYPES = {0: "F32", 1: "F16", 2: "Q4_0", 3: "Q4_1", 7: "Q8_0", 8: "Q5_0", 9: "Q5_1", 10: "Q2_K",
              11: "Q3_K_S", 12: "Q3_K_M", 13: "Q3_K_L", 14: "Q4_K_S", 15: "Q4_K_M", 16: "Q5_K_S",
              17: "Q5_K_M", 18: "Q6_K", 30: "IQ4_XS", 32: "BF16"}


def read_gguf(path: str | Path) -> ModelInfo:
    from gguf import GGUFReader
    r = GGUFReader(str(path))
    arch = _field(r, "general.architecture", "llama")
    g = lambda k, d=None: _field(r, f"{arch}.{k}", d)  # noqa: E731
    n_layer = int(g("block_count"))
    n_head = int(g("attention.head_count"))
    n_head_kv = int(g("attention.head_count_kv", n_head))
    n_embd = int(g("embedding_length"))
    hk = int(g("attention.key_length", n_embd // n_head))
    hv = int(g("attention.value_length", hk))
    tokens = r.fields.get("tokenizer.ggml.tokens")
    n_vocab = int(g("vocab_size", len(tokens.data) if tokens is not None else 32000))

    layer_mb = [0.0] * n_layer
    output_mb = embd_mb = vision_mb = 0.0
    has_output = False
    blk = re.compile(r"^blk\.(\d+)\.")
    for t in r.tensors:
        size = t.n_bytes / MB
        m = blk.match(t.name)
        if m:
            layer_mb[int(m.group(1))] += size
        elif t.name.startswith("output"):
            output_mb += size
            has_output |= t.name == "output.weight"
        elif t.name.startswith("token_embd"):
            embd_mb += size
        elif t.name.startswith(("v.", "mm.")):
            vision_mb += size
    if not has_output:
        output_mb += embd_mb  # tied embeddings: the output head is a GPU copy of token_embd

    return ModelInfo(
        name=str(_field(r, "general.name", Path(path).name)), arch=arch, n_layer=n_layer, n_head=n_head,
        n_head_kv=n_head_kv, n_embd=n_embd, head_dim_k=hk, head_dim_v=hv, n_vocab=n_vocab,
        ctx_train=int(g("context_length", 4096)), file_mb=os.path.getsize(path) // MB,
        quant=FILE_TYPES.get(int(_field(r, "general.file_type", -1) or -1), "unknown"),
        layer_mb=layer_mb, output_mb=output_mb, embd_mb=embd_mb, vision_mb=vision_mb,
        sliding_window=g("attention.sliding_window"), source=str(path),
    )


# ---- Ollama model resolution ---------------------------------------------------------------
def ollama_models_dir() -> Path:
    return Path(os.environ.get("OLLAMA_MODELS", Path.home() / ".ollama" / "models"))


def resolve_ollama(name: str) -> Path:
    """'qwen2.5:3b-instruct' -> path of its GGUF blob in the local Ollama store."""
    if ":" not in name:
        name += ":latest"
    model, tag = name.split(":", 1)
    parts = model.split("/")
    if len(parts) == 1:
        parts = ["registry.ollama.ai", "library", parts[0]]
    elif len(parts) == 2:
        parts = ["registry.ollama.ai", *parts]
    manifest = ollama_models_dir() / "manifests" / Path(*parts) / tag
    data = json.loads(manifest.read_text())
    digest = next(l["digest"] for l in data["layers"] if l["mediaType"] == "application/vnd.ollama.image.model")
    return ollama_models_dir() / "blobs" / digest.replace(":", "-")


def list_ollama_models() -> list[str]:
    root = ollama_models_dir() / "manifests" / "registry.ollama.ai" / "library"
    if not root.exists():
        return []
    return sorted(f"{d.name}:{f.name}" for d in root.iterdir() if d.is_dir() for f in d.iterdir() if f.is_file())


_CACHE: dict[tuple[str, float], ModelInfo] = {}


def _read_cached(path: Path) -> ModelInfo:
    # Parsing a GGUF header walks the whole tokenizer array (~150k entries): seconds, not ms.
    key = (str(path), path.stat().st_mtime)
    if key not in _CACHE:
        _CACHE[key] = read_gguf(path)
    return _CACHE[key]


def load_model(spec: str) -> ModelInfo:
    """spec: a .gguf path, 'ollama:<name>', or a bare Ollama model name."""
    from dataclasses import replace
    if Path(spec).exists():
        return replace(_read_cached(Path(spec)))
    name = spec.removeprefix("ollama:")
    m = replace(_read_cached(resolve_ollama(name)))
    if m.name.startswith("sha256-"):  # Ollama blobs often lack general.name
        m.name = name
    return m


# ---- estimate ------------------------------------------------------------------------------
@dataclass
class FitConfig:
    n_ctx: int = 4096
    kv_type: str = "f16"
    n_gpu_layers: int = 999        # 999 = everything (llama.cpp convention)
    flash_attn: bool = False
    n_parallel: int = 1

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Estimate:
    weights_mb: float
    kv_mb: float
    buffer_mb: float
    overhead_mb: float
    layers_on_gpu: int
    total_layers: int

    @property
    def total_mb(self) -> float:
        return self.weights_mb + self.kv_mb + self.buffer_mb + self.overhead_mb

    def to_dict(self) -> dict:
        return {**asdict(self), "total_mb": round(self.total_mb)}


def estimate(m: ModelInfo, cfg: FitConfig, cal: dict | None = None) -> Estimate:
    cal = cal or load_calibration()
    if cfg.kv_type != "f16" and not cfg.flash_attn:
        raise ValueError("quantized KV cache requires flash attention (llama.cpp / Ollama)")
    ngl = min(cfg.n_gpu_layers, m.n_layer + 1)
    layers = min(ngl, m.n_layer)
    full = ngl > m.n_layer
    w = sum(m.layer_mb[m.n_layer - layers:]) + (m.output_mb + m.vision_mb if full else 0.0)

    kv_ctx = cfg.n_ctx * cfg.n_parallel
    kv_bytes = layers * kv_ctx * m.n_head_kv * (m.head_dim_k + m.head_dim_v) * KV_BYTES[cfg.kv_type]
    ub = cal["n_ubatch"]
    buf = m.n_vocab * ub * 4 if ngl > m.n_layer else 0
    if not cfg.flash_attn and layers:
        buf += m.n_head * cfg.n_ctx * ub * 4
    slack = cal["buffer_slack_mb"] + cal.get("buffer_per_kctx_mb", 0.0) * cfg.n_ctx / 1024
    if m.vision_mb and full:
        slack += cal.get("vision_buffer_mb", 0.0)  # image-encoder graph reserved at load time
    return Estimate(weights_mb=w, kv_mb=kv_bytes / MB, buffer_mb=buf / MB + slack,
                    overhead_mb=cal["overhead_mb"] if layers else 0, layers_on_gpu=layers, total_layers=m.n_layer)


def max_ctx_that_fits(m: ModelInfo, budget_mb: float, kv_type="f16", flash_attn=False, cal=None) -> int:
    """Largest power-of-two context (>= 512) for a full offload that fits budget_mb, else 0."""
    best, ctx = 0, 512
    while ctx <= max(m.ctx_train, 512):
        if estimate(m, FitConfig(n_ctx=ctx, kv_type=kv_type, flash_attn=flash_attn), cal).total_mb <= budget_mb:
            best = ctx
        ctx *= 2
    return best
