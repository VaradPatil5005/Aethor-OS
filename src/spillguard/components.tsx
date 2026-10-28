import React, { useRef } from 'react';
import { useSpillStore } from '../stores/useSpillStore';
import type { SgEvent, SgFrame, SgProc, SpillMode } from './types';
import { formatReplayTime } from './time';

export const bevelOut = 'bg-[var(--rt-panel)] rt-raised';
export const bevelIn = 'bg-white rt-sunken';

export const TIER = { vram: '#4f46e5', spill: '#e11d48', baseline: '#94a3b8', free: '#e2e8f0' };

export const fmtMB = (mb: number | null | undefined) =>
  mb == null ? '—' : mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${Math.round(mb)} MB`;

export const fmtTime = (t: number) => new Date(t * 1000).toLocaleTimeString([], { hour12: false });

/** One process: VRAM -> spilled (shared above baseline) -> baseline shared, on a common scale. */
export const TierBar: React.FC<{ p: SgProc; scaleMb: number }> = ({ p, scaleMb }) => {
  const pct = (mb: number) => `${Math.min(100, (100 * mb) / Math.max(1, scaleMb))}%`;
  // Excess over baseline is only a spill once the detector says so; below that it is counter noise.
  const spill = p.state === 'SPILLING' ? p.spill_mb : 0;
  const color = p.state === 'SPILLING' ? 'text-rose-700' : p.state === 'PRESSURED' ? 'text-amber-700' : 'text-slate-700';
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] gap-2 items-center font-terminal text-[15px]">
      <span className={`truncate font-bold ${color}`} title={`${p.name} (PID ${p.pid})`}>{p.name}</span>
      <div className="h-3.5 border border-black/40 flex overflow-hidden bg-[var(--rt-side)]" role="img"
        aria-label={`${p.name}: ${p.dedicated_mb} MB in VRAM, ${spill} MB spilled to system RAM`}>
        <div style={{ width: pct(p.dedicated_mb), background: TIER.vram }} />
        <div style={{ width: pct(spill), background: TIER.spill }} />
        <div style={{ width: pct(Math.min(p.shared_mb, p.baseline_shared_mb)), background: TIER.baseline }} />
      </div>
      <span className={`w-28 text-right ${color}`}>
        {fmtMB(p.dedicated_mb)}{spill > 0 ? <b> +{fmtMB(spill)}</b> : null}
      </span>
    </div>
  );
};

export const TierLegend: React.FC = () => (
  <div className="flex flex-wrap gap-3 text-slate-700 font-terminal text-[14px]">
    {([['VRAM (dedicated)', TIER.vram], ['spilled to system RAM', TIER.spill], ['baseline shared', TIER.baseline]] as const).map(([l, c]) => (
      <span key={l} className="flex items-center gap-1"><span className="inline-block w-3 h-3 border border-black/40" style={{ background: c }} />{l}</span>
    ))}
  </div>
);

export const Gauge: React.FC<{ label: string; value: number; max: number; marks?: { at: number; label: string }[]; danger?: boolean; detail?: string }> =
  ({ label, value, max, marks = [], danger, detail }) => {
    const pct = Math.min(100, (100 * value) / Math.max(1, max));
    return (
      <div className={`${bevelIn} p-2`}>
        <div className="flex justify-between font-bold text-slate-600 uppercase text-[12px]"><span>{label}</span><span>{detail}</span></div>
        <div className="relative h-4 mt-1 border border-black/40 bg-[var(--rt-side)]">
          <div className="h-full" style={{ width: `${pct}%`, background: danger ? TIER.spill : TIER.vram }} />
          {marks.map((m) => (
            <div key={m.label} className="absolute top-[-3px] bottom-[-3px] w-px bg-black" style={{ left: `${Math.min(100, (100 * m.at) / max)}%` }} title={m.label} />
          ))}
        </div>
        <div className="font-bold mt-1 font-terminal text-[20px]">{fmtMB(value)} <span className="text-slate-500 font-normal">/ {fmtMB(max)}</span></div>
      </div>
    );
  };

/** Two series over time: adapter VRAM (indigo area) and total spilled MB (rose line). */
export const Sparkline: React.FC<{ frames: SgFrame[]; height?: number }> = ({ frames, height = 70 }) => {
  if (frames.length < 2) return <div className="text-slate-500 p-2 font-terminal text-[15px]">waiting for samples…</div>;
  const W = 600;
  const V = frames[frames.length - 1].adapter.vram_total_mb;
  const maxY = Math.max(V, ...frames.map((f) => f.summary.total_spill_mb + f.adapter.dedicated_mb)) * 1.05;
  const x = (i: number) => (i / (frames.length - 1)) * W;
  const y = (mb: number) => height - (mb / maxY) * height;
  const area = frames.map((f, i) => `${x(i)},${y(f.adapter.dedicated_mb)}`).join(' ');
  const spill = frames.map((f, i) => `${x(i)},${y(f.summary.total_spill_mb)}`).join(' ');
  const t0 = frames[0].t, t1 = frames[frames.length - 1].t;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img"
      aria-label={`VRAM and spill over the last ${Math.round(t1 - t0)} seconds`}>
      <line x1={0} x2={W} y1={y(V)} y2={y(V)} stroke="#000" strokeDasharray="4 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <polygon points={`0,${height} ${area} ${W},${height}`} fill={TIER.vram} fillOpacity={0.35} stroke={TIER.vram} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <polyline points={spill} fill="none" stroke={TIER.spill} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export const EVENT_STYLE: Record<string, string> = {
  SPILL_START: 'text-rose-700 font-bold', SPILL_END: 'text-emerald-700', PRESSURE_START: 'text-amber-700',
  PRESSURE_END: 'text-slate-600', OFFLOAD_SPLIT: 'text-sky-700', RAM_PRESSURE_START: 'text-orange-700',
  RAM_PRESSURE_END: 'text-slate-600', BUDGET_CHANGE: 'text-violet-700',
};

export function describeEvent(e: SgEvent): string {
  switch (e.type) {
    case 'SPILL_START': {
      const c = e.culprit;
      const who = c ? (c.self_inflicted ? 'self-inflicted' : `culprit ${c.name} (+${c.growth_mb} MB)`) : '';
      return `pid=${e.pid} ${e.name} spill=${e.spill_mb}MB ratio=${Math.round((e.ratio ?? 0) * 100)}% cause=${e.cause} ${who}`;
    }
    case 'SPILL_END': return `pid=${e.pid} ${e.name} after ${e.duration_s}s, peak ${e.peak_spill_mb}MB${e.exited ? ' (exited)' : ''}`;
    case 'PRESSURE_START': case 'PRESSURE_END': return `adapter load ${Math.round(Number(e.load) * 100)}% (${e.dedicated_mb} MB)`;
    case 'OFFLOAD_SPLIT': return `${e.model}: ${e.cpu_pct}% of layers on CPU (type A, chosen by the framework)`;
    case 'RAM_PRESSURE_START': case 'RAM_PRESSURE_END': return `commit ${e.commit_pct}% avail ${e.avail_mb} MB (type C)`;
    case 'BUDGET_CHANGE': return `OS VRAM budget ${e.old_mb} -> ${e.new_mb} MB`;
    default: return JSON.stringify(e);
  }
}

export const EventLog: React.FC<{ events: SgEvent[]; max?: number }> = ({ events, max = 40 }) => (
  <div className="space-y-0.5 font-terminal text-[15px]">
    {events.length === 0 && <div className="text-slate-500">no events yet</div>}
    {events.slice(-max).reverse().map((e, i) => (
      <div key={`${e.t}-${e.type}-${i}`} className="flex gap-2">
        <span className="text-slate-500 shrink-0">{fmtTime(e.t)}</span>
        <span className={`shrink-0 w-36 ${EVENT_STYLE[e.type] ?? ''}`}>{e.type}</span>
        <span className="truncate" title={describeEvent(e)}>{describeEvent(e)}</span>
      </div>
    ))}
  </div>
);

export const ModeSwitch: React.FC = () => {
  const { mode, setMode, status, statusDetail, session, loadTrace, loadDemoTrace } = useSpillStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const modes: [SpillMode, string][] = [['simulated', 'Simulated'], ['live', 'Live'], ['replay', 'Replay']];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <div className="flex border-2 border-black" role="radiogroup" aria-label="Data source">
        {modes.map(([m, label]) => (
          <button key={m} role="radio" aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`px-2 py-0.5 font-bold ${mode === m ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'live' && (
        <span className={`font-terminal text-[15px] ${status === 'live' ? 'text-emerald-700' : 'text-rose-700'}`}>
          ● {status === 'live' ? `agent ${session?.base.replace(/^https?:\/\//, '')}` : status}
        </span>
      )}
      {mode === 'replay' && (
        <>
          <button onClick={() => fileRef.current?.click()} className="px-2 py-0.5 bg-white border border-black font-bold hover:bg-slate-200">Open trace…</button>
          <button onClick={() => loadDemoTrace()} className="px-2 py-0.5 bg-white border border-black font-bold hover:bg-slate-200">Demo trace</button>
          <input ref={fileRef} type="file" accept=".jsonl,.json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) loadTrace(await f.text(), f.name);
            e.target.value = '';
          }} />
        </>
      )}
      {statusDetail && <span className="text-rose-700 font-terminal text-[15px]">{statusDetail}</span>}
    </div>
  );
};

