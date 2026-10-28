"""Evaluate W1 runs: E1 cost of spill, E2 detection latency / false positives, E5 overhead,
plus a threshold sweep for calibration (Phase 2).

Ground truth is independent of the detector's input: spillstress measures write bandwidth
for every block after warming the GPU, and blocks the driver placed in system memory are
an order of magnitude slower. Onset = allocation time of the first block of the trailing
run of slow blocks. A fallback-OFF run that ends in OOM is a negative (no spill possible).

  python bench/evaluate.py traces/w1/*.trace.jsonl
"""
from __future__ import annotations

import argparse
import itertools
import json
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "agent"))
from spillguard.analyzer import Params, analyze_frames  # noqa: E402
from spillguard.trace import read_trace  # noqa: E402

RESULTS = Path(__file__).resolve().parent / "results"


def truth_for(trace: Path) -> dict:
    tp = Path(str(trace).replace(".trace.jsonl", ".truth.jsonl"))
    recs = [json.loads(l) for l in tp.read_text().splitlines() if l.strip()]
    start = recs[0]
    allocs = [r for r in recs if r["ev"] == "ALLOC"]
    bw = next((r["per_block_gbps"] for r in recs if r["ev"] == "BANDWIDTH"), None)
    oom = any(r["ev"] == "OOM" for r in recs)
    out = {"pid": start["pid"], "oom": oom, "spilled": False, "onset": None, "bw": bw,
           "allocated_mb": allocs[-1]["allocated_mb"] if allocs else 0}
    if bw:
        fast = sorted(bw)[len(bw) // 2:]
        resident_bw = statistics.median(fast)
        slow = [g < 0.3 * resident_bw for g in bw]
        i = len(slow)
        while i > 0 and slow[i - 1]:
            i -= 1
        if i < len(slow):
            out.update(spilled=True, onset=allocs[i]["t"], first_spilled_block=i,
                       spilled_mb=(len(slow) - i) * start["block_mb"],
                       resident_gbps=round(resident_bw, 1),
                       spilled_gbps=round(statistics.median([g for g, s in zip(bw, slow) if s]), 1))
    return out


def detect(frames: list[dict], truth: dict, p: Params) -> dict:
    out = analyze_frames(frames, p)
    starts = [e for f in out for e in f["events"] if e["type"] == "SPILL_START"]
    mine = [e for e in starts if e["pid"] == truth["pid"]]
    others = [e for e in starts if e["pid"] != truth["pid"]]
    early = [e for e in mine if truth["onset"] and e["t"] < truth["onset"] - 0.5]
    r = {"detected": bool(mine), "false_positives": len(others) + len(early), "latency_s": None}
    if truth["spilled"] and mine:
        good = [e for e in mine if e["t"] >= truth["onset"] - 0.5]
        if good:
            r["latency_s"] = round(good[0]["t"] - truth["onset"], 2)
    return r


def mean_sd(xs):
    xs = [x for x in xs if x is not None]
    if not xs:
        return None
    return {"mean": round(statistics.mean(xs), 2), "sd": round(statistics.stdev(xs), 2) if len(xs) > 1 else 0.0, "n": len(xs)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("traces", nargs="+")
    a = ap.parse_args()
    runs = []
    for t in a.traces:
        _, fr = read_trace(t)
        frames = list(fr)
        runs.append((Path(t).name, frames, truth_for(Path(t))))

    default = Params()
    per_run = []
    for name, frames, truth in runs:
        d = detect(frames, truth, default)
        cpu = [f["agent"]["cpu_pct"] for f in frames if f.get("agent")]
        rss = [f["agent"]["rss_mb"] for f in frames if f.get("agent")]
        per_run.append({"run": name, "spilled": truth["spilled"], "oom": truth["oom"],
                        "first_spilled_block": truth.get("first_spilled_block"),
                        "spilled_mb": truth.get("spilled_mb"), "resident_gbps": truth.get("resident_gbps"),
                        "spilled_gbps": truth.get("spilled_gbps"), **d,
                        "agent_cpu_mean": round(statistics.mean(cpu), 2) if cpu else None,
                        "agent_cpu_p95": round(sorted(cpu)[int(0.95 * (len(cpu) - 1))], 2) if cpu else None,
                        "agent_rss_mb": max(rss) if rss else None})
    for r in per_run:
        print(json.dumps(r))

    pos = [r for r in per_run if r["spilled"]]
    neg = [r for r in per_run if not r["spilled"]]
    tp = sum(r["detected"] for r in pos)
    fp_runs = sum(r["detected"] for r in neg)
    summary = {
        "params": default.to_dict(),
        "E1_resident_gbps": mean_sd([r["resident_gbps"] for r in pos]),
        "E1_spilled_gbps": mean_sd([r["spilled_gbps"] for r in pos]),
        "E1_slowdown_x": mean_sd([r["resident_gbps"] / r["spilled_gbps"] for r in pos if r["spilled_gbps"]]),
        "E2_runs": {"positive": len(pos), "negative": len(neg), "true_positive": tp, "false_negative": len(pos) - tp,
                    "false_positive_runs": fp_runs, "false_positive_events": sum(r["false_positives"] for r in per_run)},
        "E2_recall": round(tp / len(pos), 3) if pos else None,
        "E2_latency_s": mean_sd([r["latency_s"] for r in pos]),
        "E5_agent_cpu_pct": mean_sd([r["agent_cpu_mean"] for r in per_run]),
        "E5_agent_cpu_p95": mean_sd([r["agent_cpu_p95"] for r in per_run]),
        "E5_agent_rss_mb": mean_sd([r["agent_rss_mb"] for r in per_run]),
    }

    sweep = []
    for th, d, k in itertools.product([0.85, 0.90, 0.92, 0.95, 0.98], [64, 128, 256, 512], [1, 2, 3]):
        p = Params(theta_hi=th, theta_lo=min(0.85, th - 0.05), delta_mb=d, k=k)
        res = [detect(frames, truth, p) for _, frames, truth in runs]
        lat = [r["latency_s"] for r, (_, _, t) in zip(res, runs) if t["spilled"] and r["latency_s"] is not None]
        sweep.append({"theta_hi": th, "delta_mb": d, "k": k,
                      "recall": round(sum(1 for r, (_, _, t) in zip(res, runs) if t["spilled"] and r["latency_s"] is not None) / max(1, len(pos)), 2),
                      "fp_events": sum(r["false_positives"] for r in res),
                      "latency_mean_s": round(statistics.mean(lat), 2) if lat else None})
    summary["sweep_top"] = sorted([s for s in sweep if s["recall"] == 1.0 and s["fp_events"] == 0],
                                  key=lambda s: (s["latency_mean_s"], -s["delta_mb"], -s["k"]))[:8]
    summary["sweep_failures"] = [s for s in sweep if s["recall"] < 1.0 or s["fp_events"] > 0][:12]

    RESULTS.mkdir(exist_ok=True)
    (RESULTS / "w1_eval.json").write_text(json.dumps({"summary": summary, "runs": per_run, "sweep": sweep}, indent=1))
    print(json.dumps({k: v for k, v in summary.items() if not k.startswith("sweep")}, indent=1))
    print("best (recall 1, no FP, fastest):")
    for s in summary["sweep_top"]:
        print("  ", s)
    print("configs that miss or false-alarm:", len([s for s in sweep if s["recall"] < 1 or s["fp_events"]]), "of", len(sweep))
    return 0


if __name__ == "__main__":
    sys.exit(main())
