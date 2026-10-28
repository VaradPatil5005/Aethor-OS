# SpillGuard research decision dossier

Prepared for **Varad Santosh Patil, 24BIT0175**. Research date: **16 October 2026**.
Constraints supplied by Varad: **at least three months; access to the current laptop only**.

## Recommendation

Develop **SpillGuard Repro: Reproducing and Minimizing Cross-Process GPU-Memory Performance Failures on Windows**.

The concrete problem is this: an AI application performs acceptably when tested alone, but becomes much slower on a customer's Windows machine when another application changes GPU-memory residency. A developer sees several plausible explanations, inconsistent memory readings, and a long workflow that is difficult to reproduce. The proposed tool should turn that incident into a small, repeatable pressure scenario, test whether residency pressure actually accounts for the slowdown, and verify a remedy.

Keep AetherOS as the explanation and demonstration interface. Make the scientific artifact the **Windows agent, experiment protocol, reducer, and reproducible evidence bundle**. An attractive simulated desktop is useful presentation, but it is not the research contribution.

This is the strongest direction I found for your combination of existing implementation, hardware access, time, and class differentiation. It is a **research hypothesis**, not a confirmed world-first invention, a patentability opinion, or an implemented result.

## 1. Your five requirements, addressed separately

| Requirement | Finding | Priority and action |
|---|---|---|
| Real problem faced outside college | NVIDIA documents Windows system-memory fallback and slowdown; Microsoft documents residency-budget stuttering; application issue reports describe concrete residency failures | **P0:** reproduce the relevant failure class locally and measure application performance |
| Unique among classmates | No direct title match to the proposed Windows residency incident reducer was found in the main project list; several substantial neighboring concepts exist | **P0:** submit a short scope statement distinguishing the method, platform, and output; ask for abstract-level comparison with the closest projects |
| Patent or research paper | Broad detection, GPU scheduling, admission, causal diagnosis, and reduction all have prior art | **P0:** pursue a narrowly scoped, reproducible systems/tool paper; treat patent assessment as a separate claim-level exercise |
| Build on SpillGuard | Your agent, telemetry, estimator, traces and synthetic stress workload can be reused | **P1:** improve evidence quality and experiments before expanding the UI |
| Think beyond common student projects | The useful shift is from “monitor and predict usage” to “produce a reduced experiment that explains and verifies a real performance failure” | **P1:** make the diagnostic witness and measured remedy the main output |

A domain can overlap without being the same project. Conversely, changing a name, adding AI, or moving the same algorithm to Windows does not establish a distinct contribution.

## 2. Research scope and evidence limits

I screened **30 research works**, with abstracts or publisher descriptions for breadth and selected full-text sections for ten core works. I also checked official platform documentation, existing implementations, public issue reports and preliminary patent disclosures. The companion [literature matrix](literature-matrix.csv) records the depth, source and relevance for every work.

This was a focused international prior-art and industry-problem investigation. It was not an exhaustive search of every paper, patent, product or private company project worldwide. A paper surfaced in search was not automatically treated as peer reviewed. Several closest 2026 works are preprints.

Evidence labels used here:

- **Official:** platform/vendor documentation about behavior or an existing capability.
- **Reported:** an issue author's observations, not independently reproduced in this session.
- **Existing local artifact:** code or saved results inspected in your checkout; not a new hardware experiment.
- **Inference:** a conclusion drawn from those sources.
- **Proposed:** a method, target, or experiment still to implement and validate.
- **NO DATA FOUND:** evidence absent from this investigation; not evidence that it does not exist.

No new GPU stress runs, model downloads, driver changes, source-code fixes, or external publication were performed for this research. Existing source changes in your worktree were preserved.

## 3. What the class sheet actually says

I read the supplied sheet through the connected Google Drive account. The main **Projects** tab returned 225 rows, containing **222 nonempty title cells after the header**. These include duplicates, unusual entries and a case-study-like entry; 222 should not be reported as a verified count of distinct projects or teams.

Your registration is **Projects row 100**:

> AetherOS: An Interactive Web-Based Micro-Operating System Environment with Real-Time Scheduling, Memory Virtualization, and Concurrency Visualizers

The row identifies 24BIT0175, varad patil, Prof. Harshita Patel, G1.

The live audit tab contains broken references and conflicting summary statements. I did not treat its “all unique” message as reliable evidence. The comparison below comes from actual titles in the main list.

