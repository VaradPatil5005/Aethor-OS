# From GPU Memory Counters to Reproducible Slowdown Witnesses: A Windows WDDM Feasibility Study

Working draft, 16 October 2026. Author: Varad Santosh Patil. This is a review draft with negative/inconclusive pilot results, not a submission-ready empirical paper. Registration and institutional fields should be copied from the supplied institution template when available.

## Abstract

GPU-memory telemetry can suggest pressure while leaving the cause and reproducibility of an application slowdown uncertain. SpillGuard Repro extends an existing Windows observer with fixed-work application measurements, owned pressure schedules, baseline/pressure/recovery blocks, explicit invalid outcomes, bounded reduction and local evidence packages. A phase-aware reducer protects observed phase/counter signatures and is compared with ordinary deletion methods in software fixtures. Native tests established a valid frozen Qwen2.5 generation measurement under a 128 MiB holder, but the observed decode ratio was approximately 1.018, below the declared 2.0 failure threshold. A longer 128 MiB pilot produced a ratio of approximately 1.019; a 1 GiB attempt was inconclusive after a host commit guard. Three paired CUDA monitoring checks produced runtime ratios from 0.996 to 1.004. These feasibility results validate selected instrumentation paths without establishing severe application failure, a residency cause, empirical reducer superiority or remedy benefit. The planned 72-cell campaign remains gated.

## 1. Problem and scope

The research question is whether an observed cross-process GPU-memory performance problem can be turned into a reproducible fixed-work witness and then reduced without switching to a different failure. A visible shared-memory counter is insufficient: accounting, offload, residency, compute, bandwidth and power can interact. A user-space observer also cannot generally impose VRAM isolation on arbitrary Windows applications.

The current implementation operates owned CUDA helpers and private local Ollama runtimes on one NVIDIA laptop. It keeps AetherOS as an explanation/replay interface. It preserves existing architecture instead of treating the simulator as a new operating system or the dashboard as proof of a mechanism.

## 2. Prior work and differentiation

