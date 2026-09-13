import { describe, it, expect } from 'vitest';
import { Scheduler } from '../Scheduler';
import { Process } from '../../types/kernel';

function makeProcess(overrides: Partial<Process>): Process {
  return {
    pid: 1,
    name: 'p',
    state: 'READY',
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

describe('Round Robin', () => {
  it('rotates to the next process only after the quantum is exhausted, not every tick', () => {
    const scheduler = new Scheduler('ROUND_ROBIN', 3);
    const p1 = makeProcess({ pid: 1, name: 'A' });
    const p2 = makeProcess({ pid: 2, name: 'B' });
    const processes = [p1, p2];
    scheduler.sync(processes);

    // First 3 ticks: p1 should be selected every time (quantum = 3).
    for (let i = 0; i < 3; i++) {
      const next = scheduler.selectNext(processes);
      expect(next?.pid).toBe(1);
      scheduler.onProcessRan(next!, false);
    }

    // Quantum now exhausted -> p1 should have rotated to the back.
    const afterQuantum = scheduler.selectNext(processes);
    expect(afterQuantum?.pid).toBe(2);
  });

  it('does not rotate a process that just finished', () => {
    const scheduler = new Scheduler('ROUND_ROBIN', 3);
    const p1 = makeProcess({ pid: 1, name: 'A' });
    const p2 = makeProcess({ pid: 2, name: 'B' });
    scheduler.sync([p1, p2]);
    scheduler.onProcessRan(p1, true); // finished before quantum ran out
    expect(scheduler.rrQueue).not.toContain(1);
    expect(scheduler.rrQueue[0]).toBe(2);
  });
});

describe('MLFQ', () => {
  it('demotes a process that uses its full level-0 quantum without finishing', () => {
    const scheduler = new Scheduler('MLFQ');
    const cpuBound = makeProcess({ pid: 1, name: 'cpu_bound', totalBurstTicks: 100, remainingBurstTicks: 100 });
    scheduler.sync([cpuBound]);

    expect(cpuBound.queueLevel).toBe(0);
    const levelZeroQuantum = scheduler.mlfqQuanta[0];
    for (let i = 0; i < levelZeroQuantum; i++) {
      scheduler.onProcessRan(cpuBound, false);
    }

    expect(cpuBound.queueLevel).toBe(1);
    expect(scheduler.mlfqQueues.q1).toContain(1);
    expect(scheduler.mlfqQueues.q0).not.toContain(1);
  });

  it('prefers a higher-queue process over a lower one', () => {
    const scheduler = new Scheduler('MLFQ');
    const high = makeProcess({ pid: 1, name: 'high', queueLevel: 0 });
    const low = makeProcess({ pid: 2, name: 'low', queueLevel: 2 });
    scheduler.sync([high, low]);
    const next = scheduler.selectNext([high, low]);
    expect(next?.pid).toBe(1);
  });

  it('applyAging resets starved low-queue processes back to queue 0', () => {
    const scheduler = new Scheduler('MLFQ');
    const starved = makeProcess({ pid: 3, name: 'starved', queueLevel: 2, quantumUsed: 5 });
    scheduler.sync([starved]);
    scheduler.applyAging([starved]);
    expect(starved.queueLevel).toBe(0);
    expect(starved.quantumUsed).toBe(0);
    expect(scheduler.mlfqQueues.q0).toContain(3);
  });
});
