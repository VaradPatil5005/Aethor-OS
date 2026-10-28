"""All-phase engineering workflows. Scientific gates remain evidence requirements."""
import argparse
from dataclasses import replace
import importlib.util
import json
from pathlib import Path
import shutil

from .evidence import write_json
from .spec import Recipe


def main(argv=None):
    parser = argparse.ArgumentParser(prog="spillguard research", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    s = commands.add_parser("search")
    s.add_argument("--recipe", type=Path, required=True)
    s.add_argument("--out", type=Path, required=True)
    s.add_argument("--method", choices=("greedy", "ddmin", "probdd-style", "no-reduction", "exhaustive", "phase-aware"), default="phase-aware")
    s.add_argument("--max-tests", type=int, default=30)
    s.add_argument("--max-executions", type=int, default=30)
    s.add_argument("--max-looks", type=int, default=1)
    s = commands.add_parser("remedy")
    s.add_argument("--recipe", type=Path, required=True)
    s.add_argument("--out", type=Path, required=True)
    s = commands.add_parser("plan")
    s.add_argument("--recipes", nargs="+", type=Path, required=True)
    s.add_argument("--levels-mib", nargs="+", type=int, required=True)
    s.add_argument("--repeats", type=int, default=6)
    s.add_argument("--seed", type=int, default=0)
    s.add_argument("--out", type=Path, required=True)
    s = commands.add_parser("campaign")
    s.add_argument("--plan", type=Path, required=True)
    s.add_argument("--gate", type=Path, required=True)
    s.add_argument("--out", type=Path, required=True)
    s.add_argument("--resume", action="store_true")
    s = commands.add_parser("analyze")
    s.add_argument("--bundles", nargs="+", type=Path, required=True)
    s.add_argument("--out", type=Path, required=True)
    s = commands.add_parser("export")
    s.add_argument("--bundle", type=Path, required=True)
    s.add_argument("--out", type=Path, required=True)
    s.add_argument("--include-prompt", action="store_true")
    s = commands.add_parser("verify-export")
    s.add_argument("directory", type=Path)
    s = commands.add_parser("capabilities")
    s.add_argument("--out", type=Path, required=True)
    for name in ("background", "overhead"):
        s = commands.add_parser(name)
        s.add_argument("--recipe", type=Path, required=True)
        s.add_argument("--out", type=Path, required=True)
        if name == "overhead":
            s.add_argument("--pairs", type=int, default=3)
            s.add_argument("--seed", type=int, default=0)
    s = commands.add_parser("fixture-comparison", help="algorithm plumbing only; never GPU research results")
    s.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "verify-export":
            from .artifact import verify_export
            verify_export(args.directory)
            print("Export integrity verified; authenticity and scientific validity are separate.")
            return 0
        if args.command == "plan":
            from .campaign import build_matrix
            recipes = [replace(Recipe.load(path), name=f"workload-{i + 1}") for i, path in enumerate(args.recipes)]
            plan = build_matrix(recipes, args.levels_mib, repeats=args.repeats, seed=args.seed)
            if args.out.exists():
                raise FileExistsError(args.out)
            args.out.parent.mkdir(parents=True, exist_ok=True)
            write_json(args.out, plan)
            print(json.dumps({"cells": plan["planned_cells"], "whole_blocks": plan["planned_blocks"], "executed": 0}))
            return 0
        if args.command == "analyze":
            from .analysis import summarize_bundles, write_analysis
            summary = summarize_bundles(args.bundles)
            write_analysis(summary, args.out)
            print(f"Saved {len(summary['groups'])} separate purpose/recipe groups -> {args.out}")
            return 0
        if args.command == "export":
            from .artifact import export_bundle
            print(json.dumps(export_bundle(args.bundle, args.out, include_prompt=args.include_prompt), indent=2))
            return 0
        if args.command == "capabilities":
            if args.out.exists():
                raise FileExistsError(args.out)
            tools = {name: shutil.which(name) for name in ("ollama", "wpr", "wpa", "PIXWin", "hypomnesis", "cargo")}
            result = {"tools": tools, "python_modules": {name: importlib.util.find_spec(name) is not None
                      for name in ("win32pdh", "pynvml", "psutil", "httpx", "win32job")},
                      "direct_residency_validation": "not established by tool presence",
                      "hypomnesis_comparator": "not matched/validated"}
            args.out.parent.mkdir(parents=True, exist_ok=True)
            write_json(args.out, result)
            print(json.dumps(result, indent=2))
            return 0
        if args.command == "fixture-comparison":
            from .demo import demo_recipe
            from .evidence import Verdict
            from .search import Observation, reduce_scenario
            from .signature import WitnessSignature
            args.out.mkdir(parents=True, exist_ok=False)
            results = []
            recipe = demo_recipe()
            def oracle(candidate, purpose):
                ids = {a.id for a in candidate.actions}
                slow = {"capacity", "touch"} <= ids
                signature = WitnessSignature("fixture-proxy", "fixture-work", "fixture-environment", ("pressure",),
                                               0, 0, .9, False, 10, "SOFTWARE FIXTURE - NOT GPU MEASUREMENTS")
                return Observation(Verdict("FAIL" if slow else "PASS", "fixture"), signature)
            for method in ("greedy", "ddmin", "probdd-style", "no-reduction", "exhaustive", "phase-aware"):
                result = reduce_scenario(recipe, oracle, method=method, max_tests=40, transforms=("delete",))
                write_json(args.out / f"{method}.json", result)
                results.append({"method": method, "actions": len(result["reduced_recipe"]["actions"]),
                                "calls": result["executed_tests"], "one_minimal": result["one_minimal"]})
            write_json(args.out / "comparison.json", {"data_origin": "SOFTWARE FIXTURE - NOT GPU MEASUREMENTS", "methods": results})
            print(json.dumps(results, indent=2))
            return 0
        from .runner import run_experiment
        if args.command == "campaign":
            from .campaign import execute_plan
            print(json.dumps(execute_plan(args.plan, args.out, run_experiment, gate_path=args.gate, resume=args.resume)))
            return 0
        recipe = Recipe.load(args.recipe)
        if args.command == "background":
            from .background import run_background
            result = run_background(recipe, args.out)
            print(json.dumps({"completed": result["completed"], "elapsed_s": result["elapsed_s"], "errors": result["errors"]}))
            return 0 if result["completed"] else 2
        if args.command == "overhead":
            from .overhead import measure_overhead
            result = measure_overhead(recipe, args.out, args.pairs, args.seed)
            print(json.dumps({"status": result["status"], "paired_workload_ratios": result.get("paired_workload_ratios")}))
            return 0 if result["status"] == "measured" else 2
        if args.command == "remedy":
            from .workflows import remedy_workflow
            result = remedy_workflow(recipe, args.out, run_experiment)
            print(json.dumps({"status": result["status"]}))
            return 0 if result["status"] == "evaluated" else 2
        from .workflows import search_workflow
        result = search_workflow(recipe, args.out, run_experiment, method=args.method, max_tests=args.max_tests,
                                 max_executions=args.max_executions, max_looks=args.max_looks)
        print(json.dumps({key: result[key] for key in ("method", "one_minimal", "executed_tests", "physical_execution_count", "fresh_validation")}))
        return 0 if result["fresh_validation"] and result["fresh_validation"]["outcome"] == "FAIL" else 2
    except KeyboardInterrupt:
        print("Research workflow interrupted; completed bundles/checkpoints are preserved.")
        return 130
    except Exception as exc:
        print(f"SpillGuard research: {exc}")
        return 2
