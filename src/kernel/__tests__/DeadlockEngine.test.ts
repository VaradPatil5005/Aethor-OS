import { describe, it, expect } from 'vitest';
import { DeadlockEngine } from '../DeadlockEngine';
import { Process } from '../../types/kernel';

function makeProcess(overrides: Partial<Process>): Process {
  return {
    pid: 1,
    name: 'p',
    state: 'WAITING',
    priority: 2,
    queueLevel: 0,
    quantumUsed: 0,
    totalBurstTicks: 10,
    remainingBurstTicks: 10,
    arrivalTick: 0,
    firstRunTick: null,
    completionTick: null,
    waitingTicks: 0,
    turnaroundTicks: null,
    responseTicks: null,
    memorySizeKB: 16,
    allocatedFrames: [],
    locksHeld: [],
    waitingFor: null,
    color: '#000',
    ...overrides
  };
}

describe('DeadlockEngine', () => {
  it('detects a two-process circular wait', () => {
    const engine = new DeadlockEngine();
    const p1 = makeProcess({ pid: 1, locksHeld: ['MUTEX_GPU'], waitingFor: 'MUTEX_DISK' });
    const p2 = makeProcess({ pid: 2, locksHeld: ['MUTEX_DISK'], waitingFor: 'MUTEX_GPU' });

    const report = engine.evaluateDeadlock([p1, p2]);
    expect(report.isDeadlocked).toBe(true);
    expect(report.cyclePids.sort()).toEqual([1, 2]);
  });

  it('reports no deadlock when no cycle exists', () => {
    const engine = new DeadlockEngine();
    const p1 = makeProcess({ pid: 1, state: 'READY', locksHeld: ['MUTEX_GPU'], waitingFor: null });
    const p2 = makeProcess({ pid: 2, state: 'WAITING', locksHeld: [], waitingFor: 'MUTEX_GPU' });

    const report = engine.evaluateDeadlock([p1, p2]);
    expect(report.isDeadlocked).toBe(false);
    expect(report.cyclePids).toEqual([]);
  });

  it('ignores terminated processes when building the graph', () => {
    const engine = new DeadlockEngine();
    const p1 = makeProcess({ pid: 1, state: 'TERMINATED', locksHeld: ['MUTEX_GPU'], waitingFor: 'MUTEX_DISK' });
    const p2 = makeProcess({ pid: 2, state: 'TERMINATED', locksHeld: ['MUTEX_DISK'], waitingFor: 'MUTEX_GPU' });

    const report = engine.evaluateDeadlock([p1, p2]);
    expect(report.isDeadlocked).toBe(false);
  });
});
