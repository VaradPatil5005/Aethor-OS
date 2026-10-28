export type SchedulingAlgorithm = 'FCFS' | 'SJF' | 'SRTF' | 'ROUND_ROBIN' | 'PRIORITY' | 'MLFQ';
export type PageReplacementPolicy = 'FIFO' | 'LRU' | 'CLOCK' | 'OPTIMAL';
export type ProcessState = 'NEW' | 'READY' | 'RUNNING' | 'WAITING' | 'TERMINATED';

export type CoreAffinity = 'ANY' | 0 | 1;

export interface CPUCore {
  coreId: number;
  currentPid: number | null;
  runqueue: number[]; // PIDs
  loadPercentage: number;
  busyTicks: number;
  idleTicks: number;
  stolenTasksCount: number;
}

export interface Process {
  pid: number;
  name: string;
  state: ProcessState;
  priority: number;
  queueLevel: number;
  quantumUsed: number;
  totalBurstTicks: number;
  remainingBurstTicks: number;
  arrivalTick: number;
  firstRunTick: number | null;
  completionTick: number | null;
  waitingTicks: number;
  turnaroundTicks: number | null;
  responseTicks: number | null;
  memorySizeKB: number;
  allocatedFrames: number[];
  locksHeld: string[];
  waitingFor: string | null;
  color: string;
  coreAffinity?: CoreAffinity;
  lastExecutedCore?: number | null;
}

export interface MemoryFrame {
  frameId: number;
  pid: number | null;
  pageNumber: number | null;
  lastAccessTick: number;
  loadedAtTick: number;
  isDirty: boolean;
  /** CLOCK reference bit: set on load and on every access, cleared as the hand sweeps past. */
  referenced?: boolean;
  color: string;
}

export interface Inode {
  inodeNumber: number;
  name: string;
  type: 'file' | 'directory';
  sizeBytes: number;
  permissions: string;
  parentId: number | null;
  content: string;
}

// Write-Ahead Logging (WAL) & Crash Consistency Types
export type JournalState = 'PENDING' | 'COMMITTED' | 'CHECKPOINTED';

export interface JournalEntry {
  txnId: number;
  op: 'CREATE' | 'WRITE' | 'DELETE';
  path: string;
  state: JournalState;
  timestamp: number;
  payload?: any;
}

export interface Superblock {
  isClean: boolean;
  totalInodes: number;
  journalHead: number;
  journalTail: number;
  blockSize: number;
  mounted: boolean;
}

// In-Kernel eBPF Probe Engine Types
export type BPFHookType = 'SCHED_SWITCH' | 'PAGE_FAULT' | 'SYSCALL_ENTER';

export interface BPFProbe {
  id: string;
  name: string;
  hook: BPFHookType;
  filterScript: string;
  enabled: boolean;
  mapOutput: Record<string, number>;
  eventCount: number;
}

export interface BPFEvent {
  timestamp: number;
  hook: BPFHookType;
  details: string;
  pid?: number;
}

// Dual-Mode Privilege & GPF Types
export type PrivilegeRing = 'RING_0' | 'RING_3';

export interface GPFRegisterDump {
  pid: number;
  procName: string;
  illegalAddress: string;
  ring: PrivilegeRing;
  eip: string;
  esp: string;
  cr3: string;
  eax: string;
  cs: string;
  eflags: string;
  timestamp: number;
}

export interface DeadlockReport {
  isDeadlocked: boolean;
  cyclePids: number[];
  allocationMatrix: Record<string, number[]>;
  requestMatrix: Record<string, number[]>;
  availableResources: Record<string, number>;
}

export interface BankerScenario {
  processNames: string[];
  resourceNames: string[];
  available: number[];
  maximum: number[][];
  allocation: number[][];
}

export interface BankerResult {
  need: number[][];
  isSafe: boolean;
  safeSequence: number[];
  steps: { pid: number; workBefore: number[]; workAfter: number[] }[];
}

export interface KernelStats {
  tick: number;
  cpuUtilization: number;
  throughput: number;
  avgWaitingTime: number;
  avgTurnaroundTime: number;
  totalContextSwitches: number;
  totalPageFaults: number;
  activeProcesses: number;
  completedProcesses: number;
  quantumTime: number;
}
