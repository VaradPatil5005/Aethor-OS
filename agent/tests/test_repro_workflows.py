"""Workflow boundary tests; all experiment outputs in this file are fixtures."""
from dataclasses import replace
import hashlib
import json

import pytest

from spillguard.repro.analysis import summarize_bundles
from spillguard.repro.artifact import export_bundle, verify_export
from spillguard.repro.campaign import build_matrix, execute_plan
from spillguard.repro.demo import demo_recipe, run_fixture
from spillguard.repro.evidence import seal_bundle, write_json
from spillguard.repro.workflows import BundleOracle, remedy_workflow


def test_duplicate_evidence_cannot_double_count(tmp_path):
    run_fixture(demo_recipe(), tmp_path / "one")
    with pytest.raises(ValueError, match="duplicate"):
        summarize_bundles([tmp_path / "one", tmp_path / "one/../one"])


def test_local_export_excludes_logs_paths_and_checks_tampering(tmp_path):
    bundle = tmp_path / "raw"
    recipe = demo_recipe()
    report = run_fixture(recipe, bundle)
    stage = bundle / "trial-001-pressure"
    stage.mkdir()
    (stage / "trace.jsonl").write_text(json.dumps({"type": "header", "machine": {"hostname": "PRIVATE-HOST"}}) + "\n" + json.dumps({
        "t": 123456789, "adapter": {"name": "GPU", "vram_total_mb": 6144, "luid": "private-luid"},
        "procs": [{"pid": 555, "name": "secret-user-app.exe", "process_start_time": 999, "dedicated_mb": 12}],
        "events": [{"detail": "C:/Users/private"}], "system": {}, "summary": {}}) + "\n")
    (bundle / "private.log").write_text("PRIVATE-HOST C:/Users/private")
    seal_bundle(bundle, recipe, report["trials"], report["metadata"])
    result = export_bundle(bundle, tmp_path / "export")
    assert not result["uploaded"]
    text = "\n".join(p.read_text() for p in (tmp_path / "export").rglob("*") if p.is_file())
    assert all(secret not in text for secret in ["PRIVATE-HOST", "secret-user-app", "private-luid", "C:/Users/private"])
    assert verify_export(tmp_path / "export")
    (tmp_path / "export/results.json").write_text("changed")
    with pytest.raises(ValueError, match="integrity"):
        verify_export(tmp_path / "export")


def test_export_refuses_parent_traversal(tmp_path):
    directory = tmp_path / "export"
    directory.mkdir()
    files = {name: "bad" for name in ("results.json", "recipe-template.json", "environment.json", "REPLICATION.md")}
    files = {"../outside": "bad", **files}
    write_json(directory / "manifest.json", {"algorithm": "sha256", "files": files})
    with pytest.raises(ValueError, match="unsafe"):
        verify_export(directory)


def test_oracle_reserves_physical_budget_for_validation(tmp_path, monkeypatch):
    monkeypatch.setattr("spillguard.repro.workflows.extract_signature", lambda path: None)
    oracle = BundleOracle(tmp_path / "search", run_fixture, max_executions=2)
    recipe = demo_recipe()
    assert oracle(recipe, "search").verdict.outcome == "FAIL"
    assert oracle(recipe, "search").verdict.outcome == "INCONCLUSIVE"
    assert oracle(recipe, "validation").verdict.outcome == "FAIL"
    assert len(oracle.calls) == 2


def test_remedy_requires_fresh_original_and_executes_serialized_work(tmp_path, monkeypatch):
    monkeypatch.setattr("spillguard.repro.workflows.extract_signature", lambda path: None)
    requested = []
    def backend(recipe, directory, purpose):
        requested.append(recipe)
        return run_fixture(recipe, directory, purpose)
    background = []
    def run_background(recipe, directory):
        background.append(recipe)
        return {"completed": True, "elapsed_s": 1}
    recipe = demo_recipe()
    result = remedy_workflow(recipe, tmp_path / "remedy", backend, run_background)
    assert result["status"] == "evaluated"
    assert background == [recipe]
    assert all(candidate.workload == recipe.workload for candidate in requested)
    serial = next(row for row in result["reports"] if row["intervention"] == "serialize-owned-background")
    assert serial["background_queue_cost_ms"] >= 0 and serial["background_execution"]["completed"]
    stopped = remedy_workflow(recipe.with_actions(()), tmp_path / "no-witness", backend, run_background)
    assert stopped["status"] == "not-evaluable"
    assert len(background) == 1


