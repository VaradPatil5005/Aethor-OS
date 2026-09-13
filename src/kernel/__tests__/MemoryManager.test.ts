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
