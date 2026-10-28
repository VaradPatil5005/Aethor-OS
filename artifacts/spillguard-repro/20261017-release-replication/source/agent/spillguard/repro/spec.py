"""Versioned, bounded experiment inputs. Memory is bytes, durations are milliseconds.

The first live backend uses a fixed-work CUDA probe. It is a synthetic control,
not an application benchmark or a residency oracle.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field, replace
import hashlib
import json
import math
from pathlib import Path
import re

MIB = 2**20


def number(value, name: str, low: float, high: float, integer: bool = False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    if integer and not isinstance(value, int):
        raise ValueError(f"{name} must be an integer")
    if not low <= value <= high:
        raise ValueError(f"{name} must be between {low} and {high}")
    return value


def _keys(data: dict, allowed: set[str], name: str):
    if not isinstance(data, dict):
        raise ValueError(f"{name} must be an object")
    if data.keys() - allowed:
        raise ValueError(f"unknown {name} fields: {sorted(data.keys() - allowed)}")


@dataclass(frozen=True)
class Action:
    id: str
    allocated_bytes: int
    start_ms: int = 0
    duration_ms: int = 5000
    touch_interval_ms: int = 0  # 0 = first touch, then idle hold
    phase: str = "pressure"
    mode: str = "hold"
    compute_duty_pct: int = 25

    def __post_init__(self):
        if not isinstance(self.id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", self.id):
            raise ValueError("action id must be 1-64 letters, digits, underscores or hyphens")
        number(self.allocated_bytes, "allocated_bytes", 4, 8 * 1024 * MIB, True)
        if self.allocated_bytes % 4:
            raise ValueError("allocated_bytes must be aligned to four bytes")
        number(self.start_ms, "start_ms", 0, 120000, True)
        number(self.duration_ms, "duration_ms", 1, 120000, True)
        number(self.touch_interval_ms, "touch_interval_ms", 0, 120000, True)
        if self.phase not in ("pressure", "request", "decode"):
            raise ValueError("action phase must be pressure, request or decode")
        if self.mode not in ("hold", "compute"):
            raise ValueError("action mode must be hold or compute")
        number(self.compute_duty_pct, "compute_duty_pct", 5, 50, True)
        if self.mode == "compute" and self.allocated_bytes < MIB:
            raise ValueError("arithmetic control requires at least 1 MiB output buffer")


@dataclass(frozen=True)
class Workload:
    kind: str = "cuda_probe"
    allocated_bytes: int = 64 * MIB
    iterations: int = 2048
    warmup_ms: int = 500

    def __post_init__(self):
        if self.kind != "cuda_probe":
            raise ValueError("only the synthetic cuda_probe workload is implemented")
        number(self.allocated_bytes, "workload.allocated_bytes", MIB, 1024 * MIB, True)
        if self.allocated_bytes % 4:
            raise ValueError("workload.allocated_bytes must be aligned to four bytes")
        number(self.iterations, "iterations", 1, 100000, True)
        number(self.warmup_ms, "warmup_ms", 0, 10000, True)

    @property
    def expected_work_units(self):
        return self.iterations

    @property
    def primary_metric(self):
        return "completion_ms"


@dataclass(frozen=True)
class OllamaWorkload:
    model: str
    model_digest: str
    model_blob_digest: str
    prompt: str
    prompt_sha256: str
    kind: str = "ollama"
    num_ctx: int = 2048
    num_predict: int = 128
    generation_seed: int = 0
    temperature: float = 0.0
    num_gpu: int = 999
    warmup_prompt: str = "Reply with the word ready."

    def __post_init__(self):
        if self.kind != "ollama":
            raise ValueError("invalid Ollama workload kind")
        if not isinstance(self.model, str) or not re.fullmatch(r"[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+", self.model):
            raise ValueError("Ollama model must be an explicit local library name:tag")
        for name in ("model_digest", "model_blob_digest", "prompt_sha256"):
            if not isinstance(getattr(self, name), str) or not re.fullmatch(r"[0-9a-f]{64}", getattr(self, name)):
                raise ValueError(f"{name} must be a lowercase SHA-256 digest")
        for name in ("prompt", "warmup_prompt"):
            value = getattr(self, name)
            if not isinstance(value, str) or not value.strip() or len(value.encode("utf-8")) > 65536:
                raise ValueError(f"{name} must be nonempty text up to 64 KiB")
        if hashlib.sha256(self.prompt.encode("utf-8")).hexdigest() != self.prompt_sha256:
            raise ValueError("prompt digest does not match prompt")
        number(self.num_ctx, "num_ctx", 512, 8192, True)
        number(self.num_predict, "num_predict", 16, 1024, True)
        if self.num_predict >= self.num_ctx:
            raise ValueError("token budget must leave room for the prompt")
        if len(self.prompt.encode("utf-8")) + self.num_predict + 256 > self.num_ctx:
            raise ValueError("prompt byte bound plus token budget and template margin exceeds context")
        number(self.generation_seed, "generation_seed", 0, 2**32 - 1, True)
        number(self.temperature, "temperature", 0, 2)
        number(self.num_gpu, "num_gpu", 1, 999, True)

    @property
    def expected_work_units(self):
        return self.num_predict

    @property
    def primary_metric(self):
        return "decode_ms_per_token"


@dataclass(frozen=True)
class Protocol:
    repeats: int = 3
    slowdown_ratio: float = 2.0
    recovery_ratio: float = 1.25
    min_pressure_fraction: float = 0.5
    min_overlap_samples: int = 2
    sample_interval_ms: int = 100
    lead_in_ms: int = 500
    cooldown_ms: int = 1000
    timeout_s: int = 30
    max_requested_bytes: int = 1024 * MIB
    min_available_host_bytes: int = 2048 * MIB
    preparation: str = "warm"
    idle_ms: int = 3000
    treatment_order: str = "fixed"

    def __post_init__(self):
        for name, low, high in (
            ("repeats", 1, 20), ("min_overlap_samples", 1, 1000),
            ("sample_interval_ms", 20, 2000), ("lead_in_ms", 0, 10000),
            ("cooldown_ms", 0, 10000), ("timeout_s", 1, 180),
            ("max_requested_bytes", MIB, 8 * 1024 * MIB),
            ("min_available_host_bytes", 1024 * MIB, 64 * 1024 * MIB),
            ("idle_ms", 0, 30000),
        ):
            number(getattr(self, name), name, low, high, True)
        number(self.slowdown_ratio, "slowdown_ratio", 1.01, 1000)
        number(self.recovery_ratio, "recovery_ratio", 1, self.slowdown_ratio)
        number(self.min_pressure_fraction, "min_pressure_fraction", 0.01, 1)
        if self.preparation not in ("cold", "warm", "idle_resume"):
            raise ValueError("preparation must be cold, warm or idle_resume")
        if self.treatment_order not in ("fixed", "paired_randomized"):
            raise ValueError("treatment_order must be fixed or paired_randomized")


@dataclass(frozen=True)
class Recipe:
    name: str
    actions: tuple[Action, ...]
    workload: Workload | OllamaWorkload = field(default_factory=Workload)
    protocol: Protocol = field(default_factory=Protocol)
    schema_version: int = 1
    seed: int = 0

    def __post_init__(self):
        if type(self.schema_version) is not int or self.schema_version != 1:
            raise ValueError("unsupported recipe schema_version")
        if not isinstance(self.name, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", self.name):
            raise ValueError("recipe name must be 1-64 letters, digits, underscores or hyphens")
        number(self.seed, "seed", 0, 2**32 - 1, True)
        if len(self.actions) > 64 or len({a.id for a in self.actions}) != len(self.actions):
            raise ValueError("recipes allow at most 64 actions, with unique ids")
        # Conservative ceiling includes even non-overlapping actions. No pressure escalation by search.
        if sum(a.allocated_bytes for a in self.actions) > self.protocol.max_requested_bytes:
            raise ValueError("requested action bytes exceed max_requested_bytes")
        if any(a.start_ms + a.duration_ms > self.protocol.timeout_s * 1000 for a in self.actions):
            raise ValueError("action extends beyond the trial timeout")
        if self.workload.kind == "cuda_probe" and any(a.phase != "pressure" for a in self.actions):
            raise ValueError("CUDA probe actions currently use only the pressure phase")

    def to_dict(self) -> dict:
        return {**asdict(self), "actions": [asdict(action) for action in self.actions]}

    @classmethod
    def from_dict(cls, data: dict) -> "Recipe":
        _keys(data, set(cls.__dataclass_fields__), "recipe")
        actions = data.get("actions")
        if not isinstance(actions, list):
            raise ValueError("actions must be a list (an empty control is allowed)")
        for a in actions:
            _keys(a, set(Action.__dataclass_fields__), "action")
            if "id" not in a or "allocated_bytes" not in a:
                raise ValueError("each action needs id and allocated_bytes")
        w, p = data.get("workload", {}), data.get("protocol", {})
        workload_type = OllamaWorkload if isinstance(w, dict) and w.get("kind") == "ollama" else Workload
        _keys(w, set(workload_type.__dataclass_fields__), "workload")
        _keys(p, set(Protocol.__dataclass_fields__), "protocol")
        if "name" not in data:
            raise ValueError("recipe name is required")
        try:
            workload = workload_type(**w)
        except TypeError as exc:
            raise ValueError(f"missing workload fields: {exc}") from exc
        return cls(**{k: v for k, v in data.items() if k not in ("actions", "workload", "protocol")},
                   actions=tuple(Action(**a) for a in actions), workload=workload, protocol=Protocol(**p))

    @classmethod
    def load(cls, path: str | Path) -> "Recipe":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8-sig")))

    @property
    def signature(self) -> str:
        return hashlib.sha256(json.dumps(self.to_dict(), sort_keys=True).encode()).hexdigest()

    def with_actions(self, actions) -> "Recipe":
        return replace(self, actions=tuple(actions))
