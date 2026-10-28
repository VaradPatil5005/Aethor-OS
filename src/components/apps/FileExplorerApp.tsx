import React, { useState } from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { retroAudio } from '../../utils/audio';
import { Folder, ArrowLeft, Plus, HardDrive, Monitor, ZapOff, RefreshCw, ShieldCheck, AlertTriangle, ScrollText } from 'lucide-react';
import type { Inode } from '../../types/kernel';
import { globalKernel } from '../../kernel/Kernel';

const PLACES = [
  { id: 'root', label: 'Root (/)', icon: HardDrive, cmds: ['cd /'] },
  { id: 'user', label: 'User space', icon: Monitor, cmds: ['cd /', 'cd user'] },
  { id: 'etc', label: 'Config (etc)', icon: Folder, cmds: ['cd /', 'cd etc'] },
];

const WAL_STATE: Record<string, string> = {
  CHECKPOINTED: 'bg-[var(--rt-min)] text-black',
  COMMITTED: 'bg-[#7ec8ff] text-black',
};

/** A slim title strip with a Retrium close dot, used by the bottom drawers and the dialog. */
const Strip: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div className="shrink-0 h-8 px-2 flex items-center justify-between gap-2 bg-[#333] text-white text-[13px]">
    <span className="truncate">{title}</span>
    <button type="button" className="rt-ctrl rt-ctrl-close" onClick={onClose} aria-label={`Close ${title}`}>x</button>
  </div>
);

