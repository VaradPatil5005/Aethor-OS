"""Plain ddmin baseline. Only FAIL preserves a witness; uncertainty is never PASS.

No binary search, byte minimization or novelty claim. Candidate tests and fresh
validation are kept separate; no oracle result is reused across invocations.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Callable

from .evidence import Verdict
from .spec import Recipe


@dataclass
class Reduction:
    recipe: Recipe
    search: list[dict]
    validation: Verdict | None
    one_minimal: bool
    stop_reason: str

    def to_dict(self):
        return {"schema_version": 1, "method": "plain-ddmin-action-deletion",
                "recipe": self.recipe.to_dict(), "search": self.search,
                "validation": asdict(self.validation) if self.validation else None,
                "one_minimal": self.one_minimal, "stop_reason": self.stop_reason,
                "minimality_scope": "single action deletion under this protocol; no global minimum claim"}


def reduce_actions(recipe: Recipe, oracle: Callable[[Recipe, str], Verdict],
                   max_tests: int = 30) -> Reduction:
    if type(max_tests) is not int or max_tests < 2:
        raise ValueError("max_tests must allow at least an original test and fresh validation")
    search = []

    def test(candidate):
        verdict = oracle(candidate, "search")
        search.append({"actions": [a.id for a in candidate.actions],
                       "recipe_signature": candidate.signature, "verdict": asdict(verdict)})
        return verdict

    original = test(recipe)
    if original.outcome != "FAIL":
        return Reduction(recipe, search, None, False, "original witness not reproduced")
    current, n = recipe, 2
    # Reserve a fresh fixed-size validation block, independent of all search results.
    while current.actions and len(search) < max_tests - 1:
        length = len(current.actions)
        n = min(n, length)
        partitions = [current.actions[i * length // n:(i + 1) * length // n] for i in range(n)]
        accepted = False
        for part in partitions:
            if len(search) >= max_tests - 1:
                break
            remove = {a.id for a in part}
            candidate = current.with_actions(a for a in current.actions if a.id not in remove)
            if test(candidate).outcome == "FAIL":
                current, n, accepted = candidate, max(2, n - 1), True
                break
        if accepted:
            continue
        if n == length:
            break
        n = min(length, n * 2)
    # Minimality requires a PASS for every single-deletion neighbor of the *final*
    # witness. An inconclusive neighbor or an exhausted budget cannot certify it.
    neighbors = [{a.id for a in current.actions if a.id != removed.id} for removed in current.actions]
    def neighbor_passed(ids):
        last = next((item for item in reversed(search) if set(item["actions"]) == ids), None)
        return last is not None and last["verdict"]["outcome"] == "PASS"
    one_minimal = all(neighbor_passed(ids) for ids in neighbors)
    validation = oracle(current, "validation")  # always fresh; not stored as a search test
    reason = "action deletion search complete" if one_minimal else "budget or uncertain neighbors limit minimality"
    if validation.outcome != "FAIL":
        reason = "fresh validation did not reproduce the selected witness"
        one_minimal = False
    return Reduction(current, search, validation, one_minimal, reason)
