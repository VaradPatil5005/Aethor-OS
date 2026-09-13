import { Inode, JournalEntry, Superblock, JournalState } from '../types/kernel';

export class VFS {
  public inodes: Inode[] = [];
  public currentDirId: number = 2;
  private nextInodeId: number = 10;
  private nextTxnId: number = 100;

  // Superblock representing file system mount & integrity state
  public superblock: Superblock = {
    isClean: true,
    totalInodes: 5,
    journalHead: 0,
    journalTail: 0,
    blockSize: 256,
    mounted: true
  };

  // Journal Ring Buffer (Write-Ahead Log)
  public journalLog: JournalEntry[] = [];
  private readonly maxJournalEntries: number = 25;

  constructor() {
    this.initFS();
  }

  private initFS() {
    this.inodes = [
      { inodeNumber: 1, name: 'root', type: 'directory', sizeBytes: 4096, permissions: 'rwxr-xr-x', parentId: null, content: '' },
      { inodeNumber: 2, name: 'user', type: 'directory', sizeBytes: 4096, permissions: 'rwxr-xr-x', parentId: 1, content: '' },
      { inodeNumber: 3, name: 'etc', type: 'directory', sizeBytes: 4096, permissions: 'rwxr-xr-x', parentId: 1, content: '' },
      { inodeNumber: 4, name: 'readme.txt', type: 'file', sizeBytes: 256, permissions: 'rw-r--r--', parentId: 2, content: 'Welcome to AetherOS Interactive Simulation!\nTry commands: help, ps, kill, run, memstat, ls, cat, touch, mkdir.\n' },
      { inodeNumber: 5, name: 'manifest.json', type: 'file', sizeBytes: 120, permissions: 'rw-r--r--', parentId: 2, content: '{\n  "os": "AetherOS",\n  "arch": "x16-Microkernel",\n  "version": "1.0.0"\n}' }
    ];
    this.superblock.totalInodes = this.inodes.length;
  }

  private appendJournal(op: 'CREATE' | 'WRITE' | 'DELETE', path: string, state: JournalState, payload?: any): JournalEntry {
    const entry: JournalEntry = {
      txnId: this.nextTxnId++,
      op,
      path,
      state,
      timestamp: Date.now(),
      payload
    };

    this.journalLog.push(entry);
    if (this.journalLog.length > this.maxJournalEntries) {
      this.journalLog.shift();
    }

    this.superblock.journalHead = (this.superblock.journalHead + 1) % this.maxJournalEntries;
    return entry;
  }

  public getCurrentPath(): string {
    let curr = this.inodes.find(i => i.inodeNumber === this.currentDirId);
    if (!curr || curr.parentId === null) return '/';
    const parts: string[] = [];
    while (curr && curr.parentId !== null) {
      parts.unshift(curr.name);
      curr = this.inodes.find(i => i.inodeNumber === curr!.parentId);
    }
    return '/' + parts.join('/');
  }

  public createFile(name: string, content: string = ''): boolean {
    if (!this.superblock.mounted) return false;
    if (this.inodes.some(i => i.parentId === this.currentDirId && i.name === name)) return false;

    const fullPath = `${this.getCurrentPath()}/${name}`.replace('//', '/');

    // Step 1: Write-Ahead Log (WAL) - PENDING
    const entry = this.appendJournal('CREATE', fullPath, 'PENDING', { content });

    // Step 2: Commit transaction - COMMITTED
    entry.state = 'COMMITTED';

    // Step 3: Checkpoint to Inode Table - CHECKPOINTED
    this.inodes.push({
      inodeNumber: this.nextInodeId++,
      name,
      type: 'file',
      sizeBytes: content.length || 64,
      permissions: 'rw-r--r--',
      parentId: this.currentDirId,
      content
    });
    this.superblock.totalInodes = this.inodes.length;

    entry.state = 'CHECKPOINTED';
    return true;
  }

  public createDirectory(name: string): boolean {
    if (!this.superblock.mounted) return false;
    if (this.inodes.some(i => i.parentId === this.currentDirId && i.name === name)) return false;

    const fullPath = `${this.getCurrentPath()}/${name}`.replace('//', '/');
    const entry = this.appendJournal('CREATE', fullPath, 'PENDING', { type: 'directory' });
    entry.state = 'COMMITTED';

    this.inodes.push({
      inodeNumber: this.nextInodeId++,
      name,
      type: 'directory',
      sizeBytes: 4096,
      permissions: 'rwxr-xr-x',
      parentId: this.currentDirId,
      content: ''
    });
    this.superblock.totalInodes = this.inodes.length;
    entry.state = 'CHECKPOINTED';
    return true;
  }

