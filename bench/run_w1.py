"""Run W1 (spillstress) N times while `spillguard record` captures a trace of each run.

  python bench/run_w1.py --repeats 3 --label fallback_on
  python bench/run_w1.py --repeats 3 --label fallback_off   # after setting
        NVIDIA Control Panel > Manage 3D settings > Program settings > python.exe >
        "CUDA - Sysmem Fallback Policy" = Prefer No Sysmem Fallback

Outputs traces/w1/<label>_rN.trace.jsonl and <label>_rN.truth.jsonl.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PY = REPO / "agent" / ".venv" / "Scripts" / "python.exe"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repeats", type=int, default=3)
    ap.add_argument("--label", default="fallback_on")
    ap.add_argument("--max-mb", type=int, default=7168)
    ap.add_argument("--block-mb", type=int, default=256)
    ap.add_argument("--interval", type=float, default=2.0)
    ap.add_argument("--cooldown", type=float, default=15.0)
    a = ap.parse_args()
    out = REPO / "traces" / "w1"
    out.mkdir(parents=True, exist_ok=True)
    stress_s = (a.max_mb // a.block_mb) * (a.interval + 0.4) + 25
    for r in range(1, a.repeats + 1):
        stem = out / f"{a.label}_r{r}"
        rec = subprocess.Popen([str(PY), "-m", "spillguard", "record", "-s", str(stress_s + 15), "--no-ollama",
                                "-o", f"{stem}.trace.jsonl"], cwd=REPO / "agent")
        time.sleep(5)
        subprocess.call([str(PY), str(REPO / "bench" / "spillstress.py"), "--block-mb", str(a.block_mb),
                         "--interval", str(a.interval), "--max-mb", str(a.max_mb), "--hold", "10",
                         "--log", f"{stem}.truth.jsonl"], stdout=subprocess.DEVNULL)
        rec.wait()
        print(f"run {r}/{a.repeats} done -> {stem}.*", flush=True)
        if r < a.repeats:
            time.sleep(a.cooldown)
    return 0


if __name__ == "__main__":
    sys.exit(main())
