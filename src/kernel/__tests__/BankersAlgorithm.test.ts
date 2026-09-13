import { describe, it, expect } from 'vitest';
import { runBankersSafetyCheck, computeNeedMatrix } from '../BankersAlgorithm';
import { BankerScenario } from '../../types/kernel';

// Classic Silberschatz/Galvin/Gagne textbook example.
// Known correct answer: safe, with a safe sequence such as <P1, P3, P4, P0, P2>.
const TEXTBOOK_SAFE_SCENARIO: BankerScenario = {
  processNames: ['P0', 'P1', 'P2', 'P3', 'P4'],
  resourceNames: ['A', 'B', 'C'],
  available: [3, 3, 2],
  maximum: [
    [7, 5, 3],
    [3, 2, 2],
    [9, 0, 2],
    [2, 2, 2],
    [4, 3, 3]
  ],
  allocation: [
    [0, 1, 0],
    [2, 0, 0],
    [3, 0, 2],
    [2, 1, 1],
    [0, 0, 2]
  ]
};

describe("Banker's Algorithm", () => {
  it('computes Need = Maximum - Allocation', () => {
    const need = computeNeedMatrix(TEXTBOOK_SAFE_SCENARIO);
    expect(need[0]).toEqual([7, 4, 3]); // P0: [7,5,3] - [0,1,0]
    expect(need[1]).toEqual([1, 2, 2]); // P1: [3,2,2] - [2,0,0]
  });

  it('finds the known-safe sequence for the textbook example', () => {
    const result = runBankersSafetyCheck(TEXTBOOK_SAFE_SCENARIO);
    expect(result.isSafe).toBe(true);
    expect(result.safeSequence.length).toBe(5);
    // First process able to finish with Available=[3,3,2] must be P1 (need [1,2,2]).
    const firstPid = TEXTBOOK_SAFE_SCENARIO.processNames[result.safeSequence[0]];
    expect(firstPid).toBe('P1');
  });

  it('detects an unsafe state when available resources are insufficient', () => {
    const unsafe: BankerScenario = {
      ...TEXTBOOK_SAFE_SCENARIO,
      available: [0, 0, 0]
    };
    const result = runBankersSafetyCheck(unsafe);
    expect(result.isSafe).toBe(false);
    expect(result.safeSequence).toEqual([]);
  });

  it('throws on mismatched matrix dimensions', () => {
    const bad: BankerScenario = {
      ...TEXTBOOK_SAFE_SCENARIO,
      available: [3, 3] // wrong length
    };
    expect(() => runBankersSafetyCheck(bad)).toThrow();
  });
});
