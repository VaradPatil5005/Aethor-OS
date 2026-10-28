import { describe, it, expect } from 'vitest';
import { Kernel } from '../Kernel';
import { TestHarness } from '../TestHarness';
import type { SchedulingAlgorithm } from '../../types/kernel';

/** A kernel with no bootstrap processes, using the given policy. */
function emptyKernel(algorithm: SchedulingAlgorithm, quantum = 2): Kernel {
  const k = new Kernel();
  k.processes = [];
  k.scheduler.algorithm = algorithm;
  k.scheduler.timeQuantum = quantum;
  k.scheduler.sync(k.processes);
  return k;
}

const core0 = (k: Kernel, n: number) => k.ganttHistoryCore0.slice(-n).map((g) => g.name).join(' ');

describe('Kernel dispatcher (Kernel.step)', () => {
  it('Round Robin: each process keeps the CPU for its full quantum, then rotates', () => {
    const k = emptyKernel('ROUND_ROBIN', 2);
    k.spawnProcess('A', 2, 6, 4, undefined, 0);
    k.spawnProcess('B', 2, 6, 4, undefined, 0);
    k.spawnProcess('C', 2, 6, 4, undefined, 0);
    for (let i = 0; i < 8; i++) k.step();
    expect(core0(k, 8)).toBe('A A B B C C A A');
  });

  it('a lone process runs every tick until it finishes (the core never idles while work is ready)', () => {
    const k = emptyKernel('ROUND_ROBIN', 2);
    const p = k.spawnProcess('solo', 2, 5, 4, undefined, 0);
    for (let i = 0; i < 5; i++) k.step();
    expect(core0(k, 5)).toBe('solo solo solo solo solo');
    expect(p.state).toBe('TERMINATED');
    expect(p.remainingBurstTicks).toBe(0);
  });

  it('MLFQ keeps a process on the CPU for its level-0 quantum before rotating', () => {
    const k = emptyKernel('MLFQ');
    const q0 = k.scheduler.mlfqQuanta[0];
    k.spawnProcess('A', 2, 30, 4, undefined, 0);
    k.spawnProcess('B', 2, 30, 4, undefined, 0);
    for (let i = 0; i < q0 + 1; i++) k.step();
    expect(core0(k, q0 + 1)).toBe([...Array(q0).fill('A'), 'B'].join(' '));
  });

  it('in-browser Test Runner harness reports every case passing', () => {
    const failing = TestHarness.runAllTests().filter((t) => !t.passed).map((t) => `${t.name}: ${t.message}`);
    expect(failing).toEqual([]);
  });
});
