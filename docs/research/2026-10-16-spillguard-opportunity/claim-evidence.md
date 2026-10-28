# Claim and evidence map — 16 October 2026

Evidence types: LIVE = native experiment; REPLAY = historical recordings re-evaluated now; FIXTURE = deterministic software contract; IMPLEMENTED = code path, not an empirical benefit; EXTERNAL = evidence not supplied.

| Proposed claim | Evidence and scope | Decision |
|---|---|---|
| Existing architecture retained | Collector, analyzer, Runtime/TraceWriter, CUDA helper and AetherOS replay reused | IMPLEMENTED |
| Fixed local generation can be measured | `traces/repro/20261016-ollama-smoke-1536mib`: 128 tokens per stage; identical output hashes; 14 pressure-overlap samples | LIVE, one valid matched negative block |
| This Qwen target has a severe pressure-induced slowdown | Same smoke ratio 1.0180; longer pilot 128 MiB ratio 1.0190; declared threshold 2.0 | Not established |
| 1 GiB pilot is a positive result | `20261016-calibration-pilot/level-1024mib`: host commit guard, inconclusive | Rejected; higher levels not executed |
| Copied worker implementation can execute | `20261016-frozen-source-cuda`: 4,297/4,297/4,297 ms; fixed 8,192 work units; PASS; source hashes and bundle verified | LIVE negative control, no slowdown claim |
| Arithmetic helper runs | `20261016-arithmetic-control-r3/background.json`: completed bounded native helper | LIVE helper check; no matched application causal result |
| Monitoring has low universal overhead | `20261016-overhead`: observed/control ratios 0.99556, 1.00000, 1.00446; observed parent CPU about 13.76–19.06% of one core including setup | Preliminary three-pair local sample only; universal claim rejected |
| Existing heuristic beats a simple threshold | `bench/results/historical_detector_comparison_20261016.json`: both detect 3 old positives and avoid alerts on 2 old negatives; threshold is earlier under bandwidth proxy labels | No superiority claim; no holdout or ordinary-session rate |
| Phase-aware reduction preserves a real residency mechanism | `signature.py` preserves phase/counter proxies; mechanism-switch regression rejects a different proxy class | FIXTURE/IMPLEMENTED; direct residency contribution unverified |
| Phase-aware reduction outperforms ordinary methods | Six-method software fixture reduces 4 actions to 2 except no-reduction; tests cover mechanism switching | No empirical advantage claim; NO DATA FOUND for GPU benefit |
| Reducer returns a global minimum | Only declared local transforms and bounded oracle calls are searched | Rejected |
| Remedy improves target execution without losing work | Guarded fresh-validation workflow exists; no original live failing witness yet | Not evaluable; NO DATA FOUND for benefit |
| The full study is complete | Saved 72-cell/432-block plan; execution gate false | Rejected; zero final cells executed |
| Two pure text model architectures tested | Qwen2.5 generation measured; Qwen3-VL text smoke attempted but all timed stages invalidated by host commit guards | Rejected; second model fit/completion not validated |
| Independent GPU-residency ground truth exists | PDH/DXGI/NVML and bandwidth proxies only; WPR presence is not a validated ETW interpretation | NO DATA FOUND |
| Model unload, D3D12 or all-vendor prevention works | No corresponding validated integrations | Outside current executable scope |
| Class project uniqueness is certified | Original title screen exists; closest abstracts unavailable | EXTERNAL, pending |
| Customers want or will pay for this | No authorized interviews or trials supplied | NO DATA FOUND |
| Paper novelty or patentability established | Prior-art matrices retained; no empirical reducer benefit or institutional IP review | Unconfirmed |

Raw evidence is intentionally ignored under `traces/repro/`; it can contain local identity/path information. The compact checked-in-style index `bench/results/research_engineering_validation_20261016.json` records local report hashes and stage summaries. A local replication directory contains sanitized outputs, not a claim of public release or third-party reproduction.

Engineering tests, browser evidence and actual hardware evidence have different meanings. Unit success does not satisfy RQ1–RQ3 or faculty approval. Do not use any of these rows as a substitute for the full report and its limitations.
