import { describe, it, expect, beforeEach } from 'vitest';
import { Scheduler } from '../Scheduler';
import { VFS } from '../VFS';
import { MemoryManager } from '../MemoryManager';
import { Kernel } from '../Kernel';
import { Process } from '../../types/kernel';

describe('Advanced Systems Architecture: Subsystems Verification', () => {
  const createMockProcess = (pid: number, name: string, affinity: 'ANY' | 0 | 1 = 'ANY'): Process => ({
    pid,
    name,
    state: 'READY',
    priority: 1,
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
    memorySizeKB: 64,
    allocatedFrames: [],
    locksHeld: [],
    waitingFor: null,
    color: '#3b82f6',
    coreAffinity: affinity,
    lastExecutedCore: null
  });

  describe('1. Multi-Core SMP & Work-Stealing Scheduler', () => {
    let scheduler: Scheduler;

    beforeEach(() => {
      scheduler = new Scheduler('ROUND_ROBIN', 2);
    });

    it('initializes dual runqueues for Core 0 and Core 1', () => {
      expect(scheduler.coreQueues[0]).toBeDefined();
      expect(scheduler.coreQueues[1]).toBeDefined();
      expect(scheduler.coreQueues[0]).toEqual([]);
      expect(scheduler.coreQueues[1]).toEqual([]);
    });

    it('steals tasks from victim when thief core is starving', () => {
      const p1 = createMockProcess(101, 'P1');
      const p2 = createMockProcess(102, 'P2');
      const p3 = createMockProcess(103, 'P3');
      const p4 = createMockProcess(104, 'P4');
      const procs = [p1, p2, p3, p4];

      // Core 0 has 4 tasks, Core 1 has 0 tasks
      scheduler.coreQueues[0] = [101, 102, 103, 104];
      scheduler.coreQueues[1] = [];

      const stolenCount = scheduler.stealWork(1, 0, procs);
      expect(stolenCount).toBe(2); // Steals floor(4/2) = 2 tasks
      expect(scheduler.coreQueues[0]).toEqual([101, 102]);
      expect(scheduler.coreQueues[1]).toEqual([104, 103]);
    });

    it('honors strict core affinity during dispatch', () => {
      const p0 = createMockProcess(1, 'ProcCore0', 0);
      const p1 = createMockProcess(2, 'ProcCore1', 1);
      const processes = [p0, p1];

      // Sync processes into core queues
      scheduler.sync(processes);
      expect(scheduler.coreQueues[0]).toContain(1);
      expect(scheduler.coreQueues[1]).toContain(2);

      // Core 0 should only pick process with affinity 0
      const nextForCore0 = scheduler.selectNextForCore(0, processes);
      expect(nextForCore0?.pid).toBe(1);

      // Core 1 should only pick process with affinity 1
      const nextForCore1 = scheduler.selectNextForCore(1, processes);
      expect(nextForCore1?.pid).toBe(2);
    });
  });

  describe('2. Crash-Consistent Journaling VFS (WAL Engine & FSCK)', () => {
    let vfs: VFS;

    beforeEach(() => {
      vfs = new VFS();
    });

    it('initializes clean superblock and write-ahead journal', () => {
      expect(vfs.superblock.isClean).toBe(true);
      expect(vfs.superblock.mounted).toBe(true);
      expect(Array.isArray(vfs.journalLog)).toBe(true);
    });

    it('records committed journal entries on safe file write', () => {
      const initialJournalLen = vfs.journalLog.length;
      vfs.createFile('sys_test.log', 'Log content');
      expect(vfs.journalLog.length).toBeGreaterThan(initialJournalLen);
      const lastEntry = vfs.journalLog[vfs.journalLog.length - 1];
      expect(lastEntry.state).toBe('CHECKPOINTED');
      expect(lastEntry.path).toContain('sys_test.log');
    });

    it('triggers power cut, leaving dirty superblock and torn transactions', () => {
      vfs.triggerPowerCut();
      expect(vfs.superblock.isClean).toBe(false);
      expect(vfs.superblock.mounted).toBe(false);

      const tornEntry = vfs.journalLog[vfs.journalLog.length - 1];
      expect(tornEntry.state).toBe('PENDING'); // Uncommitted torn write simulated
    });

    it('recovers filesystem via automated fsck journal replay', () => {
      vfs.triggerPowerCut();
      expect(vfs.superblock.isClean).toBe(false);

      const logs = vfs.recoverFSCK();
      expect(logs.length).toBeGreaterThan(0);
      expect(vfs.superblock.isClean).toBe(true);
      expect(vfs.superblock.mounted).toBe(true);
      expect(logs.some(l => l.includes('Rolling back dirty transaction'))).toBe(true);
    });
  });

  describe('3. In-Kernel eBPF Probes & Telemetry', () => {
    let kernel: Kernel;

    beforeEach(() => {
      kernel = new Kernel();
    });

    it('attaches and toggles eBPF probes for scheduler and syscall hookpoints', () => {
      const probe = kernel.attachProbe('test_sched_monitor', 'SCHED_SWITCH', 'count(pid)');

      expect(kernel.probes.some(p => p.id === probe.id)).toBe(true);

      kernel.toggleProbe(probe.id);
      const found = kernel.probes.find(p => p.id === probe.id);
      expect(found?.enabled).toBe(false);

      kernel.removeProbe(probe.id);
      expect(kernel.probes.some(p => p.id === probe.id)).toBe(false);
    });

    it('emits BPF events and populates the in-kernel BPF map', () => {
      const initialEvents = kernel.bpfEvents.length;
      kernel.emitBPFEvent('SYSCALL_ENTER', 'sys_write called', 1, 'PID_1');

      expect(kernel.bpfEvents.length).toBeGreaterThan(initialEvents);
      const lastEvent = kernel.bpfEvents[kernel.bpfEvents.length - 1];
      expect(lastEvent.hook).toBe('SYSCALL_ENTER');

      const syscallProbe = kernel.probes.find(p => p.hook === 'SYSCALL_ENTER');
      expect(syscallProbe).toBeDefined();
      expect(syscallProbe!.mapOutput['PID_1']).toBeGreaterThan(0);
    });
  });

  describe('4. Dual-Mode Privilege & General Protection Faults (#GP)', () => {
    let mem: MemoryManager;

    beforeEach(() => {
      mem = new MemoryManager(32, 'LRU');
    });

    it('permits Ring 0 kernel mode to access low addresses', () => {
      const result = mem.verifyAddressAccess(1, 'KernelInit', 0x1000, 'RING_0');
      expect(result.valid).toBe(true);
      expect(result.dump).toBeUndefined();
    });

    it('traps Ring 3 user mode accessing kernel space with full x86 register dump', () => {
      // Attempting to access Ring 0 kernel space (0x0020) from Ring 3
      const result = mem.verifyAddressAccess(42, 'RogueUserProc', 0x0020, 'RING_3');
      expect(result.valid).toBe(false);
      expect(result.dump).toBeDefined();

      const dump = result.dump!;
      expect(dump.pid).toBe(42);
      expect(dump.illegalAddress).toBe('0x0020');
      expect(dump.ring).toBe('RING_3');
      expect(dump.eip).toBeDefined();
      expect(dump.esp).toBeDefined();
      expect(dump.cr3).toBeDefined();
      expect(dump.cs).toBe('0x0073'); // User code segment
      expect(dump.eflags).toBe('0x00010246');
    });
  });
});
