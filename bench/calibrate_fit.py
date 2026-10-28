"""E3 — calibrate and evaluate the VRAM fit estimator against measured usage.

For each (model, n_ctx) the script asks Ollama to load the model with that context,
generates a few tokens (so compute buffers are allocated), then reads the runner
process's *measured* dedicated VRAM from PDH (via the SpillGuard collector) and
Ollama's own size_vram. Results go to bench/results/e3_fit.csv.

The CUDA/runtime overhead O is the one free constant. It is fitted as the median
residual, and the error is reported with leave-one-out cross-validation, so the
reported MAE is not measured on the data it was fitted to.

  python bench/calibrate_fit.py --models qwen2.5:3b-instruct --ctx 2048 4096 8192 16384 32768 --write
"""
from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "agent"))
from spillguard import gguf_fit  # noqa: E402
from spillguard.collector import Collector  # noqa: E402
from spillguard.gguf_fit import FitConfig  # noqa: E402

OLLAMA = "http://127.0.0.1:11434"
RESULTS = Path(__file__).resolve().parent / "results"


def runner_vram(col: Collector, before: set[int]) -> tuple[int, str] | None:
    s = col.sample()
    cands = [p for p in s["procs"] if "ollama" in p["name"].lower() or p["pid"] not in before]
    if not cands:
        return None
    p = max(cands, key=lambda p: p["dedicated_mb"])
    return p["dedicated_mb"] + p["shared_mb"], p["name"]  # total GPU footprint = the claim to predict


def measure(model: str, ctx: int, col: Collector, cli: httpx.Client) -> dict:
    cli.post(f"{OLLAMA}/api/generate", json={"model": model, "keep_alive": 0}, timeout=60)  # unload
    time.sleep(2)
    before = {p["pid"] for p in col.sample()["procs"]}
    t0 = time.time()
    r = cli.post(f"{OLLAMA}/api/generate", timeout=300, json={
        "model": model, "prompt": "Count from 1 to 20.", "stream": False, "keep_alive": "2m",
        "options": {"num_ctx": ctx, "num_predict": 32, "temperature": 0}})
    r.raise_for_status()
    gen = r.json()
    time.sleep(1.5)
    peak, name = 0, ""
    for _ in range(3):
        v = runner_vram(col, before)
        if v and v[0] > peak:
            peak, name = v
        time.sleep(0.7)
    ps = cli.get(f"{OLLAMA}/api/ps").json().get("models", [])
    mine = next((m for m in ps if m["name"].startswith(model.split(":")[0])), {})
    return {"model": model, "ctx": ctx, "measured_mb": peak, "runner": name,
            "ollama_size_mb": mine.get("size", 0) // 2**20, "ollama_size_vram_mb": mine.get("size_vram", 0) // 2**20,
            "tok_s": round(gen.get("eval_count", 0) / max(1e-9, gen.get("eval_duration", 1) / 1e9), 1),
            "load_s": round(time.time() - t0, 1)}


FEATURES = {
    "const": lambda r: [1.0],
    "const+vision": lambda r: [1.0, float(r["is_vision"])],
    "linear+vision": lambda r: [1.0, r["ctx"] / 1024, float(r["is_vision"])],
}


def lstsq(X, y):
    import numpy as np
    return np.linalg.lstsq(np.array(X, float), np.array(y, float), rcond=None)[0].tolist()


def gpu_name() -> str:
    from spillguard import dxgi
    p = dxgi.pick_primary(dxgi.enumerate_adapters(query_budget=False))
    return p.name if p else "unknown GPU"


def add_predictions(rows: list[dict], infos: dict) -> None:
    zero = {**gguf_fit.DEFAULT_CAL, "overhead_mb": 0, "buffer_slack_mb": 0}
    for r in rows:
        info = infos[r["model"]]
        r["is_vision"] = int(info.vision_mb > 0)
        r["full_offload"] = int(not r["ollama_size_vram_mb"] or r["ollama_size_vram_mb"] >= r["ollama_size_mb"])
        for fa in (0, 1):
            e = gguf_fit.estimate(info, FitConfig(n_ctx=int(r["ctx"]), flash_attn=bool(fa)), zero)
            r[f"pred_fa{fa}"] = round(e.total_mb)


