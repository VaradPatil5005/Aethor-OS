"""Deterministic software fixture. These values are not hardware measurements."""
from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

from .evidence import classify, seal_bundle
from .spec import Action, MIB, Recipe


def demo_recipe():
    return Recipe("fixture-demo", (Action("irrelevant-a", 16 * MIB),
                                   Action("capacity", 128 * MIB),
                                   Action("touch", 64 * MIB, touch_interval_ms=100),
                                   Action("irrelevant-b", 16 * MIB)))


def run_fixture(recipe: Recipe, directory: Path, purpose: str = "standalone"):
    """Known interaction retains capacity + touch, exercising non-monotonic set search."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=False)
    ids = {a.id for a in recipe.actions}
    fails = {"capacity", "touch"} <= ids
    trials = []
    for index in range(recipe.protocol.repeats):
        stages = [{"stage": stage, "completed": True, "errors": [],
                   "latency_ms": 300.0 if stage == "pressure" and fails else 100.0,
                   "work_units": recipe.workload.iterations, "workload_signature": "fixture-work-v1",
                   "environment_signature": "fixture-env-v1", "host_pressure": False,
                   "pressure_observed": bool(recipe.actions)}
                  for stage in ("baseline", "pressure", "recovery")]
        trials.append({"trial": index + 1, "stages": stages, "verdict": asdict(classify(recipe, stages))})
    return seal_bundle(directory, recipe, trials, {"backend": "deterministic-fixture",
                       "purpose": purpose,
                       "data_origin": "SOFTWARE FIXTURE - NOT GPU MEASUREMENTS",
                       "environment_signature": "fixture-env-v1"})
