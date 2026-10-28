"""Conservative tri-state failure predicate and self-contained local evidence bundles."""
from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
import math
from pathlib import Path
from statistics import median

from .spec import Recipe


@dataclass(frozen=True)
class Verdict:
    outcome: str  # FAIL = reproduced slowdown; PASS = valid non-reproduction
    reason: str
    slowdown: float | None = None
    recovery: float | None = None


def _positive(value):
    return type(value) in (int, float) and math.isfinite(value) and value > 0


def classify(recipe: Recipe, stages: list[dict]) -> Verdict:
    """Failure means a completed, matched, recovered slowdown under observed pressure.

    Counter observations support manipulation validity, never establish its cause.
    Missing telemetry, failed helpers and mismatched work stay INCONCLUSIVE.
    """
    if [s.get("stage") for s in stages] != ["baseline", "pressure", "recovery"]:
        return Verdict("INCONCLUSIVE", "missing or out-of-order matched stages")
    for s in stages:
        if s.get("errors") or s.get("completed") is not True:
            return Verdict("INCONCLUSIVE", f"{s['stage']}: collection, workload or helper failure")
        if not _positive(s.get("latency_ms")):
            return Verdict("INCONCLUSIVE", f"{s['stage']}: missing or invalid timing")
        if s.get("work_units") != recipe.workload.expected_work_units:
            return Verdict("INCONCLUSIVE", "requested work changed")
        if s.get("workload_signature") != stages[0].get("workload_signature") or not s.get("workload_signature"):
            return Verdict("INCONCLUSIVE", "workload signature changed or missing")
        if s.get("environment_signature") != stages[0].get("environment_signature") or not s.get("environment_signature"):
            return Verdict("INCONCLUSIVE", "environment signature changed or missing")
        if s.get("host_pressure") is not False:
            return Verdict("INCONCLUSIVE", f"{s['stage']}: host pressure or unavailable host telemetry")
        if recipe.workload.kind == "ollama":
            if s.get("metric") != recipe.workload.primary_metric or not _positive(s.get("metric_value")):
                return Verdict("INCONCLUSIVE", "primary inference metric missing or changed")
            stats = s.get("server_statistics", {})
            if stats.get("prompt_eval_count", 0) <= 0 or stats.get("prompt_eval_count") != stages[0].get("server_statistics", {}).get("prompt_eval_count"):
                return Verdict("INCONCLUSIVE", "prompt token work changed or missing")
            if stats["prompt_eval_count"] + recipe.workload.num_predict > recipe.workload.num_ctx:
                return Verdict("INCONCLUSIVE", "measured token work exceeds the frozen context")
            for key in ("output_sha256", "thinking_sha256"):
                if not s.get(key) or s.get(key) != stages[0].get(key):
                    return Verdict("INCONCLUSIVE", "generated output changed")
            if s.get("prompt_sha256") != recipe.workload.prompt_sha256:
                return Verdict("INCONCLUSIVE", "prompt changed")
            for key in ("model_before", "model_after"):
                state = s.get(key) or {}
                if key == "model_before" and recipe.protocol.preparation == "cold" and s.get(key) is None:
                    continue
                if (state.get("digest", "").removeprefix("sha256:") != recipe.workload.model_digest or
                        state.get("context_length") != recipe.workload.num_ctx):
                    return Verdict("INCONCLUSIVE", "model identity or realized context changed")
                size, vram = state.get("size"), state.get("size_vram")
                if not _positive(size) or not _positive(vram) or vram < size:
                    return Verdict("INCONCLUSIVE", "runtime reports partial CPU offload or unavailable allocation evidence")
    pressure = stages[1]
    if recipe.actions and pressure.get("pressure_observed") is not True:
        return Verdict("INCONCLUSIVE", "requested pressure was not observed during target execution")
    metric_key = "metric_value" if recipe.workload.kind == "ollama" else "latency_ms"
    ratio = pressure[metric_key] / stages[0][metric_key]
    recovery = stages[2][metric_key] / stages[0][metric_key]
    if recovery > recipe.protocol.recovery_ratio:
        return Verdict("INCONCLUSIVE", "release did not restore the matched baseline", ratio, recovery)
    if ratio >= recipe.protocol.slowdown_ratio:
        if not recipe.actions:
            return Verdict("INCONCLUSIVE", "empty control slowed down; pressure recipe cannot explain it", ratio, recovery)
        return Verdict("FAIL", "completed slowdown with recovery; mechanism remains unverified", ratio, recovery)
    return Verdict("PASS", "valid trial did not reach the declared slowdown threshold", ratio, recovery)