def test_remedy_tries_smaller_releases_and_pausing_activity(tmp_path, monkeypatch):
    monkeypatch.setattr("spillguard.repro.workflows.extract_signature", lambda path: None)
    requested = {}
    def backend(recipe, directory, purpose):
        requested[directory.name] = recipe
        return run_fixture(recipe, directory, purpose)
    base = demo_recipe()
    recipe = base.with_actions(tuple(replace(a, touch_interval_ms=250) for a in base.actions))
    result = remedy_workflow(recipe, tmp_path / "remedy", backend, lambda r, d: {"completed": True})
    names = [row["intervention"] for row in result["reports"]]
    assert {"release-eighth-owned-bytes", "pause-owned-activity"} <= set(names)
    original = sum(a.allocated_bytes for a in recipe.actions)
    eighth = sum(a.allocated_bytes for a in requested["release-eighth-owned-bytes"].actions)
    assert original * 0.85 <= eighth < original  # keeps ~7/8, a smaller remedy than releasing half
    paused = requested["pause-owned-activity"]
    assert [a.allocated_bytes for a in paused.actions] == [a.allocated_bytes for a in recipe.actions]
    assert all(a.touch_interval_ms == 0 for a in paused.actions)
    row = next(r for r in result["reports"] if r["intervention"] == "pause-owned-activity")
    assert row["operation"] == "owned holder kept, accesses stopped"
    # An already-idle holder has no activity to pause, so that variant is not offered.
    idle = remedy_workflow(base.with_actions(tuple(replace(a, touch_interval_ms=0) for a in base.actions)),
                           tmp_path / "idle", backend, lambda r, d: {"completed": True})
    assert "pause-owned-activity" not in [r["intervention"] for r in idle["reports"]]


def test_invalid_remedy_is_not_reported_as_evaluated(tmp_path, monkeypatch):
    monkeypatch.setattr("spillguard.repro.workflows.extract_signature", lambda path: None)
    result = remedy_workflow(demo_recipe(), tmp_path / "remedy", run_fixture,
                             lambda recipe, directory: {"completed": False, "errors": ["fixture fault"]})
    assert result["status"] == "inconclusive"


def test_campaign_rejects_unrelated_live_labelled_witness(tmp_path):
    # Mocked origin exercises the gate; this fixture is never empirical evidence.
    recipe = demo_recipe()
    report = run_fixture(recipe, tmp_path / "mock-calibration")
    seal_bundle(tmp_path / "mock-calibration", recipe, report["trials"], {**report["metadata"], "data_origin": "live measurement"})
    unrelated = replace(recipe, workload=replace(recipe.workload, iterations=recipe.workload.iterations + 1))
    plan = tmp_path / "plan.json"
    write_json(plan, build_matrix([unrelated], [128]))
    gate = tmp_path / "gate.json"
    write_json(gate, {"approved_for_execution": True, "plan_sha256": hashlib.sha256(plan.read_bytes()).hexdigest(),
                     "evidence_bundles": ["mock-calibration"]})
    with pytest.raises(ValueError, match="each target"):
        execute_plan(plan, tmp_path / "campaign", lambda *args: pytest.fail("must not execute"), gate_path=gate)
    assert not (tmp_path / "campaign").exists()


def test_guard_stops_remaining_planned_blocks_and_preserves_missing_denominator(tmp_path, monkeypatch):
    from spillguard.repro.runner import run_experiment
    calls, closed = [], []
    class Observer:
        signature, facts = "fixture-env", {}
        def close(self):
            closed.append(True)
    def stage(recipe, name, directory, observer, **kwargs):
        calls.append(name)
        return {"stage": name, "completed": False, "latency_ms": None, "environment_signature": "fixture-env",
                "errors": ["RuntimeError: host commit pressure reached"] if name == "pressure" else []}
    monkeypatch.setattr("spillguard.repro.runner.Observer", Observer)
    monkeypatch.setattr("spillguard.repro.runner.run_stage", stage)
    monkeypatch.setattr("spillguard.repro.runner.time.sleep", lambda value: None)
    report = run_experiment(demo_recipe(), tmp_path / "guarded")
    assert calls == ["baseline", "pressure", "recovery"]
    assert closed and not report["complete"] and report["verdict"]["outcome"] == "INCONCLUSIVE"
    assert len(report["trials"]) == 1 and report["planned_blocks"] == 3
    summary = summarize_bundles([tmp_path / "guarded"])
    assert summary["groups"][0]["invalid_or_missing"] == 3
