# SpillGuard × AetherOS

**Research extension (16 October 2026):** [SpillGuard Repro](SPILLGUARD_REPRO.md)
adds bounded experiments, evidence bundles and a plain action-deletion reducer on
this foundation. Its initial live target is synthetic; residency-causal and real
application claims remain unvalidated. The saved pilot results below predate it.

SpillGuard detects, explains and prevents **silent GPU-memory spill** on Windows: when an app needs more VRAM
than the card has, Windows' video memory manager (VidMm) and the NVIDIA driver (536.40+, "sysmem fallback")
page the overflow into system RAM over PCIe. Nothing errors; the app just runs slower. AetherOS is the dashboard
and teaching layer: every textbook concept it simulates (paging, working sets, thrashing, Banker's algorithm)
gets a live, real-hardware counterpart.

Everything below was measured on one machine (section 3). Numbers are mean ± sd over repeated runs.

---

## 1. Quick start

```bash
npm install
npm run build
```

```bash
cd agent
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m spillguard serve
```

`serve` samples once per second, serves the AetherOS build at `http://127.0.0.1:8765`, and prints a link with a
one-time session token (`#sg=…`). Open that link, log in, and open **SpillGuard** from the desktop.

No NVIDIA GPU (a lab PC, the demo machine)? Any browser works: open SpillGuard → **Replay** → **Demo trace**.

| Command | What it does |
| --- | --- |
| `spillguard serve` | live agent + dashboard; writes a trace to `traces/live-*.jsonl` |
| `spillguard status` | one-shot table of VRAM / shared / RAM per process |
| `spillguard why <pid>` | explains one process's spill state and its culprit |
| `spillguard fit <model> --ctx 8192 [--kv q8_0]` | VRAM estimate + Banker's admission verdict |
| `spillguard run [--ctx N] -- llama-server -m m.gguf …` | checks the launch, rewrites `-c/-ngl/-fa/-ctk/-ctv` to a config that fits, asks before starting |
| `spillguard run -- ollama run qwen2.5:3b-instruct` | same, via a derived Ollama model (`PARAMETER num_ctx/num_gpu`) |
| `spillguard record -s 120 -o t.jsonl` | record a trace without the server |
| `spillguard analyze t.jsonl [--delta-mb 64 --k 1]` | re-run the detector over a trace with other thresholds |
| `spillguard facts` | machine facts and the exact PDH counter names |

Developing the UI with hot reload: `spillguard serve --dev`, then `npm run dev` and open the `dev` link it prints.

---

## 2. Architecture

```
 PDH counters ─┐                                                     ┌─ SpillGuard app
 DXGI (ctypes) ─┤                                                     ├─ Memory Map twin view
 NVML ──────────┼─► Collector ─► Analyzer ─► Runtime ─► FastAPI ─ /ws ─► HostBridge ─► useSpillStore ┼─ eBPF Studio events
 psutil ────────┤   (1 Hz)      (detector,   (trace,    (127.0.0.1,     (Web Worker)                ├─ Deadlock Lab live Banker's
 Ollama /api/ps ┘               classifier,   peaks)     token)                                      ├─ aethersh `spillguard …`
                                culprit)                    └─ /api/advise ◄─ gguf_fit + bankers     └─ KernelQuest 3 & 4
                                                                                 + advisor
   JSONL trace  ───────────────────────────────────────────────────────► (Replay: same frames, no agent)
```

| File | Role |
| --- | --- |
| `agent/spillguard/dxgi.py` | DXGI adapter enumeration + `QueryVideoMemoryInfo` via ctypes vtables (no C++/Rust helper needed) |
| `agent/spillguard/collector.py` | one PDH query with enumerated (never hand-built) instances, per-LUID aggregation, NVML, psutil, Ollama |
| `agent/spillguard/analyzer.py` | spill detector with hysteresis, A/B/C cause classifier, culprit ranking; pure, so replay = live |
| `agent/spillguard/gguf_fit.py` | `M = W_gpu + KV + B + O` from the GGUF header; calibration in `agent/calibration.json` |
| `agent/spillguard/bankers.py` | Banker's safety check with long-lived reservation (port of `src/kernel/BankersAlgorithm.ts`) |
| `agent/spillguard/advisor.py` | admission verdict + config search + llama.cpp / Ollama launch rewriting |
| `agent/spillguard/server.py` | serves `dist/` and `/ws`, `/api/*`; security in section 6 |
| `src/spillguard/hostBridge.worker.ts` | WebSocket (Live) or parsed JSONL (Replay) off the main thread |
| `src/stores/useSpillStore.ts` | mode switch Simulated / Live / Replay, history, events, peaks |
| `src/spillguard/admission.ts` | browser-side Banker's on real VRAM (works offline in Replay) |
| `bench/spillstress.py` | W1 workload via the CUDA *driver* API (`nvcuda.dll`, ships with the driver; no PyTorch) |
| `bench/run_w1.py`, `bench/evaluate.py` | repeated W1 runs with traces; E1 / E2 / E5 + threshold sweep |
| `bench/calibrate_fit.py` | E3: loads models in Ollama at several contexts, measures the runner's VRAM, fits and cross-validates |

Wire format: one JSON frame per second (`src/spillguard/types.ts` mirrors it). Traces are JSONL: a header line
with machine facts and detector parameters, then analyzed frames. Analyzed frames are a superset of raw samples,
so AetherOS replays them as-is and `spillguard analyze` can re-run the detector with different thresholds.

---

## 3. Phase 0: what this laptop actually looks like

Raw output: [`machine-facts.json`](machine-facts.json).

| Fact | Value |
| --- | --- |
| GPU | NVIDIA GeForce RTX 3050 6GB Laptop GPU — DXGI `DedicatedVideoMemory` 6002 MB |
| OS VRAM budget (DXGI, this process) | 5234 MB local, 7180 MB non-local |
| Shared GPU memory cap | 7827 MB (= half of RAM, as Microsoft documents) |
| Driver / OS | NVIDIA 581.83, Windows 11 build 26200 |
| CPU / RAM | Ryzen 7 7840HS (16 threads), 16 GB DDR5-5600, system-managed pagefile |
| Ollama | 0.34.4; its runner process is `llama-server.exe` |

Findings that shaped the design:

1. **The driver fills physical VRAM, not the OS budget.** Under W1, adapter dedicated usage plateaued at
   5954 MB of 6002, far past the 5234 MB DXGI budget. Pressure is therefore measured against physical VRAM.
2. **CUDA cannot tell you it is spilling.** `cuMemGetInfo` reported 0 MB free from 5376 MB onward, and
   allocations kept succeeding (they went to system memory). This answers the open NVIDIA-forum question cited
   in the plan: the API gives no signal beyond "0 free".
3. **Per-process GPU counters do not need admin.** An unelevated agent sees every process, including `dwm.exe`.
4. **DXGI lists no AMD adapter**, only the RTX 3050 and two "Microsoft Basic Render Driver" entries, so the
   Radeon 780M is either disabled (MUX in dGPU-only mode) or has no driver. PDH also shows a third LUID
   (`0x1a009`) that DXGI does not list (likely a compute-only device such as the NPU). SpillGuard tracks one LUID
   and never sums across adapters.
5. **PDH counter names on this build:** `\GPU Process Memory(*)\{Dedicated Usage, Shared Usage, Local Usage,
   Non Local Usage, Total Committed}`, `\GPU Adapter Memory(*)\{Dedicated Usage, Shared Usage, Total Committed}`,
   `\GPU Local Adapter Memory(*)\Local Usage`, `\GPU Non Local Adapter Memory(*)\Non Local Usage`,
   `\GPU Engine(*)\{Utilization Percentage, Running Time}`. Instances look like
   `pid_32220_luid_0x00000000_0x00018056_phys_0` and are enumerated at runtime.

---

## 4. Algorithms and calibrated parameters

**Detector (type B).** A process enters SPILLING when, for *k* consecutive samples, the adapter is at
≥ θhi of physical VRAM, its shared usage exceeds its own baseline by more than Δ, and shared usage is still
rising. The baseline is the minimum shared usage seen while the adapter was *not* under pressure, so apps that
always keep shared memory (browsers, the compositor) are not flagged. It leaves SPILLING after 3 clear samples
(load < θlo or excess ≤ Δ/2). Defaults: θhi = 0.92, θlo = 0.85, Δ = 128 MB, k = 2.

Why these values: in the pilot run, the spilling process's shared usage rose 74 → 266 MB in the first 1 s sample
after onset, so Δ = 128 MB with k = 2 fires within about 2 s, and k = 2 keeps one-sample counter glitches out.
The sweep (section 5) found **every** combination of θhi ∈ {0.85…0.98}, Δ ∈ {64…512}, k ∈ {1,2,3} perfect on
the W1 runs, so W1 does not discriminate between thresholds; see limitations.

**Classifier.** A = Ollama reports `size_vram < size` (the framework put layers on the CPU by choice).
B = the detector fires. C = commit ≥ 90 % or available RAM < 512 MB for 3 samples. B during C is reported as
`B+C`.

**Culprit.** The process whose dedicated VRAM grew most in the 30 s before onset. If that is the spilling
process itself, the spill is "self-inflicted"; otherwise the spiller is the victim.

**Fit estimator.** `M = W_gpu + KV + B + O`, all from the GGUF header and real tensor sizes:
`W_gpu` sums the offloaded blocks (llama.cpp offloads the *last* `n_gpu_layers`), plus the output head
(a GPU copy of `token_embd` when embeddings are tied) and, for vision models, the encoder (`v.*`, `mm.*`).
`KV = 2 · layers · n_ctx · n_head_kv · head_dim · bytes/elem` (f16 = 2, q8_0 = 34/32, q4_0 = 18/32).
`B` = logits buffer + attention scratch (only without flash attention) + calibrated terms. Calibrated on this
laptop (`agent/calibration.json`): **O = 235 MB, +6.1 MB per 1k context, +535 MB image-encoder buffer for
vision models**, runtime flash attention on.

**Admission (Banker's).** Resources: VRAM and commit. Running processes are *long-lived*: Allocation = measured,
Max = observed peak × 1.1, and their remaining Need is reserved up front instead of joining the safe sequence
(a game never "finishes"). Finite jobs run the classic safe-sequence search. Verdicts: SAFE, FIXABLE (search over
context, KV type, flash attention and GPU layers for the best config that fits) or UNSAFE with a plain reason
("needs 6.5 GB VRAM, 5.4 GB free; chrome.exe holds 1.4 GB"). The Deadlock Lab panel shows the textbook verdict
next to the long-lived one, because they can disagree.

---

## 5. Evaluation

Reproduce: `python bench/run_w1.py --repeats 3`, `python bench/run_w1.py --repeats 2 --label nearfull_nospill
--max-mb 5632`, `python bench/evaluate.py traces/w1/*.trace.jsonl`, `python bench/calibrate_fit.py --models
qwen2.5:3b-instruct qwen3-vl:2b --write`. Raw results: `bench/results/`.

**Ground truth (independent of the detector's input).** After the ramp, `spillstress` warms the GPU out of its
idle P8 state and measures write bandwidth for every 256 MB block. Blocks the driver placed in system memory are
an order of magnitude slower. Onset = allocation time of the first block of the trailing run of slow blocks.
(Without the warm-up, the first block measured looked "spilled" too; that was the idle memory clock.)

| Experiment | Setup | Result |
| --- | --- | --- |
| **E1** cost of spill | W1, 3 runs, warmed per-block memset bandwidth | resident **163.3 ± 0.1 GB/s**, spilled **13.2 ± 0.0 GB/s** → **12.4 ± 0.0× slower**. Spill always began with the 23rd 256 MB block (5.75 GB allocated); 1.5 GB had spilled at 7 GB |
| **E1b** type A, observed | qwen3-vl:2b in Ollama at 32k context | Ollama itself split the model (3.6 of 5.5 GB on GPU): **71 vs 113 tok/s** at ≤16k |
| **E2** detection | 3 spill runs + 2 runs that reach ~98 % VRAM without spilling | recall **3/3**, **0** false positives, latency **0.95 ± 0.03 s** after true onset |
| **E3** fit estimator | 2 models × 5 contexts in Ollama; measured = runner's dedicated + shared via PDH; 9 full-offload configs | leave-one-out MAE **46 MB** (max 93 MB). Ollama's own `size_vram` was off by **902 MB** on average (it leaves out the CUDA context and buffers). The estimator also predicted the 32k vision config would not fit — Ollama split it |
| **E5** overhead | agent self-measurement at 1 Hz across 5 runs | **2.3 ± 0.3 %** of one core (psutil convention) ≈ **0.14 %** of the 16-thread CPU; p95 3.1 %; **52 MB** RSS |

Live end-to-end check: with `serve` running and the dashboard open, a W1 run turned the banner red
("SPILLING: python.exe (1.50 GB, 21%)"), named the cause ("python.exe itself grew VRAM by 3.00 GB in the 30 s
before the spill") and returned to "No spill" when the process exited.

---

## 6. Security model

* Binds **127.0.0.1** only, and serves the AetherOS build itself, so the browser talks same-origin to loopback
  (no Private/Local Network Access prompts, no cross-site calls).
* A random **session token** per `serve` is required for `/ws` and `/api/*`. It travels in the URL *fragment*
  (`#sg=`), which browsers never send to servers, and the page scrubs it from the address bar.
* **Host** and **Origin** headers are checked against the loopback origin (blocks DNS rebinding and other sites).
  Verified: no token → 401, foreign Origin → 403, rebinding Host → 403.
* The HTTP API is **read-only**. Launching programs is CLI-only (`spillguard run`), always behind an interactive
  confirm. The NVIDIA "CUDA – Sysmem Fallback Policy" switch is never changed automatically (no public API).

---

## 7. Limitations (say these out loud)

1. **Thresholds are not yet discriminated.** All 60 threshold combinations were perfect on W1, which is a clean
   synthetic ramp. Real negatives (browser with many tabs, a game, W5) are needed before claiming the defaults are
   the right ones.
2. **Small samples.** E1/E2 are n = 3 (+2 negatives), E3 is 2 models × 5 contexts (target ≥ 20 configs, more
   architectures, KV quantization). The vision-buffer term is fitted on one model.
3. **Fallback-OFF oracle not run yet.** The OOM oracle needs the NVIDIA Control Panel setting changed by hand;
   the bandwidth probe served as ground truth instead. Both should agree; run it to confirm.
4. **One adapter, one vendor tested.** AMD/Intel paths exist (PDH/DXGI are vendor-neutral) but are untested.
5. **Known Windows counter drift:** per-process GPU counters can drift after an app is hidden/restored
   (Microsoft KB). SpillGuard cross-checks adapter totals and NVML, but does not yet flag disagreements.
6. **Banker's assumes claims are known.** For unknown apps, Max = observed peak × 1.1 is a heuristic.
7. **Sliding-window attention / MoE** models: the KV estimate is an upper bound (flagged in the output).

---

## 8. What is left

Needs you (cannot be automated from here):

- [ ] Update your sheet row (24BIT0175, Prof. Harshita Patel, G1) with the new title and get the change approved.
- [ ] **Fallback-OFF runs:** NVIDIA Control Panel → Manage 3D settings → Program settings → add
      `agent\.venv\Scripts\python.exe` → *CUDA – Sysmem Fallback Policy* = **Prefer No Sysmem Fallback**, then
      `python bench/run_w1.py --repeats 3 --label fallback_off`. Expect `OOM` in the truth logs and no
      `SPILL_START`. Set it back afterwards.
- [ ] Approve model downloads for W2/W3/E3 (e.g. `qwen2.5:7b` ≈ 4.7 GB, `llama3.1:8b` ≈ 4.9 GB) so the
      estimator reaches ≥ 20 configs and W2 has a model just over VRAM.
- [ ] Record real-life negatives and W5: a normal hour of browsing/gaming with `spillguard record`, then
      `bench/evaluate.py` again.
- [ ] E6: SUS questionnaire with 5–10 classmates.
- [ ] Content decisions from the plan: replace Retrium-derived assets/names (Snoogle, Dash, guestbook) and the
      personal chats in Messages.

Engineering still open: move the AetherOS kernel into a Web Worker (CHANGES.md), PyInstaller `.exe`, flag
counter disagreements (limitation 5), the IEEE-format report.