export const ReplayControls: React.FC = () => {
  const { replay, play, pause, seek, setSpeed, latest } = useSpillStore();
  if (!replay) return null;
  return (
    <div className="flex items-center gap-2 font-terminal text-[17px]">
      <button onClick={() => (replay.playing ? pause() : play())} className="px-2 py-0.5 bg-white border border-black font-bold w-16">
        {replay.playing ? 'Pause' : 'Play'}
      </button>
      <input type="range" min={0} max={replay.count - 1} value={replay.index} onChange={(e) => seek(Number(e.target.value))}
        className="flex-1" aria-label="Replay position" />
      <select value={replay.speed} onChange={(e) => setSpeed(Number(e.target.value))} className="bg-white border border-black" aria-label="Replay speed">
        {[1, 2, 4, 8, 16].map((s) => <option key={s} value={s}>{s}×</option>)}
      </select>
      <span className="max-w-72 truncate text-slate-600" title={replay.name}>{latest ? formatReplayTime(latest.t, replay.relativeTime) : ''} · {replay.name}</span>
    </div>
  );
};

/** For apps that add a Live/Replay twin panel: true when real (non-simulated) data is showing. */
export const useRealData = () => {
  const { mode, latest } = useSpillStore();
  return mode !== 'simulated' && latest !== null;
};
