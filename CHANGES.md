# Bug-fix pass over the original AetherOS source

This pass fixes the specific issues found in review, without a full rewrite.
Each fix has a corresponding automated test in `src/kernel/__tests__/`.

## 1. Round Robin was not rotating
**Before:** `Scheduler.selectNext` for `ROUND_ROBIN` always returned
`readyQueue[0]` — no quantum tracking, no rotation. Selecting "Round Robin"
in the UI behaved identically to FCFS.
**Fix:** Added a `rrQueue` (pid rotation order) and `quantumUsed` per
process. `onProcessRan` increments `quantumUsed` each tick and rotates the
process to the back of the queue once its quantum is exhausted.
**Test:** `Scheduler.test.ts` — "rotates to the next process only after the
quantum is exhausted, not every tick".

## 2. MLFQ never demoted or aged processes
**Before:** `queueLevel` was set once at spawn (`0`) and never changed —
MLFQ always drained queue 0 and behaved like FCFS.
**Fix:** `onProcessRan` demotes a process to the next queue level when it
exhausts that level's quantum (`mlfqQuanta = [4, 8, 16]`), and a periodic
`applyAging()` call (every `agingIntervalTicks`) boosts starved processes
back to queue 0.
**Test:** `Scheduler.test.ts` — demotion and aging cases.

## 3. "Banker's Algorithm" fields were fake
**Before:** `DeadlockReport.isSafe` / `.safeSequence` existed but were just
derived from the DFS cycle result (`isSafe: cyclePids.length === 0`,
`safeSequence: []` always empty) — not a real Banker's computation, and the
mutex model has no per-process maximum-claim data for Banker's to use.
**Fix:** Removed the misleading fields from `DeadlockReport`. Added a real,
independent `BankersAlgorithm.ts` implementing Need = Max − Allocation and
the standard safety-sequence search, wired into a "Run Safety Check" panel
in the Deadlock Lab using the textbook example (known-correct answer:
safe sequence starting with P1).
**Test:** `BankersAlgorithm.test.ts` — matches the textbook safe sequence,
correctly reports an unsafe state when resources are insufficient.

## 4. Page replacement policy was always LRU regardless of setting
**Before:** `MemoryManager` stored a `policy` field but every eviction used
`lastAccessTick` ordering — FIFO/CLOCK/OPTIMAL were unreachable.
**Fix:** Added `loadedAtTick` (separate from `lastAccessTick`) and a real
`FIFO` branch that evicts by load order. Added a policy selector to the
Memory Map app UI. `CLOCK`/`OPTIMAL` still fall back to LRU ordering — that
is stated explicitly in code comments rather than silently implied.
**Test:** `MemoryManager.test.ts` — FIFO and LRU evict different frames
under the same access pattern.

## Not fixed in this pass (flagged, not silently skipped)
- **No Web Worker.** The kernel still runs on the main thread via
  `setInterval`, not in a dedicated worker. This is a real architectural
  gap versus the original pitch, not a quick patch — it needs `worker.ts`,
  a `postMessage` command/event protocol, and moving `useKernelStore` to a
  client/bridge pattern. Worth doing as its own follow-up.
- **`globalKernel` auto-starts as a module-level side effect** on import,
  which can double-tick under React StrictMode/HMR. Deferred until the
  worker refactor, since that will change how the kernel is instantiated
  anyway.

## Verifying this yourself
```
npm install
npm test        # 14/14 passing
npx tsc --noEmit  # no type errors
npm run build    # production build succeeds
```
