"""Local review packages with allowlisted reports and identity-scrubbed replay traces.

No upload/publication occurs. Model weights, binary dependencies, logs, environment
files, hostnames, original PIDs/start times and file paths are excluded.
"""
import hashlib
import json
from pathlib import Path
import shutil

from .evidence import verify_bundle, write_json


def verify_export(directory):
    directory = Path(directory).resolve()
    manifest = json.loads((directory / "manifest.json").read_text())
    if manifest.get("algorithm") != "sha256" or not isinstance(manifest.get("files"), dict):
        raise ValueError("unsupported export manifest")
    files = manifest["files"]
    if not {"results.json", "recipe-template.json", "environment.json", "REPLICATION.md"} <= files.keys():
        raise ValueError("export omits required files")
    for name, digest in files.items():
        relative = Path(name)
        path = directory / relative
        if relative.is_absolute() or ".." in relative.parts or path.is_symlink() or not path.resolve().is_relative_to(directory):
            raise ValueError("unsafe export path")
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f"export integrity mismatch: {name}")
    actual = {p.relative_to(directory).as_posix() for p in directory.rglob("*") if p.is_file() and p.name != "manifest.json"}
    if actual != set(files):
        raise ValueError("export contains unlisted or missing files")
    return True


def export_bundle(bundle, out, *, include_prompt=False):
    bundle, out = Path(bundle), Path(out)
    verify_bundle(bundle)
    report = json.loads((bundle / "report.json").read_text())
    recipe = json.loads((bundle / "recipe.json").read_text())
    out.mkdir(parents=True, exist_ok=False)
    if not include_prompt and recipe["workload"]["kind"] == "ollama":
        recipe["workload"]["prompt"] = "<supply original local prompt with the recorded SHA-256>"
    write_json(out / "recipe-template.json", recipe)
    public_trials = []
    for trial in report["trials"]:
        public_stages = []
        for stage in trial["stages"]:
            public_stages.append({key: stage.get(key) for key in (
                "stage", "completed", "latency_ms", "metric", "metric_value", "work_units", "pressure_observed",
                "overlap_samples", "host_pressure", "server_statistics", "time_to_first_output_ms")})
        public_trials.append({"trial": trial["trial"], "verdict": {key: trial["verdict"].get(key) for key in
                               ("outcome", "slowdown", "recovery")}, "stages": public_stages})
    write_json(out / "results.json", {"schema_version": 1, "data_origin": report["data_origin"],
               "primary_metric": report["primary_metric"], "recipe_signature": report["recipe_signature"],
               "complete": report["complete"], "mechanism": "unverified",
               "outcome": report["verdict"]["outcome"], "trials": public_trials,
               "source_hashes": report["metadata"].get("source_sha256", {}),
               "prompt_included": include_prompt, "publication_review": "not performed"})
    machine = report["metadata"].get("machine", {})
    write_json(out / "environment.json", {key: machine.get(key) for key in ("os", "python", "nvidia_driver", "ram_mb", "logical_cpus")})
    for stage_file in bundle.glob("trial-*/trace.jsonl"):
        records = [json.loads(line) for line in stage_file.read_text().splitlines() if line.strip()]
        header = records.pop(0)
        frames = records if header.get("type") == "header" else [header, *records]
        origin = frames[0]["t"] if frames else 0
        ids = {}
        def anonymize(pid):
            if pid not in ids:
                ids[pid] = len(ids) + 1
            return ids[pid]
        target = out / stage_file.parent.name / "trace.jsonl"
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", encoding="utf-8") as stream:
            stream.write(json.dumps({"type": "header", "version": 1, "protocol": 1, "started": 0,
                                    "timestamps": "relative seconds", "machine": {"os": machine.get("os")}}) + "\n")
            for frame in frames:
                procs = []
                for proc in frame.get("procs", []):
                    pid = anonymize(proc["pid"])
                    procs.append({"pid": pid, "name": f"process-{pid}", **{key: proc.get(key) for key in (
                        "dedicated_mb", "shared_mb", "committed_mb", "private_mb", "baseline_shared_mb", "spill_mb", "ratio", "state")}})
                adapter = {key: frame["adapter"].get(key) for key in (
                    "name", "vram_total_mb", "budget_mb", "budget_scope", "shared_cap_mb", "dedicated_mb", "shared_mb", "load", "state", "nvml")}
                adapter["luid"] = "adapter-1"
                summary = frame.get("summary", {})
                sanitized = {"t": frame["t"] - origin, "adapter": adapter,
                    "system": {key: frame.get("system", {}).get(key) for key in (
                        "commit_mb", "commit_limit_mb", "commit_pct", "avail_mb", "pages_per_sec", "pagefile_pct", "ram_pressure")},
                    "procs": procs, "events": [], "ollama": None,
                    "summary": {"state": summary.get("state", "OK"), "total_spill_mb": summary.get("total_spill_mb", 0),
                                "episodes": summary.get("episodes", 0), "spilling": [
                        {"pid": anonymize(p["pid"]), "name": f"process-{anonymize(p['pid'])}",
                         "spill_mb": p.get("spill_mb"), "ratio": p.get("ratio")} for p in summary.get("spilling", [])]}}
                stream.write(json.dumps(sanitized, allow_nan=False) + "\n")
    copied = 0
    snapshot = bundle / "source"
    for source in snapshot.rglob("*") if snapshot.exists() else []:
        if source.is_file() and not source.is_symlink() and (source.suffix == ".py" or source.name == "requirements.txt"):
            relative = source.relative_to(snapshot)
            recorded = report["metadata"].get("source_sha256", {}).get(relative.as_posix())
            if not recorded or hashlib.sha256(source.read_bytes()).hexdigest() != recorded:
                raise ValueError("recorded source snapshot is incomplete or modified")
            target = out / "source" / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            copied += 1
    if snapshot.exists() and copied != len(report["metadata"].get("source_sha256", {})):
        raise ValueError("source snapshot is incomplete; do not publish this as a runnable package")
    (out / "REPLICATION.md").write_text(
        "# Local replication package\n\nNo publication has occurred. Review before sharing.\n\n"
        "Model binaries and runtime dependencies are excluded. Install requirements in source/agent/requirements.txt "
        "with an appropriate local Python environment and the documented Windows/NVIDIA driver setup. "
        "The source snapshot records the experiment implementation, when present.\n\n"
        "For a redacted prompt, provide the exact original UTF-8 text locally and check its SHA-256. "
        "Replace only that placeholder in recipe-template.json, validate it with SpillGuard Repro, then run into a new directory. "
        "A substituted prompt is a different experiment.\n\n"
        "Report/trace identity fields are scrubbed with a field allowlist. Timestamps are relative, "
        "process labels are pseudonyms, and raw events/logs are omitted. This reduces identifying data; "
        "it is not a formal privacy guarantee. Do not use this package as an independent residency oracle.\n", encoding="utf-8")
    manifest = {p.relative_to(out).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in out.rglob("*") if p.is_file()}
    write_json(out / "manifest.json", {"algorithm": "sha256", "files": manifest})
    verify_export(out)
    return {"output": str(out), "source_files": copied, "prompt_included": include_prompt,
            "runnable_after_local_prompt_restore": bool(copied), "uploaded": False}
