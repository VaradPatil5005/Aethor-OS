import { BankerScenario, BankerResult } from '../types/kernel';

/**
 * Classic Banker's Algorithm safety check for multi-instance resources.
 * This is intentionally independent from DeadlockEngine's single-instance
 * mutex Wait-For-Graph model: real Banker's requires declared maximum
 * claims per process per resource type, which mutex acquire/release does
 * not model. Given a scenario (available / maximum / allocation), this
 * computes Need = Maximum - Allocation and searches for a safe sequence.
 */
export function computeNeedMatrix(scenario: BankerScenario): number[][] {
  const { maximum, allocation } = scenario;
  return maximum.map((row, i) =>
    row.map((max, j) => max - allocation[i][j])
  );
}

export function runBankersSafetyCheck(scenario: BankerScenario): BankerResult {
  const { available, maximum, allocation, processNames, resourceNames } = scenario;
  const n = processNames.length;
  const m = resourceNames.length;

  if (
    maximum.length !== n ||
    allocation.length !== n ||
    available.length !== m ||
    maximum.some(row => row.length !== m) ||
    allocation.some(row => row.length !== m)
  ) {
    throw new Error('BankersAlgorithm: matrix dimensions do not match process/resource counts.');
  }

  const need = computeNeedMatrix(scenario);
  const work = [...available];
  const finished = new Array(n).fill(false);
  const safeSequence: number[] = [];
  const steps: BankerResult['steps'] = [];

  let progressed = true;
  while (progressed && safeSequence.length < n) {
    progressed = false;
    for (let i = 0; i < n; i++) {
      if (finished[i]) continue;
      const canRun = need[i].every((needed, j) => needed <= work[j]);
      if (canRun) {
        const workBefore = [...work];
        for (let j = 0; j < m; j++) work[j] += allocation[i][j];
        steps.push({ pid: i, workBefore, workAfter: [...work] });
        finished[i] = true;
        safeSequence.push(i);
        progressed = true;
      }
    }
  }

  const isSafe = safeSequence.length === n;

  return {
    need,
    isSafe,
    safeSequence: isSafe ? safeSequence : [],
    steps: isSafe ? steps : []
  };
}
