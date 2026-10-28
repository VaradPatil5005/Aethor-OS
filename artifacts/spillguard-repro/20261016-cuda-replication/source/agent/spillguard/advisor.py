"""Admission + configuration advice for an LLM launch, from the latest analyzed frame.

verdict SAFE      the requested config's claim keeps the system in a safe state
verdict FIXABLE   it does not, but a lower-cost config does (best one returned)
verdict UNSAFE    nothing fits; plain-language reason
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

from .bankers import Job, admit
from .gguf_fit import FitConfig, ModelInfo, estimate, load_calibration

RESOURCES = ["VRAM", "commit"]
VRAM_MARGIN_MB = 256       # desktop compositor / browser growth headroom
COMMIT_MARGIN_MB = 1024
PEAK_FACTOR = 1.1          # Max claim for unknown running apps = observed peak x 1.1
KV_RANK = {"f16": 2, "q8_0": 1, "q4_0": 0}


@dataclass
class Candidate:
    config: FitConfig
    vram_mb: float
    commit_mb: float
    full_offload: bool

    def to_dict(self) -> dict:
        return {"config": self.config.to_dict(), "vram_mb": round(self.vram_mb),
                "commit_mb": round(self.commit_mb), "full_offload": self.full_offload}


def claim(m: ModelInfo, cfg: FitConfig, cal: dict) -> Candidate:
    e = estimate(m, cfg, cal)
    cpu_weights = m.file_mb - e.weights_mb + (m.output_mb if e.layers_on_gpu == m.n_layer else 0)
    commit = max(0.0, cpu_weights) + 512  # host-side weights + runtime; mmapped weights are not commit
    return Candidate(cfg, e.total_mb, commit, e.layers_on_gpu == m.n_layer)


def running_jobs(frame: dict, peaks: dict[int, tuple[float, float]] | None = None) -> list[Job]:
    jobs = []
    for p in frame.get("procs", []):
        alloc = [float(p.get("dedicated_mb", 0)), float(p.get("private_mb", 0) or 0)]
        pk = (peaks or {}).get(p["pid"], (alloc[0], alloc[1]))
        jobs.append(Job(p["name"], alloc, [max(alloc[0], pk[0]) * PEAK_FACTOR, max(alloc[1], pk[1]) * PEAK_FACTOR],
                        long_lived=True, pid=p["pid"]))
    return jobs


def capacity(frame: dict) -> tuple[list[float], list[float]]:
    ad, sysm = frame["adapter"], frame.get("system", {})
    commit_free_cap = float(sysm.get("commit_limit_mb") or 0)
    # running procs' private bytes are only part of total commit; fold the rest into the margin
    tracked_private = sum(float(p.get("private_mb", 0) or 0) for p in frame.get("procs", []))
    untracked = max(0.0, float(sysm.get("commit_mb") or 0) - tracked_private)
    return [float(ad["vram_total_mb"]), commit_free_cap], [VRAM_MARGIN_MB, COMMIT_MARGIN_MB + untracked]


def candidates(m: ModelInfo, want: FitConfig, cal: dict) -> list[Candidate]:
    ctxs, c = [], want.n_ctx
    while c >= 2048:
        ctxs.append(c)
        c //= 2
    ctxs = ctxs or [want.n_ctx]
    out = []
    for ctx in ctxs:
        for kv, fa in (("f16", False), ("f16", True), ("q8_0", True), ("q4_0", True)):
            for ngl in [999] + list(range(m.n_layer - 1, -1, -max(1, m.n_layer // 8))):
                cfg = FitConfig(n_ctx=ctx, kv_type=kv, n_gpu_layers=ngl, flash_attn=fa, n_parallel=want.n_parallel)
                out.append(claim(m, cfg, cal))
    return out


def rank_key(c: Candidate, want: FitConfig):
    return (c.full_offload, min(c.config.n_ctx, want.n_ctx), KV_RANK[c.config.kv_type],
            not c.config.flash_attn, min(c.config.n_gpu_layers, 999))


def advise(m: ModelInfo, want: FitConfig, frame: dict, peaks=None, long_lived: bool = True,
           exclude_pids: set[int] | None = None) -> dict:
    cal = load_calibration()
    running = [j for j in running_jobs(frame, peaks) if j.pid not in (exclude_pids or set())]
    cap, margin = capacity(frame)

    def try_cfg(c: Candidate):
        return admit(RESOURCES, cap, margin, running, Job(m.name, [0.0, 0.0], [c.vram_mb, c.commit_mb], long_lived))

    req = claim(m, want, cal)
    first = try_cfg(req)
    result = {"model": m.to_dict(), "requested": req.to_dict(), "estimate": estimate(m, want, cal).to_dict(),
              "calibration": cal.get("source"), "available_mb": [round(a) for a in first.available],
              "holders": first.holders}
    if first.verdict == "SAFE":
        return {**result, "verdict": "SAFE", "reason": first.reason, "suggested": req.to_dict(),
                "safety": asdict(first.result)}
    best = None
    for c in candidates(m, want, cal):
        if try_cfg(c).verdict == "SAFE" and (best is None or rank_key(c, want) > rank_key(best, want)):
            best = c
    if best:
        return {**result, "verdict": "FIXABLE", "reason": first.reason, "suggested": best.to_dict(),
                "safety": asdict(try_cfg(best).result)}
    return {**result, "verdict": "UNSAFE", "reason": first.reason, "suggested": None, "safety": asdict(first.result)}


# ---- launch command rewriting ----------------------------------------------------------------
def llama_cpp_args(cfg: dict) -> list[str]:
    a = ["-c", str(cfg["n_ctx"]), "-ngl", str(cfg["n_gpu_layers"])]
    if cfg["flash_attn"]:
        a += ["-fa", "on"]
    if cfg["kv_type"] != "f16":
        a += ["-ctk", cfg["kv_type"], "-ctv", cfg["kv_type"]]
    if cfg.get("n_parallel", 1) > 1:
        a += ["-np", str(cfg["n_parallel"])]
    return a


def ollama_env(cfg: dict) -> dict[str, str]:
    env = {"OLLAMA_CONTEXT_LENGTH": str(cfg["n_ctx"])}
    if cfg["flash_attn"]:
        env["OLLAMA_FLASH_ATTENTION"] = "1"
    if cfg["kv_type"] != "f16":
        env["OLLAMA_KV_CACHE_TYPE"] = cfg["kv_type"]
    return env


def ollama_modelfile(base: str, cfg: dict) -> str:
    lines = [f"FROM {base}", f"PARAMETER num_ctx {cfg['n_ctx']}"]
    if cfg["n_gpu_layers"] < 999:
        lines.append(f"PARAMETER num_gpu {cfg['n_gpu_layers']}")
    return "\n".join(lines) + "\n"
