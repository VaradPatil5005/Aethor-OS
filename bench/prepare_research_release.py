"""Build a declared, unexecuted matrix and a compact index of real local evidence."""
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agent"))
from spillguard.repro.campaign import build_matrix
from spillguard.repro.evidence import verify_bundle, write_json
from spillguard.repro.spec import Recipe


def main():
    output = ROOT / "bench/plans/20261016"
    output.mkdir(parents=True, exist_ok=True)
    cuda = replace(Recipe.load(ROOT / "bench/recipes/overhead-cuda.json"), name="cuda-write")
    qwen = Recipe.load(ROOT / "bench/recipes/ollama-qwen25-smoke-1536mib.json")
    qwen = replace(qwen, name="qwen25-text", workload=replace(qwen.workload, num_predict=512))
    vl = replace(Recipe.load(ROOT / "bench/recipes/ollama-qwen3vl-text-only.json"), name="qwen3vl-text-input")
    plan = build_matrix([cuda, qwen, vl], [128, 256, 512], seed=42)
    plan["level_status"] = "PROVISIONAL engineering grid; these levels are not calibrated failure levels"
    plan["workload_notes"] = {"qwen3vl-text-input": "text input/output using an installed multimodal architecture; images are not tested"}
    path = output / "campaign.json"
    if path.exists():
        raise FileExistsError("preserve the previously declared plan")
    write_json(path, plan)
    write_json(output / "gate.json", {"approved_for_execution": False,
        "plan_sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "evidence_bundles": [],
        "reason": "No valid >=2x application slowdown with recovery; 1 GiB pilot reached host commit guard. Per-target/state/level calibration is incomplete.",
        "executed_final_cells": 0, "executed_final_blocks": 0})
    rows = []
    references = ["20261016-ollama-smoke-1536mib", "20261016-calibration-pilot/level-128mib",
                  "20261016-calibration-pilot/level-1024mib", "20261016-frozen-source-cuda"]
    for reference in references:
        directory = ROOT / "traces/repro" / reference
        verify_bundle(directory)
        report = json.loads((directory / "report.json").read_text())
        rows.append({"bundle": f"traces/repro/{reference}", "report_sha256": hashlib.sha256((directory / "report.json").read_bytes()).hexdigest(),
            "origin": report["data_origin"], "purpose": report["metadata"]["purpose"], "verdict": report["verdict"],
            "primary_metric": report["primary_metric"], "mechanism": report["mechanism"],
            "trials": [{"verdict": trial["verdict"], "stages": [{key: stage.get(key) for key in
                ("stage", "completed", "latency_ms", "metric_value", "work_units", "errors", "overlap_samples")}
                for stage in trial["stages"]]} for trial in report["trials"]]})
    overhead = json.loads((ROOT / "traces/repro/20261016-overhead/overhead.json").read_text())
    write_json(ROOT / "bench/results/research_engineering_validation_20261016.json", {
        "schema_version": 1, "date": "2026-10-16", "bundles": rows,
        "overhead": {"bundle": "traces/repro/20261016-overhead", "ratios": overhead["paired_workload_ratios"],
                     "limits": overhead["limits"]},
        "arithmetic_helper": {"bundle": "traces/repro/20261016-arithmetic-control-r3", "completed": True,
                              "scope": "helper execution only; not a matched application confounder study"},
        "campaign": {"cells": 72, "planned_whole_blocks": 432, "executed": 0, "gate": "unmet"},
        "conclusions": {"application_failure": "not reproduced", "reducer_empirical_benefit": "NO DATA FOUND",
                        "remedy_benefit": "not evaluable without a failure witness", "direct_residency_cause": "unverified"}})
    print("Prepared 72 cells / 432 planned blocks; executed 0. Evidence hashes verified.")


if __name__ == "__main__":
    main()
