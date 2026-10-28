import { Process, KernelStats, SchedulingAlgorithm, CoreAffinity, CPUCore, BPFProbe, BPFEvent, BPFHookType, GPFRegisterDump } from '../types/kernel';
import { Scheduler } from './Scheduler';
import { MemoryManager } from './MemoryManager';
import { DeadlockEngine } from './DeadlockEngine';
import { VFS } from './VFS';

export class Kernel {
  public scheduler: Scheduler;
  public memory: MemoryManager;
  public deadlock: DeadlockEngine;
  public vfs: VFS;

  public processes: Process[] = [];
  public currentRunningPid: number | null = null;
  public currentTick: number = 0;
  public isRunning: boolean = true;
  public tickRateMs: number = 800;
  private timerId: any = null;
  private nextPid: number = 100;
  public totalContextSwitches: number = 0;
  public busyTicks: number = 0;
  public idleTicks: number = 0;

  // Multi-Core SMP Structures (CPU_0 and CPU_1)
  public cpus: [CPUCore, CPUCore] = [
    { coreId: 0, currentPid: null, runqueue: [], loadPercentage: 0, busyTicks: 0, idleTicks: 0, stolenTasksCount: 0 },
    { coreId: 1, currentPid: null, runqueue: [], loadPercentage: 0, busyTicks: 0, idleTicks: 0, stolenTasksCount: 0 }
  ];

  // Parallel Execution Gantt Streams
  public ganttHistoryCore0: { tick: number; pid: number | null; name: string; color: string }[] = [];
  public ganttHistoryCore1: { tick: number; pid: number | null; name: string; color: string }[] = [];
  public ganttHistory: { tick: number; pid: number | null; name: string; color: string }[] = []; // Legacy compatibility

  // In-Kernel eBPF Probes & Telemetry
  public probes: BPFProbe[] = [
    {
      id: 'probe_sched_switch',
      name: 'sched_switch_counter',
      hook: 'SCHED_SWITCH',
      filterScript: 'count(pid)',
      enabled: true,
      mapOutput: {},
      eventCount: 0
    },
    {
      id: 'probe_page_fault',
      name: 'mm_page_fault_tracer',
      hook: 'PAGE_FAULT',
      filterScript: 'count(pid)',
      enabled: true,
      mapOutput: {},
      eventCount: 0
    },
    {
      id: 'probe_vfs_syscall',
      name: 'vfs_syscall_latency',
      hook: 'SYSCALL_ENTER',
      filterScript: 'count(syscall)',
      enabled: true,
      mapOutput: {},
      eventCount: 0
    }
  ];
  public bpfEvents: BPFEvent[] = [];

  // Dual-Mode Privilege & GPF Register Dump
  public lastGPF: GPFRegisterDump | null = null;

  public journal: { tick: number; type: string; message: string }[] = [];
  public onUpdate?: () => void;

  constructor() {
    this.scheduler = new Scheduler('MLFQ');
    this.memory = new MemoryManager(32, 'LRU');
    this.deadlock = new DeadlockEngine();
    this.vfs = new VFS();
    this.bootstrapProcesses();
  }

  private bootstrapProcesses() {
    this.spawnProcess('kernel_daemon', 1, 20, 12, '#3b82f6', 0);
    this.spawnProcess('window_manager', 2, 25, 16, '#8b5cf6', 'ANY');
    this.spawnProcess('audio_server', 3, 15, 8, '#10b981', 1);
    this.spawnProcess('network_sync', 4, 18, 12, '#f59e0b', 'ANY');
    this.logJournal('BOOT', 'AetherOS Dual-Core SMP Microkernel initialized.');
  }

  public logJournal(type: string, message: string) {
    this.journal.push({ tick: this.currentTick, type, message });
    if (this.journal.length > 50) this.journal.shift();
  }

