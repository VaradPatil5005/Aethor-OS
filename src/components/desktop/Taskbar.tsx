import React from 'react';
import { useWindowStore, AppId } from '../../stores/useWindowStore';
import { useKernelStore } from '../../stores/useKernelStore';
import { Cpu, Layers, ShieldAlert, Terminal, Folder, Trophy, Activity, Info, Clock, Play, Pause } from 'lucide-react';

export const Taskbar: React.FC = () => {
  const { windows, open, focus, activeId } = useWindowStore();
  const { stats, isPaused, togglePause } = useKernelStore();

  const appIcons: { id: AppId; label: string; icon: React.ReactNode }[] = [
    { id: 'task_manager', label: 'CPU Scheduler', icon: <Cpu className="w-5 h-5 text-indigo-400" /> },
    { id: 'memory_map', label: 'Memory Map', icon: <Layers className="w-5 h-5 text-emerald-400" /> },
    { id: 'deadlock_lab', label: 'Deadlock Lab', icon: <ShieldAlert className="w-5 h-5 text-amber-400" /> },
    { id: 'terminal', label: 'Terminal CLI', icon: <Terminal className="w-5 h-5 text-cyan-400" /> },
    { id: 'file_explorer', label: 'VFS Inodes', icon: <Folder className="w-5 h-5 text-yellow-400" /> },
    { id: 'kernel_monitor', label: 'Kernel Monitor', icon: <Activity className="w-5 h-5 text-rose-400" /> },
    { id: 'kernel_quest', label: 'KernelQuest', icon: <Trophy className="w-5 h-5 text-purple-400" /> },
    { id: 'about', label: 'About', icon: <Info className="w-5 h-5 text-slate-400" /> }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-12 bg-slate-900/90 border-t border-slate-700/80 backdrop-blur-md flex items-center justify-between px-3 z-50 select-none">
      <div className="flex items-center gap-2">
        <button onClick={() => open('about')} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 font-bold text-xs transition">
          <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span>AetherOS</span>
        </button>
      </div>

      <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
        {appIcons.map(({ id, label, icon }) => {
          const win = windows[id];
          const isOpen = win && win.isOpen;
          const isActive = activeId === id && isOpen && !win.isMinimized;

          return (
            <button
              key={id}
              onClick={() => {
                if (isOpen && !win.isMinimized && activeId === id) {}
                else if (isOpen) focus(id);
                else open(id);
              }}
              title={label}
              className={`relative p-2 rounded-lg flex items-center justify-center transition-all ${
                isActive ? 'bg-slate-800 shadow-inner border border-indigo-500/50 scale-105' : isOpen ? 'bg-slate-850 hover:bg-slate-800' : 'hover:bg-slate-800/60'
              }`}
            >
              {icon}
              {isOpen && <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isActive ? 'bg-indigo-400' : 'bg-slate-500'}`} />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-300 font-mono">
        <button onClick={togglePause} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
          {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
        </button>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-indigo-400" /> Tick {stats.tick}
        </span>
      </div>
    </div>
  );
};