export const FileExplorerApp: React.FC = () => {
  const { vfsInodes, executeTerminalCommand, currentVfsPath, superblock, journalLog, triggerPowerCut, recoverFSCK } = useKernelStore();

  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string; size: number } | null>(null);
  const [selectedInode, setSelectedInode] = useState<number | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [showJournal, setShowJournal] = useState(false);
  const [recoveryLogs, setRecoveryLogs] = useState<string[] | null>(null);

  // vfsInodes is the whole filesystem; show only the current folder's children.
  // (currentVfsPath changes on every cd, which re-renders this component.)
  const children = vfsInodes.filter((i) => i.parentId === globalKernel.vfs.currentDirId);

  // Highlight follows the real path, so it stays right after cd from the terminal too.
  const place = currentVfsPath === '/' ? 'root' : currentVfsPath.startsWith('/user') ? 'user' : currentVfsPath.startsWith('/etc') ? 'etc' : null;

  const go = (_id: string, cmds: string[]) => {
    retroAudio.playClickSound();
    cmds.forEach((c) => executeTerminalCommand(c));
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    retroAudio.playClickSound();
    executeTerminalCommand(`touch ${newFileName.trim()}`);
    setNewFileName('');
  };

  const openItem = (inode: Inode) => {
    retroAudio.playClickSound();
    if (inode.type === 'directory') {
      executeTerminalCommand(`cd ${inode.name}`);
      setSelectedInode(null);
    } else {
      setSelectedFile({ name: inode.name, content: inode.content || '(empty file)', size: inode.sizeBytes });
    }
  };

  const runFsck = () => {
    retroAudio.playClickSound();
    setRecoveryLogs(recoverFSCK());
  };

  return (
    <div className="h-full w-full flex relative min-h-0 min-w-0 bg-white font-pixel text-[13px]">
      {/* Sidebar */}
      <aside className="w-44 shrink-0 flex flex-col gap-3 p-2 overflow-y-auto bg-[var(--rt-side)] border-r-2 border-black">
        <nav className="space-y-1" aria-label="Places">
          {PLACES.map(({ id, label, icon: Icon, cmds }) => (
            <button
              key={id}
              onClick={() => go(id, cmds)}
              className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-1.5 font-bold rt-row ${place === id ? 'is-active' : ''}`}
            >
              <Icon className="w-4 h-4 shrink-0" /> <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        <section className="bg-white rt-sunken p-2 space-y-0.5 font-terminal text-[17px] leading-tight">
          <div className="flex items-center justify-between gap-1 font-pixel font-bold text-[12px]">
            <span>Superblock</span>
            <span className={`px-1 border-2 border-black ${superblock.isClean ? 'bg-[var(--rt-min)]' : 'bg-[var(--rt-close)] animate-pulse'}`}>
              {superblock.isClean ? 'CLEAN' : 'DIRTY'}
            </span>
          </div>
          <div>Mount: {superblock.mounted ? 'online' : 'unmounted'}</div>
          <div>Inodes: {vfsInodes.length} / 64</div>
          <div>WAL entries: {journalLog.length}</div>
          <button onClick={() => setShowJournal((v) => !v)} className="rt-btn rt-btn-sm w-full !mt-1.5">
            <ScrollText className="w-3.5 h-3.5" /> {showJournal ? 'Hide WAL log' : 'View WAL ring'}
          </button>
        </section>

        <section className="space-y-2">
          <div className="font-bold text-[12px]">Crash consistency</div>
          <button onClick={() => { retroAudio.playClickSound(); triggerPowerCut(); }} className="rt-btn rt-btn-sm w-full !bg-[var(--rt-close)] hover:!bg-black" title="Interrupt the active transaction and crash the disk">
            <ZapOff className="w-3.5 h-3.5" /> Power cut
          </button>
          <button onClick={runFsck} className="rt-btn rt-btn-sm w-full !bg-[var(--rt-min)] hover:!bg-black" title="Replay the journal and clean uncommitted blocks">
            <RefreshCw className="w-3.5 h-3.5" /> Run fsck
          </button>
        </section>
      </aside>

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!superblock.isClean && (
          <div className="shrink-0 bg-[var(--rt-close)] border-b-2 border-black px-3 py-1.5 flex items-center justify-between gap-2" role="alert">
            <span className="flex items-center gap-2 font-bold"><AlertTriangle className="w-4 h-4 shrink-0" /> Crash detected: dirty WAL blocks</span>
            <button onClick={runFsck} className="rt-btn rt-btn-sm">Recover</button>
          </div>
        )}

        <div className="shrink-0 p-2 border-b-2 border-black flex items-center gap-2 flex-wrap bg-[var(--rt-soft)]">
          <button onClick={() => { retroAudio.playClickSound(); executeTerminalCommand('cd ..'); }} className="rt-btn rt-btn-sm" title="Parent directory">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <span className="flex-1 min-w-[6rem] truncate bg-white border-2 border-black px-2 font-terminal text-[18px]" title={currentVfsPath}>
            {currentVfsPath}
          </span>
          <form onSubmit={handleCreateFile} className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="new_file.txt"
              aria-label="New file name"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              disabled={!superblock.mounted}
              className="w-28 px-2 font-terminal text-[18px] disabled:opacity-50"
            />
            <button type="submit" disabled={!superblock.mounted} className="rt-btn rt-btn-sm">
              <Plus className="w-3.5 h-3.5" /> Create
            </button>
          </form>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3" onClick={() => setSelectedInode(null)}>
          {!superblock.mounted ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-2 p-6">
              <ZapOff className="w-10 h-10" />
              <p className="font-bold text-[15px]">Disk unmounted after a power cut</p>
              <p className="font-terminal text-[18px] leading-tight max-w-sm text-[var(--rt-muted)]">
                Dirty transactions in the write-ahead log must be replayed before the disk can mount again.
              </p>
              <button onClick={runFsck} className="rt-btn">Run fsck recovery</button>
            </div>
          ) : children.length === 0 ? (
            <p className="text-center font-terminal text-[18px] text-[var(--rt-muted)] mt-6">This folder is empty.</p>
          ) : (
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
              {children.map((inode) => {
                const sel = selectedInode === inode.inodeNumber;
                return (
                  <button
                    key={inode.inodeNumber}
                    onClick={(e) => { e.stopPropagation(); setSelectedInode(inode.inodeNumber); }}
                    onDoubleClick={() => openItem(inode)}
                    onKeyDown={(e) => { if (e.key === 'Enter') openItem(inode); }}
                    className="flex flex-col items-center gap-1 px-1 py-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-black"
                    title={`${inode.name} · ${inode.sizeBytes} B · double-click to open`}
                  >
                    <img
                      src={inode.type === 'directory' ? '/assets/icons/folderIcon.webp' : '/assets/icons/TxtIcon.webp'}
                      alt=""
                      className="w-12 h-12 object-contain pointer-events-none"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <span className={`max-w-full px-1 truncate leading-tight ${sel ? 'bg-black text-white' : ''}`}>{inode.name}</span>
                    <span className="font-terminal text-[15px] leading-none text-[var(--rt-muted)]">{inode.sizeBytes} B</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedFile && (
          <section className="shrink-0 h-44 flex flex-col border-t-2 border-black">
            <Strip title={`${selectedFile.name} (${selectedFile.size} B)`} onClose={() => setSelectedFile(null)} />
            <pre className="flex-1 min-h-0 overflow-auto rt-dark-scroll p-2 bg-[#222] text-[#5af78e] whitespace-pre-wrap select-text font-terminal text-[18px] leading-tight">
              {selectedFile.content}
            </pre>
          </section>
        )}

        {showJournal && (
          <section className="shrink-0 h-48 flex flex-col border-t-2 border-black">
            <Strip title="Write-ahead log ring buffer" onClose={() => setShowJournal(false)} />
            <div className="flex-1 min-h-0 overflow-auto rt-dark-scroll bg-[#222] text-[#e0e0e0] font-terminal text-[17px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#333] text-[#bdbdbd]">
                  <tr><th className="px-2">TXN</th><th className="px-2">OP</th><th className="px-2">PATH</th><th className="px-2">STATE</th><th className="px-2">PAYLOAD</th></tr>
                </thead>
                <tbody>
                  {journalLog.map((j) => (
                    <tr key={j.txnId} className="border-b border-white/10">
                      <td className="px-2">#{j.txnId}</td>
                      <td className="px-2">{j.op}</td>
                      <td className="px-2">{j.path}</td>
                      <td className="px-2"><span className={`px-1 ${WAL_STATE[j.state] ?? 'bg-[var(--rt-max)] text-black'}`}>{j.state}</span></td>
                      <td className="px-2 truncate max-w-[140px] text-[#9a9a9a]">{j.payload ? JSON.stringify(j.payload) : ''}</td>
                    </tr>
                  ))}
                  {journalLog.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-[#9a9a9a]">Journal empty.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {recoveryLogs && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-label="fsck recovery">
          <div className="rt-window w-full max-w-md flex flex-col max-h-full">
            <Strip title="fsck: crash-consistency recovery" onClose={() => setRecoveryLogs(null)} />
            <div className="bg-white p-4 space-y-3 overflow-y-auto">
              <p className="flex items-center gap-1.5 font-bold"><ShieldCheck className="w-4 h-4" /> Journal replayed</p>
              <div className="bg-[#222] text-[#5af78e] p-2 max-h-48 overflow-y-auto rt-dark-scroll font-terminal text-[17px] leading-tight space-y-0.5">
                {recoveryLogs.map((log, i) => <div key={i}>{log}</div>)}
              </div>
              <div className="flex justify-end">
                <button onClick={() => setRecoveryLogs(null)} className="rt-btn">Done (remount)</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
