import { create } from 'zustand';
import { 
  Process, 
  MemoryFrame, 
  Inode, 
  KernelStats, 
  SchedulingAlgorithm, 
  PageReplacementPolicy, 
  DeadlockReport,
  CPUCore,
  CoreAffinity,
  Superblock,
  JournalEntry,
  BPFProbe,
  BPFEvent,
  BPFHookType,
  GPFRegisterDump
} from '../types/kernel';
import { globalKernel } from '../kernel/Kernel';

interface KernelStoreState {
  stats: KernelStats;
  processes: Process[];
  frames: MemoryFrame[];
  ganttHistory: { tick: number; pid: number | null; name: string; color: string }[];
  ganttCore0: { tick: number; pid: number | null; name: string; color: string }[];
  ganttCore1: { tick: number; pid: number | null; name: string; color: string }[];
  cpus: [CPUCore, CPUCore];
  deadlockState: DeadlockReport;
  vfsInodes: Inode[];
  currentVfsPath: string;
  superblock: Superblock;
  journalLog: JournalEntry[];
  probes: BPFProbe[];
  bpfEvents: BPFEvent[];
  lastGPF: GPFRegisterDump | null;
  schedulerAlgorithm: SchedulingAlgorithm;
  memoryPolicy: PageReplacementPolicy;
  isPaused: boolean;
  speedMs: number;
  journal: { tick: number; type: string; message: string }[];

  refresh: () => void;
  setAlgorithm: (algo: SchedulingAlgorithm) => void;
  setQuantum: (q: number) => void;
  setMemoryPolicy: (policy: PageReplacementPolicy) => void;
  spawnProcess: (name: string, priority: number, burst: number, memoryKB: number, affinity?: CoreAffinity) => void;
  terminateProcess: (pid: number) => void;
  setProcessAffinity: (pid: number, affinity: CoreAffinity) => void;
  triggerDeadlock: () => void;
  togglePause: () => void;
  setSpeed: (ms: number) => void;
  triggerPowerCut: () => void;
  recoverFSCK: () => string[];
  attachProbe: (name: string, hook: BPFHookType, filterScript: string) => void;
  toggleProbe: (id: string) => void;
  removeProbe: (id: string) => void;
  triggerSimulatedGPF: (pid?: number) => GPFRegisterDump | null;
  executeTerminalCommand: (cmd: string) => string;
}

