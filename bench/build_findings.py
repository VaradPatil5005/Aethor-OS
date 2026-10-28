"""Merge measured runs into one findings file for the AetherOS evidence desk.

Inputs (all measured, unchanged): a dose-response summary, an optional idle-co-tenant
summary, and their sealed bundles (for the detector comparison). Output: a single JSON
the browser can show offline. No numbers are computed here except counts and ratios
copied from the sealed verdicts.

  python bench/build_findings.py --dose traces/repro/20261018-dose-response \
      --idle traces/repro/20261018-idle-cotenant --out public/traces/demo-dose-response.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def detector_rows(run_dir: Path, touch_ms: int) -> list[dict]:
    """Did the original counter-based detector raise SPILL_START during each pressure stage?"""
    rows = []
    for bundle in sorted(run_dir.glob("dose-*")):
        report = json.loads((bundle / "report.json").read_text(encoding="utf-8"))
        for trial in report.get("trials", []):
            v = trial["verdict"]
            trace = bundle / f"trial-{trial['trial']:03d}-pressure" / "trace.jsonl"
            alarm = None
            if trace.exists():
                lines = trace.read_text(encoding="utf-8").splitlines()[1:]
                alarm = any(e.get("type") == "SPILL_START" for l in lines for e in json.loads(l).get("events", []))
            rows.append({"level": bundle.name, "touch_interval_ms": touch_ms, "trial": trial["trial"],
                         "outcome": v["outcome"], "slowdown": v.get("slowdown"), "detector_alarm": alarm})
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dose", required=True)
    ap.add_argument("--idle", default=None)
    ap.add_argument("--remedy", default=None, help="remedy study folder (remedy.json)")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    dose_dir = (REPO / a.dose).resolve()
    data = json.loads((dose_dir / "summary.json").read_text(encoding="utf-8"))
    rows = detector_rows(dose_dir, data["touch_interval_ms"])
    if a.idle:
        idle_dir = (REPO / a.idle).resolve()
        idle = json.loads((idle_dir / "summary.json").read_text(encoding="utf-8"))
        data["idle"] = {"touch_interval_ms": idle["touch_interval_ms"], "levels": idle["levels"]}
        rows += detector_rows(idle_dir, idle["touch_interval_ms"])
    valid = [r for r in rows if r["outcome"] in ("FAIL", "PASS") and r["detector_alarm"] is not None]
    data["detector"] = {
        "name": "SpillGuard counter detector (PDH, hysteresis)",
        "rows": rows,
        "true_positive": sum(r["outcome"] == "FAIL" and r["detector_alarm"] for r in valid),
        "false_positive": sum(r["outcome"] == "PASS" and r["detector_alarm"] for r in valid),
        "false_negative": sum(r["outcome"] == "FAIL" and not r["detector_alarm"] for r in valid),
        "true_negative": sum(r["outcome"] == "PASS" and not r["detector_alarm"] for r in valid),
        "valid_trials": len(valid),
    }
    if a.remedy:
        rem_dir = (REPO / a.remedy).resolve()
        rem = json.loads((rem_dir / "remedy.json").read_text(encoding="utf-8"))
        witness = json.loads((rem_dir / "original-validation" / "recipe.json").read_text(encoding="utf-8"))
        witness_mib = sum(x["allocated_bytes"] for x in witness["actions"]) // (1024 * 1024)

        def ratios(r):
            if r.get("target_ratio"):
                return r["target_ratio"]
            report = json.loads((rem_dir / r["bundle"] / "report.json").read_text(encoding="utf-8"))
            return [t["verdict"].get("slowdown") for t in report["trials"] if t["verdict"].get("slowdown") is not None]

        data["remedy"] = {"status": rem["status"], "rows": [
            {"intervention": r["intervention"], "outcome": r["verdict"]["outcome"], "slowdown": r["verdict"].get("slowdown"),
             "trial_ratios": ratios(r),
             "cotenant_mib": witness_mib if r["intervention"] == "original" else (r.get("requested_bytes") or 0) // (1024 * 1024),
             "operation": r.get("operation", "fresh re-validation of the original witness")} for r in rem["reports"]]}
    data["data_origin"] = "live measurement, one laptop, pilot sample sizes"
    out = (REPO / a.out).resolve()
    out.write_text(json.dumps(data, indent=1), encoding="utf-8")
    d = data["detector"]
    print(f"wrote {out}: {len(data['levels'])} active levels, {len(data.get('idle', {}).get('levels', []))} idle levels; "
          f"detector TP {d['true_positive']} FP {d['false_positive']} FN {d['false_negative']} TN {d['true_negative']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
