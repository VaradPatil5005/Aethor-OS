import React, { useEffect, useRef } from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { retroAudio } from '../../utils/audio';
import { Activity, ShieldCheck, ShieldAlert, Cpu, Zap } from 'lucide-react';

const JOURNAL_COLOR: Record<string, string> = {
  GPF_FAULT: 'text-[#ff6b6b]',
  WORK_STEAL: 'text-[#febc2e]',
  POWER_CUT: 'text-[#ff6b6b]',
  FSCK_REPLAY: 'text-[#5af78e]',
};

const REGISTERS = ['eip', 'esp', 'cr3', 'eax', 'cs', 'eflags'] as const;

export const KernelMonitorApp: React.FC = () => {
  const { journal, lastGPF, triggerSimulatedGPF } = useKernelStore();
  const logRef = useRef<HTMLDivElement>(null);

  // Keep the log pinned to the newest entry unless the user scrolled up to read.
  useEffect(() => {
    const el = logRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 60) el.scrollTop = el.scrollHeight;
  }, [journal.length]);

  return (
    <div className="h-full w-full p-3 flex flex-col gap-3 overflow-y-auto min-h-0 min-w-0 bg-[var(--rt-panel)] font-pixel text-[13px]">
      <div className="flex items-center justify-between gap-2 flex-wrap bg-white rt-raised px-3 py-2">
        <span className="font-bold flex items-center gap-1.5">
          <Activity className="w-4 h-4" /> Kernel Invariants & Protection Rings
        </span>
        <span className="flex items-center gap-1 font-terminal text-[17px]">
          <ShieldCheck className="w-4 h-4 text-emerald-700" /> x86 rings active
        </span>
      </div>

      <section className="bg-white rt-raised p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-bold flex items-center gap-1.5">
            <Cpu className="w-4 h-4" /> Memory Segmentation
          </span>
          <button
            onClick={() => { retroAudio.playClickSound(); triggerSimulatedGPF(); }}
            className="rt-btn rt-btn-sm"
            style={{ background: 'var(--rt-close)' }}
          >
            <Zap className="w-3.5 h-3.5" /> Inject #GP violation
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { ring: 'RING 0 · Kernel', range: '0x0000 – 0x3FFF', text: 'Privileged: hardware control, page directory (CR3), interrupt vectors.' },
            { ring: 'RING 3 · User', range: '0x4000 – 0xFFFF', text: 'Isolated: touching an address below 0x4000 traps a General Protection Fault.' },
          ].map((r) => (
            <div key={r.ring} className="rt-sunken bg-[var(--rt-soft)] p-2 space-y-1">
              <div className="flex justify-between items-center gap-2 font-bold">
                <span>{r.ring}</span>
                <span className="font-terminal text-[16px] bg-black text-white px-1.5">{r.range}</span>
              </div>
              <p className="font-terminal text-[17px] leading-tight text-[var(--rt-muted)]">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      {lastGPF && (
        <section className="bg-[#ffe3e1] rt-raised p-3 space-y-2" role="alert">
          <div className="flex items-center justify-between gap-2 flex-wrap font-bold">
            <span className="flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-[#c0261b]" /> TRAP: General Protection Fault</span>
            <span className="font-terminal text-[17px] bg-black text-white px-2">PID #{lastGPF.pid} ({lastGPF.procName})</span>
          </div>
          <p className="font-terminal text-[18px] leading-tight">
            Dereferenced kernel address <b>{lastGPF.illegalAddress}</b> from <b>{lastGPF.ring}</b>.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center font-terminal">
            {REGISTERS.map((r) => (
              <div key={r} className="rt-sunken bg-white px-1 py-0.5">
                <div className="text-[14px] uppercase text-[var(--rt-muted)]">{r}</div>
                <div className="text-[16px] font-bold">{lastGPF[r]}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Audit journal: Retrium-terminal style, fills the rest of the window */}
      <section className="flex-1 min-h-[180px] flex flex-col rt-raised bg-[#222]">
        <div className="shrink-0 px-2 py-1 bg-[#333] text-white text-[12px] border-b-2 border-black">Kernel audit journal</div>
        <div ref={logRef} className="flex-1 min-h-0 overflow-y-auto rt-dark-scroll p-2 space-y-0.5 font-terminal text-[17px] leading-tight">
          {journal.length === 0 && <div className="text-[#8a8a8a]">(empty)</div>}
          {journal.map((j, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[#8a8a8a] shrink-0">[t:{j.tick}]</span>
              <span className={`shrink-0 ${JOURNAL_COLOR[j.type] ?? 'text-[#7ec8ff]'}`}>[{j.type}]</span>
              <span className="text-[#e0e0e0] flex-1 min-w-0 break-words">{j.message}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