| Sheet row | Closest registered project | Overlap to avoid | Proposed boundary |
|---|---|---|---|
| 38 | A Resource Managed C Daemon for Local AI Workload Orchestration | Generic local AI orchestration | Reproduce and reduce a Windows residency-induced incident, rather than orchestrate AI work generally |
| 55 | Latency-Aware Operating System Scheduler for Heterogenous Local AI Inference Workloads | Scheduling local inference for latency | Diagnose a measured failure and output a replayable experiment; no new general scheduler claim |
| 70 | CascadeGuard A Self Calibrating Kernel Engine for Predictive Contention Propagation Analysis and Bounded Intervention | Predictive contention and mitigation | Cross-process WDDM residency witnesses, experimental controls and reduction |
| 94 | GPU-aware fair scheduler for multi-tenant edge AI | GPU resource fairness | Diagnostic reproduction/minimization on a Windows laptop, not fair sharing |
| 95 | Momus: An Evolutionary Adversarial Framework for Emperical Worst-Case Analysis of Classical Operating System Algorithms | Adversarial testing | Real applications and live residency behavior, rather than worst-case behavior of classical OS algorithms |
| 105 | MemGuard: A Thrashing Detection and Intelligent OOM Resolution Engine | Detecting thrashing and resolving memory exhaustion | Successful-but-slow GPU workloads; diagnosis and minimized reproducer rather than generic OOM handling |
| 162 | CPRIE — Cross-Layer Predictive Resource Impact Engine for Operating Systems | General cross-resource impact prediction | Explicit experimental intervention and a reduced failure trace |
| 164 | Predictive and Adaptive Virtual Memory Management with Intelligent Thrashing Prevention | Adaptive virtual-memory policies | GPU residency incident testing rather than CPU virtual-memory policy |
| 166 | Evidence-Driven Kernel-Level Performance Diagnosis in Linux | Evidence-based performance diagnosis | Windows WDDM cross-process residency, minimum witnesses, and application performance tests |

PRESERVE at row 23 and KernelLens at row 82 are also adjacent to a broad resource-governor proposal. The [complete title screen](class-title-screen.csv) retains all 222 nonempty entries and the provisional overlap assessment.

**Conclusion:** the proposed scope has no direct match in the titles inspected, but uniqueness cannot be certified from titles. Momus and the Linux diagnosis project are especially important abstract-level comparisons. The appropriate claim is “distinct proposed scope based on the supplied list,” not “no student anywhere has this idea.”

