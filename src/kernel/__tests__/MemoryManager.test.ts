import { describe, it, expect } from 'vitest';
import { MemoryManager } from '../MemoryManager';
import { Process } from '../../types/kernel';

function makeProcess(pid: number, memoryKB: number): Process {
  return {
    pid,
    name: `p${pid}`,
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
    memorySizeKB: memoryKB,
    allocatedFrames: [],
    locksHeld: [],
    waitingFor: null,
    color: '#000'
  };
}

describe('MemoryManager eviction policies', () => {
  it('FIFO evicts the frame loaded longest ago, even if it was accessed recently', () => {
    const mem = new MemoryManager(2, 'FIFO');
    const pA = makeProcess(1, 4); // 1 page, loaded at tick 0
    mem.allocateProcessSpace(pA, 0);
    const pB = makeProcess(2, 4); // 1 page, loaded at tick 5 -> fills remaining frame
    mem.allocateProcessSpace(pB, 5);

    // Access (touch) pA's frame recently so LRU would prefer to keep it,
    // but FIFO should still evict it since it was loaded first.
    mem.touchFrame(pA.allocatedFrames[0], 20);

    const pC = makeProcess(3, 4); // needs 1 more page than is free -> forces eviction
    mem.allocateProcessSpace(pC, 21);

    const evictedPA = mem.frames.find(f => f.frameId === pA.allocatedFrames[0]);
    expect(evictedPA?.pid).toBe(3); // pA's old frame was reassigned to pC
  });

  it('LRU evicts the frame accessed longest ago, not the one loaded first', () => {
    const mem = new MemoryManager(2, 'LRU');
    const pA = makeProcess(1, 4);
    mem.allocateProcessSpace(pA, 0);
    const pB = makeProcess(2, 4);
    mem.allocateProcessSpace(pB, 5);

    // Touch pA after pB was loaded, so pB is now the least-recently-used.
    mem.touchFrame(pA.allocatedFrames[0], 20);

    const pC = makeProcess(3, 4);
    mem.allocateProcessSpace(pC, 21);

    const pAFrame = mem.frames.find(f => f.frameId === pA.allocatedFrames[0]);
    const pBFrame = mem.frames.find(f => f.frameId === pB.allocatedFrames[0]);
    expect(pAFrame?.pid).toBe(1); // pA survives, was touched recently
    expect(pBFrame?.pid).toBe(3); // pB gets evicted
  });
});

describe('MemoryManager CLOCK (second chance)', () => {
  // Same reference string under both policies; CLOCK and LRU must pick different victims.
  function run(policy: 'CLOCK' | 'LRU') {
    const mem = new MemoryManager(3, policy);
    for (const [pid, tick] of [[1, 0], [2, 1], [3, 2]]) mem.allocateProcessSpace(makeProcess(pid, 4), tick);
    mem.allocateProcessSpace(makeProcess(4, 4), 3); // fault: evicts frame 0 under both policies
    mem.touchFrame(1, 10);
    mem.touchFrame(2, 11);
    mem.allocateProcessSpace(makeProcess(5, 4), 12); // second fault
    return mem.frames.map((f) => f.pid);
  }

  it('first fault: every bit was set on load, so one sweep clears them and frame 0 goes', () => {
    const mem = new MemoryManager(3, 'CLOCK');
    for (const [pid, tick] of [[1, 0], [2, 1], [3, 2]]) mem.allocateProcessSpace(makeProcess(pid, 4), tick);
    mem.allocateProcessSpace(makeProcess(4, 4), 3);
    expect(mem.frames.map((f) => f.pid)).toEqual([4, 2, 3]);
    expect(mem.clockHand).toBe(1);
  });

  it('gives referenced frames a second chance where LRU evicts the oldest access', () => {
    // CLOCK: hand at frame 1 clears b, c, d, then evicts b (frame 1).
    expect(run('CLOCK')).toEqual([4, 5, 3]);
    // LRU: d (frame 0, last access tick 3) is the least recently used.
    expect(run('LRU')).toEqual([5, 2, 3]);
  });
});
