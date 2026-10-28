# SpillGuard Repro: local AI workload adapter

This continuation adds a real workload path to the [first milestone](SPILLGUARD_REPRO.md):
fixed local Ollama generation, measured request/output markers, optional GPU sensors,
and temporary Windows-job-owned inference servers. The plain reducer and evidence
bundles accept the new recipe type. The proposed mechanism-aware reducer remains a
later research gate.

## Frozen workload and commands

The supplied [Qwen recipe](../bench/recipes/ollama-qwen25-smoke.json) pins the installed
`qwen2.5:3b-instruct` manifest and weights, prompt text/hash, 2048-token context,
128-token generation budget, seed 0, temperature 0 and GPU layer request 999.
Its pressure action requests 128 MiB after the first observed output. This is a small
integration recipe, not a calibration of the laptop's spill boundary.

```powershell
# Validate the supplied recipe without starting inference.
agent/.venv/Scripts/python.exe bench/repro.py validate bench/recipes/ollama-qwen25-smoke.json

# Check installed model layer hashes, PDH, RAM headroom and host commit.
agent/.venv/Scripts/python.exe bench/repro.py preflight --recipe bench/recipes/ollama-qwen25-smoke.json

# Run only when preflight reports telemetry_ready: true. Use a new output directory.
agent/.venv/Scripts/python.exe bench/repro.py run --recipe bench/recipes/ollama-qwen25-smoke.json --out traces/repro/my-qwen-run

# Pin another already-installed local library model and exact prompt; no downloads.
agent/.venv/Scripts/python.exe bench/repro.py freeze-ollama --model qwen2.5:3b-instruct --prompt-file bench/prompts/repro-counting.txt --out bench/recipes/my-qwen-recipe.json --num-ctx 2048 --num-predict 128 --repeats 3 --pressure-mib 128 --phase decode
```

Freezing verifies all local manifest layers, including template/config layers, and
stores the manifest and weights digests. Every stage checks installed bytes before
starting its server. The API's model digest is checked before and after measurement.
Recipes accept explicit local library `name:tag` identifiers; remote/cloud models and
arbitrary HTTP endpoints are unsupported. A model missing from disk produces an error,
never an automatic pull. Existing recipe files and evidence directories are never overwritten.

## Measurements and phase limits

