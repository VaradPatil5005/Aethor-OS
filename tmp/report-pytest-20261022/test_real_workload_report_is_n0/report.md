# SpillGuard Repro: ollama-test

Data origin: **HTTP fixture; not a measurement**.

Outcome: **FAIL**. 1/1 concordant matched trials.

Trials: 1 reproduced, 0 non-reproductions, 0 inconclusive; planned 1.

This is a frozen local Ollama generation workload. The primary metric is server-reported decode milliseconds per token. Client time to first output is observed at the stream boundary; exact load/prefill boundaries are unavailable. A slowdown with observed memory pressure does not prove a residency mechanism or an application-wide speedup. DXGI budgets describe the observer. PDH dedication/shared observations are not direct resource-residency measurements. Temperature, clock and compute/bandwidth confounders remain uncontrolled.

Stage-order policy: fixed; preparation: warm. time/order effects remain a limitation. No confidence interval or tail-latency claim is made.

Rerun from the repository root (new output directory required):

```powershell
agent/.venv/Scripts/python.exe bench/repro.py run --recipe <this-bundle>/recipe.json --out <new-bundle>
```

Raw files and the local machine metadata are included. Review them before sharing. manifest.json contains SHA-256 integrity hashes, not an authenticity signature.