  public emitBPFEvent(hook: BPFHookType, details: string, pid?: number, mapKey?: string) {
    const event: BPFEvent = {
      timestamp: this.currentTick,
      hook,
      details,
      pid
    };

    this.bpfEvents.push(event);
    if (this.bpfEvents.length > 40) this.bpfEvents.shift();

    // Dispatch to enabled probes matching this hook
    for (const probe of this.probes) {
      if (probe.enabled && probe.hook === hook) {
        probe.eventCount++;
        const key = mapKey || (pid ? `PID_${pid}` : 'SYSTEM');
        probe.mapOutput[key] = (probe.mapOutput[key] || 0) + 1;
      }
    }
  }

  public attachProbe(name: string, hook: BPFHookType, filterScript: string): BPFProbe {
    const newProbe: BPFProbe = {
      id: 'probe_' + Date.now(),
      name,
      hook,
      filterScript,
      enabled: true,
      mapOutput: {},
      eventCount: 0
    };
    this.probes.push(newProbe);
    this.logJournal('EBPF_ATTACH', `Attached probe '${name}' on hook [${hook}]`);
    if (this.onUpdate) this.onUpdate();
    return newProbe;
  }

  public toggleProbe(id: string) {
    const probe = this.probes.find(p => p.id === id);
    if (probe) {
      probe.enabled = !probe.enabled;
      if (this.onUpdate) this.onUpdate();
    }
  }

  public removeProbe(id: string) {
    this.probes = this.probes.filter(p => p.id !== id);
    if (this.onUpdate) this.onUpdate();
  }

  public spawnProcess(name: string, priority: number, burstTime: number, memoryKB: number, color?: string, affinity: CoreAffinity = 'ANY'): Process {
    const defaultColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const assignedColor = color || defaultColors[this.processes.length % defaultColors.length];

    const proc: Process = {
      pid: this.nextPid++,
      name,
      state: 'READY',
      priority: Math.min(Math.max(priority, 1), 5),
      queueLevel: 0,
      quantumUsed: 0,
      totalBurstTicks: burstTime,
      remainingBurstTicks: burstTime,
      arrivalTick: this.currentTick,
      firstRunTick: null,
      completionTick: null,
      waitingTicks: 0,
      turnaroundTicks: null,
      responseTicks: null,
      memorySizeKB: memoryKB,
      allocatedFrames: [],
      locksHeld: [],
      waitingFor: null,
      color: assignedColor,
      coreAffinity: affinity,
      lastExecutedCore: null
    };

    this.memory.allocateProcessSpace(proc, this.currentTick);
    this.processes.push(proc);
    this.scheduler.sync(this.processes);
    this.logJournal('PROCESS_CREATE', `Spawned PID #${proc.pid} (${name}) [Affinity: ${affinity}]`);
    this.emitBPFEvent('PAGE_FAULT', `Memory mapped ${memoryKB}KB for ${name}`, proc.pid, `PID_${proc.pid}`);
    if (this.onUpdate) this.onUpdate();
    return proc;
  }

  public setProcessAffinity(pid: number, affinity: CoreAffinity) {
    const proc = this.processes.find(p => p.pid === pid);
    if (proc) {
      proc.coreAffinity = affinity;
      this.scheduler.sync(this.processes);
      this.logJournal('SMP_AFFINITY', `PID #${pid} affinity set to: ${affinity}`);
      if (this.onUpdate) this.onUpdate();
    }
  }

  public killProcess(pid: number): boolean {
    const proc = this.processes.find(p => p.pid === pid);
    if (!proc) return false;

    proc.state = 'TERMINATED';
    proc.completionTick = this.currentTick;
    this.memory.deallocateProcess(pid);

    if (this.cpus[0].currentPid === pid) this.cpus[0].currentPid = null;
    if (this.cpus[1].currentPid === pid) this.cpus[1].currentPid = null;
    if (this.currentRunningPid === pid) this.currentRunningPid = null;

    this.scheduler.sync(this.processes);
    this.logJournal('PROCESS_KILL', `Terminated PID #${pid}`);
    if (this.onUpdate) this.onUpdate();
    return true;
  }