export const useKernelStore = create<KernelStoreState>((set, get) => {
  globalKernel.onUpdate = () => {
    set({
      stats: globalKernel.getStats(),
      processes: [...globalKernel.processes],
      frames: [...globalKernel.memory.frames],
      ganttHistory: [...globalKernel.ganttHistory],
      ganttCore0: [...globalKernel.ganttHistoryCore0],
      ganttCore1: [...globalKernel.ganttHistoryCore1],
      cpus: [{ ...globalKernel.cpus[0] }, { ...globalKernel.cpus[1] }],
      deadlockState: globalKernel.deadlock.evaluateDeadlock(globalKernel.processes),
      vfsInodes: [...globalKernel.vfs.inodes],
      currentVfsPath: globalKernel.vfs.getCurrentPath(),
      superblock: { ...globalKernel.vfs.superblock },
      journalLog: [...globalKernel.vfs.journalLog],
      probes: [...globalKernel.probes.map(p => ({ ...p, mapOutput: { ...p.mapOutput } }))],
      bpfEvents: [...globalKernel.bpfEvents],
      lastGPF: globalKernel.lastGPF ? { ...globalKernel.lastGPF } : null,
      schedulerAlgorithm: globalKernel.scheduler.algorithm,
      memoryPolicy: globalKernel.memory.policy,
      isPaused: !globalKernel.isRunning,
      speedMs: globalKernel.tickRateMs,
      journal: [...globalKernel.journal]
    });
  };

  return {
    stats: globalKernel.getStats(),
    processes: [...globalKernel.processes],
    frames: [...globalKernel.memory.frames],
    ganttHistory: [...globalKernel.ganttHistory],
    ganttCore0: [...globalKernel.ganttHistoryCore0],
    ganttCore1: [...globalKernel.ganttHistoryCore1],
    cpus: [{ ...globalKernel.cpus[0] }, { ...globalKernel.cpus[1] }],
    deadlockState: globalKernel.deadlock.evaluateDeadlock(globalKernel.processes),
    vfsInodes: [...globalKernel.vfs.inodes],
    currentVfsPath: globalKernel.vfs.getCurrentPath(),
    superblock: { ...globalKernel.vfs.superblock },
    journalLog: [...globalKernel.vfs.journalLog],
    probes: [...globalKernel.probes],
    bpfEvents: [...globalKernel.bpfEvents],
    lastGPF: null,
    schedulerAlgorithm: globalKernel.scheduler.algorithm,
    memoryPolicy: globalKernel.memory.policy,
    isPaused: false,
    speedMs: 800,
    journal: [...globalKernel.journal],

    refresh: () => globalKernel.step(),
    setAlgorithm: (algo) => {
      globalKernel.scheduler.algorithm = algo;
      globalKernel.scheduler.rrQueue = [];
      globalKernel.scheduler.mlfqQueues = { q0: [], q1: [], q2: [] };
      globalKernel.scheduler.coreQueues = { 0: [], 1: [] };
      for (const p of globalKernel.processes) {
        p.queueLevel = 0;
        p.quantumUsed = 0;
      }
      globalKernel.scheduler.sync(globalKernel.processes);
      get().refresh();
    },
    setQuantum: (q) => {
      globalKernel.scheduler.timeQuantum = q;
      get().refresh();
    },
    setMemoryPolicy: (policy) => {
      globalKernel.memory.setPolicy(policy);
      set({ memoryPolicy: policy });
    },
    spawnProcess: (name, priority, burst, memoryKB, affinity = 'ANY') => {
      globalKernel.spawnProcess(name, priority, burst, memoryKB, undefined, affinity);
    },
    terminateProcess: (pid) => {
      globalKernel.killProcess(pid);
    },
    setProcessAffinity: (pid, affinity) => {
      globalKernel.setProcessAffinity(pid, affinity);
    },
    triggerDeadlock: () => {
      globalKernel.injectDeadlock();
    },
    togglePause: () => {
      if (globalKernel.isRunning) globalKernel.pause();
      else globalKernel.start();
      set({ isPaused: !globalKernel.isRunning });
    },
    setSpeed: (ms) => {
      globalKernel.setSpeed(ms);
      set({ speedMs: ms });
    },
    triggerPowerCut: () => {
      globalKernel.vfs.triggerPowerCut();
      globalKernel.logJournal('POWER_CUT', 'Simulated sudden power cut. Unmounted dirty VFS.');
      if (globalKernel.onUpdate) globalKernel.onUpdate();
    },
    recoverFSCK: () => {
      const logs = globalKernel.vfs.recoverFSCK();
      globalKernel.logJournal('FSCK_REPLAY', 'Journal replay finished. File system clean.');
      if (globalKernel.onUpdate) globalKernel.onUpdate();
      return logs;
    },
    attachProbe: (name, hook, filterScript) => {
      globalKernel.attachProbe(name, hook, filterScript);
    },
    toggleProbe: (id) => {
      globalKernel.toggleProbe(id);
    },
    removeProbe: (id) => {
      globalKernel.removeProbe(id);
    },
    triggerSimulatedGPF: (pid) => {
      return globalKernel.triggerSimulatedGPF(pid);
    },
    executeTerminalCommand: (input: string): string => {
      const parts = input.trim().split(/\s+/);
      const cmd = parts[0]?.toLowerCase();
      const args = parts.slice(1);
      if (!cmd) return '';

      switch (cmd) {
        case 'help':
          return `Available AetherOS Commands:
  ps                  - Show processes, PCBs & Core affinities
  affinity <pid> <0|1|any> - Set process CPU core affinity
  kill <pid>          - Terminate process
  run <name> <burst>  - Create process
  sched <algo>        - Set scheduler (MLFQ, ROUND_ROBIN, SRTF, PRIORITY)
  quantum <val>       - Set RR Quantum
  memstat             - Show RAM & Page fault statistics
  gpf [pid]           - Inject simulated General Protection Fault
  fsck                - Run VFS journal crash consistency recovery
  powercut            - Simulate sudden storage power failure
  bpf                 - Dump active eBPF probes & telemetry map
  deadlock            - Inject deadlock scenario
  ls, pwd, cd, cat, touch, mkdir, rm - VFS storage utilities`;

        case 'ps': {
          let out = 'PID   NAME               STATE       PRIO  CORE  BURST  REMAIN  MEM\n';
          out += '--------------------------------------------------------------------\n';
          for (const p of globalKernel.processes) {
            const coreStr = p.coreAffinity === 'ANY' ? 'ANY' : `CPU_${p.coreAffinity}`;
            out += `${p.pid.toString().padEnd(6)}${p.name.padEnd(19)}${p.state.padEnd(12)}${p.priority.toString().padEnd(6)}${coreStr.padEnd(6)}${p.totalBurstTicks.toString().padEnd(7)}${p.remainingBurstTicks.toString().padEnd(8)}${p.memorySizeKB}KB\n`;
          }
          out += `\n[SMP LOAD] Core 0: ${globalKernel.cpus[0].loadPercentage}% (${globalKernel.cpus[0].stolenTasksCount} stolen) | Core 1: ${globalKernel.cpus[1].loadPercentage}% (${globalKernel.cpus[1].stolenTasksCount} stolen)\n`;
          return out;
        }

        case 'affinity': {
          const pid = parseInt(args[0]);
          const affStr = args[1]?.toLowerCase();
          if (isNaN(pid) || !['0', '1', 'any'].includes(affStr)) {
            return 'Usage: affinity <pid> <0 | 1 | any>';
          }
          const aff: CoreAffinity = affStr === 'any' ? 'ANY' : (parseInt(affStr) as 0 | 1);
          globalKernel.setProcessAffinity(pid, aff);
          return `[SMP] PID #${pid} affinity configured to Core ${aff}`;
        }

        case 'kill': {
          const pid = parseInt(args[0]);
          if (isNaN(pid)) return 'Error: Specify valid PID (e.g. kill 101)';
          return globalKernel.killProcess(pid) ? `[OK] PID ${pid} terminated.` : `[Error] PID ${pid} not found.`;
        }

        case 'run': {
          const name = args[0] || 'app_worker';
          const burst = parseInt(args[1]) || 12;
          const p = globalKernel.spawnProcess(name, 2, burst, 16);
          return `[SPAWNED] PID ${p.pid} ('${p.name}') created (Burst: ${burst}t).`;
        }

        case 'sched': {
          const algo = args[0]?.toUpperCase() as SchedulingAlgorithm;
          if (['MLFQ', 'ROUND_ROBIN', 'SRTF', 'PRIORITY', 'FCFS', 'SJF'].includes(algo)) {
            globalKernel.scheduler.algorithm = algo;
            return `[SCHEDULER] Algorithm switched to ${algo}`;
          }
          return 'Error: Invalid algorithm.';
        }

        case 'quantum': {
          const q = parseInt(args[0]);
          if (isNaN(q) || q < 1) return 'Error: Quantum must be >= 1';
          globalKernel.scheduler.timeQuantum = q;
          return `[SCHEDULER] Quantum set to ${q}`;
        }

        case 'gpf': {
          const pid = args[0] ? parseInt(args[0]) : undefined;
          const dump = globalKernel.triggerSimulatedGPF(pid);
          if (dump) {
            return `[GENERAL PROTECTION FAULT] Trapped invalid memory access!
PID: ${dump.pid} (${dump.procName})
Illegal Address: ${dump.illegalAddress} (Access Ring: ${dump.ring})
EIP: ${dump.eip} | ESP: ${dump.esp} | CR3: ${dump.cr3}
EAX: ${dump.eax} | CS:  ${dump.cs}  | EFLAGS: ${dump.eflags}
Process halted and placed in WAITING state.`;
          }
          return 'No eligible process found to trigger GPF.';
        }

        case 'powercut': {
          const res = globalKernel.vfs.triggerPowerCut();
          globalKernel.logJournal('POWER_CUT', 'Storage power disrupted. Superblock DIRTY.');
          if (globalKernel.onUpdate) globalKernel.onUpdate();
          return `[SIMULATED POWER CUT]
${res.message}
Dirty Txn: #${res.dirtyTxn.txnId} (${res.dirtyTxn.path}) State: ${res.dirtyTxn.state}
Superblock: isClean = false, mounted = false.
Run 'fsck' to execute journal replay recovery.`;
        }

        case 'fsck': {
          const logs = globalKernel.vfs.recoverFSCK();
          globalKernel.logJournal('FSCK_REPLAY', 'Journal recovery complete.');
          if (globalKernel.onUpdate) globalKernel.onUpdate();
          return logs.join('\n');
        }

        case 'bpf': {
          let out = '=== IN-KERNEL eBPF PROBES & BPF MAPS ===\n';
          for (const probe of globalKernel.probes) {
            out += `\n[${probe.enabled ? 'ACTIVE' : 'DISABLED'}] ${probe.name} (${probe.hook})\n`;
            out += `  Filter: ${probe.filterScript} | Events: ${probe.eventCount}\n`;
            out += `  BPF Map Keys:\n`;
            const keys = Object.keys(probe.mapOutput);
            if (keys.length === 0) out += '    (empty map)\n';
            else {
              for (const k of keys.slice(0, 5)) {
                out += `    ${k.padEnd(16)} => ${probe.mapOutput[k]}\n`;
              }
            }
          }
          return out;
        }

        case 'memstat': {
          const used = globalKernel.memory.frames.filter(f => f.pid !== null).length;
          return `[MEMORY SUBSYSTEM]
Total Physical Frames: 32 (128 KB total RAM)
Allocated Frames:     ${used} (${used * 4} KB)
Free Frames:          ${32 - used} (${(32 - used) * 4} KB)
Total Page Faults:    ${globalKernel.memory.totalPageFaults}
Segmentation:         0x0000-0x3FFF (Kernel Ring 0) | 0x4000-0xFFFF (User Ring 3)
Total GPF Traps:      ${globalKernel.memory.totalGPFFaults}`;
        }

        case 'pwd': return globalKernel.vfs.getCurrentPath();
        case 'ls': {
          const items = globalKernel.vfs.inodes.filter(i => i.parentId === globalKernel.vfs.currentDirId);
          if (items.length === 0) return '(empty directory)';
          let out = 'PERMS       TYPE   SIZE   NAME\n';
          out += '------------------------------\n';
          for (const item of items) {
            out += `${item.permissions}  ${item.type.padEnd(7)}${item.sizeBytes.toString().padEnd(7)}${item.name}\n`;
          }
          return out;
        }

        case 'cd': {
          const ok = globalKernel.vfs.changeDirectory(args[0] || '~');
          return ok ? `Path: ${globalKernel.vfs.getCurrentPath()}` : `Error: Directory '${args[0]}' not found.`;
        }

        case 'cat': {
          const c = globalKernel.vfs.readFile(args[0]);
          return c !== null ? c : `Error: File '${args[0]}' not found.`;
        }

        case 'touch': return globalKernel.vfs.createFile(args[0]) ? `Created '${args[0]}' (WAL Checkpointed)` : `Error creating file.`;
        case 'mkdir': return globalKernel.vfs.createDirectory(args[0]) ? `Created directory '${args[0]}'` : `Error creating directory.`;
        case 'rm': return globalKernel.vfs.removeNode(args[0]) ? `Removed '${args[0]}'` : `Error removing node.`;
        default: return `Unknown command: '${cmd}'. Type 'help' for commands.`;
      }
    }
  };
});
