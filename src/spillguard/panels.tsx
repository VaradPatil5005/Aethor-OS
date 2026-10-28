// Live/Replay panels embedded in existing AetherOS apps, so each textbook concept
// shows its real-hardware counterpart next to the simulation.
import React, { useState } from 'react';
import { useSpillStore } from '../stores/useSpillStore';
import { useWindowStore } from '../stores/useWindowStore';
import { vramAdmission } from './admission';
import { bevelIn, bevelOut, EventLog, fmtMB, ModeSwitch, TierBar, TierLegend } from './components';

const PALETTE = ['#4f46e5', '#0891b2', '#7c3aed', '#0d9488', '#2563eb', '#9333ea', '#0369a1', '#4338ca'];

const NoData: React.FC<{ what: string }> = ({ what }) => {
  const open = useWindowStore((s) => s.open);
  return (
    <div className="text-slate-600 space-y-1 font-terminal text-[15px]">
      <div>{what} Choose a data source:</div>
      <ModeSwitch />
      <button onClick={() => open('spillguard')} className="underline text-black">Open SpillGuard</button>
    </div>
  );
};

/** Memory Map twin view: simulated page frames above, real VRAM residency here. */
export const VramTwinPanel: React.FC = () => {
  const { latest, mode } = useSpillStore();
  return (
    <div className={`${bevelOut} p-3 space-y-2`}>
      <div className="flex justify-between items-center flex-wrap gap-1 font-bold text-slate-800 text-[12.5px]">
        <span>Twin view · real GPU memory ({mode === 'simulated' ? 'off' : mode})</span>
        {latest && <TierLegend />}
      </div>
      {!latest || mode === 'simulated' ? <NoData what="Show your GPU's real VRAM residency next to the simulated frames." /> : (() => {
        const V = latest.adapter.vram_total_mb;
        const procs = latest.procs.filter((p) => p.dedicated_mb > 0);
        const used = procs.reduce((s, p) => s + p.dedicated_mb, 0);
        return (
          <>
            <div className={`${bevelIn} p-2 space-y-1`}>
              <div className="text-slate-600 font-terminal text-[14px]">VRAM = physical frames · {fmtMB(V)} on {latest.adapter.name}</div>
              <div className="h-6 flex border border-black/50 bg-[var(--rt-side)]" role="img" aria-label={`VRAM ${Math.round(100 * latest.adapter.load)}% resident`}>
                {procs.map((p, i) => (
                  <div key={p.pid} title={`${p.name} · ${fmtMB(p.dedicated_mb)}`}
                    style={{ width: `${(100 * p.dedicated_mb) / V}%`, background: PALETTE[i % PALETTE.length] }}
                    className="border-r border-white/60" />
                ))}
                <div style={{ width: `${Math.max(0, (100 * (V - used)) / V)}%` }} />
              </div>
              <div className="text-slate-600 mt-1 font-terminal text-[14px]">Shared system RAM = backing store · spilled pages live here</div>
              <div className="h-4 flex border border-black/50 bg-[var(--rt-side)]">
                {latest.procs.filter((p) => p.state === 'SPILLING').map((p) => (
                  <div key={p.pid} title={`${p.name} spilled ${fmtMB(p.spill_mb)}`} style={{ width: `${(100 * p.spill_mb) / V}%`, background: '#e11d48' }} />
                ))}
              </div>
            </div>
            <div className={`${bevelIn} p-2 space-y-1`}>
              {latest.procs.slice(0, 6).map((p) => <TierBar key={p.pid} p={p} scaleMb={Math.max(V, ...latest.procs.map((q) => q.dedicated_mb + q.shared_mb))} />)}
            </div>
            <p className="leading-snug text-slate-700 text-[12.5px]">
              Same idea, real hardware: when a process's working set exceeds the frames available, the OS keeps it
              running by paging to a slower tier. Here Windows' video memory manager pages GPU allocations from VRAM
              into system RAM over PCIe — the app keeps running, but every access to a spilled page is ~12× slower
              (measured on an RTX 3050). That is Denning's thrashing, on a GPU.
            </p>
          </>
        );
      })()}
    </div>
  );
};

