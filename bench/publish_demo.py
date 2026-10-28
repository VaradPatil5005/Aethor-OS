"""Copy measured SpillGuard Repro results into public/research/ so the AetherOS evidence desk
can open them with one click (no file picker), and in any browser without the agent.

Privacy: these files ship inside the web build, so the hostname is removed and GPU processes
that are not part of the experiment are renamed "other app". Measurements are not changed.

  agent/.venv/Scripts/python.exe bench/publish_demo.py
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
OUT = REPO / "public" / "research"
T = REPO / "traces" / "repro"
A = REPO / "artifacts" / "spillguard-repro"

# Processes that belong to the experiment keep their names; everything else is anonymised.
EXPERIMENT_PROCS = ("python.exe", "llama-server.exe", "ollama.exe", "dwm.exe")

ITEMS = [
    # group, title, kind, source, note
    ("Headline result (18 Oct 2026)", "Dose-response + intervention + remedies (all in one)", "report",
     REPO / "public" / "traces" / "demo-dose-response.json", "Chart of slowdown vs VRAM overflow, idle co-tenant, fixes, detector check"),
    ("Dose-response runs (active co-tenant)", "−512 MiB: model still fits (control)", "report",
     T / "20261018-dose-response" / "dose-minus512mib" / "report.json", "valid non-reproduction, 1.16×"),
    ("Dose-response runs (active co-tenant)", "0 MiB: exactly at capacity", "report",
     T / "20261018-dose-response" / "dose-plus0mib" / "report.json", "valid non-reproduction, 1.21×"),
    ("Dose-response runs (active co-tenant)", "+256 MiB over capacity — reproduced witness", "report",
     T / "20261018-dose-response" / "dose-plus256mib" / "report.json", "slowdown reproduced, 2.36×"),
    ("Dose-response runs (active co-tenant)", "+512 MiB over capacity", "report",
     T / "20261018-dose-response" / "dose-plus512mib" / "report.json", "slowdown reproduced, 2.33×"),
    ("Intervention: idle co-tenant (same bytes)", "+256 MiB, co-tenant idle", "report",
     T / "20261018-idle-cotenant" / "dose-plus256mib" / "report.json", "1 valid trial 1.03×; 1 stopped by commit guard"),
    ("Intervention: idle co-tenant (same bytes)", "+512 MiB, co-tenant idle", "report",
     T / "20261018-idle-cotenant" / "dose-plus512mib" / "report.json", "stopped by commit guard (inconclusive)"),
    ("Remedies on the +256 MiB witness", "Fresh re-validation of the witness", "report",
     T / "20261018-remedy-plus256-r2" / "original-validation" / "report.json", "reproduced again, 2.34×"),
    ("Remedies on the +256 MiB witness", "Release the whole co-tenant", "report",
     T / "20261018-remedy-plus256-r2" / "release-owned-holder" / "report.json", "fixed, 1.01×"),
    ("Remedies on the +256 MiB witness", "Run the co-tenant after the target", "report",
     T / "20261018-remedy-plus256-r2" / "serialize-owned-background" / "report.json", "fixed, 1.00×"),
    ("Remedies on the +256 MiB witness", "Release half of the co-tenant's bytes", "report",
     T / "20261018-remedy-plus256-r2" / "release-half-owned-bytes" / "report.json", "fixed, 1.10×"),
    ("Remedies on the +256 MiB witness", "Release one eighth of its bytes", "report",
     T / "20261018-remedy-plus256-r2" / "release-eighth-owned-bytes" / "report.json", "fixed, 1.19×"),
    ("Remedies on the +256 MiB witness", "Keep every byte, stop touching it", "report",
     T / "20261018-remedy-plus256-r2" / "pause-owned-activity" / "report.json", "fixed, 1.01× — least disruptive"),
    ("Live GPU traces of the witness (replay)", "+256 MiB trial 1 · baseline", "trace",
     T / "20261018-dose-response" / "dose-plus256mib" / "trial-001-baseline" / "trace.jsonl", "model alone"),
    ("Live GPU traces of the witness (replay)", "+256 MiB trial 1 · pressure", "trace",
     T / "20261018-dose-response" / "dose-plus256mib" / "trial-001-pressure" / "trace.jsonl", "co-tenant resident, VRAM at its ceiling"),
    ("Live GPU traces of the witness (replay)", "+256 MiB trial 1 · recovery", "trace",
     T / "20261018-dose-response" / "dose-plus256mib" / "trial-001-recovery" / "trace.jsonl", "co-tenant released"),
    ("Earlier work (17 Oct 2026)", "Whole-block analysis of the earlier runs", "report",
     A / "20261017-analysis" / "summary.json", "pre-witness campaign summary"),
    ("Earlier work (17 Oct 2026)", "Reducer comparison: phase-aware (fixture)", "report",
     A / "20261017-fixture-comparison" / "phase-aware.json", "synthetic fixture, not a GPU measurement"),
    ("Earlier work (17 Oct 2026)", "Reducer comparison: plain ddmin (fixture)", "report",
     A / "20261017-fixture-comparison" / "ddmin.json", "synthetic fixture, not a GPU measurement"),
]


def scrub(value):
    """Remove hostnames and absolute local paths anywhere in a JSON value."""
    if isinstance(value, dict):
        return {k: scrub(v) for k, v in value.items() if k not in ("hostname", "source_sha256")}
    if isinstance(value, list):
        return [scrub(v) for v in value]
    if isinstance(value, str) and (":\\" in value or value.startswith("/Users/")):
        return Path(value).name
    return value


def scrub_frame(frame: dict) -> dict:
    frame = scrub(frame)
    for p in frame.get("procs", []) or []:
        if str(p.get("name", "")).lower() not in EXPERIMENT_PROCS:
            p["name"] = "other app"
    for e in frame.get("events", []) or []:
        if "name" in e and str(e["name"]).lower() not in EXPERIMENT_PROCS:
            e["name"] = "other app"
        c = e.get("culprit")
        if isinstance(c, dict) and str(c.get("name", "")).lower() not in EXPERIMENT_PROCS:
            c["name"] = "other app"
    return frame


def main() -> int:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    index, missing = [], []
    for n, (group, title, kind, src, note) in enumerate(ITEMS, 1):
        if not src.exists():
            missing.append(str(src.relative_to(REPO)))
            continue
        name = f"{n:02d}-{src.parent.name if src.name in ('report.json', 'trace.jsonl', 'summary.json') else src.stem}{src.suffix}"
        if kind == "trace":
            lines = src.read_text(encoding="utf-8").splitlines()
            out = [json.dumps(scrub(json.loads(lines[0])))] + [json.dumps(scrub_frame(json.loads(l)), separators=(",", ":")) for l in lines[1:] if l.strip()]
            (OUT / name).write_text("\n".join(out) + "\n", encoding="utf-8")
        else:
            (OUT / name).write_text(json.dumps(scrub(json.loads(src.read_text(encoding="utf-8"))), indent=1), encoding="utf-8")
        index.append({"id": name, "group": group, "title": title, "kind": kind, "file": f"/research/{name}", "note": note})
    (OUT / "index.json").write_text(json.dumps({"schema_version": 1, "items": index}, indent=1), encoding="utf-8")
    text = "\n".join(p.read_text(encoding="utf-8") for p in OUT.iterdir())
    leaks = [s for s in ("TLG17", "F:\\\\os", "varad", "WhatsApp", "EpicGames") if s.lower() in text.lower()]
    print(f"published {len(index)} files to {OUT.relative_to(REPO)}; missing: {missing or 'none'}; leak check: {leaks or 'clean'}")
    return 1 if leaks else 0


if __name__ == "__main__":
    raise SystemExit(main())