def aggregate(verdicts: list[Verdict], required: int) -> Verdict:
    if len(verdicts) != required or any(v.outcome == "INCONCLUSIVE" for v in verdicts):
        return Verdict("INCONCLUSIVE", "incomplete or inconclusive fixed-size trial block")
    outcomes = {v.outcome for v in verdicts}
    if len(outcomes) != 1:
        return Verdict("INCONCLUSIVE", "mixed outcomes across repeated trials")
    return Verdict(verdicts[0].outcome, f"{required}/{required} concordant matched trials",
                   median(v.slowdown for v in verdicts), median(v.recovery for v in verdicts))


def write_json(path: Path, data):
    path.write_text(json.dumps(data, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def verify_bundle(directory: Path):
    directory = directory.resolve()
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("algorithm") != "sha256" or not isinstance(manifest.get("files"), dict):
        raise ValueError("unsupported manifest format")
    expected = manifest["files"]
    if not {"recipe.json", "report.json", "report.md"} <= expected.keys():
        raise ValueError("manifest omits required evidence files")
    for name, digest in expected.items():
        relative = Path(name)
        path = directory / relative
        if relative.is_absolute() or ".." in relative.parts or not path.resolve().is_relative_to(directory) or path.is_symlink():
            raise ValueError("manifest contains an unsafe file path")
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f"bundle integrity mismatch: {name}")
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob("*") if p.is_file() and p.name != "manifest.json"}
    if actual != set(expected):
        raise ValueError("bundle contains unlisted or missing files")


def seal_bundle(directory: Path, recipe: Recipe, trials: list[dict], metadata: dict,
                complete: bool = True) -> dict:
    """Raw traces are already in directory. Hash them without following external symlinks.

    Bundles are local artifacts: machine metadata/paths may be sensitive. They are not
    advertised as privacy-scrubbed publication artifacts.
    """
    verdicts = [Verdict(**t["verdict"]) for t in trials]
    summary = aggregate(verdicts, recipe.protocol.repeats) if complete else Verdict("INCONCLUSIVE", "run interrupted")
    origin = metadata.get("data_origin", "unspecified")
    synthetic = recipe.workload.kind == "cuda_probe"
    report = {"schema_version": 1, "artifact": "experimental witness" if summary.outcome == "FAIL" else "experiment record",
              "synthetic_workload": synthetic, "primary_metric": recipe.workload.primary_metric,
              "data_origin": origin,
              "mechanism": "unverified", "recipe_signature": recipe.signature,
              "complete": complete, "planned_blocks": recipe.protocol.repeats, "metadata": metadata, "trials": trials,
              "verdict": asdict(summary), "fresh_validation": complete and metadata.get("purpose") == "validation"}
    write_json(directory / "recipe.json", recipe.to_dict())
    write_json(directory / "report.json", report)
    counts = {o: sum(v.outcome == o for v in verdicts) for o in ("FAIL", "PASS", "INCONCLUSIVE")}
    (directory / "report.md").write_text(
        f"# SpillGuard Repro: {recipe.name}\n\n"
        f"Data origin: **{origin}**.\n\n"
        f"Outcome: **{summary.outcome}**. {summary.reason}.\n\n"
        f"Trials: {counts['FAIL']} reproduced, {counts['PASS']} non-reproductions, "
        f"{counts['INCONCLUSIVE']} inconclusive; planned {recipe.protocol.repeats}.\n\n" +
        ("This is a synthetic CUDA write probe. " if synthetic else
         "This is a frozen local Ollama generation workload. The primary metric is server-reported decode milliseconds per token. "
         "Client time to first output is observed at the stream boundary; exact load/prefill boundaries are unavailable. ") +
        "A slowdown with observed memory pressure does not "
        "prove a residency mechanism or an application-wide speedup. DXGI budgets describe the observer. "
        "PDH dedication/shared observations are not direct resource-residency measurements. "
        "Temperature, clock and compute/bandwidth confounders remain uncontrolled.\n\n"
        f"Stage-order policy: {recipe.protocol.treatment_order}; preparation: {recipe.protocol.preparation}. "
        "time/order effects remain a limitation. No confidence interval or tail-latency claim is made.\n\n"
        "Rerun from the repository root (new output directory required):\n\n"
        "```powershell\n"
        "agent/.venv/Scripts/python.exe bench/repro.py run --recipe <this-bundle>/recipe.json --out <new-bundle>\n"
        "```\n\n"
        "Raw files and the local machine metadata are included. Review them before sharing. "
        "manifest.json contains SHA-256 integrity hashes, not an authenticity signature.\n", encoding="utf-8")
    manifest = {}
    for path in sorted(directory.rglob("*")):
        if path.is_file() and not path.is_symlink() and path.name != "manifest.json":
            manifest[path.relative_to(directory).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    write_json(directory / "manifest.json", {"algorithm": "sha256", "files": manifest})
    return report
