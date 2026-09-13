import React from 'react';
import { Sparkles, Cpu, Layers, ShieldCheck, Terminal } from 'lucide-react';

export const AboutApp: React.FC = () => {
  return (
    <div className="h-full w-full bg-[#cecece] text-black flex flex-col p-4 select-none font-pixel text-xs overflow-y-auto space-y-3 min-h-0 min-w-0 overscroll-contain">
      {/* Top Mac OS Header */}
      <div className="flex items-center gap-4 bg-[#dedede] border-2 border-t-white border-l-white border-r-black border-b-black p-3 shadow-[2px_2px_0px_rgba(0,0,0,0.3)]">
        <img 
          src="/assets/icons/logo.webp" 
          alt="Apple" 
          className="w-12 h-12 object-contain drop-shadow" 
        />
        <div>
          <h1 className="text-base font-bold font-silkscreen text-black">AetherOS System 7</h1>
          <p className="text-[11px] text-slate-700">Version 2.1 • AetherOS System 7 Edition</p>
          <p className="text-[10px] text-slate-500 font-mono">Built by hand, one piece at a time.</p>
        </div>
      </div>

      {/* ReadMe Narrative Box */}
      <div className="bg-white border-2 border-t-black border-l-black border-r-white border-b-white p-3 shadow-inner space-y-2 font-mono text-xs">
        <div className="font-bold text-black border-b border-[#ccc] pb-1">
          ReadMe.txt — System Sandbox
        </div>
        <p className="leading-relaxed text-slate-800">
          Welcome to Dash's machine. A sandbox operating system running entirely in your web browser.
        </p>
        <p className="leading-relaxed text-slate-800">
          This system contains dual-core scheduling, virtual memory paging, deadlock graphs, and hidden functions waiting to be discovered.
        </p>
        <p className="text-indigo-900 font-bold">
          Tip: Curiosity will reveal more than instructions ever could.
        </p>
      </div>

      {/* 4 Feature Subsystems */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 bg-[#dedede] border border-t-white border-l-white border-r-black border-b-black shadow-xs">
          <div className="font-bold flex items-center gap-1 text-indigo-900">
            <Cpu className="w-3.5 h-3.5" />
            <span>Dual-Core Sched</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5">MLFQ 3-queue aging, Round Robin, SRTF, and FCFS.</p>
        </div>

        <div className="p-2.5 bg-[#dedede] border border-t-white border-l-white border-r-black border-b-black shadow-xs">
          <div className="font-bold flex items-center gap-1 text-emerald-900">
            <Layers className="w-3.5 h-3.5" />
            <span>Memory MMU</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5">32-frame physical RAM matrix with LRU & FIFO fault eviction.</p>
        </div>

        <div className="p-2.5 bg-[#dedede] border border-t-white border-l-white border-r-black border-b-black shadow-xs">
          <div className="font-bold flex items-center gap-1 text-amber-900">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Deadlock Lab</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5">Wait-For Graph cycle detection & Banker's algorithm matrices.</p>
        </div>

        <div className="p-2.5 bg-[#dedede] border border-t-white border-l-white border-r-black border-b-black shadow-xs">
          <div className="font-bold flex items-center gap-1 text-cyan-900">
            <Terminal className="w-3.5 h-3.5" />
            <span>Inode VFS</span>
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5">Hierarchical block storage with POSIX shell and Finder.</p>
        </div>
      </div>
    </div>
  );
};
