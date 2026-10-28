"""Research contracts: counter preservation, budgets, matrix gates and uncertainty."""
from dataclasses import replace
import json
import math

import pytest

from spillguard.repro.campaign import build_matrix, execute_plan, pattern_actions
from spillguard.repro.demo import demo_recipe, run_fixture
from spillguard.repro.evidence import Verdict
from spillguard.repro.search import Observation, neighbors, reduce_scenario, size
from spillguard.repro.signature import WitnessSignature, compare_signatures
from spillguard.repro.spec import Action, MIB, Recipe
from spillguard.repro.statistics import binomial_interval, trial_decision
from spillguard.repro.analysis import summarize_bundles, write_analysis
from spillguard.repro.diagnosis import diagnose


def signature(kind="shared-growth", phases=("pressure",)):
    return WitnessSignature(kind, "work", "env", phases, 256 * MIB, .1, .9, False, 12)


@pytest.mark.parametrize("k,n", [(0, 1), (1, 1), (0, 10), (3, 10), (10, 10), (20, 50)])
def test_exact_interval_symmetry_and_bounds(k, n):
    lo, hi = binomial_interval(k, n)
    opposite_lo, opposite_hi = binomial_interval(n - k, n)
    assert 0 <= lo <= k / n <= hi <= 1
    assert lo == pytest.approx(1 - opposite_hi)
    assert hi == pytest.approx(1 - opposite_lo)
    if k == 0:
        assert hi == pytest.approx(1 - .025**(1 / n))
    if k == n:
        assert lo == pytest.approx(.025**(1 / n))


def test_declared_looks_widen_intervals_and_invalids_never_pass():
    fixed = trial_decision(["FAIL"] * 9)
    sequential = trial_decision(["FAIL"] * 9, max_looks=3)
    assert sequential["interval"][0] < fixed["interval"][0]
    assert sequential["outcome"] == "FAIL"
    assert trial_decision(["PASS"] * 9, max_looks=3)["outcome"] == "PASS"
    assert trial_decision(["PASS"] * 9 + ["INCONCLUSIVE"])["outcome"] == "INCONCLUSIVE"
    assert trial_decision(["PASS", "FAIL"] * 5)["outcome"] == "INCONCLUSIVE"


@pytest.mark.parametrize("candidate", [None, replace(signature(), kind="no-shared-growth"),
    replace(signature(), phases=("decode",)), replace(signature(), environment_signature="other"),
    replace(signature(), overlap_fraction=.1), replace(signature(), shared_growth_bytes=1024 * MIB),
    replace(signature(), dedicated_loss_fraction=.8), replace(signature(), counter_disagreement=True)])
def test_signature_loss_is_not_accepted(candidate):
    assert not compare_signatures(signature(), candidate)[0]


def test_all_discrete_transforms_reduce_declared_size_without_changing_target():
    recipe = Recipe("test", (Action("one", 64 * MIB, duration_ms=4000),))
    variants = list(neighbors(recipe, ("delete", "bytes", "duration", "overlap")))
    assert {label.split(":")[0] for label, _ in variants} == {"delete", "bytes", "duration", "overlap"}
    assert all(size(candidate) < size(recipe) and candidate.workload == recipe.workload for _, candidate in variants)


def test_aware_reduction_rejects_a_smaller_different_failure():
    recipe = Recipe("test", (Action("capacity", 64 * MIB), Action("touch", 64 * MIB), Action("compute", 4 * MIB)))
    def oracle(candidate, purpose):
        ids = {a.id for a in candidate.actions}
        resident = {"capacity", "touch"} <= ids
        slow = resident or "compute" in ids
        return Observation(Verdict("FAIL" if slow else "PASS", "fixture"),
                           signature("shared-growth" if resident else "no-shared-growth"))
    plain = reduce_scenario(recipe, oracle, method="greedy", max_tests=30)
    aware = reduce_scenario(recipe, oracle, method="phase-aware", max_tests=40, transforms=("delete",))
    assert len(plain["reduced_recipe"]["actions"]) == 1
    assert {a["id"] for a in aware["reduced_recipe"]["actions"]} == {"capacity", "touch"}
    assert any(h["raw_verdict"]["outcome"] == "FAIL" and h["verdict"]["outcome"] == "INCONCLUSIVE" for h in aware["history"])
    assert aware["fresh_validation"]["outcome"] == "FAIL"