  /**
   * General Protection Fault (GPF) Simulator:
   * Simulates Ring 3 process attempting illegal access to Ring 0 Kernel Space (0x0020).
   * Traps fault, captures register dump, pauses process in WAITING state.
   */
  public triggerSimulatedGPF(pid?: number): GPFRegisterDump | null {
    const target = (pid ? this.processes.find(p => p.pid === pid) : null) || 
                   this.processes.find(p => p.state === 'RUNNING' || p.state === 'READY') ||
                   this.processes[0];

    if (!target) return null;

    const illegalAddr = 0x0020; // Inside Ring 0 Kernel Reserved Memory (0x0000 - 0x3FFF)
    const check = this.memory.verifyAddressAccess(target.pid, target.name, illegalAddr, 'RING_3');

    if (!check.valid && check.dump) {
      this.lastGPF = check.dump;
      target.state = 'WAITING';
      target.waitingFor = 'SIGSEGV_FAULT_HANDLER';
      this.logJournal('GPF_FAULT', `[#GP Trap] PID #${target.pid} (${target.name}) dereferenced Kernel Address 0x0020!`);
      this.emitBPFEvent('PAGE_FAULT', `GPF Trap on illegal access to ${check.dump.illegalAddress}`, target.pid, 'GPF_TRAP');
      if (this.onUpdate) this.onUpdate();
      return check.dump;
    }
    return null;
  }

  public injectDeadlock() {
    const p1 = this.spawnProcess('Worker_Thread_Alpha', 2, 25, 8, '#e11d48', 'ANY');
    const p2 = this.spawnProcess('Worker_Thread_Beta', 2, 25, 8, '#d97706', 'ANY');

    p1.locksHeld = ['MUTEX_GPU'];
    p1.waitingFor = 'MUTEX_DISK';
    p1.state = 'WAITING';

    p2.locksHeld = ['MUTEX_DISK'];
    p2.waitingFor = 'MUTEX_GPU';
    p2.state = 'WAITING';

    this.logJournal('DEADLOCK', 'Injected circular wait condition.');
    if (this.onUpdate) this.onUpdate();
  }

