# SpillGuard Repro: implementation milestone 1

Continuation: [local AI timing and owned Ollama servers](SPILLGUARD_REPRO_OLLAMA.md).
The sections below retain the first milestone's scope and validation record.

SpillGuard Repro adds a controlled experiment and evidence workflow to the existing
SpillGuard agent. AetherOS remains the explanation/replay interface. The existing
collector, analyzer, CUDA allocation helper, estimator and admission tools remain
the foundation. The research direction is recorded in the
[16 October dossier](research/2026-10-16-spillguard-opportunity/research-dossier.md).

This milestone implements the experimental plumbing and a **plain ddmin baseline**.
It does not implement or establish the proposed research contribution. Its only live
target is a synthetic CUDA write workload. Real application slowdown reproduction,
phase/residency-aware reduction and remedy comparison remain research gates.

## Run it

Use the existing Python environment from the repository root. No additional Python
dependencies, model downloads or driver settings are required.

```powershell
# No GPU use: validate the bounded input format.
agent/.venv/Scripts/python.exe bench/repro.py validate bench/recipes/cuda-smoke.json

# No GPU use: labelled deterministic fixture, action reduction and fresh validation.
# Every output directory must be new; existing evidence is never overwritten.
agent/.venv/Scripts/python.exe bench/repro.py demo --out traces/repro/my-demo

# Read-only: enumerate the real adapter, verify PDH and check host-memory headroom.
agent/.venv/Scripts/python.exe bench/repro.py preflight --recipe bench/recipes/cuda-smoke.json

# Live: one baseline/pressure/recovery block; 128 MiB holder, 64 MiB target.
agent/.venv/Scripts/python.exe bench/repro.py run --recipe bench/recipes/cuda-smoke.json --out traces/repro/my-smoke

# Verify the saved files against their manifest, without using the GPU.
agent/.venv/Scripts/python.exe bench/repro.py verify traces/repro/my-smoke

# Live reduction: only useful after a recipe reliably reproduces the declared failure.
# A maximum of 12 candidate blocks, including the fresh final validation block.
agent/.venv/Scripts/python.exe bench/repro.py reduce --recipe traces/repro/my-smoke/recipe.json --out traces/repro/my-reduction --max-tests 12
```

The commands are also available from `agent/` through `python -m spillguard repro`.
`bench/repro.py --help` lists all commands. Windows performance counters may require
execution outside a restricted application sandbox; administrator access is not a
protocol requirement.

`run` uses predicate exit codes: **0** = FAIL (slowdown reproduced), **1** = PASS
(valid non-reproduction), **2** = INCONCLUSIVE/error, **130** = interrupted.
`validate`, `verify`, and `preflight` return zero on success. `demo`/`reduce` return
zero only when fresh validation reproduces the selected witness. A `PASS` from the
small smoke recipe is expected and is a successful plumbing check.

## Experiment contract

The version 1 recipe records a seed, a fixed-work target, a fixed-size repeat policy,
limits and a list of pressure actions. Unknown keys, non-finite values, invalid
units, duplicate action IDs and out-of-bounds requests are rejected before execution.
The seed is reserved for future randomized designs; this backend uses a deterministic
action schedule and fixed work and does not claim randomized treatment order.

Memory quantities are **bytes** in recipes/observations and **MiB** in the inherited
trace fields ending in `_mb`. Timing is **milliseconds**, with monotonic nanosecond
timestamps for ordering and wall-clock timestamps for correlation. PDH memory values
inherit the original collector's whole-MiB resolution.

Each action has an allocation size, start offset, duration and touch cadence. The
implemented action phase is `pressure`: offsets are relative to the holder's GO
marker. Target measurement starts after `lead_in_ms`; its own `measure` marker is
recorded separately. Actions may overlap and be released/reacquired using distinct
IDs. A zero touch interval means first-touch followed by an idle hold. A positive
interval repeats the touch and also introduces bandwidth/compute/power interference.
Requesting allocation does not guarantee any particular WDDM residency.

Each matched block runs:

1. **Baseline:** warmed fixed-work target plus an empty holder CUDA context.
2. **Pressure:** identical target plus the scheduled actions in another process.
3. **Recovery:** identical target after the previous owned helpers have exited,
   again with an empty holder context.

All three stages create fresh CUDA contexts and warm the target before starting
measurement. This is a synthetic warm-probe protocol; it does not model persistent
application state or cold/warm inference sessions. The empty holder context is
present in every stage to avoid comparing against the extra context's memory alone.

The primary metric is completion time for an unchanged number of GPU writes to an
unchanged buffer. The predicate requires successful completion, matching workload
and environment signatures, usable telemetry, host-memory headroom, recovery within
the declared tolerance, and sufficient observations of pressure overlapping the
target. Pressure means additional holder dedicated-memory observations above its
pre-allocation context baseline, relative to the allocation actually active at that
sample. At least two overlapping samples are required by default. A target that is
too short to observe adequately is inconclusive.

The chosen default failure threshold is pressure latency / baseline latency >= 2.
This is an operational definition, not an observed hardware boundary. A complete
repeat block must have concordant outcomes; mixed, invalid or missing trials remain
inconclusive. Invalid trials remain in the saved record and denominator.

