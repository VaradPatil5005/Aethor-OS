import { Process, DeadlockReport } from '../types/kernel';

export class DeadlockEngine {
  public resources: Record<string, number> = {
    'MUTEX_GPU': 1,
    'MUTEX_DISK': 1,
    'MUTEX_NET': 1,
    'SEMAPHORE_IO': 2
  };

  public evaluateDeadlock(processes: Process[]): DeadlockReport {
    const allocationMatrix: Record<string, number[]> = {};
    const requestMatrix: Record<string, number[]> = {};

    for (const res of Object.keys(this.resources)) {
      allocationMatrix[res] = [];
      requestMatrix[res] = [];
    }

    for (const p of processes) {
      if (p.state === 'TERMINATED') continue;
      for (const lock of p.locksHeld) {
        if (!allocationMatrix[lock]) allocationMatrix[lock] = [];
        allocationMatrix[lock].push(p.pid);
      }
      if (p.waitingFor) {
        if (!requestMatrix[p.waitingFor]) requestMatrix[p.waitingFor] = [];
        requestMatrix[p.waitingFor].push(p.pid);
      }
    }

    // Graph cycle DFS for Wait-For-Graph
    const adj: Map<number, number[]> = new Map();
    for (const p of processes) adj.set(p.pid, []);

    for (const [res, waiters] of Object.entries(requestMatrix)) {
      const holders = allocationMatrix[res] || [];
      for (const waiter of waiters) {
        for (const holder of holders) {
          if (waiter !== holder) {
            const list = adj.get(waiter) || [];
            if (!list.includes(holder)) list.push(holder);
            adj.set(waiter, list);
          }
        }
      }
    }

    const visited = new Map<number, boolean>();
    const recStack = new Map<number, boolean>();
    const cyclePids: number[] = [];

    const dfs = (u: number, path: number[]): boolean => {
      visited.set(u, true);
      recStack.set(u, true);
      path.push(u);

      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        if (!visited.get(v)) {
          if (dfs(v, path)) return true;
        } else if (recStack.get(v)) {
          const idx = path.indexOf(v);
          for (let i = idx; i < path.length; i++) {
            if (!cyclePids.includes(path[i])) cyclePids.push(path[i]);
          }
          return true;
        }
      }

      recStack.set(u, false);
      path.pop();
      return false;
    };

    for (const p of processes) {
      if (!visited.get(p.pid)) {
        if (dfs(p.pid, [])) break;
      }
    }

    return {
      isDeadlocked: cyclePids.length > 0,
      cyclePids,
      allocationMatrix,
      requestMatrix,
      availableResources: { ...this.resources }
    };
  }
}