  /**
   * Dual-Core Step Engine:
   * Concurrently steps Core 0 and Core 1 with work-stealing and load balancing.
   */
  public step() {
    this.currentTick++;

    // Every tick is a dispatch decision: whatever ran last tick goes back to READY and competes
    // again. Without this a RUNNING process was skipped by selectNextForCore forever, so each
    // process ran a single tick and the cores then sat idle (the RR quantum never mattered).
    // The policy itself keeps a process on the CPU: under RR/MLFQ it stays at the head of its
    // core queue until onProcessRan rotates it out at quantum exhaustion.
    for (const p of this.processes) {
      if (p.state === 'RUNNING') p.state = 'READY';
    }

    this.scheduler.sync(this.processes);

    // 1. Work-Stealing Check: If a core is starved and the other is loaded, steal tasks
    if (this.scheduler.coreQueues[0].length === 0 && this.scheduler.coreQueues[1].length > 1) {
      const stolen = this.scheduler.stealWork(0, 1, this.processes);
      if (stolen > 0) {
        this.cpus[0].stolenTasksCount += stolen;
        this.logJournal('WORK_STEAL', `Core 0 stole ${stolen} task(s) from Core 1 tail.`);
      }
    } else if (this.scheduler.coreQueues[1].length === 0 && this.scheduler.coreQueues[0].length > 1) {
      const stolen = this.scheduler.stealWork(1, 0, this.processes);
      if (stolen > 0) {
        this.cpus[1].stolenTasksCount += stolen;
        this.logJournal('WORK_STEAL', `Core 1 stole ${stolen} task(s) from Core 0 tail.`);
      }
    }

    if (this.scheduler.algorithm === 'MLFQ' && this.currentTick % this.scheduler.agingIntervalTicks === 0) {
      this.scheduler.applyAging(this.processes);
      this.logJournal('AGING', `Priority boost applied at tick ${this.currentTick}.`);
    }

    const readyProcs = this.processes.filter(p => p.state === 'READY' || p.state === 'RUNNING');

    // 2. Schedule Core 0
    const proc0 = this.scheduler.selectNextForCore(0, readyProcs);
    // 3. Schedule Core 1 (cannot be same process as Core 0)
    const readyForCore1 = readyProcs.filter(p => !proc0 || p.pid !== proc0.pid);
    const proc1 = this.scheduler.selectNextForCore(1, readyForCore1);

    // Context switch accounting
    if (proc0 && proc0.pid !== this.cpus[0].currentPid) {
      this.totalContextSwitches++;
      this.emitBPFEvent('SCHED_SWITCH', `Core 0 switched to PID #${proc0.pid}`, proc0.pid, `PID_${proc0.pid}`);
    }
    if (proc1 && proc1.pid !== this.cpus[1].currentPid) {
      this.totalContextSwitches++;
      this.emitBPFEvent('SCHED_SWITCH', `Core 1 switched to PID #${proc1.pid}`, proc1.pid, `PID_${proc1.pid}`);
    }

    // Advance Core 0
    if (proc0) {
      this.busyTicks++;
      this.cpus[0].busyTicks++;
      this.cpus[0].currentPid = proc0.pid;
      proc0.state = 'RUNNING';
      if (proc0.firstRunTick === null) {
        proc0.firstRunTick = this.currentTick;
        proc0.responseTicks = this.currentTick - proc0.arrivalTick;
      }
      proc0.remainingBurstTicks = Math.max(0, proc0.remainingBurstTicks - 1);
      proc0.allocatedFrames.forEach(f => this.memory.touchFrame(f, this.currentTick));

      const justFinished = proc0.remainingBurstTicks === 0;
      this.scheduler.onProcessRan(proc0, justFinished, 0);

      if (justFinished) {
        proc0.state = 'TERMINATED';
        proc0.completionTick = this.currentTick;
        proc0.turnaroundTicks = this.currentTick - proc0.arrivalTick;
        this.memory.deallocateProcess(proc0.pid);
        this.cpus[0].currentPid = null;
        this.logJournal('PROCESS_COMPLETE', `Core 0: PID #${proc0.pid} finished.`);
      }

      this.ganttHistoryCore0.push({
        tick: this.currentTick,
        pid: proc0.pid,
        name: proc0.name,
        color: proc0.color
      });
    } else {
      this.idleTicks++;
      this.cpus[0].idleTicks++;
      this.cpus[0].currentPid = null;
      this.ganttHistoryCore0.push({
        tick: this.currentTick,
        pid: null,
        name: 'IDLE',
        color: '#475569'
      });
    }

    // Advance Core 1
    if (proc1) {
      this.busyTicks++;
      this.cpus[1].busyTicks++;
      this.cpus[1].currentPid = proc1.pid;
      proc1.state = 'RUNNING';
      if (proc1.firstRunTick === null) {
        proc1.firstRunTick = this.currentTick;
        proc1.responseTicks = this.currentTick - proc1.arrivalTick;
      }
      proc1.remainingBurstTicks = Math.max(0, proc1.remainingBurstTicks - 1);
      proc1.allocatedFrames.forEach(f => this.memory.touchFrame(f, this.currentTick));

      const justFinished = proc1.remainingBurstTicks === 0;
      this.scheduler.onProcessRan(proc1, justFinished, 1);

      if (justFinished) {
        proc1.state = 'TERMINATED';
        proc1.completionTick = this.currentTick;
        proc1.turnaroundTicks = this.currentTick - proc1.arrivalTick;
        this.memory.deallocateProcess(proc1.pid);
        this.cpus[1].currentPid = null;
        this.logJournal('PROCESS_COMPLETE', `Core 1: PID #${proc1.pid} finished.`);
      }

      this.ganttHistoryCore1.push({
        tick: this.currentTick,
        pid: proc1.pid,
        name: proc1.name,
        color: proc1.color
      });
    } else {
      this.cpus[1].idleTicks++;
      this.cpus[1].currentPid = null;
      this.ganttHistoryCore1.push({
        tick: this.currentTick,
        pid: null,
        name: 'IDLE',
        color: '#475569'
      });
    }

    // Keep primary legacy pointer synced
    this.currentRunningPid = proc0?.pid || proc1?.pid || null;
    this.ganttHistory = [...this.ganttHistoryCore0];

    // Trim Gantt history to last 30 ticks
    if (this.ganttHistoryCore0.length > 30) this.ganttHistoryCore0.shift();
    if (this.ganttHistoryCore1.length > 30) this.ganttHistoryCore1.shift();
    if (this.ganttHistory.length > 30) this.ganttHistory.shift();

    // Update CPU runqueue references and load %
    this.cpus[0].runqueue = [...this.scheduler.coreQueues[0]];
    this.cpus[1].runqueue = [...this.scheduler.coreQueues[1]];

    const total0 = this.cpus[0].busyTicks + this.cpus[0].idleTicks;
    this.cpus[0].loadPercentage = total0 > 0 ? Math.round((this.cpus[0].busyTicks / total0) * 100) : 0;

    const total1 = this.cpus[1].busyTicks + this.cpus[1].idleTicks;
    this.cpus[1].loadPercentage = total1 > 0 ? Math.round((this.cpus[1].busyTicks / total1) * 100) : 0;

    // Waiting ticks accounting
    const activePids = new Set([proc0?.pid, proc1?.pid]);
    readyProcs.forEach(p => {
      if (!activePids.has(p.pid) && p.state === 'READY') {
        p.waitingTicks++;
      }
    });

    if (this.onUpdate) this.onUpdate();
  }