This protocol measures **slowdown under an observed manipulation with recovery**.
It does not prove a residency/paging mechanism. Shared observations, requested bytes,
committed bytes and actual local residency remain distinct. DXGI budgets belong to
the calling observer process. An absolute PDH/NVML adapter-total difference above a
chosen 256 MiB threshold is flagged for inspection; it is not proof either source is
wrong and is not an automatic causal label. Temperature, clocks, AC/battery state,
power mode and compute utilization are currently listed as unmeasured.

## Bounds, cleanup and evidence

The live backend currently supports a Windows machine with exactly one NVIDIA
adapter. Other vendors and multi-NVIDIA adapter mapping are rejected. It reuses
`bench/spillstress.py` through a dedicated helper module. The allocation sizes in the
smoke recipe are small and deliberately do not aim to induce fallback.

The default protocol caps the sum of requested pressure allocations at 1 GiB.
Explicit recipes may raise that cap up to 8 GiB; the target buffer is separately
bounded to 1 GiB. Sum rather than peak overlap is used conservatively. The observer
aborts at less than the declared host-memory floor (default 2 GiB) or >= 90% host
commit; each holder also checks available host RAM before allocating and while
running. These are best-effort sampled guards, not a hard OS reservation.

Only direct subprocess handles created by the runner may be stopped. No process-name
lookup, third-party termination, driver policy changes, network service or automatic
model unload is involved. Ctrl+C unwinds the runner and closes owned helpers. A
bounded wait precedes forced termination; any forced or unsuccessful cleanup makes
the stage invalid. Helper allocation, release, phase, timing and close events are
saved. Startup failures and interrupted runs are sealed as inconclusive artifacts.

Each local bundle contains:

- `recipe.json`, `report.json`, a readable `report.md`, and a SHA-256 manifest.
- Machine/source/environment signatures, limits, all trial outcomes and missing-data errors.
- Per-stage helper JSONL, stderr, identity (PID plus creation time), phase and action events.
- Per-stage observations and `trace.jsonl` in the existing AetherOS replay format.

The UI can import an individual stage trace through its existing Replay controls.
The experiment report itself has no new dashboard panel yet. Bundles stay in ignored
`traces/repro/` by default. They contain local machine/process metadata and are **not
privacy-scrubbed publication packages**. Manifests detect modification; they do not
authenticate data or establish scientific validity.

## Reduction baseline

The reducer deletes action groups using plain ddmin. It never increases pressure,
changes target work, assumes memory monotonicity or accepts an inconclusive outcome
as a valid non-failure. Each candidate runs the same fixed-size matched protocol.
Environment and implementation signatures must remain equal across candidate blocks.
There is no cross-run result cache.

Search has an explicit budget and reserves one full fresh validation block. Search
and validation bundles are separate and labelled by purpose. A 1-minimal claim is
made only if every single-action deletion of the selected witness was tested as
PASS and fresh validation reproduced the failure. Inconclusive neighbors and budget
limits suppress that claim. Even a certified result is only minimal under the
implemented **action-deletion transformation**; it is not globally smallest, a
minimum byte threshold, phase preserving or mechanism preserving.

The offline demo has four actions and a known two-action interaction. Its result
tests pipeline behavior using fabricated values labelled **SOFTWARE FIXTURE - NOT
GPU MEASUREMENTS**. Those values must never enter the research result tables.

## Validation on 16 October 2026

The first live smoke block recorded 828 ms baseline, 844 ms pressure and 843 ms
recovery on the available RTX 3050 laptop. Pressure overlapped seven valid samples;
all stages completed with no recorded helper errors. Outcome: valid non-reproduction
at a 2x threshold (1.019x pressure/baseline). This is a single synthetic integration
check, not an application benchmark, repeatability result or new spill reproduction.
The bundle records the exact source hashes for that run.

A final smoke check after adding commit-pressure guards and explicit release logs
recorded 843/844/844 ms for baseline/pressure/recovery with eight overlapping pressure
samples. The six owned helper identities were independently confirmed exited;
allocation release events, manifest hashes and all three legacy trace readers were
verified. These two development checks are not a repeated experimental study.

The labelled fixture reduced four actions to two with fresh validation. Automated
checks cover recipe rejection, missing/mismatched evidence, pressure overlap,
non-monotonic reduction, ambiguity, budget exhaustion, validation failure and bundle
integrity. The existing agent and frontend regression suites are also retained.

Final gates: **66 Python tests passed**, **37 frontend tests passed**, and the
production TypeScript/Vite build passed. The Python total includes the original
20 tests. The sandbox's default pytest temporary directory was inaccessible; the
successful run used an isolated base under `agent/.pytest_cache/`. A compact
[validation record](../bench/results/repro_milestone1_validation.json) retains the
measured final smoke values without copying raw machine/process metadata into the
documentation. No new browser visual audit was performed for this backend milestone.

## Next implementation gates

1. Freeze an installed real workload, model hash/input/settings and primary metric;
   add its timing adapter with explicit load/prefill/decode markers. Reproduce
   slowdown and recovery without exhausting host RAM before increasing scope.
2. Record GPU clocks/temperature/power, intentional offload and realistic negative
   controls. Establish reset rules and randomized matched blocks suited to that target.
3. Compare this plain reducer against a proposed phase/residency-aware reducer;
   add duration/byte/overlap transformations only with measured manipulation checks.
4. Evaluate fresh witness reproduction and acceptable remedies without changing task
   requirements, then surface those results in AetherOS.

The three-month study, application-level claims and the proposed reducer remain
unvalidated. This milestone supplies the executable baseline needed to test them.
