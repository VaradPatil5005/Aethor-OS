"""Predeclared bounded pilot. Run each planned level once; retain all invalid outcomes.

This is calibration/integration data, separate from a final fixed-size study.
Never silently lower guards, retry a level until favorable, or overwrite evidence.
"""
from dataclasses import replace
from pathlib import Path
import argparse
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agent"))
from spillguard.repro.spec import Action, MIB, Recipe
from spillguard.repro.evidence import write_json
from spillguard.repro.runner import run_experiment


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recipe", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--levels-mib", type=int, nargs="+", default=[128, 1024, 2048, 3072, 4096])
    args = parser.parse_args()
    base = Recipe.load(args.recipe)
    if len(set(args.levels_mib)) != len(args.levels_mib):
        parser.error("pilot levels must be unique")
    recipes = []
    for level in args.levels_mib:
        recipe = replace(base, name=f"pilot-{level}mib", actions=(Action("holder", level * MIB,
                         duration_ms=30000, phase="decode", touch_interval_ms=250),),
                         protocol=replace(base.protocol, repeats=1, max_requested_bytes=4096 * MIB),
                         workload=replace(base.workload, num_predict=512))
        recipes.append(recipe)
    args.out.mkdir(parents=True, exist_ok=False)
    write_json(args.out / "plan.json", {"purpose": "calibration pilot; not final study", "retries": 0,
               "recipes": [r.to_dict() for r in recipes], "order": "ascending resource exposure for bounded calibration"})
    outcomes = []
    for index, recipe in enumerate(recipes):
        report = run_experiment(recipe, args.out / f"level-{args.levels_mib[index]}mib", purpose="calibration")
        outcomes.append({"level_mib": args.levels_mib[index], "verdict": report["verdict"],
                         "bundle": f"level-{args.levels_mib[index]}mib"})
        write_json(args.out / "outcomes.json", outcomes)
        print(json.dumps(outcomes[-1]), flush=True)
        stages = [s for t in report["trials"] for s in t["stages"]]
        if any(any("host memory floor" in e or "host commit pressure" in e for e in s["errors"]) for s in stages):
            write_json(args.out / "stopped.json", {"reason": "resource guard; higher levels not executed",
                       "unexecuted_levels_mib": args.levels_mib[index + 1:]})
            break


if __name__ == "__main__":
    main()
