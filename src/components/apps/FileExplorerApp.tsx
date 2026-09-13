import React, { useState } from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { retroAudio } from '../../utils/audio';
import { 
  Folder, 
  FileText, 
  ArrowLeft, 
  Plus, 
  HardDrive, 
  Monitor, 
  ZapOff, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle,
  ScrollText,
  CheckCircle2
} from 'lucide-react';

export const FileExplorerApp: React.FC = () => {
  const { 
    vfsInodes, 
    executeTerminalCommand, 
    currentVfsPath, 
    superblock, 
    journalLog, 
    triggerPowerCut, 
    recoverFSCK 
  } = useKernelStore();

  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string; size: number } | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [sidebarLocation, setSidebarLocation] = useState<string>('root');
  const [showJournalDrawer, setShowJournalDrawer] = useState<boolean>(false);
  const [recoveryLogs, setRecoveryLogs] = useState<string[] | null>(null);

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    retroAudio.playClickSound();
    executeTerminalCommand(`touch ${newFileName.trim()}`);
    setNewFileName('');
  };

  const handleItemClick = (inode: any) => {
    retroAudio.playClickSound();
    if (inode.type === 'directory') {
      executeTerminalCommand(`cd ${inode.name}`);
    } else {
      setSelectedFile({
        name: inode.name,
        content: inode.content || '(Empty file payload)',
        size: inode.sizeBytes
      });
    }
  };

  const handlePowerCut = () => {
    retroAudio.playClickSound();
    triggerPowerCut();
  };

  const handleRunFsck = () => {
    retroAudio.playClickSound();
    const logs = recoverFSCK();
    setRecoveryLogs(logs);
  };

  return (
    <div className="h-full w-full bg-[#cecece] text-black flex font-pixel select-none overflow-hidden text-xs relative min-h-0 min-w-0">
      {/* Finder Left Sidebar */}
      <div className="w-44 bg-[#dedede] border-r-2 border-[#888] flex flex-col p-2 space-y-3 shrink-0">
        <div>
          <div className="text-[10px] font-bold text-[#666] tracking-wider uppercase mb-1">
            Favorites
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => { retroAudio.playClickSound(); executeTerminalCommand('cd /'); setSidebarLocation('root'); }}
              className={`w-full text-left px-2 py-1 rounded-sm flex items-center gap-1.5 font-bold ${
                sidebarLocation === 'root' ? 'bg-[#181a24] text-white' : 'hover:bg-[#eaeaea] text-black'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Root (/)</span>
            </button>
            <button
              onClick={() => { retroAudio.playClickSound(); executeTerminalCommand('cd user'); setSidebarLocation('user'); }}
              className={`w-full text-left px-2 py-1 rounded-sm flex items-center gap-1.5 font-bold ${
                sidebarLocation === 'user' ? 'bg-[#181a24] text-white' : 'hover:bg-[#eaeaea] text-black'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>User Space</span>
            </button>
            <button
              onClick={() => { retroAudio.playClickSound(); executeTerminalCommand('cd etc'); setSidebarLocation('etc'); }}
              className={`w-full text-left px-2 py-1 rounded-sm flex items-center gap-1.5 font-bold ${
                sidebarLocation === 'etc' ? 'bg-[#181a24] text-white' : 'hover:bg-[#eaeaea] text-black'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Config (etc)</span>
            </button>
          </div>
        </div>

        {/* Superblock WAL Metadata Status */}
        <div className="p-2 bg-[#cecece] border border-t-white border-l-white border-r-[#888] border-b-[#888] text-[10px] text-slate-800 space-y-1">
          <div className="font-bold text-black flex items-center justify-between">
            <span>Superblock:</span>
            <span className={`px-1 rounded-xs text-[9px] font-bold ${
              superblock.isClean ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900 animate-pulse'
            }`}>
              {superblock.isClean ? 'CLEAN' : 'DIRTY / CRASH'}
            </span>
          </div>
          <div>Mount: {superblock.mounted ? 'ONLINE' : 'UNMOUNTED'}</div>
          <div>Inodes: {vfsInodes.length} / 64</div>
          <div>WAL Entries: {journalLog.length}</div>
          <button
            onClick={() => setShowJournalDrawer(!showJournalDrawer)}
            className="w-full mt-1 px-1.5 py-0.5 bg-white hover:bg-slate-100 border border-black font-bold text-[9px] flex items-center justify-center gap-1 cursor-pointer"
          >
            <ScrollText className="w-3 h-3 text-indigo-700" />
            <span>{showJournalDrawer ? 'Hide WAL Log' : 'View WAL Ring'}</span>
          </button>
        </div>

        {/* Crash Consistency Simulation Controls */}
        <div className="p-2 bg-[#dfdfdf] border border-[#888] space-y-1.5">
          <div className="text-[10px] font-bold text-slate-800">Crash Consistency:</div>
          <button
            onClick={handlePowerCut}
            className="w-full px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] border border-black rounded-xs flex items-center justify-center gap-1 cursor-pointer active:translate-y-0.5"
            title="Interrupt active transaction and crash disk"
          >
            <ZapOff className="w-3 h-3" />
            <span>Simulate Power Cut</span>
          </button>

          <button
            onClick={handleRunFsck}
            className="w-full px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] border border-black rounded-xs flex items-center justify-center gap-1 cursor-pointer active:translate-y-0.5"
            title="Replay journal and clean uncommitted blocks"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Run fsck Recovery</span>
          </button>
        </div>
      </div>

      {/* Main Finder Area */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Crash Warning Banner if dirty */}
        {!superblock.isClean && (
          <div className="bg-rose-600 text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold animate-pulse">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>CRASH DETECTED: Storage unmounted with dirty uncommitted WAL blocks!</span>
            </div>
            <button
              onClick={handleRunFsck}
              className="bg-white text-rose-900 px-2 py-0.5 rounded-xs hover:bg-rose-100 text-[10px] font-bold"
            >
              Recover with fsck
            </button>
          </div>
        )}

        {/* Top Path & Controls */}
        <div className="p-2 bg-[#dfdfdf] border-b border-[#888] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-1 truncate">
            <button 
              onClick={() => { retroAudio.playClickSound(); executeTerminalCommand('cd ..'); }}
              className="px-2 py-0.5 bg-[#dedede] border border-t-white border-l-white border-r-black border-b-black active:border-t-black active:border-l-black active:border-r-white active:border-b-white font-bold flex items-center gap-1"
              title="Parent directory"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back</span>
            </button>
            <span className="font-mono text-xs font-bold text-slate-700 truncate bg-white px-2 py-0.5 border border-[#999] rounded-sm">
              {currentVfsPath}
            </span>
          </div>

          <form onSubmit={handleCreateFile} className="flex items-center gap-1">
            <input
              type="text"
              placeholder="new_file.txt"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              disabled={!superblock.mounted}
              className="px-2 py-0.5 bg-white border border-[#888] rounded-sm text-black font-mono text-xs outline-none w-28 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!superblock.mounted}
              className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold border border-black rounded-sm flex items-center gap-0.5 active:translate-y-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Create (WAL)</span>
            </button>
          </form>
        </div>

        {/* Inode Files Grid */}
        <div className="flex-1 overflow-auto p-4 bg-[#f8f9fc]">
          {!superblock.mounted ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <ZapOff className="w-10 h-10 text-rose-500 mb-2" />
              <p className="font-bold text-slate-800 text-sm">VFS Unmounted Due to Sudden Power Cut</p>
              <p className="text-xs text-slate-600 mt-1 max-w-sm">
                Dirty transactions in the Write-Ahead Log must be resolved by the recovery daemon before mounting.
              </p>
              <button
                onClick={handleRunFsck}
                className="mt-3 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-sm border border-black shadow"
              >
                Run fsck Recovery Daemon
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {vfsInodes.map((inode) => (
                <div
                  key={inode.inodeNumber}
                  onDoubleClick={() => handleItemClick(inode)}
                  onClick={() => handleItemClick(inode)}
                  className="p-2 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-400 rounded-sm flex flex-col items-center justify-center cursor-pointer transition text-center shadow-sm group"
                >
                  <div className="mb-1 text-2xl group-hover:scale-105 transition">
                    {inode.type === 'directory' ? '??' : '??'}
                  </div>
                  <span className="font-bold text-slate-800 text-xs truncate w-full">
                    {inode.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {inode.sizeBytes} B
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected File Viewer Modal */}
        {selectedFile && (
          <div className="h-44 bg-[#181a24] text-slate-100 border-t-2 border-black flex flex-col">
            <div className="p-1.5 bg-[#cecece] text-black border-b border-black flex items-center justify-between font-bold text-xs">
              <span>Reading: {selectedFile.name} ({selectedFile.size} Bytes)</span>
              <button 
                onClick={() => setSelectedFile(null)}
                className="px-1.5 py-0.5 bg-[#dedede] border border-black hover:bg-black hover:text-white"
              >
                Close
              </button>
            </div>
            <pre className="flex-1 p-2 font-mono text-xs overflow-auto text-emerald-400 bg-[#111218] select-text whitespace-pre-wrap">
              {selectedFile.content}
            </pre>
          </div>
        )}

        {/* WAL Journal Log Ring Buffer Drawer */}
        {showJournalDrawer && (
          <div className="h-48 bg-[#181a24] text-white border-t-2 border-black flex flex-col font-mono text-xs">
            <div className="p-1.5 bg-[#cecece] text-black border-b border-black flex items-center justify-between font-bold">
              <span>Ext4/XFS Write-Ahead Log (WAL) Ring Buffer</span>
              <button onClick={() => setShowJournalDrawer(false)} className="px-1.5 py-0.2 bg-[#dedede] border border-black hover:bg-rose-600 hover:text-white">?</button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              <table className="w-full text-left text-[11px]">
                <thead className="text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="pb-1">TXN</th>
                    <th className="pb-1">OP</th>
                    <th className="pb-1">PATH</th>
                    <th className="pb-1">STATE</th>
                    <th className="pb-1">PAYLOAD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {journalLog.map((j) => (
                    <tr key={j.txnId} className="hover:bg-slate-800/50">
                      <td className="py-1 font-bold text-indigo-400">#{j.txnId}</td>
                      <td className="py-1">{j.op}</td>
                      <td className="py-1 text-slate-300">{j.path}</td>
                      <td className="py-1">
                        <span className={`px-1 py-0.2 rounded-xs text-[9px] font-bold ${
                          j.state === 'CHECKPOINTED' ? 'bg-emerald-900 text-emerald-200' :
                          j.state === 'COMMITTED' ? 'bg-blue-900 text-blue-200' : 'bg-amber-900 text-amber-200'
                        }`}>
                          {j.state}
                        </span>
                      </td>
                      <td className="py-1 text-slate-400 truncate max-w-[120px]">
                        {j.payload ? JSON.stringify(j.payload) : ''}
                      </td>
                    </tr>
                  ))}
                  {journalLog.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-500">
                        Journal ring buffer empty.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* fsck Recovery Modal Dialog */}
        {recoveryLogs && (
          <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#dfdfdf] border-2 border-t-white border-l-white border-r-black border-b-black shadow-[6px_6px_0px_rgba(0,0,0,0.8)] p-4 text-black font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-400 pb-1.5 mb-2 font-bold font-pixel">
                <span className="flex items-center gap-1.5 text-emerald-800">
                  <ShieldCheck className="w-4 h-4" /> fsck.aether Crash Consistency Recovery
                </span>
                <button 
                  onClick={() => setRecoveryLogs(null)}
                  className="hover:text-rose-600 font-bold"
                >
                  ?
                </button>
              </div>

              <div className="bg-[#111218] p-3 text-emerald-400 space-y-1 max-h-48 overflow-y-auto mb-3 rounded-xs">
                {recoveryLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">{log}</div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setRecoveryLogs(null)}
                  className="px-4 py-1 bg-[#3b82f6] hover:bg-blue-600 text-white font-bold border border-black cursor-pointer font-pixel text-xs"
                >
                  Done (Remount VFS)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