def analyse(rows: list[dict]) -> tuple[dict, str]:
    fit_rows = [r for r in rows if r["full_offload"]]
    report = {}
    for fa in (0, 1):
        for name, feat in FEATURES.items():
            X = [feat(r) for r in fit_rows]
            y = [r["measured_mb"] - r[f"pred_fa{fa}"] for r in fit_rows]
            if len(fit_rows) <= len(X[0]):
                continue
            errs = []
            for i in range(len(fit_rows)):
                coef = lstsq(X[:i] + X[i + 1:], y[:i] + y[i + 1:])
                errs.append(abs(y[i] - sum(c * x for c, x in zip(coef, X[i]))))
            coef = lstsq(X, y)
            key = f"fa{fa}_{name}"
            report[key] = {"flash_attn": bool(fa), "features": name, "coef": [round(c, 2) for c in coef],
                           "loo_mae_mb": round(statistics.mean(errs)), "loo_max_mb": round(max(errs)),
                           "n": len(fit_rows)}
            print(f"{key:<20} coef={report[key]['coef']}  LOO-MAE={report[key]['loo_mae_mb']} MB  max={report[key]['loo_max_mb']} MB")
    # Ties (within 5 MB) go to the fit whose coefficients are physically meaningful (all >= 0):
    # without flash attention the linear term can go negative to cancel the KQ-scratch term.
    best = min(report, key=lambda k: (report[k]["loo_mae_mb"] // 5, any(c < 0 for c in report[k]["coef"]),
                                      report[k]["loo_mae_mb"]))
    return report, best


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", nargs="+", required=True)
    ap.add_argument("--ctx", nargs="+", type=int, default=[2048, 4096, 8192, 16384, 32768])
    ap.add_argument("--from-csv", action="store_true", help="re-analyse bench/results/e3_fit.csv without measuring")
    ap.add_argument("--write", action="store_true", help="write agent/calibration.json")
    a = ap.parse_args()

    infos = {m: gguf_fit.load_model(m) for m in a.models}
    out = RESULTS / "e3_fit.csv"
    if a.from_csv:
        with open(out) as f:
            rows = [{k: (int(v) if v.lstrip("-").isdigit() else (float(v) if k == "tok_s" else v)) for k, v in r.items()}
                    for r in csv.DictReader(f) if r["model"] in infos]
    else:
        col = Collector(use_ollama=False)
        cli = httpx.Client()
        rows = []
        for model, info in infos.items():
            for ctx in a.ctx:
                if ctx > info.ctx_train:
                    continue
                rows.append(measure(model, ctx, col, cli))
                print(json.dumps(rows[-1]))
            cli.post(f"{OLLAMA}/api/generate", json={"model": model, "keep_alive": 0}, timeout=60)
    keep = ["model", "ctx", "measured_mb", "runner", "ollama_size_mb", "ollama_size_vram_mb", "tok_s", "load_s"]
    rows = [{k: r[k] for k in keep} for r in rows]
    add_predictions(rows, infos)

    RESULTS.mkdir(exist_ok=True)
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)

    report, best = analyse(rows)
    full = [r for r in rows if r["full_offload"]]
    ollama_mae = round(statistics.mean(abs(r["measured_mb"] - r["ollama_size_vram_mb"]) for r in full))
    partial = [f"{r['model']}@{r['ctx']}" for r in rows if not r["full_offload"]]
    print(f"Ollama's own size_vram vs measured (full offloads): MAE={ollama_mae} MB")
    print(f"excluded partial offloads (type A observed): {partial}")
    print(f"best: {best}")
    (RESULTS / "e3_summary.json").write_text(json.dumps({"fits": report, "best": best, "ollama_size_vram_mae_mb": ollama_mae,
                                                         "partial_offload_rows": partial}, indent=1))
    if a.write:
        r = report[best]
        keys = {"const": ["overhead_mb"], "const+vision": ["overhead_mb", "vision_buffer_mb"],
                "linear+vision": ["overhead_mb", "buffer_per_kctx_mb", "vision_buffer_mb"]}[r["features"]]
        coef = dict(zip(keys, r["coef"]))
        cal = {**gguf_fit.DEFAULT_CAL, "buffer_slack_mb": 0, **coef, "runtime_flash_attn": r["flash_attn"],
               "source": f"calibrated {time.strftime('%Y-%m-%d')} on {gpu_name()}, "
                         f"{r['features']}, n={r['n']}, LOO-MAE {r['loo_mae_mb']} MB"}
        gguf_fit.CALIBRATION_FILE.write_text(json.dumps(cal, indent=1))
        print(f"wrote {gguf_fit.CALIBRATION_FILE}: {cal}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
