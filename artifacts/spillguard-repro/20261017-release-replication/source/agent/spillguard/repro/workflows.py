"""Concrete search/validation/remedy workflows, keeping every expensive execution."""
from dataclasses import asdict
import json
from pathlib import Path
import time

from .evidence import Verdict, write_json
from .search import Observation, reduce_scenario
from .signature import extract_signature
from .spec import Recipe
from .statistics import trial_decision


class BundleOracle:
    def __init__(self, out, backend, *, max_executions=40, max_looks=1, threshold=.5):
        if not 1 <= max_looks <= 10 or max_executions < 2 * max_looks:
            raise ValueError("execution budget must reserve original and fresh validation look budgets")
        self.out, self.backend = Path(out), backend
        self.out.mkdir(parents=True, exist_ok=False)
        self.max_executions, self.max_looks, self.threshold = max_executions, max_looks, threshold
        self.calls, self.environment = [], None

    def __call__(self, recipe, purpose):
        outcomes, signature, last = [], None, None
        for look in range(self.max_looks):
            reserve = self.max_looks if purpose == "search" else 0
            if len(self.calls) >= self.max_executions - reserve:
                return Observation(Verdict("INCONCLUSIVE", "physical execution budget exhausted"), signature, last)
            directory = self.out / f"{len(self.calls) + 1:04d}-{purpose}"
            started = time.monotonic()
            report = self.backend(recipe, directory, purpose=purpose)
            environment = (report["metadata"].get("environment_signature"), report["metadata"].get("source_sha256"))
            if self.environment is None:
                self.environment = environment
            outcomes.extend(t["verdict"]["outcome"] for t in report["trials"])
            last = directory.name
            observed = extract_signature(directory) if any(t["verdict"]["outcome"] == "FAIL" for t in report["trials"]) else None
            if signature is None:
                signature = observed
            elif observed is not None:
                from .signature import compare_signatures
                if not compare_signatures(signature, observed)[0]:
                    outcomes.append("INCONCLUSIVE")
            if self.max_looks == 1:
                verdict = Verdict(**report["verdict"])
                decision = {"outcome": verdict.outcome, "policy": "strict fixed-size block"}
            else:
                decision = trial_decision(outcomes, max_looks=self.max_looks, threshold=self.threshold)
                verdict = Verdict(decision["outcome"], "declared bounded-look binomial decision")
            if not environment[0] or environment != self.environment:
                verdict = Verdict("INCONCLUSIVE", "environment/implementation changed across executions")
            self.calls.append({"purpose": purpose, "look": look + 1, "bundle": directory.name,
                               "data_origin": report["data_origin"],
                               "recipe_signature": recipe.signature, "raw_verdict": report["verdict"],
                               "decision": decision, "effective_verdict": asdict(verdict),
                               "elapsed_s": time.monotonic() - started})
            write_json(self.out / "calls.json", self.calls)
            if verdict.outcome != "INCONCLUSIVE" or any(o == "INCONCLUSIVE" for o in outcomes):
                return Observation(verdict, signature, last)
        return Observation(verdict, signature, last)


def search_workflow(recipe, out, backend, *, method="phase-aware", max_tests=40,
                    max_executions=40, max_looks=1):
    oracle = BundleOracle(out, backend, max_executions=max_executions, max_looks=max_looks)
    write_json(Path(out) / "original-recipe.json", recipe.to_dict())
    result = reduce_scenario(recipe, oracle, method=method, max_tests=max_tests)
    result["physical_execution_count"] = len(oracle.calls)
    origins = {call["data_origin"] for call in oracle.calls}
    result["data_origin"] = next(iter(origins)) if len(origins) == 1 else "mixed or unspecified origins; inspect calls"
    result["uncertainty_policy"] = {"max_looks": max_looks, "max_executions": max_executions,
                                     "alpha": .05, "failure_probability_threshold": .5}
    write_json(Path(out) / "reduction.json", result)
    write_json(Path(out) / "reduced-recipe.json", result["reduced_recipe"])
    return result


def remedy_workflow(recipe, out, backend, background_backend=None):
    """Compare an original witness with owned-only interventions, preserving target work.

    Delaying actions past the target removes measured pressure; it may add queueing
    latency for the background work, which is reported rather than hidden.
    """
    from dataclasses import replace
    out = Path(out)
    out.mkdir(parents=True, exist_ok=False)
    reports = []
    original = backend(recipe, out / "original-validation", purpose="remedy-original-validation")
    reports.append({"intervention": "original", "verdict": original["verdict"], "bundle": "original-validation"})
    if original["verdict"]["outcome"] != "FAIL":
        result = {"status": "not-evaluable", "reason": "fresh original witness did not reproduce",
                  "reports": reports, "task_requirements_preserved": True}
        write_json(out / "remedy.json", result)
        return result
    original_signature = extract_signature(out / "original-validation")
    variants = [("release-owned-holder", recipe.with_actions(())),
                ("serialize-owned-background", recipe.with_actions(()))]
    if recipe.actions:
        from .spec import MIB
        actions = tuple(replace(a, allocated_bytes=max(4, a.allocated_bytes // 8 * 4)) for a in recipe.actions)
        variants.append(("release-half-owned-bytes", recipe.with_actions(actions)))
    for name, candidate in variants:
        if candidate.workload != recipe.workload:
            raise ValueError("a remedy may not silently change the target workload")
        variant_started = time.monotonic()
        report = backend(candidate, out / name, purpose="fresh-remedy-validation")
        queue_cost_ms, background = None, None
        if name == "serialize-owned-background":
            from .background import run_background
            queue_cost_ms = (time.monotonic() - variant_started) * 1000
            background = (background_backend or run_background)(recipe, out / "serialized-background-execution")
        ratios = [t["verdict"].get("slowdown") for t in report["trials"] if t["verdict"].get("slowdown") is not None]
        reports.append({"intervention": name, "bundle": name, "verdict": report["verdict"],
                        "target_ratio": ratios, "background_queue_cost_ms": queue_cost_ms,
                        "queue_cost_scope": "delay until after the full matched block; includes experimental controls/setup",
                        "background_execution": background,
                        "experiment_wall_s": time.monotonic() - variant_started,
                        "changed_target_requirements": [], "requested_bytes": sum(a.allocated_bytes for a in candidate.actions),
                        "operation": "owned holder removed before target" if not candidate.actions else "owned allocation reduced",
                        "no_third_party_unload_or_pause": True})
    valid = all(row["verdict"]["outcome"] != "INCONCLUSIVE" for row in reports)
    valid = valid and all(row.get("background_execution") is None or row["background_execution"].get("completed") is True for row in reports)
    result = {"schema_version": 1, "status": "evaluated" if valid else "inconclusive", "reports": reports,
              "original_proxy_signature": original_signature.to_dict() if original_signature else None,
              "task_requirements_preserved": True,
              "limits": "fresh-instance pressure-off/reduced-allocation controls; not persistent-process live memory release or arbitrary application coordination"}
    write_json(out / "remedy.json", result)
    return result
