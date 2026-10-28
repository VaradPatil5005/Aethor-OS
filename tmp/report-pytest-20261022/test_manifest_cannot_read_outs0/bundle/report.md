# SpillGuard Repro: fixture-demo

Data origin: **SOFTWARE FIXTURE - NOT GPU MEASUREMENTS**.

Outcome: **FAIL**. 3/3 concordant matched trials.

Trials: 3 reproduced, 0 non-reproductions, 0 inconclusive; planned 3.

This is a synthetic CUDA write probe. A slowdown with observed memory pressure does not prove a residency mechanism or an application-wide speedup. DXGI budgets describe the observer. PDH dedication/shared observations are not direct resource-residency measurements. Temperature, clock and compute/bandwidth confounders remain uncontrolled.

Stage-order policy: fixed; preparation: warm. time/order effects remain a limitation. No confidence interval or tail-latency claim is made.

Rerun from the repository root (new output directory required):

```powershell
agent/.venv/Scripts/python.exe bench/repro.py run --recipe <this-bundle>/recipe.json --out <new-bundle>
```

Raw files and the local machine metadata are included. Review them before sharing. manifest.json contains SHA-256 integrity hashes, not an authenticity signature.