The original [literature matrix](literature-matrix.csv) and [source register](source-register.csv) retain the cited papers, tools, dates and evidence types. Relevant building blocks include delta debugging, probabilistic reduction, GPU resource testing, counter-based diagnosis, residency tools and memory coordination. The [ProbDD paper](https://xiongyingfei.github.io/papers/FSE21a.pdf) motivates one selection/update baseline; our comparator is explicitly labeled ProbDD-style because it does not reproduce all original semantics or guarantees.

The proposed distinction is an uncertainty-aware reduction workflow protecting a measured signature and phase alignment while preserving fixed target requirements. This is a hypothesis about a useful contribution. Direct residency preservation, novelty and advantage over established reducers have not been demonstrated. PIX/ETW interpretation and a matched hypomnesis comparator remain unavailable. Their absence is a limitation, not evidence of differentiation.

## 3. Implementation

Recipes freeze target settings and pressure actions. Each action specifies requested bytes, touch cadence, bounded arithmetic duty, phase offset, duration and release. Hold, ramp, burst and reacquire patterns are supported. Cold/warm/idle preparation is explicit; cold uses a fresh private runtime, not a flushed system cache. Exact internal load and prefill boundaries remain unavailable; request and first-output anchors are client observations.

The observer records monotonic and wall time, process birth identity, source errors, host-memory status, optional clocks/temperature/power/utilization and disagreement between adapter PDH and NVML totals. DXGI budgets are labeled as belonging to the calling observer. Per-process allocation/accounting observations are not asserted to be direct resource-residency ground truth. Missing or changed identities never receive credited pressure.

Workers run from a copied source tree whose files are hashed into each evidence bundle. Fixed inputs, engine settings, token count and output hashes are checked across matched stages. Live and software-fixture origins are separate. Original subprocess handles and a private Windows job bound cleanup; no third-party process is unloaded or terminated. Host-memory guards can invalidate a stage even when requested GPU bytes are within the declared cap.

## 4. Predicate and reduction

A reproduced operational failure requires completed fixed work, valid overlap, at least the declared slowdown ratio and recovery after release. Failure to manipulate pressure, reset, complete work or observe counters is inconclusive. Valid execution below the threshold is a non-reproduction.

Greedy, ddmin, ProbDD-style, no-reduction and tiny exhaustive deletion provide engineering comparators. The phase-aware variant also reduces bytes, duration and overlap. It rejects a raw slowdown when its phase/counter proxy differs from the original witness. Tests demonstrate that a smaller compute-like fixture cannot silently replace a shared-growth fixture. This validates a contract, not the physical fidelity or novelty of the proxy.

Fresh final validation is reserved within query and physical execution budgets. Optional predeclared bounded looks apply corrected exact binomial intervals to whole-block outcomes, conditional on independence/stationarity. A local minimality certificate is restricted to checked neighbors under the declared transforms. No global minimum or monotonic byte threshold is assumed.

## 5. Evaluation design

RQ1 concerns signal discrimination and confounders. RQ2 concerns witness size, search cost, signature retention and fresh reproducibility. RQ3 concerns remedy recovery and disruption with target requirements preserved. RQ4 concerns observer and experiment overhead. The prepared grid has three workloads, two preparation states, four patterns and three provisional pressure levels, with six matched blocks per cell. Calibration must precede execution. Blocks include three stages; they are not 432 isolated stage requests or thousands of independent tokens.

The campaign gate requires concrete matching live calibration evidence. Search and validation stay separate, invalid/missing blocks remain in denominators, and fixed-size samples avoid uncorrected repeated looks. Fresh independent sessions, power-mode control, thermal stability and instrumented confounder comparisons remain part of the unexecuted empirical protocol. A single-device study cannot support cross-vendor or multi-machine claims.

## 6. Observed results

| Evidence | Result | Interpretation |
|---|---|---|
| Qwen2.5, 128-token smoke, 128 MiB holder | Decode ms/token: 13.9482 baseline, 14.1996 pressure, 13.9867 recovery; 128 tokens each; matching output hashes; ratio 1.0180 | Valid non-reproduction, one matched block |
| Qwen2.5, 512-token pilot, 128 MiB touched holder | Ratio 1.0190; recovery 1.0177 | Valid non-reproduction, one matched block |
| 512-token pilot, 1 GiB holder | Host commit guard reached during pressure | Inconclusive; larger levels skipped |
| Frozen-source CUDA control | 4,297 ms in each stage; 8,192 work units | Valid negative control; source/cleanup evidence |
| Qwen3-VL text-input smoke | Host commit guards before valid measured stages | Inconclusive; fit/completion unvalidated |
| Observer overhead, three randomized CUDA pairs | Ratios 0.99556, 1.00000, 1.00446 | Preliminary sample only; no universal bound |
| Observed-arm parent CPU during overhead check | About 13.76–19.06% of one core including setup; roughly 57 MB RSS | Monitoring is not cost-free; interval/host/startup dependent |
| Six-method deterministic fixture | Five methods reduce 4 actions to 2; no-reduction retains 4 | Software plumbing only; no empirical ranking |
| Historical five-trace detector replay | Existing and fixed-threshold methods both detect 3 old positives and avoid alerts on 2 old negatives | Exploratory reused data, no superiority or normal-use rate |

Raw report hashes and summaries are in `bench/results/research_engineering_validation_20261016.json`. Historical comparison is separately labeled. No final-campaign cells have executed. There is no measured real failure on which to estimate reducer gain, remedy benefit or a reproducibility rate for a severe application slowdown.

## 7. Validity and decision

The limiting condition is the lack of a valid severe failure before host-memory pressure on the attempted configuration. Continuing to larger allocations or weakening host guards would confound the intended GPU hypothesis. Following the dossier's kill/narrow rule, the present deliverable is narrowed to an auditable experiment system and a feasibility report. The broader reduction-benefit study remains open.

Counter signatures are proxies; a preserved proxy is weaker than a preserved residency mechanism. Decode metrics are server aggregates, not independent token samples. A second installed model's hashes are frozen, but its full inference fit/completion and a second purely text architecture are not established. Optional D3D12, image generation, exact load/prefill instrumentation, long ordinary-session negatives, matched external comparators, persistent model-unload remedies and independent replication are not validated. Existing synthetic bandwidth findings cannot be generalized into an AI application speedup.

## 8. Artifact and remaining evidence

The artifact includes recipes, budgeted reducers, campaign gating/checkpoints, whole-block analysis, guarded remedy comparisons, tests, native evidence and a local sanitized source/results package. The evidence viewer renders measured reports and fixtures distinctly. Package hashes are integrity checks, not authenticity signatures. Dependencies, drivers and model weights are not hermetically locked or redistributed.

Before an empirical submission: establish valid failure/reset on a suitable resource configuration, predeclare calibrated levels and fresh session blocks, collect matched confounder controls and independent residency evidence, run the gated comparison/ablations, and report failures as well as successes. Faculty approval, closest-project abstract review, developer interviews and institutional IP review are external and remain pending. They have not been inferred from implementation progress.
