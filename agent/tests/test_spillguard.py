"""Unit tests for the SpillGuard agent. The analyzer tests replay a real trace recorded
on the RTX 3050 laptop (traces/pilot) as well as synthetic edge cases."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from spillguard.advisor import advise, llama_cpp_args, ollama_modelfile
from spillguard.analyzer import Analyzer, Params, analyze_frames
from spillguard.bankers import Job, admit, safety_check
from spillguard.collector import aggregate_adapters, aggregate_procs, parse_proc_instance
from spillguard.dxgi import luid_to_pdh
from spillguard.gguf_fit import FitConfig, ModelInfo, estimate
from spillguard.trace import read_trace

REPO = Path(__file__).resolve().parents[2]
PILOT = REPO / "traces" / "pilot" / "w1_fallback_on_r1.trace.jsonl"
PILOT_TRUTH = REPO / "traces" / "pilot" / "w1_fallback_on_r1.truth.jsonl"
LUID = "luid_0x00000000_0x00018056"
MB = 2**20


# ---- collector parsing ---------------------------------------------------------------------
def test_luid_format_matches_pdh():
    assert luid_to_pdh(0x18056, 0) == LUID


def test_parse_proc_instance():
    assert parse_proc_instance(f"pid_1234_{LUID}_phys_0") == (1234, LUID)
    assert parse_proc_instance("garbage") is None


def test_aggregate_procs_filters_luid_and_sums_phys():
    raw = {"dedicated": {f"pid_1_{LUID}_phys_0": 100 * MB, f"pid_1_{LUID}_phys_1": 50 * MB,
                         "pid_1_luid_0x00000000_0x0000aaaa_phys_0": 999 * MB},
           "shared": {f"pid_1_{LUID}_phys_0": 10 * MB}}
    out = aggregate_procs(raw, LUID)
    assert out == {1: {"dedicated_mb": 150, "shared_mb": 10, "committed_mb": 0}}


def test_aggregate_adapters():
    out = aggregate_adapters({"dedicated": {f"{LUID}_phys_0": 2048 * MB}, "shared": {f"{LUID}_phys_0": 5 * MB}})
    assert out[LUID] == {"dedicated_mb": 2048, "shared_mb": 5}


# ---- analyzer ------------------------------------------------------------------------------
def frame(t, ded, procs, V=6000, commit=50.0, avail=4000, ollama=None):
    return {"t": t, "adapter": {"luid": LUID, "vram_total_mb": V, "dedicated_mb": ded, "shared_mb": 0, "budget_mb": 5200},
            "procs": [{"pid": p, "name": n, "dedicated_mb": d, "shared_mb": s} for (p, n, d, s) in procs],
            "system": {"commit_pct": commit, "avail_mb": avail}, "ollama": ollama}


def run_sched(points):
    return analyze_frames([frame(t, *rest) for t, *rest in points])


def events(frames, kind=None):
    return [e for f in frames for e in f["events"] if kind is None or e["type"] == kind]


def test_no_spill_without_pressure():
    # shared grows a lot, but VRAM is nowhere near full: not a spill (an app's normal shared use)
    pts = [(t, 1000, [(1, "chrome.exe", 500, 50 + 100 * t)]) for t in range(10)]
    assert events(run_sched(pts), "SPILL_START") == []


def test_spill_detected_with_hysteresis_and_end():
    pts = [(t, 3000 + 300 * t, [(7, "llama-server.exe", 2800 + 300 * t, 80)]) for t in range(10)]  # ramp to 5700+
    pts += [(10 + t, 5900, [(7, "llama-server.exe", 5800, 80 + 200 * (t + 1))]) for t in range(5)]  # spill
    pts += [(15 + t, 5900, [(7, "llama-server.exe", 5800, 1080)]) for t in range(5)]  # steady: stays SPILLING
    pts += [(20 + t, 1000, [(7, "llama-server.exe", 900, 80)]) for t in range(5)]   # released
    out = run_sched(pts)
    starts, ends = events(out, "SPILL_START"), events(out, "SPILL_END")
    assert len(starts) == 1 and len(ends) == 1
    assert starts[0]["pid"] == 7 and starts[0]["cause"] == "B"
    assert 10 < starts[0]["t"] <= 12          # k = 2 samples after onset at t = 10
    assert all(f["summary"]["state"] == "SPILL" for f in out if 15 <= f["t"] < 20)
    assert ends[0]["peak_spill_mb"] == 1000


def test_baseline_ignores_preexisting_shared():
    # a browser already holds 600 MB shared before pressure; it must not be flagged for that
    pts = [(t, 3000, [(2, "chrome.exe", 400, 600)]) for t in range(10)]
    pts += [(10 + t, 5800, [(2, "chrome.exe", 400, 600), (3, "game.exe", 5300, 20)]) for t in range(5)]
    assert events(run_sched(pts), "SPILL_START") == []


def test_culprit_is_the_grower_not_the_victim():
    pts = [(t, 4000, [(1, "llama-server.exe", 3800, 80), (2, "game.exe", 100, 0)]) for t in range(5)]
    pts += [(5 + t, 4000 + 400 * t, [(1, "llama-server.exe", 3800, 80), (2, "game.exe", 100 + 400 * t, 0)]) for t in range(5)]
    pts += [(10 + t, 5950, [(1, "llama-server.exe", 3400, 80 + 300 * (t + 1)), (2, "game.exe", 2400, 0)]) for t in range(4)]
    s = events(run_sched(pts), "SPILL_START")
    assert s and s[0]["pid"] == 1
    assert s[0]["culprit"]["name"] == "game.exe" and not s[0]["culprit"]["self_inflicted"]


def test_type_c_and_type_a_events():
    out = analyze_frames([frame(t, 1000, [], commit=50.0 if t < 3 else 95.0) for t in range(8)])
    assert len(events(out, "RAM_PRESSURE_START")) == 1
    a = Analyzer()
    f = a.step(frame(0, 1000, [], ollama=[{"name": "qwen", "size_mb": 5000, "size_vram_mb": 3600}]))
    assert f["events"][0]["type"] == "OFFLOAD_SPLIT" and f["events"][0]["cpu_pct"] == 28
    assert a.step(frame(1, 1000, [], ollama=[{"name": "qwen", "size_mb": 5000, "size_vram_mb": 3600}]))["events"] == []


def test_vanished_process_closes_episode():
    pts = [(t, 5900, [(9, "x.exe", 5000, 100 + 300 * t)]) for t in range(6)]
    pts += [(6, 200, [])]
    out = run_sched(pts)
    ends = events(out, "SPILL_END")
    assert ends and ends[0].get("exited")


@pytest.mark.skipif(not PILOT.exists(), reason="pilot trace not present")
def test_real_pilot_trace_detected_within_2s():
    """Real W1 run on the RTX 3050: SPILL_START for the stress PID within 2 s of the first
    allocation that the driver placed in system memory."""
    _, frames = read_trace(PILOT)
    out = analyze_frames(list(frames))
    truth = [json.loads(l) for l in PILOT_TRUTH.read_text().splitlines()]
    pid = truth[0]["pid"]
    # onset = first allocation after which the process's shared usage rose (block 22, 5888 MB)
    onset = next(r["t"] for r in truth if r["ev"] == "ALLOC" and r["allocated_mb"] == 5888)
    starts = [e for e in events(out, "SPILL_START") if e["pid"] == pid]
    assert len(starts) == 1
    assert 0 <= starts[0]["t"] - onset <= 2.0
    assert starts[0]["culprit"]["self_inflicted"]
    assert len(events(out, "SPILL_START")) == 1  # no false positives on other processes


# ---- Banker's ------------------------------------------------------------------------------
def test_textbook_bankers_matches_aetheros_ts():
    # Silberschatz example, same as src/kernel/__tests__/BankersAlgorithm.test.ts
    alloc = [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]]
    mx = [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]]
    jobs = [Job(f"P{i}", a, m, long_lived=False) for i, (a, m) in enumerate(zip(alloc, mx))]
    r = safety_check([3, 3, 2], jobs)
    assert r.safe and r.sequence == ["P1", "P3", "P4", "P0", "P2"]


def test_long_lived_jobs_reserve_their_need():
    game = Job("game.exe", [3000], [3500], long_lived=True)
    assert safety_check([400], [game]).safe is False      # needs 500 more, only 400 free
    assert safety_check([600], [game]).safe is True


def test_admit_reason_names_the_holder():
    running = [Job("chrome.exe", [1400.0, 0.0], [1500.0, 0.0], pid=5)]
    ad = admit(["VRAM", "commit"], [6000.0, 30000.0], [256.0, 1024.0], running,
               Job("llama", [0.0, 0.0], [5200.0, 500.0]))
    assert ad.verdict == "UNSAFE"
    assert "VRAM" in ad.reason and "chrome.exe" in ad.reason


# ---- estimator + advisor -------------------------------------------------------------------
def toy_model(**kw) -> ModelInfo:
    d = dict(name="toy", arch="llama", n_layer=32, n_head=32, n_head_kv=8, n_embd=4096, head_dim_k=128, head_dim_v=128,
             n_vocab=128256, ctx_train=131072, file_mb=4700, quant="Q4_K_M", layer_mb=[130.0] * 32,
             output_mb=400.0, embd_mb=400.0)
    d.update(kw)
    return ModelInfo(**d)


CAL = {"overhead_mb": 250, "buffer_slack_mb": 0, "buffer_per_kctx_mb": 0, "vision_buffer_mb": 0, "n_ubatch": 512}


def test_kv_cache_formula_llama3_8b():
    # 2 (K,V) x 32 layers x 8 KV heads x 128 dim x 2 B = 128 KiB per token -> 1 GiB at 8192 tokens
    e = estimate(toy_model(), FitConfig(n_ctx=8192, flash_attn=True), CAL)
    assert e.kv_mb == pytest.approx(1024)
    q8 = estimate(toy_model(), FitConfig(n_ctx=8192, kv_type="q8_0", flash_attn=True), CAL)
    assert q8.kv_mb == pytest.approx(1024 * 34 / 64)


def test_partial_offload_counts_last_layers_only():
    e = estimate(toy_model(), FitConfig(n_ctx=4096, n_gpu_layers=16, flash_attn=True), CAL)
    assert e.weights_mb == pytest.approx(16 * 130) and e.layers_on_gpu == 16


def test_quant_kv_requires_flash_attention():
    with pytest.raises(ValueError):
        estimate(toy_model(), FitConfig(kv_type="q8_0", flash_attn=False), CAL)


def idle_frame(V=6002, held=200):
    return {"t": 0, "adapter": {"vram_total_mb": V, "dedicated_mb": held, "shared_mb": 0},
            "procs": [{"pid": 1, "name": "dwm.exe", "dedicated_mb": held, "shared_mb": 0, "private_mb": 100}],
            "system": {"commit_mb": 10000, "commit_limit_mb": 30000}}


def test_advise_fixable_suggests_a_config_that_fits(monkeypatch):
    monkeypatch.setattr("spillguard.advisor.load_calibration", lambda: {**CAL, "source": "test"})
    r = advise(toy_model(), FitConfig(n_ctx=32768, flash_attn=True), idle_frame())
    assert r["verdict"] == "FIXABLE"
    assert r["suggested"]["vram_mb"] <= r["available_mb"][0]
    assert r["suggested"]["full_offload"]


def test_advise_safe_when_small(monkeypatch):
    monkeypatch.setattr("spillguard.advisor.load_calibration", lambda: {**CAL, "source": "test"})
    assert advise(toy_model(), FitConfig(n_ctx=2048, flash_attn=True), idle_frame())["verdict"] == "SAFE"


def test_launch_rewrites():
    cfg = {"n_ctx": 4096, "n_gpu_layers": 999, "flash_attn": True, "kv_type": "q8_0", "n_parallel": 1}
    assert llama_cpp_args(cfg) == ["-c", "4096", "-ngl", "999", "-fa", "on", "-ctk", "q8_0", "-ctv", "q8_0"]
    assert "PARAMETER num_ctx 4096" in ollama_modelfile("qwen2.5:7b", cfg)
