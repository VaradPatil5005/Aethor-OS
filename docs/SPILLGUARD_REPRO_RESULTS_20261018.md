# SpillGuard Repro — first reproduced witness (18 October 2026)

Prototype evidence for the dossier [SpillGuard Repro: Reproducing and Minimizing Cross-Process GPU-Memory
Performance Failures on Windows](research/2026-10-16-spillguard-opportunity/research-dossier.md).
All numbers below were measured today on one laptop (RTX 3050 6 GB Laptop GPU, NVIDIA 581.83, Windows 11
26200, AC power). They are a **pilot**: small samples, one machine, one target model. Every trial is kept,
including invalid ones.

## What changed: the kill gate is passed

The 17 October ledger stopped at the dossier's first gate: *no repeatable severe slowdown of a real
application before host-memory pressure.* The reason was the experiment design, not the hardware:

- the co-tenant held 128 MiB–1 GiB, but Qwen2.5-3B needs only ~2.4 GiB of a 6 GiB card, so the two never
  crossed capacity (slowdowns of ~1.02×);
- the co-tenant started *after* the model was already resident, so any overflow landed on the co-tenant;
- the laptop had ~1.5 GB of available RAM, below the 1.5 GiB safety floor.

The new pilot ([bench/dose_response.py](../bench/dose_response.py)) sizes the co-tenant from measured
headroom (`physical VRAM − desktop residency − target footprint + planned overflow`), makes it resident
before the model loads (cold preparation, `pressure`-phase anchor), and runs every level through the
unchanged runner and conservative classifier. The host-RAM and commit guards were **not** relaxed; memory
was freed by closing other applications.

## Result 1 — a performance cliff at the capacity boundary

Workload: `qwen2.5:3b-instruct` in a private Ollama 0.34.4 server, fixed prompt, 128 output tokens,
temperature 0, ctx 2048, all layers on GPU. Metric: server-reported decode ms per token. Each trial is a
matched baseline → pressure → recovery block. Co-tenant: an owned CUDA process touching its memory every
250 ms.

| Planned overflow | Co-tenant holds | Baseline ms/tok | Pressure ms/tok | Slowdown | Verdict |
|---|---|---|---|---|---|
| −512 MiB (fits) | 2,941 MiB | 14.4 / 14.3 | 16.6 / 16.7 | 1.15× / 1.17× | PASS / PASS |
| 0 MiB (at capacity) | 3,453 MiB | 14.2 / 14.0 | 17.1 / 17.1 | 1.20× / 1.22× | PASS / PASS |
| **+256 MiB** | 3,709 MiB | 14.0 / 14.1 | **33.3 / 33.1** | **2.37× / 2.35×** | **FAIL / FAIL** |
| **+512 MiB** | 3,965 MiB | 14.1 / 14.1 | **33.6 / 32.2** | **2.38× / 2.28×** | **FAIL / FAIL** |

- Every FAIL recovered on release (recovery 0.996–1.010×) with byte-identical output, unchanged prompt-token
  work, and no partial CPU offload reported by Ollama (that case is classified INCONCLUSIVE, not FAIL).
- The response is a **cliff with a plateau**: crossing capacity by 256 MiB more than doubles per-token time;
  doubling the overflow to 512 MiB does not make it worse.
- The −512 MiB control isolates the co-tenant's own bandwidth use (it rewrites ~2.9 GiB every 250 ms):
  **1.16×**. The 2.36× at +256 MiB is not explained by that traffic alone.
- Bundles: `traces/repro/20261018-dose-response/` (summary.json + one sealed bundle per level).

## Result 2 — identical memory counters, opposite outcomes

The same +256 MiB co-tenant was rerun **idle** (allocated and touched once, then left alone).

| Co-tenant at +256 MiB | Runner VRAM / shared (PDH) | Co-tenant VRAM (PDH) | Adapter VRAM | Slowdown |
|---|---|---|---|---|
| active (touch 250 ms) | 2,033 / 388 MiB | 3,790 MiB | 5,952 MiB (ceiling) | **2.37×** (FAIL) |
| idle (touch once) | 2,033 / 388 MiB | 3,790 MiB | 5,952 MiB (ceiling) | **1.03×** (PASS) |

The per-process and adapter counters are the same in both cases, yet one case is a severe slowdown and the
other is not. Implications, stated carefully:

