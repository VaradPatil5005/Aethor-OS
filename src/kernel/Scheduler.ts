import { Process, SchedulingAlgorithm } from '../types/kernel';

export class Scheduler {
  public algorithm: SchedulingAlgorithm = 'MLFQ';
  public timeQuantum: number = 4;
  public mlfqQuanta: number[] = [4, 8, 16];
  public agingIntervalTicks: number = 40;

  // Single-core legacy compatibility queues
  public rrQueue: number[] = [];
  public mlfqQueues: { q0: number[]; q1: number[]; q2: number[] } = { q0: [], q1: [], q2: [] };

  // SMP Multi-Core Runqueues: Core 0 and Core 1
  public coreQueues: { 0: number[]; 1: number[] } = { 0: [], 1: [] };
  public totalStealEvents: number = 0;

  constructor(algo: SchedulingAlgorithm = 'MLFQ', quantum: number = 4) {
    this.algorithm = algo;
    this.timeQuantum = quantum;
  }

  /** Keep coreQueues, rrQueue and mlfqQueues in sync with ready processes. */
  public sync(processes: Process[]) {
    const readyProcs = processes.filter(p => p.state === 'READY' || p.state === 'RUNNING');
    const readyPids = new Set(readyProcs.map(p => p.pid));

    // 1. Sync legacy single-core queues
    this.rrQueue = this.rrQueue.filter(pid => readyPids.has(pid));
    for (const p of processes) {
      if (readyPids.has(p.pid) && !this.rrQueue.includes(p.pid)) {
        this.rrQueue.push(p.pid);
      }
    }

    const allMlfqQueued = new Set([...this.mlfqQueues.q0, ...this.mlfqQueues.q1, ...this.mlfqQueues.q2]);
    for (const p of processes) {
      if (readyPids.has(p.pid) && !allMlfqQueued.has(p.pid)) {
        if (p.queueLevel <= 0) this.mlfqQueues.q0.push(p.pid);
        else if (p.queueLevel === 1) this.mlfqQueues.q1.push(p.pid);
        else this.mlfqQueues.q2.push(p.pid);
      }
    }
    this.mlfqQueues.q0 = this.mlfqQueues.q0.filter(pid => readyPids.has(pid));
    this.mlfqQueues.q1 = this.mlfqQueues.q1.filter(pid => readyPids.has(pid));
    this.mlfqQueues.q2 = this.mlfqQueues.q2.filter(pid => readyPids.has(pid));

    // 2. Sync SMP Core Queues
    this.coreQueues[0] = this.coreQueues[0].filter(pid => readyPids.has(pid));
    this.coreQueues[1] = this.coreQueues[1].filter(pid => readyPids.has(pid));

    const queuedInCores = new Set([...this.coreQueues[0], ...this.coreQueues[1]]);

    for (const p of readyProcs) {
      if (!queuedInCores.has(p.pid)) {
        if (p.coreAffinity === 0) {
          this.coreQueues[0].push(p.pid);
        } else if (p.coreAffinity === 1) {
          this.coreQueues[1].push(p.pid);
        } else {
          // Load balancing: assign to core with fewer tasks
          if (this.coreQueues[0].length <= this.coreQueues[1].length) {
            this.coreQueues[0].push(p.pid);
          } else {
            this.coreQueues[1].push(p.pid);
          }
        }
      }
    }
  }

  /**
   * SMP Work-Stealing:
   * If thiefCore has an empty runqueue, while victimCore has N > 1 tasks,
   * thief steals floor(N / 2) tasks from the tail of victim's queue.
   */
  public stealWork(thiefCore: 0 | 1, victimCore: 0 | 1, processes: Process[]): number {
    if (this.coreQueues[thiefCore].length > 0) return 0;
    const victimQueue = this.coreQueues[victimCore];
    if (victimQueue.length <= 1) return 0;

    const byPid = new Map(processes.map(p => [p.pid, p]));
    const maxSteal = Math.floor(victimQueue.length / 2);
    let stolen = 0;

    // Scan backwards from tail of victim queue to steal tasks eligible for thiefCore
    for (let i = victimQueue.length - 1; i >= 0 && stolen < maxSteal; i--) {
      const pid = victimQueue[i];
      const proc = byPid.get(pid);
      if (proc && (proc.coreAffinity === 'ANY' || proc.coreAffinity === thiefCore)) {
        victimQueue.splice(i, 1);
        this.coreQueues[thiefCore].push(pid);
        stolen++;
      }
    }

    if (stolen > 0) {
      this.totalStealEvents += stolen;
    }

    return stolen;
  }

  /** Select next process specifically for a given SMP core. */
  public selectNextForCore(coreId: 0 | 1, readyQueue: Process[]): Process | null {
    if (readyQueue.length === 0) return null;
    const byPid = new Map(readyQueue.map(p => [p.pid, p]));
    const queue = this.coreQueues[coreId];

    if (queue.length === 0) return null;

    // Filter available processes in this core's runqueue
    const candidates: Process[] = [];
    for (const pid of queue) {
      const p = byPid.get(pid);
      if (p && p.state !== 'RUNNING' && (p.coreAffinity === 'ANY' || p.coreAffinity === coreId)) {
        candidates.push(p);
      }
    }

    if (candidates.length === 0) return null;

    switch (this.algorithm) {
      case 'FCFS':
        return [...candidates].sort((a, b) => a.arrivalTick - b.arrivalTick)[0];
      case 'SJF':
        return [...candidates].sort((a, b) => a.totalBurstTicks - b.totalBurstTicks)[0];
      case 'SRTF':
        return [...candidates].sort((a, b) => a.remainingBurstTicks - b.remainingBurstTicks)[0];
      case 'PRIORITY':
        return [...candidates].sort((a, b) => a.priority - b.priority || a.arrivalTick - b.arrivalTick)[0];
      case 'ROUND_ROBIN':
      case 'MLFQ':
      default:
        return candidates[0];
    }
  }

