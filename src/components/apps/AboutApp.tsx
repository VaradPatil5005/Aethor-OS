import React from 'react';
import { Sparkles, Cpu, Layers, ShieldCheck, Terminal } from 'lucide-react';

export const AboutApp: React.FC = () => {
  return (
    <div className="h-full w-full text-black flex flex-col p-4 select-none font-pixel text-xs overflow-y-auto space-y-3 min-h-0 min-w-0 overscroll-contain bg-white">
      {/* Top Mac OS Header */}
      <div className="flex items-center gap-4 p-3 bg-[var(--rt-panel)] rt-raised">
        <img 
          src="/assets/icons/logo.webp" 
          alt="Apple" 
          className="w-12 h-12 object-contain drop-shadow" 
        />
        <div>
          <h1 className="text-base font-bold font-silkscreen text-black">AetherOS System 7</h1>
          <p className="text-slate-700 text-[12.5px]">Version 2.1 • AetherOS System 7 Edition</p>
          <p className="text-slate-500 font-terminal text-[14px]">Built by hand, one piece at a time.</p>
        </div>
      </div>

      {/* ReadMe Narrative Box */}
      <div className="bg-white p-3 space-y-2 font-terminal text-[17px] rt-sunken">
        <div className="font-bold text-black border-b pb-1 border-black/25">
          ReadMe.txt — System Sandbox
        </div>
        <p className="leading-relaxed text-slate-800">
          Welcome to Dash's machine. A sandbox operating system running entirely in your web browser.
        </p>
        <p className="leading-relaxed text-slate-800">
          This system contains dual-core scheduling, virtual memory paging, deadlock graphs, and hidden functions waiting to be discovered.
        </p>
        <p className="text-black font-bold">
          Tip: Curiosity will reveal more than instructions ever could.
        </p>
      </div>

      {/* 4 Feature Subsystems */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 bg-[var(--rt-panel)] rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          <div className="font-bold flex items-center gap-1 text-black">
            <Cpu className="w-3.5 h-3.5" />
            <span>Dual-Core Sched</span>
          </div>
          <p className="text-slate-600 mt-0.5 text-[12px]">MLFQ 3-queue aging, Round Robin, SRTF, and FCFS.</p>
        </div>

        <div className="p-2.5 bg-[var(--rt-panel)] rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          <div className="font-bold flex items-center gap-1 text-emerald-900">
            <Layers className="w-3.5 h-3.5" />
            <span>Memory MMU</span>
          </div>
          <p className="text-slate-600 mt-0.5 text-[12px]">32-frame physical RAM matrix with LRU & FIFO fault eviction.</p>
        </div>

        <div className="p-2.5 bg-[var(--rt-panel)] rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          <div className="font-bold flex items-center gap-1 text-amber-900">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Deadlock Lab</span>
          </div>
          <p className="text-slate-600 mt-0.5 text-[12px]">Wait-For Graph cycle detection & Banker's algorithm matrices.</p>
        </div>

        <div className="p-2.5 bg-[var(--rt-panel)] rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
          <div className="font-bold flex items-center gap-1 text-black">
            <Terminal className="w-3.5 h-3.5" />
            <span>Inode VFS</span>
          </div>
          <p className="text-slate-600 mt-0.5 text-[12px]">Hierarchical block storage with POSIX shell and Finder.</p>
        </div>
      </div>
    </div>
  );
};