[Class source](https://docs.google.com/spreadsheets/d/1sko20RrZe9eCI4bAm2HiQSoQRK0zswxjCKQ_q5DbDJU/edit?gid=0#gid=0)

## 4. Real-world problems and the strength of the evidence

### 4.1 NVIDIA: the speed-versus-failure tradeoff is documented

NVIDIA explains that its Windows driver can use shared system memory when GPU memory is exhausted. This lets workloads continue at reduced speed. Its support article describes a per-program fallback setting, with disabling fallback potentially restoring stable speed at the cost of an out-of-memory failure.

This establishes a real platform problem. It also disproves a weak novelty claim: “my tool is the first way to prevent Windows fallback.” A documented control already exists. The unanswered practical question for your tool is which pressure condition causes a particular application's slowdown and which acceptable change resolves it.

**Official source:** [NVIDIA system-memory fallback guidance](https://nvidia.custhelp.com/app/answers/detail/a_id/5490).

### 4.2 Microsoft: residency budgets change and exceeding them can cause stuttering

Microsoft documents per-process residency budgets and states that applications exceeding their assigned budgets may be intermittently frozen and paged out. The budget is dynamic.

A crucial limitation follows: **a DXGI query issued by the SpillGuard observer describes the calling process's budget and usage. It is not automatically the target application's budget or a global free-memory number.** Your source already acknowledges the calling-process scope, but a research design must preserve that distinction in every formula and graph.

**Official sources:** [QueryVideoMemoryInfo](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_4/nf-dxgi1_4-idxgiadapter3-queryvideomemoryinfo), [process residency budgets](https://learn.microsoft.com/en-us/windows-hardware/drivers/display/process-residency-budgets).

### 4.3 ONNX Runtime/DirectML: applications need coordinated residency, not just smaller models

A public ONNX Runtime feature request describes multi-session inference where models fit individually but not together, with expensive session recreation and poor responsiveness under overcommitment. The author reports a prototype residency API as a solution.

This is concrete developer evidence and relevant prior art. It is not proof that the latest runtime remains unable to handle this situation, nor that Microsoft has validated every number in the report. It suggests testing the transition between model phases rather than considering only a steady-state model footprint.

**Reported source:** [ONNX Runtime issue 18142](https://github.com/microsoft/onnxruntime/issues/18142). **Existing prototype:** [PR 18143](https://github.com/microsoft/onnxruntime/pull/18143).

### 4.4 ComfyUI: a small code change can cross a large performance cliff

An August 2026 public issue reports that an extra tensor clone increased peak VRAM enough to trigger severe slowdown on a Windows 16 GB GPU. The report includes commits and an apparent local workaround.

The important product lesson is not the reported GPU's exact threshold. It is that a memory increase can appear harmless on one machine and become a substantial performance regression near another machine's residency boundary. Your tool could be useful as a local regression test for this failure class.

The reported 16 GB video workflow cannot be claimed as reproduced on your 6 GB laptop. You can test the underlying class using smaller workloads and separately state that limitation. Removing the clone is not a general recommendation: correctness may depend on it.

**Reported source:** [ComfyUI issue 15537](https://github.com/Comfy-Org/ComfyUI/issues/15537).

### 4.5 AMD/ROCm: allocated, alive and resident are different states

A public TheRock issue reports live tensors losing local residency after an idle period under one Windows driver, while another tested driver retained residency. The author provides a reduced reproducer and residency measurements.

This motivates idle/resume testing and the separation of allocation from residency. It is an AMD user's report, not evidence that the same regression exists on your NVIDIA laptop. Do not advertise AMD support until tested.

**Reported source:** [ROCm/TheRock issue 7221](https://github.com/ROCm/TheRock/issues/7221).

### 4.6 Alibaba and IBM: GPU memory problems are broader than Windows spill

AntMan describes a real production GPU-sharing deployment at Alibaba. IBM research reports memory-bandwidth bottlenecks in large-batch inference. These establish wider industrial relevance for GPU interference, but they should not be used to claim that Alibaba or IBM needs this proposed Windows tool.

**Research sources:** [AntMan](https://www.usenix.org/conference/osdi20/presentation/xiao), [IBM memory-bottleneck research](https://research.ibm.com/publications/mind-the-memory-gap-unveiling-gpu-bottlenecks-in-large-batch-llm-inference).

**Commercial evidence still missing:** NO DATA FOUND for willingness to pay, incident frequency in target teams, support costs saved, or a company commitment to pilot your tool. Technical pain is documented; product demand requires interviews.

## 5. What already exists, and why several attractive ideas are weak

| Existing work/tool | Capability that overlaps | Consequence |
|---|---|---|
| hypomnesis spill tracker and CLI | Windows spill detection using dedicated-memory pressure and shared-memory growth; incident summaries and attach-style triage | Basic counter-based spill detection is not a strong novelty claim |
| NVIDIA fallback control | Changes CUDA fallback behavior for a program | Prevention cannot be claimed merely by exposing this setting |
| PIX | D3D12 resource/residency events, including paging operations | “Nobody can observe GPU paging” is false |
| Windows HLK memory-budget tests | Tests driver responses to trimming and budget requests | A generic Windows memory stress test already exists |
| Nixie | Consumer GPU temporal multiplexing, memory movement and interactive prioritization | Generic consumer GPU sharing is crowded; the paper describes a Linux prototype and discusses Windows portability |
| Concur | Feedback-driven proactive agent admission | “Predict pressure and regulate concurrency” is already researched |
| Valve and Mosaic | Preemption/reclamation bounds or interference-aware admission | A new general GPU scheduler would face strong recent competitors |
| CADET and Coz | Experimental/counterfactual performance diagnosis | Causality is not a new concept introduced by this project |
| HPAS and the LLM RCA framework | Controlled performance anomaly generation and diagnostic evaluation | Chaos testing alone is not new |
| ddmin and ProbDD | Failure-preserving input reduction | Calling ordinary delta debugging “our novel algorithm” would be inaccurate |

**Sources:** [hypomnesis documentation](https://docs.rs/hypomnesis/latest/x86_64-pc-windows-msvc/hypomnesis/spill/index.html), [hypomnesis changelog](https://github.com/pcfvw/hypomnesis/blob/HEAD/CHANGELOG.md), [PIX residency events](https://devblogs.microsoft.com/pix/pix-2303-02/), [HLK trim test](https://learn.microsoft.com/en-us/windows-hardware/test/hlk/testref/7d035ea1-571a-4dda-9543-abbc1798e5a5), and papers P01–P12 in the literature matrix.

The current fetched hypomnesis pages/changelog are not a release-history audit; repository snapshots differ. The overlap in the documented mechanism is sufficient to require comparison, without claiming a precise latest version.

The vramd package also describes peak-based admission, calibration and feedback on consumer GPUs. Its documentation states a POSIX limitation. Its exact release chronology was not established here, so treat it as an observed implementation competitor rather than relying on it for a dated patent novelty conclusion. [Package documentation](https://pypi.org/project/vramd/0.3.0/).

### The candidate gap

In the inspected closest sources, I did **not identify an end-to-end equivalent** of:

1. Reproducing a Windows application's residency-related slowdown using a controlled cross-process pressure scenario.
2. Reducing that scenario while preserving the target's relevant phase and measured residency behavior.
3. Separating a residency explanation from compute/bandwidth contention, intended offload, host-memory pressure and telemetry disagreement.
4. Validating the reduced scenario and an acceptable remedy in fresh repeated trials.
5. Packaging the result as a rerunnable evidence bundle.

That is a candidate gap, not proof of absence. The research contribution must be the additional mechanism and measured benefit over the existing components, not the fact that they were integrated.

## 6. Alternatives considered and ranked for your constraints

These are qualitative judgments, not measured market scores.

| Rank | Direction | Real problem | Fit to one laptop | Novelty pressure | Decision |
|---|---|---|---|---|---|
| 1 | Residency-aware incident reproduction and reduction | Strong documented failure class | High | Existing diagnosis/reduction work requires a precise new mechanism | Recommended |
| 2 | Verified cooperative GPU-memory release coordinator | Strong multi-application problem | Medium | ONNX residency prototype, Nixie, Valve and other controls overlap | Possible later extension; requires application cooperation |
| 3 | Load-peak-aware admission for local AI | Strong risk of transient allocation peaks | High | Calibration/admission already implemented elsewhere | Useful feature; weak standalone research pitch |
| 4 | GPU telemetry consistency auditor | Documented counter limitations; confusing commitment/residency | High | Existing telemetry libraries overlap | Good narrower fallback measurement study |
| 5 | General predictive GPU scheduler | Strong industry interest | Medium/low | Very crowded; class overlap and strong papers | Reject as primary topic |
| 6 | Memory-aware asynchronous checkpointing | Real host-memory and persistence tradeoffs | Low/medium | Strong existing DCP ecosystem; distributed evaluation expensive | Outside your current comparative advantage |

PyTorch's asynchronous checkpointing documentation explicitly discusses the extra CPU-buffer memory requirement. This makes the sixth problem real, but does not make it your best project. [Official checkpointing recipe](https://docs.pytorch.org/tutorials/recipes/distributed_async_checkpoint_recipe.html).

## 7. The proposed solution in operational detail

### Target user and job

Start with a local inference developer or open-source application maintainer with a Windows GPU performance complaint. Their job is to answer: “What small scenario reproduces this slowdown, what evidence supports the cause, and what change actually fixes it?”

A successful output is a local folder containing:

- Environment and version manifest, with identifiers and private paths minimized.
- Workload configuration, input hashes and phase markers.
- Pressure recipe and seed.
- Actual observed pressure/residency trajectory.
- Baseline, pressure and intervention timings.
- Counter disagreements and missing-data markers.
- Reduced recipe and independent validation results.
- A concise report and command to rerun the experiment.

Avoid a fabricated “diagnostic proof.” Call it an **experimental witness**: it demonstrates observed behavior under recorded conditions.

### A. Build a trustworthy observation layer

Reuse PDH per-process memory, adapter totals, LUID mapping, NVML where valid, system RAM/commit and workload timing.

Preserve units consistently: MiB/GiB for binary memory quantities, GB/s if bandwidth is calculated in decimal bytes per second. Existing files label some binary quantities MB; normalize in new experiments.

Record a monotonic clock for experiment ordering and wall time for log correlation. Track PID plus process start time; PID reuse alone can otherwise join unrelated histories.

Maintain separate fields for committed allocation, local/dedicated residency, non-local/shared observations, requested workload memory and measured latency. Record collection failures rather than converting unknown values to zero.

**Do not assume** the sum of per-process counters equals adapter use: shared allocations, accounting semantics and lag can complicate reconciliation. Use disagreement as a diagnostic signal.

Microsoft documents incorrect GPU process-memory counters in specific circumstances. That is a reason to test data quality, not to claim that all current Windows counters are wrong. [Official counter limitation](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/gpu-process-memory-counters-report-wrong-value).

### B. Represent controlled pressure as an experiment

A pressure recipe should record at least:

| Field | Why it matters |
|---|---|
| Allocated bytes | What the helper requested |
| Observed residency | Allocation does not prove that the intended resident pressure was produced |
| Touch cadence/access pattern | Idle buffers and repeatedly used buffers can behave differently |
| Compute duty | Distinguishes some compute competition from mainly capacity pressure |
| Start phase | Model load, prefill, decode and idle/resume have different sensitivity |
| Duration and release schedule | Transient spikes differ from sustained occupancy |
| Host-memory use | GPU backing memory can create a second bottleneck |
| Measured clocks/temperature | Power-state changes can mimic a memory-induced slowdown |

Extend your existing allocation helper first. Add a small D3D12 pressure helper later if feasible, because it is closer to graphics coexistence. A synthetic helper is not a faithful recreation of every game, browser or editor. Publish that distinction.

Pressure control is **best effort** under WDDM. Requesting a given allocation does not force the OS to produce the same residency trace on every run. Log the realized pressure and classify failed manipulations as inconclusive.

### C. Establish an interpretable performance failure

Choose one primary metric per workload before testing. For LLM decode, use run-level time per generated token or throughput; for interaction use time to first token; for a rendering workload use completion time. Do not pool these into one unexplained score.

For example:

R = median per-token time under pressure / median per-token time in the matched baseline.

A practical failure might require R >= 2, successful completion, and no reduction in requested work. The threshold is a **chosen operational definition**, not a measured result or universal boundary.

A memory-pressure hypothesis needs more than R:

- A baseline with the same input, engine settings and output-token requirement.
- Evidence that the pressure manipulation occurred.
- A control run that removes or changes the suspected pressure.
- Repeated recovery when the pressure is removed.
- Accounting for intentional CPU offload, host pressure and major power-state changes.

Shared memory growth alone is not proof that it caused the slowdown. No observed shared growth is not proof that the GPU is free of all performance problems.

### D. Use interventions instead of blaming the largest process

Your current culprit method ranks recent dedicated-memory growth. Keep that as an explicit heuristic baseline.

For controlled helpers, compare randomized matched runs such as:

- No helper.
- A resident-memory holder with minimal ongoing activity.
- Similar allocation with additional memory touches.
- Compute-heavy pressure with a smaller memory footprint.
- Release part of the controlled holder, keeping the target settings fixed.
- Remove the holder entirely.

These comparisons do not perfectly isolate every GPU resource. Touching memory also consumes bandwidth; a compute workload also draws power. Measure those confounders and limit the causal statement to the intervention actually tested.

Use labels such as **supported residency contribution**, **mixed cause**, **insufficient evidence**, or **counter disagreement**. Do not label an uncontrolled third-party process a proven culprit from correlation alone.

A runtime tool observing someone's ordinary session should remain diagnostic. The controlled experiments belong in an explicit lab mode and should operate on owned test processes.

### E. Reduce the failing scenario

Represent a recipe as a sequence of pressure actions. Reduction can remove actions or shorten their duration, reduce held bytes, narrow their overlap with a target phase, or remove unnecessary helper processes.

Begin with ordinary ddmin/greedy reduction as baselines. The proposed extension should preserve **phase alignment and realized residency behavior**, rather than accepting a smaller recipe that now causes a different failure.

A failed or ambiguous test must not be classified as a pass. WDDM behavior can be noisy and non-monotonic. Therefore:

- Do not assume more allocated memory always produces greater slowdown.
- Use binary search only for ranges where repeated measurements support approximate monotonicity.
- Distinguish recipe minimization from byte-threshold estimation.
- Cache results only when environment and workload signatures match.
- Validate the final recipe with fresh runs after the search.

The realistic target is **a locally or 1-minimal witness under a defined discrete transformation set**. It is not a globally smallest failure under all possible schedules.

Potential original mechanism: an uncertainty-aware reducer that rejects reductions which destroy the relevant residency/phase signature, and allocates test effort to ambiguous outcomes. Whether that is publishably novel requires comparison with reduction literature and experimental baselines.

### F. Verify the smallest acceptable remedy

A remedy should be evaluated against a declared user constraint: preserve context length, output count, model precision or render quality unless the user explicitly allows change.

Possible interventions:

- Delay a controlled background job.
- Unload a specifically supported idle model through its documented API.
- Release memory in an owned helper.
- Select a lower-memory execution configuration with explicit quality/capability consequences.
- Queue a new job rather than start it during an incompatible peak.

Measure what actually happened: unload requests do not necessarily return residency immediately; pausing a process usually does not establish that its VRAM was freed.

Test the selected remedy in fresh runs. Report recovered performance, action cost, and any changed task requirement. A faster result obtained by silently truncating the input is not a valid fix.

General prevention of spill across arbitrary Windows applications is outside the enforceable scope of a user-space observer.

## 8. Why your existing implementation is a credible starting point

I inspected the current source and saved artifacts. The relevant foundations are:

| Existing component | Reuse |
|---|---|
| agent/spillguard/collector.py and dxgi.py | Windows telemetry and adapter selection |
| analyzer.py | Replayable detector and heuristic culprit baseline |
| gguf_fit.py | Configuration footprint estimate |
| advisor.py and bankers.py | Existing admission baseline and configuration proposals |
| bench/spillstress.py | Controlled allocation/touch helper |
| bench/run_w1.py and evaluate.py | Repeated traces and evaluation scaffolding |
| Frontend live/replay integration | Explain and demonstrate the evidence |

Saved results in bench/results/w1_eval.json report three positive runs, two negative runs, 3/3 detections and no false-positive runs. They report about 163.3 versus 13.2 GB/s for the synthetic bandwidth probe and mean detection latency of 0.95 seconds.

These are **previously saved pilot results inspected now**, not new experiments or a verified application-wide speedup. The bandwidth ratio must not be presented as “all AI apps become 12.4 times faster.”

The estimator summary contains nine full-offload observations from two models, with reported leave-one-out error around 46 MB. This is a small calibration exercise. Holding out a configuration is much weaker than holding out a model architecture, session, driver or machine.

The current advisor uses a fixed 256 MiB VRAM margin and 1.1 times observed peaks for unknown running applications. That is a heuristic, not a reliable maximum-claim contract or hard memory reservation. Banker's algorithm does not create GPU isolation.

The existing documentation itself identifies weak threshold discrimination, small samples, missing realistic negatives, untested vendors and an unperformed fallback-off check. These are sensible starting limitations to address.

## 9. Experiments feasible on your one laptop

### Research questions

- **RQ1:** Which observed signals distinguish residency-related slowdown from benign shared-memory use, intentional offload and other resource competition?
- **RQ2:** Does phase/residency-aware reduction produce smaller and more reproducible witnesses than ordinary reduction?
- **RQ3:** Can the reduced witness help choose an effective remedy with less disruption than unloading everything or serializing all work?
- **RQ4:** How much monitoring and experimentation overhead is introduced?

### Workload coverage

Start with two local text models that genuinely fit, plus a controlled CUDA workload. Add a small real image-generation workflow only if it runs acceptably on the laptop.

Cover cold load, warm load, prefill, decode and idle/resume. Use controlled co-tenants with distinct pressure patterns: steady hold, ramp, burst and release/reacquire. Include normal browsing and benign shared-memory cases as negative controls, without assuming they are identical across sessions.

Do not claim that reduced VRAM availability emulates every characteristic of a 4 GB, 8 GB or 16 GB GPU. It changes one resource condition on the same architecture.

### A practical initial matrix

A first structured matrix could use:

- Three target workloads.
- Two preparation states: cold and warm.
- Four pressure patterns.
- Three pressure levels determined from a separate calibration pilot.

That gives **72 cells**. Six fresh session runs per cell gives **432 trials**. At 90 seconds per trial that is approximately **10.8 hours of execution**, excluding model setup, cooling, failures and analysis. This is planning arithmetic, not a prediction of actual runtime.

Use a smaller pilot to estimate variability before committing to the matrix. Six runs can be underpowered for some comparisons. Allocate additional fixed batches where the pilot indicates a need. Do not report precise tail-latency claims from a handful of requests.

### Strong baselines

1. Current SpillGuard detector and growth-based culprit heuristic.
2. A simple fixed-free-memory or pressure threshold policy.
3. Plain greedy reduction or ddmin.
4. ProbDD-style reduction where implementation assumptions apply.
5. A no-reduction pressure-replay baseline.
6. Manual or exhaustive search on tiny scenarios, where affordable.
7. “Run one workload at a time” and “unload all supported idle models” as intervention baselines.
8. A matched hypomnesis detector configuration where it can be installed and validated.
9. PIX/ETW residency observations on a small supported D3D12 validation subset, if available.

Nixie, Mosaic and large cluster frameworks belong in the related-work comparison. Do not manufacture numeric head-to-head results when their runtime assumptions cannot be reproduced on this laptop.

### What to measure

- Reproduction rate k/n on fresh runs.
- Failure classification precision/recall and false alarms per normal-use hour.
- Witness size: actions, duration, requested bytes and realized residency.
- Reduction wall time and number of expensive test executions.
- Agreement between reduced and original failure mechanisms.
- Application slowdown and recovery relative to matched baselines.
- Remedy disruption and preserved task requirements.
- Agent CPU, RAM, collection lag and workload overhead.

Treat whole sessions or experiment blocks as the statistical replication unit. Thousands of token intervals from one run are not thousands of independent experiments. Randomize treatment order and use paired comparisons where appropriate.

Use fixed sample sizes or a valid sequential procedure. Repeatedly checking an ordinary 95% interval until it looks favorable does not preserve its nominal interpretation. Keep search data separate from final witness validation; selected “best” recipes otherwise receive optimistically biased scores.

Predeclare exclusion rules. An experiment with failed pressure generation or missing timing should be labeled invalid, not quietly dropped because it weakens a result.

### Controls that matter on this hardware

- Record versions, power mode, AC/battery state, temperature and clock behavior.
- Warm up kernels; your earlier artifacts already identified a cold-state bandwidth confounder.
- Keep input length, generated-token budget, engine settings and model hash fixed.
- Separate CPU offload and paging behavior.
- Record available RAM, commit and major background activity.
- Establish recovery and cooldown/reset rules before repeat runs.
- Use conservative resource limits and an immediate stop mechanism for lab helpers.
- Terminate/release only owned experiment helpers automatically.
- Do not change driver policy or install drivers as part of a routine test.

All measurements remain conditional on the tested laptop. Multiple sessions improve repeatability evidence, not hardware generality.

## 10. Three-month execution plan with decision gates

| Weeks | Priority | Deliverable | Gate |
|---|---|---|---|
| 1–2 | P0 | Frozen scope, closest-work comparison, instrumentation audit and pilot | Show a repeatable real workload slowdown and recovery under a controlled manipulation |
| 3–4 | P0 | Phase markers, pressure recipes, reliable reset and negative controls | Separate at least two confounded explanations with intervention evidence |
| 5–6 | P0 | Plain reducer plus proposed phase/residency-aware version | Establish a measurable benefit over a simple baseline |
| 7–8 | P1 | Fresh-validation workflow, remedy tests and uncertainty reporting | Show the reduced scenario preserves the failure rather than switching mechanisms |
| 9–10 | P1 | Full experiment matrix, ablations and overhead study | Results remain interpretable after accounting for failed and inconclusive trials |
| 11–12 | P1 | Artifact cleanup, paper draft, replication guide and faculty review | Every major claim maps to a result table or a clearly stated limitation |

If extra weeks are available, use them for external replication or a second real application. Do not add another large subsystem merely to increase feature count.

**Kill or narrow the proposal early if:**

- The target workload slowdown cannot be reproduced without overwhelming host RAM.
- A simple threshold plus plain ddmin performs just as well.
- The pressure helper cannot produce sufficiently repeatable residency conditions.
- The mechanism labels cannot be validated independently.
- A closer equivalent appears in prior work.

A useful fallback paper could study **when Windows GPU-memory indicators disagree and how that changes diagnosis**, using your existing detector as a baseline. That still needs an empirical result; it is not an automatic publication.

## 11. Paper path and patent path are different

### A defensible paper contribution

A realistic paper could contain:

1. A well-controlled characterization of residency-related performance cliffs on a specific Windows GPU platform.
2. A phase/residency-aware method for reducing cross-process pressure incidents.
3. Evidence that the method improves reproducibility or testing cost over ordinary reduction.
4. A public, privacy-scrubbed artifact and a fresh validation protocol.
5. An analysis of where the method fails.

Proposed paper title:

**From GPU Memory Counters to Reproducible Slowdown Witnesses: A Windows WDDM Case Study**

This formulation fits single-device evidence better than claiming a universal GPU memory manager. A systems/performance/software-testing workshop or tool/demo track may be a better initial target than a top-tier full paper, but suitability and acceptance depend on results, venue scope and deadlines. No venue acceptance is promised.

A negative result can be publishable when it is rigorous and informative. “We built a dashboard” without a research question and comparison is a substantially weaker submission.

### Patent assessment

**Patentability is unconfirmed.** Prior art already covers the building blocks, including allocation controls, GPU fault injection, resource testing, causal diagnosis and reduction.

A preliminary title/disclosure screen surfaced, among others:

- [US10922203B1 — Fault injection architecture for resilient GPU computing](https://patents.google.com/patent/US10922203B1/en).
- [CN119922183A — Automated CUDA environment configuration and GPU stress testing](https://patents.google.com/patent/CN119922183A/en).
- [CN116569153A — Virtual GPU–CPU memory orchestration](https://patents.google.com/patent/CN116569153A/en).

These are screening leads, not a claim chart, legal-status investigation, infringement assessment or freedom-to-operate search. A patent's relevance is determined by the claims and disclosure, not its title.

For India, section 3(k) and the official computer-related-invention examination guidance matter. A technical effect is relevant to eligibility analysis, but it does not remove novelty, inventive-step and other requirements. [Official CRI guidelines](https://ipindia.gov.in/frontend/pdf/patents/guidelines/GUIDELINES%20FOR%20EXAMINATION%20OF%20COMPUTER%20RELATED%20INVENTIONS%20(CRIs)%20-%202025.pdf).

A possible invention discussion with your institute's IP cell would concern a **specific experimentally supported reduction/control mechanism**, not “AI detects GPU spill.” First produce a detailed invention disclosure, list the closest claims and papers, and identify exactly which technical steps differ.

If patent protection matters, discuss filing strategy **before public release of the new inventive details**. WIPO explains that disclosure before filing can destroy novelty, subject to jurisdiction-specific rules. Do not assume an academic presentation or GitHub repository is exempt. This is especially relevant because parts of SpillGuard already exist; document what was previously disclosed and when. [WIPO guidance](https://www.wipo.int/en/web/patents/protection).

## 12. Product validation without pretending there are customers

The likely initial users are local AI maintainers, Windows application QA engineers and performance-support engineers. These are hypotheses.

Interview approximately five to ten relevant developers, where possible, about recent incidents:

- What slowdown occurred, and what evidence was available?
- How long did reproduction take?
- Was the machine's workload mix different from the developer's?
- Which tools were already tried?
- Would a small runnable reproducer have changed the debugging process?
- Which logs or data cannot leave the machine?
- Can they supply a non-sensitive workload or independently try an artifact?

Do not ask only “Would you use my tool?” Ask for a concrete past incident and a trial. A reduced reproducer accepted by a maintainer, or a regression caught before release, would be stronger practical evidence than a speculative market-size estimate.

No messages were sent to maintainers or companies during this research.

## 13. Scope statement for the faculty review

Suggested project title:

**SpillGuard Repro: Reproducing and Minimizing Cross-Process GPU-Memory Performance Failures on Windows**

Suggested scope:

“We will develop and evaluate a Windows user-space experimental tool for GPU applications that complete successfully but suffer severe latency degradation under changing memory residency. The tool will combine application timing, per-process and adapter telemetry, controlled co-process pressure, and failure-preserving scenario reduction to produce a small rerunnable incident. We will compare the proposed phase/residency-aware reduction method with ordinary reduction and heuristic memory diagnosis, and verify remedies without silently changing task requirements. AetherOS will visualize the experiments. Initial evaluation will be limited to the available RTX 3050 laptop.”

This is intentionally a proposed scope. Do not present its unbuilt capabilities as completed work.

## 14. What to do first

1. Confirm the proposed boundary against the abstracts of the nearest class projects, particularly rows 95 and 166.
2. Compare hypomnesis's documented spill mechanism against your detector and record what is already shared prior art.
3. Freeze one target workload and one primary performance metric.
4. Reproduce slowdown and recovery with your existing helper, preserving task settings.
5. Build plain reduction first; establish whether the proposed residency/phase preservation adds value.
6. Decide on a paper contribution after the pilot, then investigate patent claims if a specific inventive mechanism survives the comparison.

The first two weeks should answer whether this becomes a research project worth spending the remaining months on.

## Companion files

- [Thirty-work literature matrix](literature-matrix.csv): primary links, review depth, mechanism and implications for novelty.
- [Complete main-sheet title screen](class-title-screen.csv): all 222 nonempty title cells, actual sheet rows and provisional boundaries.
- [Source register](source-register.csv): paper and non-paper sources with evidence type.
- Existing local evidence: ../../SPILLGUARD.md, ../../../bench/results/w1_eval.json and ../../../bench/results/e3_summary.json.

The recommendation is to retain your working foundation and invest the new effort in **trustworthy reproduction, experimentally supported diagnosis, and independently validated reduction**.