  /** Legacy / Single-core selectNext */
  public selectNext(readyQueue: Process[]): Process | null {
    if (readyQueue.length === 0) return null;
    const byPid = new Map(readyQueue.map(p => [p.pid, p]));

    switch (this.algorithm) {
      case 'FCFS':
        return [...readyQueue].sort((a, b) => a.arrivalTick - b.arrivalTick)[0];
      case 'SJF':
        return [...readyQueue].sort((a, b) => a.totalBurstTicks - b.totalBurstTicks)[0];
      case 'SRTF':
        return [...readyQueue].sort((a, b) => a.remainingBurstTicks - b.remainingBurstTicks)[0];
      case 'PRIORITY':
        return [...readyQueue].sort((a, b) => a.priority - b.priority || a.arrivalTick - b.arrivalTick)[0];
      case 'ROUND_ROBIN': {
        for (const pid of this.rrQueue) {
          const p = byPid.get(pid);
          if (p) return p;
        }
        return readyQueue[0];
      }
      case 'MLFQ':
      default: {
        for (const pid of this.mlfqQueues.q0) { const p = byPid.get(pid); if (p) return p; }
        for (const pid of this.mlfqQueues.q1) { const p = byPid.get(pid); if (p) return p; }
        for (const pid of this.mlfqQueues.q2) { const p = byPid.get(pid); if (p) return p; }
        return readyQueue[0];
      }
    }
  }

  public onProcessRan(proc: Process, finished: boolean, coreId: 0 | 1 = 0) {
    proc.quantumUsed++;
    proc.lastExecutedCore = coreId;

    if (finished) {
      this.coreQueues[0] = this.coreQueues[0].filter(pid => pid !== proc.pid);
      this.coreQueues[1] = this.coreQueues[1].filter(pid => pid !== proc.pid);
      this.rrQueue = this.rrQueue.filter(pid => pid !== proc.pid);
      this.mlfqQueues.q0 = this.mlfqQueues.q0.filter(pid => pid !== proc.pid);
      this.mlfqQueues.q1 = this.mlfqQueues.q1.filter(pid => pid !== proc.pid);
      this.mlfqQueues.q2 = this.mlfqQueues.q2.filter(pid => pid !== proc.pid);
      return;
    }

    if (this.algorithm === 'ROUND_ROBIN') {
      if (proc.quantumUsed >= this.timeQuantum) {
        proc.quantumUsed = 0;
        // Rotate in core queue
        const q = this.coreQueues[coreId];
        const idx = q.indexOf(proc.pid);
        if (idx !== -1) {
          q.splice(idx, 1);
          q.push(proc.pid);
        }
        // Rotate in legacy queue
        const rIdx = this.rrQueue.indexOf(proc.pid);
        if (rIdx !== -1) {
          this.rrQueue.splice(rIdx, 1);
          this.rrQueue.push(proc.pid);
        }
      }
      return;
    }

    if (this.algorithm === 'MLFQ') {
      const levelQuantum = this.mlfqQuanta[Math.min(proc.queueLevel, this.mlfqQuanta.length - 1)];
      if (proc.quantumUsed >= levelQuantum) {
        const fromQueue = proc.queueLevel === 0 ? this.mlfqQueues.q0 : proc.queueLevel === 1 ? this.mlfqQueues.q1 : this.mlfqQueues.q2;
        const idx = fromQueue.indexOf(proc.pid);
        if (idx !== -1) fromQueue.splice(idx, 1);

        proc.queueLevel = Math.min(proc.queueLevel + 1, this.mlfqQuanta.length - 1);
        proc.quantumUsed = 0;

        const toQueue = proc.queueLevel === 0 ? this.mlfqQueues.q0 : proc.queueLevel === 1 ? this.mlfqQueues.q1 : this.mlfqQueues.q2;
        toQueue.push(proc.pid);

        // Also rotate to tail of core queue
        const cq = this.coreQueues[coreId];
        const cIdx = cq.indexOf(proc.pid);
        if (cIdx !== -1) {
          cq.splice(cIdx, 1);
          cq.push(proc.pid);
        }
      }
    }
  }

  public applyAging(processes: Process[]) {
    if (this.algorithm !== 'MLFQ') return;
    const readyPids = new Set(processes.filter(p => p.state === 'READY' || p.state === 'RUNNING').map(p => p.pid));
    for (const p of processes) {
      if (readyPids.has(p.pid) && p.queueLevel > 0) {
        p.queueLevel = 0;
        p.quantumUsed = 0;
      }
    }
    this.mlfqQueues.q0 = processes
      .filter(p => readyPids.has(p.pid))
      .sort((a, b) => a.arrivalTick - b.arrivalTick)
      .map(p => p.pid);
    this.mlfqQueues.q1 = [];
    this.mlfqQueues.q2 = [];
  }
}
