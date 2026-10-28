# Dossier execution ledger

Updated 17 October 2026. Source: [research dossier](research/2026-10-16-spillguard-opportunity/research-dossier.md). Existing architecture and research files are retained. Software delivery and empirical conclusions are tracked separately.

**Update 18 October 2026 — first gate passed.** A repeatable, matched, recovered severe slowdown of a real
local LLM was reproduced on this laptop without relaxing any guard: Qwen2.5-3B decode slowed 2.28–2.38×
(4/4 trials) once an active co-tenant pushed demand 256–512 MiB past physical VRAM, against 1.15–1.22× when
the model still fit. The earlier attempts could not fail by design (co-tenant ≤ 1 GiB, started after the model
was resident). An idle co-tenant of the same size gave 1.03× (one valid trial) with identical residency
counters, and the counter detector raised 3 false alarms in 9 valid trials. Details, limits and commands:
[SPILLGUARD_REPRO_RESULTS_20261018.md](SPILLGUARD_REPRO_RESULTS_20261018.md). Remaining items below still apply,
except item 1 (a severe-slowdown configuration now exists).

**Decision of 17 October (superseded for gate 1):** deliver the experiment/evidence system and feasibility report. The dossier's early kill/narrow gate has been reached in the attempted loaded-laptop configuration: no valid severe application slowdown was reproduced before host-memory pressure. The full empirical project is not complete. Larger pressure, weaker guards and fabricated results would not resolve that gate.

| Dossier area | Implemented or prepared | Validation / remaining requirement |
|---|---|---|
| 1, 3, 13, 14: scope/class distinction | Original title screen; faculty brief and abstract form in [review packet](research/2026-10-16-spillguard-opportunity/review-packet.md) | Closest abstracts, faculty rubric and approval unavailable; uniqueness unconfirmed |
| 2, 4, 5, 6: evidence/prior art | Original matrices retained; six reducers; historical fixed-threshold/existing-detector comparison | Five old traces re-evaluated, not independent new data; matched hypomnesis/PIX/ETW validation unavailable |
| 7A: observation | Monotonic/wall time, birth identity, source errors, units, disagreement, observer-specific DXGI scope, optional clock/temperature/power/utilization | Native PDH/DXGI/NVML checks; direct residency unverified |
| 7B: experiment | Hold/ramp/burst/reacquire; pressure/request/first-output anchors; cold/warm/idle preparation; owned cleanup; timeout/cancel/host guards | Warm Qwen2.5/CUDA paths checked; full state/pattern coverage, exact internal load/prefill, D3D12 and image generation unvalidated |
| 7C: performance failure | Fixed work/output/digests/context, primary metrics, observed overlap, baseline/pressure/recovery, invalid outcomes | Qwen2.5 128 MiB negative ratios about 1.018/1.019; 1 GiB host-guard inconclusive; Qwen3-VL text smoke guarded before timed stages. Severe-failure gate unmet |
| 7D: interventions | Holder, repeated touches, bounded PTX arithmetic helper; conservative diagnosis; heuristic UI cause wording corrected | Native arithmetic helper completes; matched causal study and independent residency evidence unperformed |
| 7E: reduction | Greedy, ddmin, ProbDD-style, no-reduction, tiny exhaustive and phase-aware; bytes/duration/overlap/deletion; budgets, corrected looks, signature checks and fresh validation | Fixtures and mechanism-switch regression pass; no GPU reduction-benefit evidence without failing witness |
| 7F: remedy | Fresh original gate; target-preserving pressure-off, partial allocation and actual serialized background work; delay/cost/completion records | Contract tests pass; live benefit/smallest remedy unestablished; persistent model unload/arbitrary application coordination unsupported |
| 9 / RQ1 | Signal instrumentation and historical detector comparison | No direct residency truth, matched external comparator or ordinary-session false-alarm/hour estimate |
| 9 / RQ2 | Reducer algorithms and declared local-minimality checks | Fixture demonstration only; empirical search/revalidation/ablations blocked |
| 9 / RQ3 | Guarded remedy comparison and disruption accounting | Not evaluable without fresh original failure |
| 9 / RQ4 | Paired overhead and self CPU/RSS/collection lag | Three randomized CUDA pairs: ratios 0.99556, 1.00000, 1.00446. Preliminary sample; no universal bound |
| 9: matrix/statistics | Immutable plan, matching calibration gate, seeded order, checkpoints, invalid/missing denominators, separated purpose/origin, exact conditional intervals | [72 cells / 432 planned blocks](../bench/plans/20261016/campaign.json); provisional levels; false gate; zero final cells executed. Independent session/thermal procedure still required |
| 10 weeks 1–2 | Scope and instrumentation | Software delivered; repeated severe slowdown/reset milestone unmet |
| 10 weeks 3–4 | Schedules/preparation/reset checks/controls | Implemented; full empirical coverage incomplete |
| 10 weeks 5–6 | Reducer comparators and signature-aware search | Delivered/tested; measured benefit unestablished |
| 10 weeks 7–8 | Fresh validation, uncertainty and remedies | Delivered/tested; independent physical validation/benefit pending |
| 10 weeks 9–10 | Plan, analysis, replay comparison, preliminary overhead | Delivered; final matrix/ablations gated |
| 10 weeks 11–12 | Local source/results package, [paper draft](research/2026-10-16-spillguard-opportunity/implementation-paper-draft.md), [claim map](research/2026-10-16-spillguard-opportunity/claim-evidence.md) | Local integrity/validation checked; independent maintainer replication/faculty review unperformed |
| 11: paper/IP | Feasibility draft; prior-art record and institutional handoff | No submission, novelty conclusion, patentability finding or clearance |
| 12: product validation | Interview protocol, header-only response CSV, independent trial task sheet | Zero interviews/trials; NO DATA FOUND for willingness to pay/customer demand |
| AetherOS interface | Local raw/old/new report import, analysis, JSONL replay, incomplete/origin/proxy labels; memory-only persistence/clear | Browser report/analysis/reducer rendering and restore/maximize checked; no errors/warnings in inspected flow |

