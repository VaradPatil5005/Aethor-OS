"""Protocol, uncertainty, reduction and artifact regressions; no GPU needed."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys

import pytest

from spillguard.repro.demo import demo_recipe, run_fixture
from spillguard.repro.evidence import Verdict, aggregate, classify
from spillguard.repro.evidence import verify_bundle
from spillguard.repro.observer import Observer
from spillguard.repro.reducer import reduce_actions
from spillguard.repro.runner import observed_pressure, run_experiment, run_stage
from spillguard.repro.spec import Action, MIB, Protocol, Recipe


def matched(recipe=None):
    recipe = recipe or demo_recipe()
    return [{"stage": name, "completed": True, "errors": [], "latency_ms": latency,
             "work_units": recipe.workload.iterations, "workload_signature": "same-work",
             "environment_signature": "same-env", "pressure_observed": True, "host_pressure": False}
            for name, latency in (("baseline", 100), ("pressure", 300), ("recovery", 110))]


def test_recipe_round_trip_and_stable_signature():
    recipe = demo_recipe()
    restored = Recipe.from_dict(json.loads(json.dumps(recipe.to_dict())))
    assert restored == recipe
    assert restored.signature == recipe.signature
    assert recipe.with_actions(recipe.actions[:1]).signature != recipe.signature


@pytest.mark.parametrize("field,value", [("allocated_bytes", 0), ("allocated_bytes", -4),
                                        ("allocated_bytes", True), ("allocated_bytes", 17),
                                        ("duration_ms", float("nan")), ("start_ms", -1),
                                        ("touch_interval_ms", "100"), ("phase", "unknown")])
def test_invalid_actions_rejected(field, value):
    data = {"id": "a", "allocated_bytes": MIB, field: value}
    with pytest.raises(ValueError):
        Action(**data)


@pytest.mark.parametrize("data", [
    {"name": "a", "actions": [], "schema_version": True},
    {"name": "a", "actions": [], "schema_version": 2},
    {"name": "a", "actions": [], "command": "not-supported"},
    {"name": "../escape", "actions": []}, {"name": "a", "actions": "bad"},
    {"name": "a", "actions": [{}]}, {"name": "a", "actions": [], "workload": {"kind": "shell"}},
    {"name": "a", "actions": [], "protocol": {"repeats": 1.5}},
    {"name": "a", "actions": [], "protocol": {"slowdown_ratio": float("inf")}},
    {"name": "a", "actions": [], "protocol": {"min_pressure_fraction": 0}},
])
def test_invalid_recipe_rejected(data):
    with pytest.raises(ValueError):
        Recipe.from_dict(data)


def test_recipe_duplicate_limits_and_deadlines():
    action = Action("a", MIB)
    with pytest.raises(ValueError, match="unique"):
        Recipe("dup", (action, action))
    with pytest.raises(ValueError, match="exceed"):
        Recipe("too-big", (Action("a", 2 * MIB),), protocol=Protocol(max_requested_bytes=MIB))
    with pytest.raises(ValueError, match="timeout"):
        Recipe("too-long", (Action("a", MIB, duration_ms=31000),))


def test_failure_and_valid_non_reproduction_are_distinct():
    recipe = demo_recipe()
    stages = matched(recipe)
    assert classify(recipe, stages).outcome == "FAIL"
    stages[1]["latency_ms"] = 120
    assert classify(recipe, stages).outcome == "PASS"
    stages[1]["pressure_observed"] = False
    assert classify(recipe, stages).outcome == "INCONCLUSIVE"


@pytest.mark.parametrize("stage,key,value", [
    (1, "errors", ["missing counter"]), (1, "completed", False), (0, "latency_ms", None),
    (1, "latency_ms", float("nan")), (1, "work_units", 8),
    (1, "environment_signature", "changed"), (1, "workload_signature", None),
    (2, "host_pressure", True), (0, "host_pressure", None), (2, "latency_ms", 200),
])
def test_ambiguous_or_invalid_trials_never_pass(stage, key, value):
    stages = matched()
    stages[stage][key] = value
    assert classify(demo_recipe(), stages).outcome == "INCONCLUSIVE"


def test_missing_stage_and_empty_control():
    assert classify(demo_recipe(), matched()[:2]).outcome == "INCONCLUSIVE"
    recipe = demo_recipe().with_actions(())
    stages = matched(recipe)
    stages[1].update(pressure_observed=False, latency_ms=100)
    assert classify(recipe, stages).outcome == "PASS"
    stages[1]["latency_ms"] = 300
    assert classify(recipe, stages).outcome == "INCONCLUSIVE"


def test_fixed_repetition_policy_no_selective_dropping():
    failure = Verdict("FAIL", "test", 3, 1)
    passing = Verdict("PASS", "test", 1, 1)
    uncertain = Verdict("INCONCLUSIVE", "test")
    assert aggregate([failure] * 3, 3).outcome == "FAIL"
    assert aggregate([failure, passing, failure], 3).outcome == "INCONCLUSIVE"
    assert aggregate([failure, uncertain, failure], 3).outcome == "INCONCLUSIVE"
    assert aggregate([failure], 3).outcome == "INCONCLUSIVE"


def test_observed_pressure_requires_overlap_growth_and_multiple_samples():
    recipe = Recipe("test", (Action("a", 100 * MIB),))
    events = [{"event": "ALLOC", "action_id": "a", "requested_bytes": 100 * MIB, "monotonic_ns": 10},
              {"event": "RELEASE", "action_id": "a", "monotonic_ns": 50}]
    def obs(when, dedicated=200 * MIB, errors=None):
        return {"monotonic_ns": when, "errors": errors or [], "processes": [
            {"pid": 12, "dedicated_observed_bytes": dedicated}]}
    result = {"measure_start_ns": 20, "measure_end_ns": 40}
    assert observed_pressure(recipe, [obs(21), obs(35)], events, 12, 100 * MIB, result) == (True, 2)
    for observations, base in (([obs(5), obs(55)], 100 * MIB),
                               ([obs(21)], 100 * MIB), ([obs(21), obs(35)], None),
                               ([obs(21, 100 * MIB), obs(35, 100 * MIB)], 100 * MIB),
                               ([obs(21, errors=["bad"]), obs(35)], 100 * MIB)):
        assert not observed_pressure(recipe, observations, events, 12, base, result)[0]


def test_ddmin_interacting_actions_and_fresh_validation():
    recipe = demo_recipe()
    calls = []
    def oracle(candidate, purpose):
        calls.append((candidate.signature, purpose))
        ids = {a.id for a in candidate.actions}
        return Verdict("FAIL" if {"capacity", "touch"} <= ids else "PASS", "fixture")
    result = reduce_actions(recipe, oracle)
    assert [a.id for a in result.recipe.actions] == ["capacity", "touch"]
    assert result.one_minimal
    assert calls[-1] == (result.recipe.signature, "validation")
    assert sum(purpose == "validation" for _, purpose in calls) == 1
    assert any(sig == result.recipe.signature for sig, purpose in calls[:-1])


def test_inconclusive_neighbors_cannot_certify_minimality():
    recipe = demo_recipe()
    def oracle(candidate, purpose):
        return Verdict("FAIL" if candidate == recipe else "INCONCLUSIVE", "fixture")
    result = reduce_actions(recipe, oracle)
    assert result.recipe == recipe
    assert not result.one_minimal
    assert result.validation.outcome == "FAIL"


def test_failed_fresh_validation_and_budget_are_reported():
    recipe = demo_recipe()
    calls = []
    def oracle(candidate, purpose):
        calls.append(purpose)
        return Verdict("INCONCLUSIVE" if purpose == "validation" else "FAIL", "fixture")
    result = reduce_actions(recipe, oracle, max_tests=2)
    assert calls == ["search", "validation"]
    assert not result.one_minimal
    assert "fresh validation" in result.stop_reason


def test_no_reduction_of_unreproduced_original():
    calls = []
    def oracle(candidate, purpose):
        calls.append(purpose)
        return Verdict("PASS", "fixture")
    result = reduce_actions(demo_recipe(), oracle)
    assert len(calls) == 1
    assert result.validation is None
    assert not result.one_minimal


def test_non_monotonic_oracle_is_not_binary_searched():
    recipe = demo_recipe().with_actions(demo_recipe().actions[:3])
    def oracle(candidate, purpose):
        # Lengths 1 and 3 fail, length 2 passes. ddmin makes only local claims.
        return Verdict("FAIL" if len(candidate.actions) % 2 else "PASS", "fixture")
    result = reduce_actions(recipe, oracle)
    assert len(result.recipe.actions) in (1, 3)
    assert result.one_minimal


def test_bundle_integrity_origin_and_no_overwrite(tmp_path):
    out = tmp_path / "bundle"
    report = run_fixture(demo_recipe(), out)
    assert report["verdict"]["outcome"] == "FAIL"
    assert report["mechanism"] == "unverified"
    assert "NOT GPU" in report["data_origin"]
    manifest = json.loads((out / "manifest.json").read_text())
    for name, expected in manifest["files"].items():
        assert hashlib.sha256((out / name).read_bytes()).hexdigest() == expected
    verify_bundle(out)
    with pytest.raises(FileExistsError):
        run_fixture(demo_recipe(), out)
    (out / "report.md").write_text("tampered", encoding="utf-8")
    with pytest.raises(ValueError, match="mismatch"):
        verify_bundle(out)


def test_manifest_cannot_read_outside_its_bundle(tmp_path):
    out = tmp_path / "bundle"
    run_fixture(demo_recipe(), out)
    path = out / "manifest.json"
    manifest = json.loads(path.read_text())
    manifest["files"]["../outside.txt"] = "irrelevant"
    path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="unsafe"):
        verify_bundle(out)


@pytest.mark.parametrize("interrupt", [False, True])
def test_startup_failure_and_interrupt_close_only_owned_children(tmp_path, monkeypatch, interrupt):
    from types import SimpleNamespace
    closed = []
    class FakeWorker:
        def __init__(self, role, recipe, directory):
            self.role, self.events = role, []
            self.process = SimpleNamespace(returncode=0)
        def ready(self, deadline):
            if not interrupt:
                raise RuntimeError("startup failed")
            return {"device": "test-gpu", "pid": 1 if self.role == "target" else 2, "process_start_time": 10}
        def close(self):
            closed.append(self.role)
            return False
    class FakeObserver:
        signature = "env"
        facts = {}
        runtime = SimpleNamespace(collector=SimpleNamespace(primary=SimpleNamespace(name="test-gpu")))
        def sample(self, identities):
            raise KeyboardInterrupt()
    monkeypatch.setattr("spillguard.repro.runner.Worker", FakeWorker)
    if interrupt:
        with pytest.raises(KeyboardInterrupt):
            run_stage(demo_recipe(), "pressure", tmp_path / "stage", FakeObserver())
        assert closed == ["pressure", "target"]
    else:
        result = run_stage(demo_recipe(), "pressure", tmp_path / "stage", FakeObserver())
        assert closed == ["target"]
        assert result["completed"] is False
        assert "startup failed" in result["errors"][0]


def test_missing_counters_and_reused_pid_do_not_become_zero_measurements(monkeypatch):
    from types import SimpleNamespace
    frame = {"monotonic_ns": 12, "collection_duration_ms": 4,
             "telemetry_quality": {"errors": [], "proc_metrics": ["dedicated", "shared", "committed"],
                                   "adapter_metrics": ["dedicated", "shared"], "adapter_luids": ["gpu"],
                                   "system_metrics": ["avail_mb", "committed", "commit_limit"]},
             "adapter": {"luid": "gpu", "dedicated_mb": 100, "nvml": None},
             "system": {"avail_mb": 4096, "commit_pct": 50},
             "procs": [{"pid": 12, "dedicated_mb": 100, "shared_mb": 3, "committed_mb": 120}]}
    observer = Observer.__new__(Observer)
    observer.runtime = SimpleNamespace(tick=lambda: frame)
    monkeypatch.setattr("psutil.Process", lambda pid: SimpleNamespace(create_time=lambda: 10))
    _, observation = observer.sample({12: 10})
    assert observation["processes"][0]["dedicated_observed_bytes"] == 100 * MIB
    frame["telemetry_quality"]["proc_metrics"].remove("shared")
    _, observation = observer.sample({12: 10})
    assert observation["errors"]
    assert observation["processes"][0]["dedicated_observed_bytes"] is None
    _, observation = observer.sample({12: 9})
    assert "identity changed" in " ".join(observation["errors"])
    assert observation["processes"] == []


def test_failed_observer_still_seals_inconclusive_bundle(tmp_path, monkeypatch):
    def fail():
        raise RuntimeError("test: unavailable GPU")
    monkeypatch.setattr("spillguard.repro.runner.Observer", fail)
    out = tmp_path / "failed"
    with pytest.raises(RuntimeError):
        run_experiment(demo_recipe(), out)
    report = json.loads((out / "report.json").read_text())
    assert report["verdict"]["outcome"] == "INCONCLUSIVE"
    assert report["complete"] is False
    assert "unavailable GPU" in report["metadata"]["run_error"]
    assert (out / "manifest.json").is_file()


def test_cli_demo_and_reduced_recipe_are_rerunnable(tmp_path):
    repo = Path(__file__).resolve().parents[2]
    out = tmp_path / "demo"
    completed = subprocess.run([sys.executable, str(repo / "bench" / "repro.py"), "demo", "--out", str(out)],
                               capture_output=True, text=True, timeout=10)
    assert completed.returncode == 0, completed.stdout + completed.stderr
    result = json.loads((out / "reduction.json").read_text())
    assert result["one_minimal"]
    assert result["validation"]["outcome"] == "FAIL"
    assert len(Recipe.load(out / "reduced-recipe.json").actions) == 2
    calls = json.loads((out / "calls.json").read_text())
    assert calls[-1]["purpose"] == "validation"
    assert all((out / call["bundle"] / "manifest.json").is_file() for call in calls)
    validation = json.loads((out / calls[-1]["bundle"] / "report.json").read_text())
    assert validation["fresh_validation"] is True
