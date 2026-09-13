import { MemoryFrame, PageReplacementPolicy, Process, PrivilegeRing, GPFRegisterDump } from '../types/kernel';

export class MemoryManager {
  public totalFrames: number = 32;
  public frames: MemoryFrame[] = [];
  public totalPageFaults: number = 0;
  public policy: PageReplacementPolicy = 'LRU';

  // Hardware Memory Segmentation Boundaries
  public static readonly KERNEL_SPACE_START = 0x0000;
  public static readonly KERNEL_SPACE_END = 0x3FFF; // 16 KB Kernel Reserved
  public static readonly USER_SPACE_START = 0x4000;
  public static readonly USER_SPACE_END = 0xFFFF;   // 64 KB Total Address Space

  public lastGPF: GPFRegisterDump | null = null;
  public totalGPFFaults: number = 0;

  constructor(totalFrames: number = 32, policy: PageReplacementPolicy = 'LRU') {
    this.totalFrames = totalFrames;
    this.policy = policy;
    this.initFrames();
  }

  private initFrames() {
    this.frames = [];
    for (let i = 0; i < this.totalFrames; i++) {
      this.frames.push({
        frameId: i,
        pid: null,
        pageNumber: null,
        lastAccessTick: 0,
        loadedAtTick: 0,
        isDirty: false,
        color: '#334155'
      });
    }
  }

  /**
   * Dual-Mode Memory Access Validator:
   * Enforces hardware isolation between Ring 0 (Kernel Space) and Ring 3 (User Space).
   * Traps unauthorized pointer dereferences and generates a General Protection Fault (GPF).
   */
  public verifyAddressAccess(pid: number, procName: string, address: number, ring: PrivilegeRing = 'RING_3'): { valid: boolean; dump?: GPFRegisterDump } {
    const isKernelAddress = address >= MemoryManager.KERNEL_SPACE_START && address <= MemoryManager.KERNEL_SPACE_END;
    const isOutOfBounds = address < 0 || address > MemoryManager.USER_SPACE_END;

    if (ring === 'RING_3' && (isKernelAddress || isOutOfBounds)) {
      const dump: GPFRegisterDump = {
        pid,
        procName,
        illegalAddress: '0x' + address.toString(16).toUpperCase().padStart(4, '0'),
        ring,
        eip: '0x0804' + (0x8000 + (pid * 37) % 0x7FFF).toString(16).toUpperCase().padStart(4, '0'),
        esp: '0xBFFF' + (0xF000 - (pid * 13) % 0x0FFF).toString(16).toUpperCase().padStart(4, '0'),
        cr3: '0x00104000',
        eax: '0x' + address.toString(16).toUpperCase().padStart(8, '0'),
        cs: '0x0073', // User Space Code Segment
        eflags: '0x00010246',
        timestamp: Date.now()
      };

      this.lastGPF = dump;
      this.totalGPFFaults++;
      return { valid: false, dump };
    }

    return { valid: true };
  }

  /** Pick eviction victims according to the active replacement policy. */
  private pickVictims(excludePid: number, count: number): MemoryFrame[] {
    const candidates = this.frames.filter(f => f.pid !== null && f.pid !== excludePid);

    switch (this.policy) {
      case 'FIFO':
        candidates.sort((a, b) => a.loadedAtTick - b.loadedAtTick);
        break;
      case 'LRU':
      default:
        candidates.sort((a, b) => a.lastAccessTick - b.lastAccessTick);
        break;
    }

    return candidates.slice(0, count);
  }

  public allocateProcessSpace(proc: Process, currentTick: number): boolean {
    const pagesNeeded = Math.ceil(proc.memorySizeKB / 4);
    const allocated: number[] = [];

    for (let i = 0; i < this.frames.length && allocated.length < pagesNeeded; i++) {
      if (this.frames[i].pid === null) {
        this.frames[i].pid = proc.pid;
        this.frames[i].pageNumber = allocated.length;
        this.frames[i].lastAccessTick = currentTick;
        this.frames[i].loadedAtTick = currentTick;
        this.frames[i].color = proc.color;
        allocated.push(i);
      }
    }

    if (allocated.length < pagesNeeded) {
      const stillNeeded = pagesNeeded - allocated.length;
      this.totalPageFaults += stillNeeded;
      const victims = this.pickVictims(proc.pid, stillNeeded);

      for (const victim of victims) {
        if (allocated.length >= pagesNeeded) break;
        victim.pid = proc.pid;
        victim.pageNumber = allocated.length;
        victim.lastAccessTick = currentTick;
        victim.loadedAtTick = currentTick;
        victim.color = proc.color;
        allocated.push(victim.frameId);
      }
    }

    proc.allocatedFrames = allocated;
    return allocated.length >= pagesNeeded;
  }

  public touchFrame(frameId: number, currentTick: number) {
    if (this.frames[frameId]) {
      this.frames[frameId].lastAccessTick = currentTick;
    }
  }

  public setPolicy(policy: PageReplacementPolicy) {
    this.policy = policy;
  }

  public deallocateProcess(pid: number) {
    for (const frame of this.frames) {
      if (frame.pid === pid) {
        frame.pid = null;
        frame.pageNumber = null;
        frame.color = '#334155';
        frame.lastAccessTick = 0;
        frame.loadedAtTick = 0;
      }
    }
  }
}
