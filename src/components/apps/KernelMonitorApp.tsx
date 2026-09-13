import React from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { retroAudio } from '../../utils/audio';
import { Activity, ShieldCheck, ShieldAlert, Cpu, AlertTriangle, Terminal, Zap } from 'lucide-react';

export const KernelMonitorApp: React.FC = () => {
  const { journal, stats, lastGPF, triggerSimulatedGPF } = useKernelStore();

  const handleInjectGPF = () => {
    retroAudio.playClickSound();
    triggerSimulatedGPF();
  };

  return (
    <div className="h-full w-full p-4 space-y-3 text-xs font-mono select-none overflow-y-auto bg-[#0a0d14] text-slate-200 font-pixel min-h-0 min-w-0 overscroll-contain">
      {/* Top Privilege Invariant Header */}
      <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded border border-slate-800">
        <span className="font-bold text-slate-200 flex items-center gap-1.5 font-sans">
          <Activity className="w-4 h-4 text-indigo-400" /> Kernel Invariant & Hardware Protection Rings
        </span>
        <span className="text-emerald-400 flex items-center gap-1 font-sans text-xs">
          <ShieldCheck className="w-4 h-4" /> x86 Protection Rings: Active
        </span>
      </div>

      {/* Dual-Mode Memory Space Segmentation */}
      <div className="bg-slate-900/80 border border-slate-800 p-3 rounded space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-300 flex items-center gap-1 font-sans">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Memory Segmentation & Protection Rings
          </span>
          <button
            onClick={handleInjectGPF}
            className="px-2.5 py-1 bg-rose-600/90 hover:bg-rose-500 text-white font-bold rounded-sm border border-rose-400 text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Zap className="w-3 h-3" />
            <span>Inject Privilege Violation (#GP)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
            <div className="flex justify-between items-center text-indigo-400 font-bold">
              <span>RING 0 (Supervisor / Kernel)</span>
              <span className="text-[10px] bg-indigo-950 text-indigo-300 px-1.5 rounded">0x0000 - 0x3FFF</span>
            </div>
            <p className="text-slate-400 text-[10px] font-sans">
              Privileged execution: Direct hardware control, page directory CR3, and interrupt vectors.
            </p>
          </div>

          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1">
            <div className="flex justify-between items-center text-emerald-400 font-bold">
              <span>RING 3 (User Space / Applications)</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 rounded">0x4000 - 0xFFFF</span>
            </div>
            <p className="text-slate-400 text-[10px] font-sans">
              Restricted isolation: Direct dereference of &lt; 0x4000 traps General Protection Fault (#GP).
            </p>
          </div>
        </div>
      </div>

      {/* General Protection Fault (GPF) CPU Register Dump */}
      {lastGPF && (
        <div className="bg-rose-950/40 border-2 border-rose-600/80 p-3 rounded space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-rose-400 font-bold font-sans">
            <span className="flex items-center gap-1.5 text-xs">
              <ShieldAlert className="w-4 h-4" /> TRAP: General Protection Fault (#GP / SIGSEGV)
            </span>
            <span className="text-[10px] bg-rose-900 text-white px-2 py-0.5 rounded font-mono">
              PID #{lastGPF.pid} ({lastGPF.procName})
            </span>
          </div>

          <div className="text-[11px] text-slate-300 font-sans leading-relaxed">
            Process attempted unauthorized pointer dereference of kernel reserved address <span className="text-rose-300 font-mono font-bold">{lastGPF.illegalAddress}</span> from <span className="text-amber-300 font-mono font-bold">{lastGPF.ring}</span>.
          </div>

          {/* x86 Hardware Register Dump Table */}
          <div className="bg-black/90 p-2.5 rounded border border-rose-900/60 font-mono text-[10px] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center">
            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block">EIP</span>
              <span className="text-cyan-400 font-bold">{lastGPF.eip}</span>
            </div>
            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block">ESP</span>
              <span className="text-indigo-400 font-bold">{lastGPF.esp}</span>
            </div>
            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block">CR3</span>
              <span className="text-emerald-400 font-bold">{lastGPF.cr3}</span>
            </div>
            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block">EAX</span>
              <span className="text-amber-400 font-bold">{lastGPF.eax}</span>
            </div>
            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block">CS</span>
              <span className="text-purple-400 font-bold">{lastGPF.cs}</span>
            </div>
            <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
              <span className="text-slate-500 block">EFLAGS</span>
              <span className="text-rose-400 font-bold">{lastGPF.eflags}</span>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Kernel Audit Journal Log */}
      <div className="bg-slate-950 p-3 rounded border border-slate-800 h-52 overflow-y-auto space-y-1.5">
        <span className="text-slate-500 block mb-2 font-sans font-semibold text-xs">
          Kernel Audit Journal & Hardware Trace:
        </span>
        {journal.map((j, i) => (
          <div key={i} className="flex items-start gap-2 text-slate-300 text-[11px]">
            <span className="text-slate-500 shrink-0">[t:{j.tick}]</span>
            <span className={`font-bold shrink-0 ${
              j.type === 'GPF_FAULT' ? 'text-rose-400' :
              j.type === 'WORK_STEAL' ? 'text-amber-400' :
              j.type === 'POWER_CUT' ? 'text-rose-500' :
              j.type === 'FSCK_REPLAY' ? 'text-emerald-400' : 'text-indigo-400'
            }`}>
              [{j.type}]
            </span>
            <span className="text-slate-200 flex-1">{j.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
