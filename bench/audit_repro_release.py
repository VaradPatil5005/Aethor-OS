"""Read-only evidence/cleanup audit. Does not kill or inspect process command lines."""
import hashlib
import json
from pathlib import Path
import sys

import psutil

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agent"))
from spillguard.repro.evidence import verify_bundle, write_json


def audit(directory):
    verify_bundle(directory)
    report = json.loads((directory / "report.json").read_text())
    identities, event_identities = set(), {}
    for trial in report["trials"]:
        for stage in trial["stages"]:
            for mapping in (stage.get("process_identities", {}), stage.get("server_cleanup", {}).get("job_owned_identities", {})):
                identities.update((int(pid), birth) for pid, birth in mapping.items())
            for child in stage.get("owned_helper_cleanup", []):
                if child["pid"] is not None and child["process_start_time"] is not None:
                    identities.add((child["pid"], child["process_start_time"]))
            assert not stage.get("server_cleanup", {}).get("remaining_owned_pids", [])
    # Older helpers could fail warmup before READY. Preserve the weaker distinction:
    # an event PID's process may be absent or born after the event; no exact birth
    # identity is invented for these historical records.
    for path in directory.glob("trial-*/*.jsonl"):
        if path.name not in ("target.jsonl", "pressure.jsonl"):
            continue
        for line in path.read_text().splitlines():
            event = json.loads(line)
            if event.get("pid") and event.get("wall_time_ns"):
                event_identities[event["pid"]] = max(event_identities.get(event["pid"], 0), event["wall_time_ns"] / 1e9)
    exact, event_checked = 0, 0
    for pid, birth in identities:
        try:
            if psutil.Process(pid).create_time() == birth:
                raise RuntimeError(f"recorded owned identity remains alive: {pid}")
        except psutil.NoSuchProcess:
            pass
        exact += 1
    for pid, event_time in event_identities.items():
        try:
            if psutil.Process(pid).create_time() <= event_time:
                raise RuntimeError(f"event-referenced helper may remain alive: {pid}")
        except psutil.NoSuchProcess:
            pass
        event_checked += 1
    for name, digest in report["metadata"].get("source_sha256", {}).items():
        source = directory / "source" / name
        if (directory / "source").exists():
            assert hashlib.sha256(source.read_bytes()).hexdigest() == digest
    return {"bundle": directory.relative_to(ROOT).as_posix(), "report_sha256": hashlib.sha256((directory / "report.json").read_bytes()).hexdigest(),
            "integrity": "verified", "verdict": report["verdict"], "complete": report["complete"],
            "exact_owned_identities_confirmed_exited": exact, "event_pid_checks_absent_or_reused": event_checked,
            "source_files": len(report["metadata"].get("source_sha256", {})),
            "errors": [error for trial in report["trials"] for stage in trial["stages"] for error in stage["errors"]]}


def main():
    names = ["20261016-ollama-smoke-1536mib", "20261016-calibration-pilot/level-128mib",
             "20261016-calibration-pilot/level-1024mib", "20261016-frozen-source-cuda", "20261016-qwen3vl-text-smoke"]
    if (ROOT / "traces/repro/20261017-release-cuda").exists():
        names.append("20261017-release-cuda")
    results = [audit(ROOT / "traces/repro" / name) for name in names]
    target = ROOT / "bench/results/research_cleanup_audit_20261017.json"
    if target.exists():
        raise FileExistsError("preserve previous audit")
    write_json(target, {"date": "2026-10-17", "bundles": results,
               "limits": "read-only PID/birth and event-time checks; historical missing exact birth identities remain explicitly weaker"})
    print(json.dumps({"bundles_verified": len(results), "exact_identities_confirmed_exited": sum(r["exact_owned_identities_confirmed_exited"] for r in results),
                      "event_pid_checks": sum(r["event_pid_checks_absent_or_reused"] for r in results), "output": str(target)}))


if __name__ == "__main__":
    main()