  public getStats(): KernelStats {
    const active = this.processes.filter(p => p.state !== 'TERMINATED');
    const completed = this.processes.filter(p => p.state === 'TERMINATED');
    const totalWaiting = completed.reduce((acc, p) => acc + p.waitingTicks, 0);
    const totalTurnaround = completed.reduce((acc, p) => acc + (p.turnaroundTicks || 0), 0);
    const totalTicks = (this.cpus[0].busyTicks + this.cpus[0].idleTicks + this.cpus[1].busyTicks + this.cpus[1].idleTicks) / 2;
    const cpuUtil = totalTicks > 0 ? Math.round((this.busyTicks / (totalTicks * 2)) * 100) : 0;
    const throughput = totalTicks > 0 ? parseFloat(((completed.length / totalTicks) * 100).toFixed(2)) : 0;

    return {
      tick: this.currentTick,
      cpuUtilization: Math.min(100, cpuUtil),
      throughput,
      avgWaitingTime: completed.length ? parseFloat((totalWaiting / completed.length).toFixed(1)) : 0,
      avgTurnaroundTime: completed.length ? parseFloat((totalTurnaround / completed.length).toFixed(1)) : 0,
      totalContextSwitches: this.totalContextSwitches,
      totalPageFaults: this.memory.totalPageFaults,
      activeProcesses: active.length,
      completedProcesses: completed.length,
      quantumTime: this.scheduler.timeQuantum
    };
  }

  public start() {
    if (this.timerId) clearInterval(this.timerId);
    this.isRunning = true;
    this.timerId = setInterval(() => this.step(), this.tickRateMs);
  }

  public pause() {
    this.isRunning = false;
    if (this.timerId) clearInterval(this.timerId);
    if (this.onUpdate) this.onUpdate();
  }

  public setSpeed(ms: number) {
    this.tickRateMs = ms;
    if (this.isRunning) this.start();
  }
}

export const globalKernel = new Kernel();
globalKernel.start();