- **Counters alone cannot separate harmful from benign pressure here.** The original SpillGuard detector
  (counter-based, like other spill trackers) raised `SPILL_START` on all 4 real failures but also on 3 of 5
  non-failures: the two at-capacity trials and the idle-co-tenant trial. Recall 4/4, precision 4/7 (n = 9
  valid trials).
- **The intervention separates them.** Same bytes held, only the co-tenant's activity changed. This is the
  dossier's argument for intervention-based diagnosis (section 7D), now with a measured example.
- In this run the idle condition had **one valid trial**; the other two idle trials were stopped by the
  host-commit guard (commit reached 90%) and are recorded as INCONCLUSIVE. The "pause activity" remedy in
  Result 3 adds two more valid idle trials (1.01×, 1.01×).
- Working hypothesis, **not verified**: an active co-tenant causes repeated page migration between VRAM and
  system memory (churn) that 100 ms counter snapshots cannot see. Verifying it needs PIX/ETW residency
  events (dossier baseline 9).

## Result 3 — the witness re-validates, and every owned remedy works

`bench/research.py remedy` first re-ran the +256 MiB witness from scratch, then each remedy as its own
matched block (2 trials each). Status: **evaluated** (no invalid block). Bundles:
`traces/repro/20261018-remedy-plus256-r2/`. A first attempt (`20261018-remedy-plus256/`) was stopped by the
host-commit guard during re-validation and is kept as not-evaluable.

| Remedy | Co-tenant still holds | Slowdown per trial | Verdict |
|---|---|---|---|
| none (fresh re-validation) | 3,709 MiB | 2.35×, 2.34× | FAIL (reproduced again) |
| release the whole co-tenant | 0 MiB | 1.02×, 1.00× | PASS |
| run the co-tenant after the target | 0 MiB | 1.00×, 1.00× | PASS (background work completed afterwards) |
| release half of its bytes | 1,854 MiB | 1.10×, 1.10× | PASS |
| release one eighth of its bytes | 3,245 MiB | 1.19×, 1.20× | PASS |
| **keep every byte, stop touching it** | **3,709 MiB** | **1.01×, 1.01×** | **PASS** |

- The witness now reproduces in **6/6 matched trials across two independent runs** (2.28–2.38×).
- Releasing just one eighth of the co-tenant's memory (~460 MiB, enough to fall back under capacity) is
  sufficient; the residual 1.19× matches the at-capacity level of Result 1.
- **Pausing activity while keeping every byte** is both the least disruptive and the most effective remedy.
  It also replicates Result 2: the idle/paused co-tenant now has **3 valid trials at 1.01–1.03×** against
  **6 active trials at 2.28–2.38×**, same memory held.
- Every remedy left the target's work unchanged (same prompt, tokens, context, model, output hash).

## What this does and does not show

Shows: a repeatable, matched, recovered severe slowdown of a real local LLM on this laptop, caused by a
controlled co-tenant crossing VRAM capacity (6/6 trials, two runs); a measured dose-response cliff; a measured
case where memory counters cannot distinguish harmful from benign pressure; and five owned remedies that each
restore performance, the least disruptive keeping all of the co-tenant's memory.

Not yet done from the dossier: the phase/residency-aware **reducer** on this witness (RQ2), larger samples and
the full campaign matrix, a second real target, PIX/ETW residency verification, and external comparators.

Does not show: the residency mechanism (unverified), other GPUs/vendors/drivers, other models or engines,
behaviour of third-party co-tenants (games, browsers), or statistical significance (2 trials per level).
The co-tenant is a synthetic owned CUDA process.

## Reproduce

```bash
agent/.venv/Scripts/python.exe bench/dose_response.py --levels=-512,0,256,512 --repeats 2
agent/.venv/Scripts/python.exe bench/dose_response.py --levels=256,512 --repeats 2 --touch-ms 0 --out traces/repro/<new>-idle
agent/.venv/Scripts/python.exe bench/research.py remedy --recipe traces/repro/20261018-dose-response/dose-plus256mib/recipe.json --out traces/repro/<new>-remedy
```

Close memory-heavy applications first: the runs need roughly 3 GiB of available RAM above the 1.5 GiB guard.
In AetherOS: SpillGuard → evidence desk → **Load measured dose-response**.
