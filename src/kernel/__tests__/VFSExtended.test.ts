import { describe, it, expect, beforeEach } from 'vitest';
import { VFS } from '../VFS';

describe('VFS Inode Subsystem Extended Tests', () => {
  let vfs: VFS;

  beforeEach(() => {
    vfs = new VFS();
  });

  it('creates directory, touches file, writes and reads content accurately', () => {
    const dirCreated = vfs.createDirectory('lab_docs');
    expect(dirCreated).toBe(true);
    vfs.changeDirectory('lab_docs');

    const fileCreated = vfs.createFile('report.txt', 'AetherOS Kernel Verification Protocol');
    expect(fileCreated).toBe(true);

    const content = vfs.readFile('report.txt');
    expect(content).toBe('AetherOS Kernel Verification Protocol');
  });

  it('preserves parent-child inode links and resolves relative paths', () => {
    vfs.createDirectory('sys');
    vfs.changeDirectory('sys');
    expect(vfs.getCurrentPath()).toContain('sys');

    vfs.createFile('kernel.conf', 'CORES=2\nRAM=128KB');
    expect(vfs.readFile('kernel.conf')).toBe('CORES=2\nRAM=128KB');

    vfs.changeDirectory('..');
    expect(vfs.getCurrentPath()).toBe('/user');
  });

  it('handles file deletion and frees inode registry entry', () => {
    vfs.createFile('temp.log', 'temporary data');
    const beforeCount = vfs.inodes.length;
    const removed = vfs.removeNode('temp.log');
    expect(removed).toBe(true);
    expect(vfs.inodes.length).toBe(beforeCount - 1);
  });
});
