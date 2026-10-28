"""Local experimental CLI; no lab execution is exposed through the HTTP server."""
from __future__ import annotations

import argparse
from dataclasses import asdict
import hashlib
import json
from pathlib import Path

from .evidence import Verdict, verify_bundle, write_json
from .spec import Action, MIB, OllamaWorkload, Protocol, Recipe


def main(argv=None):
    ap = argparse.ArgumentParser(prog="spillguard repro", description=__doc__)
    sub = ap.add_subparsers(dest="command", required=True)
    validate = sub.add_parser("validate", help="check a recipe without using the GPU")
    validate.add_argument("recipe", type=Path)
    verify = sub.add_parser("verify", help="verify bundle integrity (not scientific validity)")
    verify.add_argument("bundle", type=Path)
    preflight = sub.add_parser("preflight", help="read-only telemetry/capability check")
    preflight.add_argument("--recipe", type=Path, required=True)
    freeze = sub.add_parser("freeze-ollama", help="pin an already-installed model and prompt; no inference or download")
    freeze.add_argument("--model", required=True)
    freeze.add_argument("--prompt-file", required=True, type=Path)
    freeze.add_argument("--out", required=True, type=Path)
    freeze.add_argument("--num-ctx", type=int, default=2048)
    freeze.add_argument("--num-predict", type=int, default=128)
    freeze.add_argument("--repeats", type=int, default=1)
    freeze.add_argument("--pressure-mib", type=int, default=128)
    freeze.add_argument("--min-host-mib", type=int, default=2048, help="explicit available-RAM floor; default 2048 MiB")
    freeze.add_argument("--phase", choices=("pressure", "request", "decode"), default="decode")
    for name in ("run", "reduce"):
        s = sub.add_parser(name, help="run bounded owned CUDA helpers" if name == "run" else "plain action-deletion ddmin")
        s.add_argument("--recipe", type=Path, required=True)
        s.add_argument("--out", type=Path, required=True)
        if name == "reduce":
            s.add_argument("--max-tests", type=int, default=12, help="candidate blocks INCLUDING fresh validation")
    demo = sub.add_parser("demo", help="exercise bundles and reduction with a labelled software fixture; no GPU")
    demo.add_argument("--out", type=Path, required=True)
    args = ap.parse_args(argv)
    try:
        if args.command == "verify":
            verify_bundle(args.bundle)
            print("Bundle integrity verified. This does not establish a failure mechanism or reproduction rate.")
            return 0
        if args.command == "demo":
            from .demo import demo_recipe, run_fixture
            return _reduce(demo_recipe(), args.out, 30, run_fixture)
        if args.command == "freeze-ollama":
            from .ollama import local_model
            frozen = local_model(args.model)
            prompt = args.prompt_file.read_text(encoding="utf-8-sig")
            workload = OllamaWorkload(model=args.model, model_digest=frozen["model_digest"],
                                      model_blob_digest=frozen["model_blob_digest"], prompt=prompt,
                                      prompt_sha256=hashlib.sha256(prompt.encode("utf-8")).hexdigest(),
                                      num_ctx=args.num_ctx, num_predict=args.num_predict)
            recipe = Recipe("ollama-decode-pilot", (Action("holder", args.pressure_mib * MIB,
                            duration_ms=15000, phase=args.phase),), workload=workload,
                            protocol=Protocol(repeats=args.repeats, timeout_s=90,
                                              min_available_host_bytes=args.min_host_mib * MIB))
            args.out.parent.mkdir(parents=True, exist_ok=True)
            with args.out.open("x", encoding="utf-8") as stream:
                json.dump(recipe.to_dict(), stream, indent=2)
                stream.write("\n")
            print(f"Frozen installed model, verified layer hashes and prompt -> {args.out}")
            return 0
        recipe = Recipe.load(args.recipe)
        if args.command == "validate":
            print(json.dumps({"valid": True, "signature": recipe.signature,
                              "synthetic_workload": recipe.workload.kind == "cuda_probe",
                              "primary_metric": recipe.workload.primary_metric,
                              "actions": len(recipe.actions),
                              "requested_bytes": sum(a.allocated_bytes for a in recipe.actions),
                              "planned_matched_blocks": recipe.protocol.repeats}, indent=2))
            return 0
        if args.command == "preflight":
            installed = None
            if recipe.workload.kind == "ollama":
                from .ollama import verify_model
                installed = verify_model(recipe.workload)
            from .observer import Observer
            observer = Observer()
            try:
                _, observation = observer.sample({})
                available = observation["available_host_bytes"]
                commit_pct = observation["host_commit_pct"]
                capable = (not observation["errors"] and available is not None and
                           available >= recipe.protocol.min_available_host_bytes and
                           commit_pct is not None and commit_pct < 90)
                print(json.dumps({"telemetry_ready": capable, "machine": observer.facts,
                                  "installed_model": installed,
                                  "observation": observation,
                                  "notes": "Read-only. CUDA allocations, helper cleanup and failure reproduction are not tested."}, indent=2))
                return 0 if capable else 2
            finally:
                observer.close()
        from .runner import run_experiment
        if args.command == "run":
            report = run_experiment(recipe, args.out)
            print(json.dumps(report["verdict"]))
            return {"FAIL": 0, "PASS": 1, "INCONCLUSIVE": 2}[report["verdict"]["outcome"]]
        return _reduce(recipe, args.out, args.max_tests, run_experiment)
    except KeyboardInterrupt:
        print("Experiment interrupted; completed evidence was preserved.")
        return 130
    except Exception as exc:
        print(f"SpillGuard Repro: {exc}")
        return 2


def _reduce(recipe, out, max_tests, backend):
    from .reducer import reduce_actions
    if max_tests < 2:
        raise ValueError("max-tests must be at least two")
    out.mkdir(parents=True, exist_ok=False)
    write_json(out / "original-recipe.json", recipe.to_dict())
    calls, environment = [], None

    def oracle(candidate, purpose):
        nonlocal environment
        folder = out / f"{len(calls) + 1:03d}-{purpose}"
        report = backend(candidate, folder, purpose=purpose)
        env = report["metadata"].get("environment_signature")
        signature = (env, report["metadata"].get("source_sha256")) if env else None
        if not calls:
            environment = signature
        verdict = Verdict(**report["verdict"])
        if not signature or signature != environment:
            verdict = Verdict("INCONCLUSIVE", "environment changed across reduction blocks")
        calls.append({"purpose": purpose, "bundle": folder.name, "verdict": asdict(verdict)})
        write_json(out / "calls.json", calls)
        return verdict

    reduction = reduce_actions(recipe, oracle, max_tests)
    write_json(out / "reduction.json", reduction.to_dict())
    write_json(out / "reduced-recipe.json", reduction.recipe.to_dict())
    print(json.dumps({"method": "plain ddmin baseline", "actions_before": len(recipe.actions),
                      "actions_after": len(reduction.recipe.actions), "one_minimal": reduction.one_minimal,
                      "fresh_validation": asdict(reduction.validation) if reduction.validation else None,
                      "stop_reason": reduction.stop_reason, "bundles": len(calls)}, indent=2))
    return 0 if reduction.validation and reduction.validation.outcome == "FAIL" else 2
