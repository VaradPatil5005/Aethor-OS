"""Declared experiment matrices, randomized cell order, checkpointing and gates."""
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import random

from .evidence import write_json
from .spec import Action, MIB, Recipe


def pattern_actions(pattern, level_bytes, phase="decode", duration_ms=12000):
    if pattern == "hold":
        return (Action("hold", level_bytes, duration_ms=duration_ms, phase=phase),)
    if pattern == "ramp":
        block = max(4, (level_bytes // 4) // 4 * 4)
        return tuple(Action(f"ramp-{i}", block, start_ms=i * 250, duration_ms=duration_ms - i * 250,
                            touch_interval_ms=250, phase=phase) for i in range(4))
    if pattern == "burst":
        return (Action("burst", level_bytes, start_ms=250, duration_ms=min(1500, duration_ms),
                       touch_interval_ms=100, phase=phase),)
    if pattern == "reacquire":
        return (Action("first", level_bytes, duration_ms=1000, phase=phase),
                Action("reacquire", level_bytes, start_ms=1500, duration_ms=max(100, duration_ms - 1500), phase=phase))
    raise ValueError("unknown pressure pattern")


def build_matrix(workloads, levels_mib, *, repeats=6, seed=0, preparations=("cold", "warm"),
                 patterns=("hold", "ramp", "burst", "reacquire")):
    if len(workloads) < 1 or len(set(levels_mib)) != len(levels_mib):
        raise ValueError("require workloads and unique calibration levels")
    if len({w.name for w in workloads}) != len(workloads):
        raise ValueError("workload recipe names must be unique")
    cells = []
    for base in workloads:
        for preparation in preparations:
            for pattern in patterns:
                for level in levels_mib:
                    if type(level) is not int or not 1 <= level <= 8192:
                        raise ValueError("level must be in 1..8192 MiB")
                    phase = "decode" if base.workload.kind == "ollama" else "pressure"
                    actions = pattern_actions(pattern, level * MIB, phase)
                    protocol = replace(base.protocol, repeats=repeats, preparation=preparation,
                                       max_requested_bytes=max(base.protocol.max_requested_bytes,
                                                               sum(a.allocated_bytes for a in actions)),
                                       treatment_order="paired_randomized")
                    recipe = replace(base, name=f"{base.name[:20]}-{preparation}-{pattern}-{level}",
                                     actions=actions, protocol=protocol)
                    cells.append({"id": f"cell-{len(cells) + 1:03d}", "workload": base.name,
                                  "preparation": preparation, "pattern": pattern, "level_mib": level,
                                  "recipe": recipe.to_dict()})
    random.Random(seed).shuffle(cells)
    return {"schema_version": 1, "purpose": "fixed-size final campaign; separate calibration required",
            "seed": seed, "replication_unit": "whole matched block", "cells": cells,
            "planned_cells": len(cells), "planned_blocks": len(cells) * repeats,
            "required_gate": "valid application failure and reset at the declared calibrated levels"}


def execute_plan(plan_path, out, backend, *, gate_path, resume=False):
    plan_path, out, gate_path = Path(plan_path), Path(out), Path(gate_path)
    raw = plan_path.read_bytes()
    plan = json.loads(raw)
    plan_hash = hashlib.sha256(raw).hexdigest()
    gate = json.loads(gate_path.read_text())
    if gate.get("approved_for_execution") is not True or gate.get("plan_sha256") != plan_hash:
        raise ValueError("campaign calibration gate is unmet or does not match this immutable plan")
    if not gate.get("evidence_bundles"):
        raise ValueError("gate requires referenced observed calibration evidence")
    # Verify the concrete evidence, rather than trusting a hand-edited boolean.
    from .evidence import verify_bundle
    from .spec import Recipe
    positives, calibrated = [], set()
    for reference in gate["evidence_bundles"]:
        path = (gate_path.parent / reference).resolve()
        verify_bundle(path)
        report = json.loads((path / "report.json").read_text())
        recipe = Recipe.load(path / "recipe.json")
        if (report["data_origin"] != "live measurement" or report.get("complete") is not True
                or report["verdict"]["outcome"] == "INCONCLUSIVE"):
            continue
        identity = json.dumps(recipe.to_dict()["workload"], sort_keys=True)
        # Match fixed target work, preparation, safety floor and slowdown/reset
        # thresholds. Calibration may use hold while the study varies patterns.
        key = (identity, recipe.protocol.preparation, recipe.protocol.min_available_host_bytes,
               recipe.protocol.slowdown_ratio, recipe.protocol.recovery_ratio)
        level = sum(a.allocated_bytes for a in recipe.actions)
        calibrated.add((key, level))
        if report["verdict"]["outcome"] == "FAIL":
            positives.append(key)
    if not positives:
        raise ValueError("gate has no valid live failure witness; a software fixture cannot authorize the study")
    for cell in plan["cells"]:
        recipe = Recipe.from_dict(cell["recipe"])
        identity = json.dumps(recipe.to_dict()["workload"], sort_keys=True)
        key = (identity, recipe.protocol.preparation, recipe.protocol.min_available_host_bytes,
               recipe.protocol.slowdown_ratio, recipe.protocol.recovery_ratio)
        if key not in positives or (key, cell["level_mib"] * MIB) not in calibrated:
            raise ValueError("each target/preparation requires a live failure/reset witness and valid calibration at every planned level")
    out.mkdir(parents=True, exist_ok=resume)
    checkpoint = out / "checkpoint.json"
    state = json.loads(checkpoint.read_text()) if resume and checkpoint.exists() else {"plan_sha256": plan_hash, "completed": []}
    if state["plan_sha256"] != plan_hash:
        raise ValueError("cannot resume a changed plan")
    write_json(out / "plan.json", plan)
    for cell in plan["cells"]:
        if cell["id"] in state["completed"]:
            continue
        directory = out / cell["id"]
        if directory.exists():
            raise ValueError(f"interrupted cell {cell['id']} must be retained and explicitly accounted for before resume")
        report = backend(Recipe.from_dict(cell["recipe"]), directory, purpose="final-study")
        state["completed"].append(cell["id"])
        write_json(checkpoint, state)
        if any(any("host memory floor" in e or "host commit pressure" in e for e in s["errors"])
               for t in report["trials"] for s in t["stages"]):
            write_json(out / "stopped.json", {"reason": "resource guard", "cell": cell["id"],
                       "unexecuted": [c["id"] for c in plan["cells"] if c["id"] not in state["completed"]]})
            break
    return state
