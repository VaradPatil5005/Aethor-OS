"""Reducer comparisons and discrete scenario transforms with auditable budgets.

ProbDD-style is a paper-inspired selection baseline, not a claimed reproduction of
all ProbDD proofs. Inconclusive tests never update its dependency probabilities.
Phase-aware protects measured proxies, not an unobserved paging mechanism.
"""
from dataclasses import asdict, dataclass, replace
import itertools
import math
import time

from .evidence import Verdict
from .signature import WitnessSignature, compare_signatures
from .spec import MIB, Recipe


@dataclass(frozen=True)
class Observation:
    verdict: Verdict
    signature: WitnessSignature | None = None
    bundle: str | None = None


def size(recipe):
    return (len(recipe.actions), sum(a.allocated_bytes * a.duration_ms for a in recipe.actions),
            sum(a.allocated_bytes for a in recipe.actions), sum(a.duration_ms for a in recipe.actions))


def neighbors(recipe, transforms=("delete",)):
    seen = set()
    for index, action in enumerate(recipe.actions):
        replacements = []
        if "delete" in transforms:
            replacements.append(("delete", None))
        if "bytes" in transforms and action.allocated_bytes > MIB:
            replacements.append(("bytes", replace(action, allocated_bytes=max(MIB, (action.allocated_bytes // 8) * 4))))
        if "duration" in transforms and action.duration_ms > 100:
            replacements.append(("duration", replace(action, duration_ms=max(100, action.duration_ms // 2))))
        if "overlap" in transforms and action.duration_ms > 200:
            shift = action.duration_ms // 4
            replacements.append(("overlap", replace(action, start_ms=action.start_ms + shift,
                                                    duration_ms=action.duration_ms - shift)))
        for transform, replacement in replacements:
            actions = list(recipe.actions)
            if replacement is None:
                actions.pop(index)
            else:
                actions[index] = replacement
            candidate = recipe.with_actions(actions)
            if candidate.signature not in seen and size(candidate) < size(recipe):
                seen.add(candidate.signature)
                yield f"{transform}:{action.id}", candidate


def reduce_scenario(recipe, oracle, *, method="phase-aware", max_tests=40,
                    transforms=("delete", "bytes", "duration", "overlap")):
    methods = {"phase-aware", "greedy", "ddmin", "probdd-style", "no-reduction", "exhaustive"}
    if method not in methods or type(max_tests) is not int or max_tests < 2:
        raise ValueError("invalid reducer method or test budget")
    if method == "exhaustive" and len(recipe.actions) > 10:
        raise ValueError("tiny exhaustive comparator supports at most ten actions")
    if set(transforms) - {"delete", "bytes", "duration", "overlap"}:
        raise ValueError("unknown discrete transform")
    started, history = time.monotonic(), []
    reference = None
    current = recipe
    budget_exhausted = False

    def test(candidate, label, purpose="search"):
        obs = oracle(candidate, purpose)
        verdict = obs.verdict
        retained = None
        if method == "phase-aware" and reference is not None and verdict.outcome == "FAIL":
            retained, reason = compare_signatures(reference, obs.signature)
            if not retained:
                verdict = Verdict("INCONCLUSIVE", reason, verdict.slowdown, verdict.recovery)
        history.append({"purpose": purpose, "transform": label, "recipe_signature": candidate.signature,
                        "size": size(candidate), "verdict": asdict(verdict), "raw_verdict": asdict(obs.verdict),
                        "signature": obs.signature.to_dict() if obs.signature else None,
                        "signature_retained": retained, "bundle": obs.bundle})
        return verdict, obs

    original, observed = test(recipe, "original")
    reference = observed.signature
    reason = "original witness not reproduced"
    if original.outcome == "FAIL" and (method != "phase-aware" or reference is not None):
        reason = "search complete under declared transforms"
        if method in ("ddmin", "probdd-style"):
            granularity, probabilities = 2, {a.id: .1 for a in current.actions}
            while current.actions and len(history) < max_tests - 1:
                count = len(current.actions)
                if method == "ddmin":
                    granularity = min(granularity, count)
                    groups = [current.actions[i * count // granularity:(i + 1) * count // granularity]
                              for i in range(granularity)]
                else:
                    ordered = sorted(current.actions, key=lambda a: (probabilities[a.id], a.id))
                    keep_product, best, best_gain = 1., 1, -1.
                    for k, action in enumerate(ordered, 1):
                        keep_product *= 1 - probabilities[action.id]
                        if k * keep_product > best_gain:
                            best, best_gain = k, k * keep_product
                    groups = [ordered[:best]]
                accepted = False
                for group in groups:
                    if len(history) >= max_tests - 1:
                        break
                    removed = {a.id for a in group}
                    candidate = current.with_actions(a for a in current.actions if a.id not in removed)
                    verdict, _ = test(candidate, "group-delete:" + ",".join(sorted(removed)))
                    if verdict.outcome == "FAIL":
                        current, accepted = candidate, True
                        granularity = max(2, granularity - 1)
                        break
                    if method == "probdd-style" and verdict.outcome == "PASS":
                        denominator = 1 - math.prod(1 - probabilities[a.id] for a in group)
                        for action in group:
                            probabilities[action.id] = min(1., probabilities[action.id] / max(1e-12, denominator))
                    elif method == "probdd-style" and verdict.outcome == "INCONCLUSIVE":
                        reason = "ambiguous test; probability model not updated"
                        break
                if accepted:
                    continue
                if method == "ddmin":
                    if granularity == count:
                        break
                    granularity = min(count, granularity * 2)
                elif all(probabilities[a.id] >= 1 - 1e-10 for a in current.actions) or verdict.outcome == "INCONCLUSIVE":
                    break
        elif method == "exhaustive":
            found = False
            for count in range(len(recipe.actions) + 1):
                for subset in itertools.combinations(recipe.actions, count):
                    if len(history) >= max_tests - 1:
                        break
                    candidate = recipe.with_actions(subset)
                    verdict, _ = test(candidate, "tiny-exhaustive")
                    if verdict.outcome == "FAIL":
                        current, found = candidate, True
                        break
                if found or len(history) >= max_tests - 1:
                    break
        if method not in ("no-reduction", "exhaustive"):
            active_transforms = transforms if method == "phase-aware" else ("delete",)
            while len(history) < max_tests - 1:
                accepted = False
                for label, candidate in neighbors(current, active_transforms):
                    if len(history) >= max_tests - 1:
                        break
                    verdict, _ = test(candidate, label)
                    if verdict.outcome == "FAIL":
                        current, accepted = candidate, True
                        break
                if not accepted:
                    break
        budget_exhausted = len(history) >= max_tests - 1
        validation, _ = test(current, "fresh-final", "validation")
    else:
        validation = None
        if original.outcome == "FAIL":
            reason = "missing original phase/counter signature"
    checked = {h["recipe_signature"]: h["verdict"]["outcome"] for h in history if h["purpose"] == "search"}
    scope = transforms if method == "phase-aware" else ("delete",)
    minimal = method != "no-reduction" and all(checked.get(c.signature) == "PASS" for _, c in neighbors(current, scope))
    validated = validation is not None and validation.outcome == "FAIL"
    return {"schema_version": 1, "method": method, "original_recipe": recipe.to_dict(),
            "reduced_recipe": current.to_dict(), "history": history,
            "original_size": size(recipe), "reduced_size": size(current), "transforms": list(scope),
            "fresh_validation": asdict(validation) if validation else None,
            "one_minimal": bool(minimal and validated), "global_minimum_claimed": False,
            "budget_exhausted": budget_exhausted, "max_tests": max_tests, "executed_tests": len(history),
            "elapsed_s": time.monotonic() - started, "stop_reason": reason,
            "mechanism": "observed proxy only; direct residency validation still required"}
