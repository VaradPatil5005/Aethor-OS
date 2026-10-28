"""spillguard — detect, explain and prevent silent VRAM -> system-RAM spill on Windows.

  spillguard serve                 live agent + AetherOS dashboard on http://127.0.0.1:8765
  spillguard record -s 120 -o t.jsonl   record a trace (no server)
  spillguard analyze t.jsonl       re-run the detector over a trace, print events
  spillguard status                one-shot summary of GPU memory tiers
  spillguard why <pid>             explain one process's spill state
  spillguard fit <model> --ctx 8192     VRAM estimate + admission verdict
  spillguard run [--ctx N] -- <cmd...>  launch llama.cpp / Ollama with a config that fits
  spillguard facts                 machine facts (GPU, driver, counters) as JSON
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # agent/
REPO = ROOT.parent
SESSION = Path(os.environ.get("LOCALAPPDATA", tempfile.gettempdir())) / "SpillGuard" / "session.json"


def _dist_dir() -> Path | None:
    # PyInstaller one-file bundles data under sys._MEIPASS
    base = Path(getattr(sys, "_MEIPASS", REPO))
    for d in (base / "dist", base / "aetheros_dist", REPO / "dist"):
        if (d / "index.html").exists():
            return d
    return None


def _session() -> dict | None:
    try:
        s = json.loads(SESSION.read_text())
        import psutil
        return s if psutil.pid_exists(s["pid"]) else None
    except Exception:
        return None


def _api(path: str, body: dict | None = None):
    s = _session()
    if not s:
        return None
    import httpx
    url = f"http://127.0.0.1:{s['port']}{path}"
    headers = {"Authorization": f"Bearer {s['token']}"}
    try:
        r = httpx.post(url, json=body, headers=headers, timeout=10) if body is not None else httpx.get(url, headers=headers, timeout=5)
        return r.json()
    except Exception:
        return None


def _standalone_frame(seconds: float = 2.0) -> tuple[dict, dict]:
    from .collector import Collector
    from .runtime import Runtime
    rt = Runtime(Collector())
    frame = None
    end = time.monotonic() + seconds
    while time.monotonic() < end or frame is None:
        frame = rt.tick()
        time.sleep(0.5)
    peaks = rt.peaks
    rt.stop()
    return frame, peaks


def _latest() -> tuple[dict, dict | None, bool]:
    st = _api("/api/status")
    if st and st.get("frame"):
        return st["frame"], st, True
    f, _ = _standalone_frame()
    return f, None, False


# ---- commands ------------------------------------------------------------------------------
def cmd_serve(a) -> int:
    import uvicorn
    from .analyzer import Params
    from .collector import Collector
    from .runtime import Runtime
    from .server import create_app, new_token

    trace = a.trace
    if trace == "auto":
        # A frozen .exe unpacks to a temp dir, so its traces go to %LOCALAPPDATA%\SpillGuard\traces.
        tdir = SESSION.parent / "traces" if getattr(sys, "frozen", False) else REPO / "traces"
        trace = str(tdir / f"live-{time.strftime('%Y%m%d-%H%M%S')}.jsonl")
    rt = Runtime(Collector(luid=a.luid, use_ollama=not a.no_ollama), Params(), trace_path=trace)
    rt.start(a.interval)
    token = new_token()
    dist = Path(a.dist) if a.dist else _dist_dir()
    dev = ["http://localhost:3000", "http://127.0.0.1:3000"] if a.dev else []
    app = create_app(rt, token, a.port, dist, dev)
    SESSION.parent.mkdir(parents=True, exist_ok=True)
    SESSION.write_text(json.dumps({"port": a.port, "token": token, "pid": os.getpid()}))
    url = f"http://127.0.0.1:{a.port}/#sg={token}"
    print(f"SpillGuard agent on {rt.facts['adapters'] and rt.collector.primary.name}")
    print(f"  dashboard : {url}" if dist else "  dashboard : (no AetherOS build found; run `npm run build`)")
    if a.dev:
        print(f"  dev       : http://localhost:3000/#sg={token}&agent=127.0.0.1:{a.port}")
    if trace:
        print(f"  trace     : {trace}")
    if dist and not a.no_browser:
        webbrowser.open(url)
    try:
        uvicorn.run(app, host="127.0.0.1", port=a.port, log_level="warning")
    finally:
        rt.stop()
        try:
            SESSION.unlink()
        except Exception:
            pass
    return 0


def cmd_record(a) -> int:
    from .collector import Collector
    from .runtime import Runtime
    rt = Runtime(Collector(luid=a.luid, use_ollama=not a.no_ollama), trace_path=a.out)
    print(f"recording {a.seconds}s at {a.interval}s -> {a.out}")
    end = time.time() + a.seconds
    nxt = time.monotonic()
    try:
        while time.time() < end:
            f = rt.tick()
            for e in f["events"]:
                print(f"  {time.strftime('%H:%M:%S', time.localtime(e['t']))} {e['type']} {e.get('name', '')} {e.get('spill_mb', '')}")
            nxt += a.interval
            time.sleep(max(0.0, nxt - time.monotonic()))
    except KeyboardInterrupt:
        pass
    finally:
        rt.stop()
    return 0


def cmd_analyze(a) -> int:
    from dataclasses import fields
    from .analyzer import Analyzer, Params
    from .trace import read_trace, TraceWriter
    kw = {}
    for f in fields(Params):
        v = getattr(a, f.name, None)
        if v is not None:
            kw[f.name] = v
    header, frames = read_trace(a.trace)
    an = Analyzer(Params(**kw))
    out = TraceWriter(a.out, {**{k: v for k, v in header.items() if k not in ("type", "started")},
                              "params": an.p.to_dict(), "reanalyzed_from": str(a.trace)}) if a.out else None
    n = 0
    for fr in frames:
        f = an.step(fr)
        n += 1
        if out:
            out.write(f)
        for e in f["events"]:
            extra = {k: v for k, v in e.items() if k not in ("type", "t")}
            print(f"{time.strftime('%H:%M:%S', time.localtime(e['t']))}  {e['type']:<18} {json.dumps(extra)[:150]}")
    if out:
        out.close()
    print(f"{n} frames, {an.spill_episodes} spill episode(s)")
    return 0


def _bar(ded: int, spill: int, width: int = 30, total: int = 1) -> str:
    d = round(width * ded / total)
    s = min(width - d, round(width * spill / total))
    return "#" * d + "!" * s + "." * (width - d - s)


def cmd_status(a) -> int:
    f, _, live = _latest()
    ad, sysm = f["adapter"], f["system"]
    V = ad["vram_total_mb"]
    print(f"{ad['name']}  [{ad['state']}]  {'(live agent)' if live else '(one-shot sample)'}")
    print(f"  VRAM    {ad['dedicated_mb']:>6} / {V} MB  ({100 * ad['load']:.0f}%)   OS budget {ad.get('budget_mb')} MB")
    print(f"  shared  {ad['shared_mb']:>6} MB of {ad['shared_cap_mb']} MB cap")
    print(f"  RAM     commit {sysm.get('commit_pct')}%  available {sysm.get('avail_mb')} MB  "
          f"{'RAM PRESSURE' if sysm.get('ram_pressure') else ''}")
    if f.get("ollama"):
        for m in f["ollama"]:
            split = "" if m["size_vram_mb"] >= m["size_mb"] else f"  <- {100 - 100 * m['size_vram_mb'] // max(1, m['size_mb'])}% on CPU (type A)"
            print(f"  ollama  {m['name']}: {m['size_vram_mb']}/{m['size_mb']} MB in VRAM{split}")
    print(f"\n  {'PID':>6}  {'PROCESS':<28}{'VRAM':>7}{'SHARED':>8}{'SPILL':>7}  STATE")
    for p in f["procs"][: a.top]:
        print(f"  {p['pid']:>6}  {p['name'][:27]:<28}{p['dedicated_mb']:>7}{p['shared_mb']:>8}{p['spill_mb']:>7}  {p['state']}")
    return 0


def cmd_why(a) -> int:
    f, st, live = _latest()
    p = next((x for x in f["procs"] if x["pid"] == a.pid), None)
    if not p:
        print(f"PID {a.pid} holds no memory on {f['adapter']['name']}.")
        return 1
    ad = f["adapter"]
    print(f"{p['name']} (PID {p['pid']}) on {ad['name']}")
    print(f"  in VRAM          {p['dedicated_mb']} MB")
    print(f"  in shared RAM    {p['shared_mb']} MB (baseline {p['baseline_shared_mb']} MB before pressure)")
    print(f"  spilled          {p['spill_mb']} MB  -> ratio {100 * p['ratio']:.0f}% of its GPU memory lives in system RAM")
    print(f"  adapter          {100 * ad['load']:.0f}% of physical VRAM in use  [{ad['state']}]")
    if p["state"] == "SPILLING":
        print("\n  Verdict: SPILLING (type B, driver/WDDM). GPU reads of that memory cross PCIe;")
        print("  on this laptop's RTX 3050 that measured ~13 GB/s vs ~163 GB/s in VRAM.")
    elif p["state"] == "PRESSURED":
        print("\n  Verdict: VRAM is under pressure but this process has not grown its shared memory.")
    else:
        print("\n  Verdict: no spill.")
    evs = [e for e in (st or {}).get("events", []) if e.get("pid") == a.pid]
    for e in evs[-5:]:
        c = e.get("culprit")
        line = f"  {time.strftime('%H:%M:%S', time.localtime(e['t']))} {e['type']}"
        if c:
            line += f"  likely culprit: {'itself' if c['self_inflicted'] else c['name'] + ' (PID ' + str(c['pid']) + ')'}" \
                    f", +{c['growth_mb']} MB VRAM in the 30 s before onset"
        print(line)
    others = sorted((x for x in f["procs"] if x["pid"] != a.pid), key=lambda x: -x["dedicated_mb"])[:3]
    if others:
        print("  other VRAM holders: " + ", ".join(f"{x['name']} {x['dedicated_mb']} MB" for x in others))
    if not live:
        print("  (one-shot sample: run `spillguard serve` for history and culprit attribution)")
    return 0


def _fit_cfg(a):
    from .gguf_fit import FitConfig, load_calibration
    fa = a.flash_attn if a.flash_attn is not None else bool(load_calibration().get("runtime_flash_attn"))
    fa = fa or a.kv != "f16"
    return FitConfig(n_ctx=a.ctx, kv_type=a.kv, n_gpu_layers=a.ngl, flash_attn=fa, n_parallel=a.parallel)


def _print_advice(r: dict) -> None:
    e = r["estimate"]
    m = r["model"]
    print(f"{m['name']}  ({m['arch']}, {m['quant']}, {m['n_layer']} layers, {m['n_head_kv']} KV heads, file {m['file_mb']} MB)")
    print(f"  weights on GPU {e['weights_mb']:>7.0f} MB   ({e['layers_on_gpu']}/{e['total_layers']} layers)")
    print(f"  KV cache       {e['kv_mb']:>7.0f} MB")
    print(f"  compute buffer {e['buffer_mb']:>7.0f} MB")
    print(f"  CUDA overhead  {e['overhead_mb']:>7.0f} MB   [{r['calibration']}]")
    print(f"  = predicted    {e['total_mb']:>7} MB VRAM;  free for a new claim: {r['available_mb'][0]} MB")
    print(f"\n  verdict: {r['verdict']}" + (f" - {r['reason']}" if r["verdict"] != "SAFE" else ""))
    s = r.get("suggested")
    if r["verdict"] == "FIXABLE" and s:
        c = s["config"]
        print(f"  suggested: ctx {c['n_ctx']}, KV {c['kv_type']}{', flash-attn' if c['flash_attn'] else ''}, "
              f"GPU layers {'all' if c['n_gpu_layers'] >= 999 else c['n_gpu_layers']}  -> {s['vram_mb']} MB")
    if m.get("sliding_window"):
        print("  note: sliding-window attention model; KV estimate is an upper bound")


def cmd_fit(a) -> int:
    from . import gguf_fit
    from .advisor import advise
    cfg = _fit_cfg(a)
    r = _api("/api/advise", {"model": a.model, **cfg.to_dict()})
    if not r or "error" in r:
        if r and "error" in r:
            print(r["error"])
            return 1
        m = gguf_fit.load_model(a.model)
        frame, peaks = _standalone_frame()
        r = advise(m, cfg, frame, peaks)
    if a.json:
        print(json.dumps(r, indent=1))
    else:
        _print_advice(r)
    return 0 if r["verdict"] != "UNSAFE" else 2


def cmd_run(a) -> int:
    from . import gguf_fit
    from .advisor import advise, llama_cpp_args, ollama_env, ollama_modelfile
    cmd = list(a.cmd)
    if cmd and cmd[0] == "--":
        cmd = cmd[1:]
    if not cmd:
        print("usage: spillguard run [--ctx N] [--model M] -- <command ...>")
        return 1
    exe = Path(cmd[0]).name.lower().removesuffix(".exe")
    kind = "ollama" if exe == "ollama" else ("llamacpp" if exe.startswith("llama") else "other")
    model = a.model
    if not model and kind == "llamacpp" and "-m" in cmd:
        model = cmd[cmd.index("-m") + 1]
    if not model and kind == "ollama" and len(cmd) >= 3 and cmd[1] == "run":
        model = cmd[2]
    if kind == "other" or not model:
        print("spillguard run understands llama.cpp (-m model.gguf) and `ollama run <model>`; launching unchanged.")
        return subprocess.call(cmd)

    m = gguf_fit.load_model(model)
    cfg = _fit_cfg(a)
    r = _api("/api/advise", {"model": model, **cfg.to_dict()})
    if not r or "error" in r:
        frame, peaks = _standalone_frame()
        r = advise(m, cfg, frame, peaks)
    _print_advice(r)
    if r["verdict"] == "UNSAFE":
        print("\nNothing fits right now. Free VRAM (close the holders above) or pick a smaller model.")
        if not a.force:
            return 2
    chosen = (r.get("suggested") or r["requested"])["config"]
    env = dict(os.environ)
    if kind == "llamacpp":
        strip = {"-c", "--ctx-size", "-ngl", "--n-gpu-layers", "-ctk", "-ctv", "-fa", "--flash-attn", "-np"}
        out, i = [], 0
        while i < len(cmd):
            if cmd[i] in strip:
                i += 2
                continue
            out.append(cmd[i])
            i += 1
        final = out + llama_cpp_args(chosen)
    else:
        mf = ollama_modelfile(model, chosen)
        derived = f"{model.split(':')[0]}-sg{chosen['n_ctx'] // 1024}k"
        print(f"\nOllama sets context per model. Will create '{derived}' from:\n{mf}")
        envs = ollama_env(chosen)
        if any(k != "OLLAMA_CONTEXT_LENGTH" for k in envs):
            print("KV cache type / flash attention are Ollama *server* settings. Restart the server with:")
            print("  " + " ".join(f"{k}={v}" for k, v in envs.items()) + "  ollama serve")
        final = ["ollama", "run", derived] + cmd[3:]
    print("\nwill run: " + " ".join(final))
    if not a.yes and input("proceed? [y/N] ").strip().lower() != "y":
        return 1
    if kind == "ollama":
        with tempfile.NamedTemporaryFile("w", suffix=".Modelfile", delete=False) as f:
            f.write(ollama_modelfile(model, chosen))
        rc = subprocess.call(["ollama", "create", derived, "-f", f.name])
        os.unlink(f.name)
        if rc:
            return rc
    return subprocess.call(final, env=env)


def cmd_facts(a) -> int:
    from .collector import Collector
    c = Collector()
    print(json.dumps(c.machine_facts(), indent=1))
    c.close()
    return 0


def cmd_repro(a) -> int:
    from .repro.cli import main as repro_main
    return repro_main(a.repro_args)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="spillguard", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("repro", help="controlled experiments, evidence bundles and plain reduction")
    s.add_argument("repro_args", nargs=argparse.REMAINDER)
    s.set_defaults(fn=cmd_repro)

    s = sub.add_parser("serve")
    s.add_argument("--port", type=int, default=8765)
    s.add_argument("--interval", type=float, default=1.0)
    s.add_argument("--dist", default=None, help="AetherOS build directory (default: ./dist)")
    s.add_argument("--trace", default="auto", help="'auto', a path, or '' to disable")
    s.add_argument("--luid", default=None)
    s.add_argument("--dev", action="store_true", help="also accept the Vite dev server origin")
    s.add_argument("--no-browser", action="store_true")
    s.add_argument("--no-ollama", action="store_true")
    s.set_defaults(fn=cmd_serve)

    s = sub.add_parser("record")
    s.add_argument("-s", "--seconds", type=float, default=60)
    s.add_argument("-o", "--out", required=True)
    s.add_argument("--interval", type=float, default=1.0)
    s.add_argument("--luid", default=None)
    s.add_argument("--no-ollama", action="store_true")
    s.set_defaults(fn=cmd_record)

    s = sub.add_parser("analyze")
    s.add_argument("trace")
    s.add_argument("-o", "--out", default=None, help="write a re-analyzed trace")
    for name, typ in (("theta_hi", float), ("theta_lo", float), ("delta_mb", int), ("k", int), ("exit_k", int)):
        s.add_argument(f"--{name.replace('_', '-')}", dest=name, type=typ, default=None)
    s.set_defaults(fn=cmd_analyze)

    s = sub.add_parser("status")
    s.add_argument("--top", type=int, default=10)
    s.set_defaults(fn=cmd_status)

    s = sub.add_parser("why")
    s.add_argument("pid", type=int)
    s.set_defaults(fn=cmd_why)

    for name, fn in (("fit", cmd_fit), ("run", cmd_run)):
        s = sub.add_parser(name)
        if name == "fit":
            s.add_argument("model", help=".gguf path or Ollama model name (e.g. qwen2.5:3b-instruct)")
            s.add_argument("--json", action="store_true")
        else:
            s.add_argument("--model", default=None, help="override model detection")
            s.add_argument("-y", "--yes", action="store_true")
            s.add_argument("--force", action="store_true", help="launch even if UNSAFE")
        s.add_argument("--ctx", type=int, default=4096)
        s.add_argument("--kv", choices=["f16", "q8_0", "q4_0"], default="f16")
        s.add_argument("--ngl", type=int, default=999)
        s.add_argument("--flash-attn", dest="flash_attn", action="store_true", default=None)
        s.add_argument("--no-flash-attn", dest="flash_attn", action="store_false")
        s.add_argument("--parallel", type=int, default=1)
        if name == "run":
            s.add_argument("cmd", nargs=argparse.REMAINDER)
        s.set_defaults(fn=fn)

    s = sub.add_parser("facts")
    s.set_defaults(fn=cmd_facts)

    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
