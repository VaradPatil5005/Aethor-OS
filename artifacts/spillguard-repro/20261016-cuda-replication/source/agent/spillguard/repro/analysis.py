"""Whole-block summaries with explicit invalid denominators and purpose separation."""
import csv
import json
from pathlib import Path
from statistics import median

from .evidence import verify_bundle, write_json
from .statistics import binomial_interval


def summarize_bundles(paths):
    groups = {}
    seen = set()
    for directory in paths:
        directory = Path(directory).resolve()
        if directory in seen:
            raise ValueError("duplicate bundle would count the same block twice")
        seen.add(directory)
        verify_bundle(directory)
        report = json.loads((directory / "report.json").read_text())
        purpose = report["metadata"].get("purpose", "unspecified")
        key = (report["recipe_signature"], purpose, report["data_origin"])
        group = groups.setdefault(key, {"recipe_signature": key[0], "purpose": key[1], "data_origin": key[2],
                    "bundles": [], "outcomes": [], "slowdowns": [], "recovery": [], "errors": [],
                    "planned_blocks": 0, "primary_metric": report["primary_metric"]})
        group["bundles"].append(str(directory))
        recipe = json.loads((directory / "recipe.json").read_text())
        planned = recipe.get("protocol", {}).get("repeats", 3)
        if len(report["trials"]) > planned:
            raise ValueError("more observed blocks than the declared plan")
        group["planned_blocks"] += planned
        for trial in report["trials"]:
            verdict = trial["verdict"]
            group["outcomes"].append(verdict["outcome"])
            if verdict.get("slowdown") is not None and verdict["outcome"] != "INCONCLUSIVE":
                group["slowdowns"].append(verdict["slowdown"])
                group["recovery"].append(verdict["recovery"])
            group["errors"].extend(e for s in trial["stages"] for e in s["errors"])
    result = []
    for group in groups.values():
        outcomes = group.pop("outcomes")
        k, n = outcomes.count("FAIL"), group["planned_blocks"]
        invalid = outcomes.count("INCONCLUSIVE") + n - len(outcomes)
        ratios, recoveries = group.pop("slowdowns"), group.pop("recovery")
        group.update(reproduced=k, valid_non_reproductions=outcomes.count("PASS"), invalid_or_missing=invalid,
                     reproduction_fraction_all_planned=k / n if n else None,
                     exact_95pct_binomial_interval=list(binomial_interval(k, n)) if n and n <= 200 else None,
                     median_slowdown=median(ratios) if ratios else None,
                     median_recovery=median(recoveries) if recoveries else None,
                     statistical_limit="conditional independent stationary whole-block assumption; invalid blocks included as non-successes; no token replication or tail-latency claim")
        result.append(group)
    return {"schema_version": 1, "groups": result, "pooling": "recipe, purpose and data origin kept separate"}


def write_analysis(summary, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=False)
    write_json(out / "summary.json", summary)
    fields = ["recipe_signature", "purpose", "data_origin", "planned_blocks", "reproduced",
              "valid_non_reproductions", "invalid_or_missing", "reproduction_fraction_all_planned", "median_slowdown"]
    with (out / "summary.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(summary["groups"])
    lines = ["# Experiment block analysis", "", "Groups remain separated by recipe, purpose and data origin.", "",
             "| Purpose | Planned | Reproduced | Valid negatives | Invalid/missing | Median slowdown |",
             "|---|---:|---:|---:|---:|---:|"]
    for group in summary["groups"]:
        lines.append(f"| {group['purpose']} | {group['planned_blocks']} | {group['reproduced']} | "
                     f"{group['valid_non_reproductions']} | {group['invalid_or_missing']} | {group['median_slowdown']} |")
    lines.extend(["", "Intervals are exact binomial intervals conditional on independent stationary whole blocks.",
                  "Search results are not pooled with fresh validation. Invalid blocks remain in the denominator.",
                  "This analysis does not establish a residency cause or generalize beyond the tested environment."])
    (out / "summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