@pytest.mark.parametrize("method", ["greedy", "ddmin", "probdd-style", "no-reduction", "exhaustive", "phase-aware"])
def test_reducer_variants_reserve_fresh_validation_and_bound_tests(method):
    recipe = demo_recipe()
    calls = []
    def oracle(candidate, purpose):
        calls.append(purpose)
        ids = {a.id for a in candidate.actions}
        return Observation(Verdict("FAIL" if {"capacity", "touch"} <= ids else "PASS", "fixture"), signature())
    result = reduce_scenario(recipe, oracle, method=method, max_tests=20, transforms=("delete",))
    assert len(calls) <= 20
    assert calls[-1] == "validation" and calls.count("validation") == 1
    assert result["fresh_validation"]["outcome"] == "FAIL"
    if method == "no-reduction":
        assert not result["one_minimal"] and len(result["reduced_recipe"]["actions"]) == 4
    else:
        assert {a["id"] for a in result["reduced_recipe"]["actions"]} == {"capacity", "touch"}


def test_uncertainty_and_budget_never_claim_minimality():
    original = demo_recipe()
    def oracle(candidate, purpose):
        return Observation(Verdict("FAIL" if candidate == original else "INCONCLUSIVE", "fixture"), signature())
    result = reduce_scenario(original, oracle, max_tests=3)
    assert result["executed_tests"] == 3
    assert not result["one_minimal"]


def test_matrix_is_seeded_72_cells_and_432_whole_blocks():
    bases = [replace(demo_recipe(), name=f"workload-{i}") for i in range(3)]
    one = build_matrix(bases, [128, 256, 512], seed=42)
    two = build_matrix(bases, [128, 256, 512], seed=42)
    assert one == two and one["planned_cells"] == 72 and one["planned_blocks"] == 432
    assert build_matrix(bases, [128, 256, 512], seed=43)["cells"] != one["cells"]
    for cell in one["cells"]:
        recipe = Recipe.from_dict(cell["recipe"])
        assert recipe.protocol.treatment_order == "paired_randomized"
        assert sum(a.allocated_bytes for a in recipe.actions) <= recipe.protocol.max_requested_bytes


def test_campaign_refuses_unmet_or_fixture_only_gate(tmp_path):
    import hashlib
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps(build_matrix([demo_recipe()], [128])))
    gate = tmp_path / "gate.json"
    gate.write_text(json.dumps({"approved_for_execution": False}))
    with pytest.raises(ValueError, match="unmet"):
        execute_plan(plan, tmp_path / "out", lambda *args: None, gate_path=gate)
    run_fixture(demo_recipe(), tmp_path / "fixture")
    gate.write_text(json.dumps({"approved_for_execution": True,
        "plan_sha256": hashlib.sha256(plan.read_bytes()).hexdigest(), "evidence_bundles": ["fixture"]}))
    with pytest.raises(ValueError, match="live failure"):
        execute_plan(plan, tmp_path / "out", lambda *args: None, gate_path=gate)


def test_analysis_keeps_search_fixture_and_validation_separate(tmp_path):
    run_fixture(demo_recipe(), tmp_path / "search", purpose="search")
    run_fixture(demo_recipe(), tmp_path / "validation", purpose="validation")
    summary = summarize_bundles([tmp_path / "search", tmp_path / "validation"])
    assert len(summary["groups"]) == 2
    assert all(g["planned_blocks"] == 3 for g in summary["groups"])
    write_analysis(summary, tmp_path / "analysis")
    assert (tmp_path / "analysis/summary.csv").is_file()


def test_diagnosis_requires_independent_residency_evidence():
    report = {"verdict": {"outcome": "FAIL"}, "trials": []}
    assert diagnose(report, signature())["label"] == "insufficient evidence"
    assert diagnose(report, signature(), {"memory_holder": "FAIL", "arithmetic_control": "PASS"})["label"] == "insufficient evidence"
    assert diagnose(report, signature(), {"memory_holder": "FAIL", "arithmetic_control": "PASS", "independent_residency_validation": True})["label"] == "supported residency contribution"
    assert diagnose(report, signature(), {"memory_holder": "FAIL", "arithmetic_control": "FAIL"})["label"] == "mixed cause"
