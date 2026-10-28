"""Re-evaluate historical W1 traces without calling them new application evidence."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agent"))
from spillguard.analyzer import Params
from spillguard.trace import read_trace
from evaluate import detect, truth_for


def threshold_starts(frames, shared_mb=256, load=.92):
    active, starts = set(), []
    for frame in frames:
        current = {proc["pid"] for proc in frame["procs"] if proc["shared_mb"] > shared_mb
                   and frame["adapter"]["dedicated_mb"] / max(1, frame["adapter"]["vram_total_mb"]) >= load}
        starts.extend({"pid": pid, "t": frame["t"]} for pid in sorted(current - active))
        active = current
    return starts


def main():
    rows = []
    for path in sorted((ROOT / "traces/w1").glob("*.trace.jsonl")):
        _, stream = read_trace(path)
        frames = list(stream)
        truth = truth_for(path)
        starts = threshold_starts(frames)
        mine = [event for event in starts if event["pid"] == truth["pid"]]
        good = [event for event in mine if truth["onset"] is not None and event["t"] >= truth["onset"] - .5]
        rows.append({"trace": path.relative_to(ROOT).as_posix(), "historical_bandwidth_label": truth["spilled"],
            "frame_count": len(frames), "observed_duration_s": frames[-1]["t"] - frames[0]["t"] if frames else 0,
            "existing_heuristic": detect(frames, truth, Params()),
            "fixed_threshold": {"detected": bool(mine),
                "false_positives": sum(event["pid"] != truth["pid"] or not truth["spilled"]
                    or event["t"] < truth["onset"] - .5 for event in starts),
                "latency_s": good[0]["t"] - truth["onset"] if good else None}})
    output = ROOT / "bench/results/historical_detector_comparison_20261016.json"
    with output.open("x", encoding="utf-8") as stream:
        json.dump({"data_origin": "historical W1 replay; not new live measurements", "runs": rows,
            "fixed_threshold": {"shared_mb": 256, "dedicated_load": .92},
            "hypomnesis": {"status": "not evaluated", "reason": "no pinned matched executable/integration available"},
            "limits": "same five exploratory traces, no holdout; bandwidth-derived labels are proxies, not direct residency truth; no ordinary-session false-alarm-per-hour estimate"}, stream, indent=2)
        stream.write("\n")
    print(json.dumps({"historical_runs": len(rows), "new_live_runs": 0, "output": str(output)}))


if __name__ == "__main__":
    main()
