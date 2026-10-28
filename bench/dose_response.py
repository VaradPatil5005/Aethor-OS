"""Dose-response pilot: how much VRAM overflow does it take to slow a real local LLM?

The earlier pilots held 128 MiB-1 GiB while the model was already loaded, so the target
never crossed the 6 GiB card's capacity (ratios ~1.02). This experiment instead sizes the
co-tenant from measured headroom:

    holder = physical VRAM - desktop residency - target footprint + planned overflow

and loads the model *after* the holder is resident (cold preparation, holder anchored to
the `pressure` phase, which starts before the target's measured request). Each level is
run by the unchanged SpillGuard Repro runner (baseline -> pressure -> recovery, private
Ollama server, host-RAM guards, conservative classifier). Negative planned overflow is a
built-in control: the same holder and touch cadence, but the model still fits.

Planned overflow is an *estimate* (the target footprint comes from the E3 calibration);
the realized cliff location is the measured result.

  agent/.venv/Scripts/python.exe bench/dose_response.py --levels=-512,0,256,512 --repeats 2
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "agent"))

from spillguard.collector import Collector  # noqa: E402
from spillguard.repro.runner import run_experiment  # noqa: E402
from spillguard.repro.spec import Recipe  # noqa: E402

MIB = 1024 * 1024
TEMPLATE = REPO / "bench" / "recipes" / "ollama-qwen25-smoke-1536mib.json"


def desktop_residency_mib() -> tuple[int, int, str]:
    """Physical VRAM and current adapter-wide dedicated residency, from DXGI + PDH."""
    c = Collector(use_ollama=False)
    try:
        time.sleep(0.5)
        s = c.sample()
        return c.primary.dedicated_vram_mb, s["adapter"]["dedicated_mb"], c.primary.name
    finally:
        c.close()


def build_recipe(level_mib: int, holder_mib: int, args) -> Recipe:
    base = json.loads(TEMPLATE.read_text(encoding="utf-8"))
    base["name"] = f"dose-{'plus' if level_mib >= 0 else 'minus'}{abs(level_mib)}mib"
    base["workload"]["num_ctx"] = args.ctx
    base["workload"]["num_predict"] = args.predict
    duration_ms = min(120000, args.timeout * 1000)
    base["actions"] = [{
        "id": "coresident",
        "allocated_bytes": holder_mib * MIB,
        "start_ms": 0,
        "duration_ms": duration_ms,
        "touch_interval_ms": args.touch_ms,
        "phase": "pressure",  # resident before the model loads
    }]
    base["protocol"].update({
        "repeats": args.repeats,
        "preparation": "cold",
        "lead_in_ms": args.lead_in_ms,
        "timeout_s": args.timeout,
        "max_requested_bytes": holder_mib * MIB,
        # min_available_host_bytes is left at the template's value: the guard is not relaxed.
    })
    return Recipe.from_dict(base)


def stage_metrics(stage: dict) -> dict:
    stats = stage.get("server_statistics") or {}
    after = stage.get("model_after") or {}
    return {
        "ms_per_token": stage.get("metric_value"),
        "load_ms": (stats.get("load_duration") or 0) / 1e6 or None,
        "size_mib": (after.get("size") or 0) // MIB or None,
        "size_vram_mib": (after.get("size_vram") or 0) // MIB or None,
        "errors": stage.get("errors", [])[:3],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--levels", default="-512,0,256,512", help="planned overflow in MiB (negative = still fits)")
    ap.add_argument("--target-mib", type=int, default=2421,
                    help="target footprint (default: E3 calibration, qwen2.5:3b-instruct, ctx 2048, measured 2026-10-09)")
    ap.add_argument("--ctx", type=int, default=2048)
    ap.add_argument("--predict", type=int, default=128)
    ap.add_argument("--repeats", type=int, default=2)
    ap.add_argument("--touch-ms", type=int, default=250, help="holder touch cadence; 0 = touch once, then idle")
    ap.add_argument("--lead-in-ms", type=int, default=4000)
    ap.add_argument("--timeout", type=int, default=150)
    ap.add_argument("--out", default=None)
    ap.add_argument("--dry-run", action="store_true", help="print the plan without running anything")
    a = ap.parse_args()

    vram, desktop, gpu = desktop_residency_mib()
    out = Path(a.out or REPO / "traces" / "repro" / f"{time.strftime('%Y%m%d-%H%M')}-dose-response").resolve()
    plan = []
    for level in [int(x) for x in a.levels.split(",")]:
        holder = vram - desktop - a.target_mib + level
        if holder < 64:
            raise SystemExit(f"level {level}: holder would be {holder} MiB; target does not leave headroom")
        plan.append((level, holder))
    print(f"{gpu}: {vram} MiB physical, {desktop} MiB resident now, target estimate {a.target_mib} MiB")
    for level, holder in plan:
        print(f"  planned overflow {level:+5d} MiB -> co-resident holder {holder} MiB (touch every {a.touch_ms} ms)")
    if a.dry_run:
        return 0

    # Re-running into the same folder resumes: sealed levels are reused, never overwritten.
    out.mkdir(parents=True, exist_ok=True)
    summary = {"gpu": gpu, "physical_vram_mib": vram, "desktop_resident_mib_at_start": desktop,
               "target_estimate_mib": a.target_mib, "touch_interval_ms": a.touch_ms,
               "ctx": a.ctx, "num_predict": a.predict, "repeats": a.repeats, "levels": []}
    for level, holder in plan:
        recipe = build_recipe(level, holder, a)
        bundle = out / recipe.name
        print(f"\n=== planned overflow {level:+d} MiB (holder {holder} MiB) ===", flush=True)
        if (bundle / "report.json").exists():
            report = json.loads((bundle / "report.json").read_text(encoding="utf-8"))
            sealed = json.loads((bundle / "recipe.json").read_text(encoding="utf-8"))
            holder = sum(x["allocated_bytes"] for x in sealed["actions"]) // MIB  # the size it actually used
            print(f"  reusing sealed bundle (holder {holder} MiB)", flush=True)
        else:
            try:
                report = run_experiment(recipe, bundle, purpose="dose-response pilot")
            except Exception as exc:  # keep going; the bundle is sealed as inconclusive
                print(f"  run error: {exc!r}")
                report = json.loads((bundle / "report.json").read_text()) if (bundle / "report.json").exists() else {}
        trials = []
        for t in report.get("trials", []):
            stages = {s["stage"]: stage_metrics(s) for s in t["stages"]}
            trials.append({"trial": t["trial"], "verdict": t["verdict"], **stages})
        row = {"planned_overflow_mib": level, "holder_mib": holder, "bundle": str(bundle.relative_to(REPO)),
               "complete": report.get("complete"), "stopped_reason": report.get("metadata", {}).get("stopped_reason"),
               "trials": trials}
        summary["levels"].append(row)
        (out / "summary.json").write_text(json.dumps(summary, indent=1), encoding="utf-8")
        for t in trials:
            v = t["verdict"]
            print(f"  trial {t['trial']}: {v['outcome']:<12} slowdown={v.get('slowdown')} recovery={v.get('recovery')}  ({v['reason']})")

    print(f"\nsummary: {out / 'summary.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