/** BPF Studio: the real event stream from SpillGuard, next to the simulated probes. */
export const SpillEventsPanel: React.FC = () => {
  const { latest, events, mode } = useSpillStore();
  return (
    <div className="space-y-1">
      <div className="font-bold text-[12.5px]">Real host events · SpillGuard ({mode})</div>
      {!latest || mode === 'simulated'
        ? <NoData what="Stream real SPILL_START / SPILL_END / OFFLOAD_SPLIT events from Windows." />
        : <div className={`${bevelIn} p-2 max-h-40 overflow-y-auto`}><EventLog events={events} max={30} /></div>}
    </div>
  );
};

/** Deadlock Lab: Banker's matrices filled with real VRAM Allocation / Max / Available. */
export const LiveBankersPanel: React.FC = () => {
  const { latest, peaks, mode } = useSpillStore();
  const [claim, setClaim] = useState(3072);
  if (!latest || mode === 'simulated') {
    return <div className={`${bevelOut} p-3`}><div className="font-bold mb-1 text-[12.5px]">Banker's algorithm on real VRAM</div>
      <NoData what="Fill the matrices with your GPU's real allocations." /></div>;
  }
  const a = vramAdmission(latest, peaks, claim);
  const { scenario, classic } = a;
  return (
    <div className={`${bevelOut} p-3 space-y-2 text-[12.5px]`}>
      <div className="font-bold">Banker's algorithm on real VRAM ({mode})</div>
      <label className="flex items-center gap-2 font-terminal text-[1.3em]">
        <span>Run Safety Check for a new launch claiming</span>
        <input type="range" min={256} max={latest.adapter.vram_total_mb} step={128} value={claim}
          onChange={(e) => setClaim(Number(e.target.value))} className="flex-1" aria-label="New launch VRAM claim" />
        <b className="w-16 text-right">{fmtMB(claim)}</b>
      </label>
      <div className={`${bevelIn} overflow-x-auto`}>
        <table className="w-full font-terminal text-[15px]">
          <thead><tr className="text-left bg-slate-200"><th className="px-1">Process</th><th className="px-1 text-right">Allocation</th><th className="px-1 text-right">Max</th><th className="px-1 text-right">Need</th></tr></thead>
          <tbody>
            {scenario.processNames.map((n, i) => (
              <tr key={n} className={i === scenario.processNames.length - 1 ? 'font-bold text-black' : ''}>
                <td className="px-1 truncate max-w-[12rem]">{n}</td>
                <td className="px-1 text-right">{scenario.allocation[i][0]}</td>
                <td className="px-1 text-right">{scenario.maximum[i][0]}</td>
                <td className="px-1 text-right">{classic.need[i][0]}</td>
              </tr>
            ))}
            <tr className="border-t border-black"><td className="px-1">Available (VRAM − 256 MB margin − Σ alloc)</td><td className="px-1 text-right" colSpan={3}>{scenario.available[0]} MB</td></tr>
          </tbody>
        </table>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 font-terminal text-[1.3em]">
        <div className={`${bevelIn} p-2`}>
          <div className="font-bold">Textbook Banker's</div>
          <div className={classic.isSafe ? 'text-emerald-700' : 'text-rose-700'}>{classic.isSafe ? 'SAFE' : 'UNSAFE'}</div>
          {classic.isSafe && <div className="truncate" title={classic.safeSequence.map((i) => scenario.processNames[i]).join(' → ')}>
            sequence: {classic.safeSequence.map((i) => scenario.processNames[i].split(' ')[0]).join(' → ')}</div>}
          <div className="text-slate-500">assumes every process finishes and frees its VRAM</div>
        </div>
        <div className={`${bevelIn} p-2`}>
          <div className="font-bold">Long-lived processes (SpillGuard)</div>
          <div className={a.longLivedSafe ? 'text-emerald-700' : 'text-rose-700'}>{a.longLivedSafe ? 'ADMIT' : 'DENY'}</div>
          <div>{a.reason}</div>
          <div className="text-slate-500">a game or chat server never "finishes": reserve its Need instead</div>
        </div>
      </div>
    </div>
  );
};