The primary metric is **server-reported decode milliseconds per output token**:
`eval_duration / eval_count / 1e6`. Completion time and client time to first output
are also recorded separately. Load and prefill durations come from the final server
statistics. These fields follow the [official generate API](https://docs.ollama.com/api/generate).
Final token counts must match the frozen budget; early EOS is inconclusive rather
than silently reducing the requested task. Prompt token counts, output/thinking hashes,
model digest, realized context and runtime signature must match across stages.
The initial predicate also rejects API-reported partial CPU offload or missing model
allocation data. API allocation reports do not establish physical residency.

The client records request start, first nonempty streamed output and completion
using a monotonic clock. The first output may include a thinking chunk for models
that provide one. It is a **client-observed decode proxy**, not an exact engine
prefill/decode transition. Streaming chunks are not assumed to equal individual tokens.
Load/prefill/decode durations are aggregate server values; the code does not invent
exact phase start timestamps from them.

Actions can use `pressure` (holder startup), `request` (measured request start), or
`decode` (first observed output). The runner relays measured markers after target
READY; warmup output never triggers a pressure action. The holder records anchor
timestamps and dispatch lag. A late marker whose action window has already expired
is invalid. Pressure validity requires actual allocation events and multiple
dedicated-memory observations overlapping the measured decode window. The reducer
does not yet compare original/reduced phase or residency signatures.

The prompt uses a conservative UTF-8 byte bound plus a template margin against the
context limit. Observed prompt tokens plus output budget must also fit. This is an
input guard, not a general proof of tokenizer/template behavior for every model.
Generated text is not saved; its hashes and token/timing statistics are saved. The
recipe includes the supplied prompt, so bundles still need review before sharing.

## Owned server lifecycle and controls

Each stage starts a fresh private loopback Ollama server and generates a short warmup
before the measured request. The usual port 11434 is never contacted by the runner.
Port ownership is checked against the created process before any request; startup
waits for HTTP readiness after GPU discovery, not merely a listening socket.

A Windows job object contains the server and inference descendants. Closing that
job releases the entire owned process tree. Normal-session models are neither
unloaded nor terminated. The environment explicitly fixes parallelism to one, one
loaded model, the requested context, flash attention on, and f16 KV cache. Cloud
features and model pruning are disabled for this server. These are fixed experiment
settings, not quality-changing remedies. Relevant controls are documented in the
[official Ollama FAQ](https://docs.ollama.com/faq).

Baseline, pressure and recovery therefore compare **fresh, warmed instances**.
Recovery is a fresh pressure-off control; it does not demonstrate recovery of the
same persistent model process. Startup/load/warmup cost is outside the primary decode
metric and is retained in the logs. The ordered-block limitation from milestone 1
still applies. Runtime signature comparison includes the Ollama version, executable
hash and controlled environment. Model roots and ephemeral ports are excluded from
that signature while frozen model contents remain separately checked.

The existing 2 GiB available-host-memory floor and 90% commit ceiling remain active.
Host memory is sampled during warmup waits and measurement. The backend closes owned
clients/helpers and the private job on failures. It does not close unrelated apps,
change driver fallback settings or automatically lower resource guards.

## New observations

The inherited NVML collector now records GPU temperature (C), graphics/memory clocks
(MHz), power (mW), GPU utilization (%) and memory utilization (%) when supported.
AC-power state is also recorded when Windows exposes battery information. Unavailable
readings are `null`, including missing NVML. Sensor failures do not turn missing data
into zeros or disable unrelated memory readings. Collection duration now includes
all collector sources, including Ollama polling when enabled in the original agent.

These observations help inspect thermal/power/compute confounders. No causal thermal
or bandwidth isolation is claimed, and Windows power mode remains unmeasured.

## Validation on 16 October 2026

The pinned installed model's layer hashes and telemetry preflight passed. A native
server-only integration check confirmed Ollama 0.34.4 HTTP readiness, private port
ownership, zero loaded models, and exit of both job-owned processes after cleanup.
It performed no model inference.

The first experiment attempt failed before inference because the installed pywin32
job constructor required an empty string rather than `None` for the job name. The
second hit the initial short HTTP-readiness timeout during GPU discovery. Both were
preserved as inconclusive development attempts; those startup paths were corrected
and the server-only check then passed.

A subsequent full attempt stopped before model launch because available RAM was
below the 2 GiB floor (about 1.87 GiB in its recorded first sample). No remaining
Ollama processes were found by the native check. This is an enforced environmental
guard, not a demonstrated model slowdown, successful inference benchmark or failed
pressure manipulation. A later attempt completed real warmup in each of three stages
but again crossed the 2 GiB floor before measured requests. All 15 recorded owned
process identities were independently confirmed exited. The floor was crossed by
about 22 MiB in that later attempt.

To exercise the measured path, a **separate explicit profile** was frozen at
[1536 MiB host headroom](../bench/recipes/ollama-qwen25-smoke-1536mib.json). The original
2 GiB recipe and default were preserved. The model, prompt, context, seed, generation
budget, pressure allocation and 90% commit ceiling stayed fixed. `freeze-ollama`
records a custom floor through `--min-host-mib`; it never adjusts the floor at runtime.

That profile completed one valid baseline/pressure/recovery block with 128 generated
tokens in each stage and matching output hashes. Decode time per token was
**13.948 / 14.200 / 13.987 ms**, respectively. Pressure overlapped fourteen valid
samples; all eighteen recorded owned process identities were independently confirmed
exited, allocation releases were logged, hashes matched, and all three traces were
read by the existing replay reader. Minimum observed available RAM was about 1.82 GiB,
above this profile's declared 1.5 GiB floor.

Outcome: **valid non-reproduction**, at 1.018x pressure/baseline against the declared
2x threshold. This validates the real workload path. It does not establish a severe
slowdown, a residency cause, a reproduction rate, or a remedy benefit. The earlier
inconclusive development attempts remain saved separately, and are not pooled with
the successful integration profile as research repetitions. The compact
[validation record](../bench/results/repro_milestone2_validation.json) lists them all.

Automated coverage exercises real-workload parsing, layer/manifest integrity,
streamed API records, missing/error timings, phase relay, token/output matching,
context/offload changes, default/custom headroom, cancellation/cleanup, optional
sensor failures, collection lag and real-versus-synthetic report labels. **112 Python
tests pass**, including the original regression suites. HTTP fixtures do
not establish real inference or driver behavior. No model downloads were performed.

Next: characterize the valid fixed-work generation block's variance across fresh
sessions, then choose pressure levels from a bounded calibration pilot. Do not
escalate pressure merely to obtain a positive research result.