  public readFile(name: string): string | null {
    if (!this.superblock.mounted) return null;
    const file = this.inodes.find(i => i.parentId === this.currentDirId && i.name === name && i.type === 'file');
    return file ? file.content : null;
  }

  public changeDirectory(name: string): boolean {
    if (!this.superblock.mounted) return false;
    if (name === '..') {
      const curr = this.inodes.find(i => i.inodeNumber === this.currentDirId);
      if (curr && curr.parentId !== null) {
        this.currentDirId = curr.parentId;
        return true;
      }
      return true;
    }
    if (name === '/' || name === '~') {
      this.currentDirId = name === '/' ? 1 : 2;
      return true;
    }
    const target = this.inodes.find(i => i.parentId === this.currentDirId && i.name === name && i.type === 'directory');
    if (target) {
      this.currentDirId = target.inodeNumber;
      return true;
    }
    return false;
  }

  public removeNode(name: string): boolean {
    if (!this.superblock.mounted) return false;
    const target = this.inodes.find(i => i.parentId === this.currentDirId && i.name === name);
    if (!target) return false;

    const fullPath = `${this.getCurrentPath()}/${name}`.replace('//', '/');
    const entry = this.appendJournal('DELETE', fullPath, 'PENDING');
    entry.state = 'COMMITTED';

    this.inodes = this.inodes.filter(i => i.inodeNumber !== target.inodeNumber && i.parentId !== target.inodeNumber);
    this.superblock.totalInodes = this.inodes.length;
    entry.state = 'CHECKPOINTED';
    return true;
  }

  /**
   * Simulated Sudden Power Cut:
   * Interrupts an active write before checkpointing, leaves uncommitted blocks,
   * unmounts the VFS and marks the Superblock dirty.
   */
  public triggerPowerCut(): { dirtyTxn: JournalEntry; message: string } {
    this.superblock.isClean = false;
    this.superblock.mounted = false;

    // Inject torn/uncheckpointed write in the WAL ring buffer
    const tornEntry: JournalEntry = {
      txnId: this.nextTxnId++,
      op: 'WRITE',
      path: '/user/dirty_buffer.tmp',
      state: 'PENDING',
      timestamp: Date.now(),
      payload: { content: 'CRASH_CORRUPTED_SECTOR_DATA_0xDEADBEEF' }
    };

    this.journalLog.push(tornEntry);
    if (this.journalLog.length > this.maxJournalEntries) {
      this.journalLog.shift();
    }

    return {
      dirtyTxn: tornEntry,
      message: 'Sudden power cut simulated. VFS unmounted with dirty uncommitted WAL blocks.'
    };
  }

  /**
   * Recovery Daemon (fsck / Journal Replay):
   * Scans journal log, replays committed transactions, rolls back torn pending transactions,
   * restores superblock to clean and remounts file system.
   */
  public recoverFSCK(): string[] {
    const logs: string[] = [];
    logs.push('[fsck.aether] Phase 1: Scanning Superblock and Journal Ring Buffer...');

    let rolledBackCount = 0;
    let replayedCount = 0;

    for (const entry of this.journalLog) {
      if (entry.state === 'PENDING') {
        logs.push(`[fsck.aether] Found uncommitted torn Txn #${entry.txnId} (${entry.path}). Rolling back dirty transaction.`);
        rolledBackCount++;
      } else if (entry.state === 'COMMITTED') {
        logs.push(`[fsck.aether] Replaying uncheckpointed committed Txn #${entry.txnId} for ${entry.path}...`);
        replayedCount++;
        entry.state = 'CHECKPOINTED';
      }
    }

    // Remove pending dirty entries from journal
    this.journalLog = this.journalLog.filter(e => e.state !== 'PENDING');

    this.superblock.isClean = true;
    this.superblock.mounted = true;
    this.superblock.totalInodes = this.inodes.length;

    logs.push(`[fsck.aether] Phase 2: Metadata invariants verified. ${rolledBackCount} torn txn rolled back, ${replayedCount} replayed.`);
    logs.push('[fsck.aether] File system consistency restored. Superblock marked CLEAN. Remounted VFS.');
    return logs;
  }
}