## Delivered entry points and evidence

- [Research guide](SPILLGUARD_RESEARCH_GUIDE.md): commands, meanings, scope and replication.
- [Repro CLI](../bench/repro.py), [research CLI](../bench/research.py), [pilot](../bench/pilot_repro.py), [plan builder](../bench/prepare_research_release.py), [historical comparison](../bench/compare_detectors.py), [cleanup audit](../bench/audit_repro_release.py).
- [Measured evidence index](../bench/results/research_engineering_validation_20261016.json), [historical replay comparison](../bench/results/historical_detector_comparison_20261016.json), native overhead and raw bundles under `traces/repro/`.
- Local review artifacts under `artifacts/spillguard-repro/`; raw evidence can contain sensitive identity/path data. Export review is separate from publication.
- Automated release check: 148 Python tests, 44 frontend tests and a passing TypeScript/Vite production build. Tests establish software contracts, not RQ1–RQ3 outcomes.
- [Final verification record](../bench/results/release_verification_20261017.json): six bundles verified, 82 exact owned identities confirmed exited, export CLI validation and browser proof. Sanitized replay is explicitly labeled relative time.

## Requirements still needed for the full research project

1. A supported resource configuration where fixed target work completes with repeatable severe slowdown/recovery before host-memory guards. Current attempts do not establish that condition.
2. Matching target/state/level calibration, a stable power/thermal and fresh-session procedure, matched resource controls and independent residency instrumentation.
3. The gated final campaign, empirical reducer/remedy comparisons, ablations, long realistic negatives, external comparator and independent replication, retaining all invalid outcomes and costs.
4. Closest-project abstracts, faculty requirements/decision, consenting developer interviews and institutional publication/IP decisions.

These are unmet requirements, not items marked complete because tooling exists. No external message, submission, upload, driver change, guard relaxation or non-owned termination was performed to bypass them.
