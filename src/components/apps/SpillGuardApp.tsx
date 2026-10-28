import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Gauge as GaugeIcon, HardDrive } from 'lucide-react';
import { useSpillStore } from '../../stores/useSpillStore';
import { vramAdmission } from '../../spillguard/admission';
import { ReproPanel } from '../../spillguard/ReproPanel';
import {
  bevelIn, bevelOut, EventLog, fmtMB, Gauge, ModeSwitch, ReplayControls, Sparkline, TierBar, TierLegend,
} from '../../spillguard/components';

interface Advice {
  verdict: 'SAFE' | 'FIXABLE' | 'UNSAFE';
  reason: string;
  estimate: { weights_mb: number; kv_mb: number; buffer_mb: number; overhead_mb: number; total_mb: number; layers_on_gpu: number; total_layers: number };
  suggested: { vram_mb: number; config: { n_ctx: number; kv_type: string; flash_attn: boolean; n_gpu_layers: number } } | null;
  available_mb: number[];
  calibration: string;
  model: { name: string; quant: string };
}

const FitChecker: React.FC = () => {
  const { mode, api, latest, peaks } = useSpillStore();
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState('');
  const [ctx, setCtx] = useState(8192);
  const [kv, setKv] = useState('f16');
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [claim, setClaim] = useState(4096);

  useEffect(() => {
    if (mode !== 'live') return;
    api<{ ollama: string[] }>('/api/models').then((r) => { setModels(r.ollama); setModel((m) => m || r.ollama[0] || ''); }).catch(() => {});
  }, [mode, api]);

  if (mode === 'replay' && latest) {
    const a = vramAdmission(latest, peaks, claim);
    return (
      <div className="space-y-1.5 font-terminal text-[15px]">
        <label className="flex items-center gap-2">
          <span className="w-28">New claim</span>
          <input type="range" min={256} max={latest.adapter.vram_total_mb} step={128} value={claim} onChange={(e) => setClaim(Number(e.target.value))} className="flex-1" aria-label="New launch VRAM claim" />
          <span className="w-20 text-right font-bold">{fmtMB(claim)}</span>
        </label>
        <div className={a.longLivedSafe ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
          {a.longLivedSafe ? 'SAFE' : 'UNSAFE'}: {a.reason}
        </div>
        <div className="text-slate-500">Replay has no model files; Live mode reads the GGUF header and suggests a config.</div>
      </div>
    );
  }
  if (mode !== 'live') return <div className="text-slate-500 font-terminal text-[15px]">Switch to Live or Replay to check a launch.</div>;

  const run = async () => {
    setBusy(true); setErr(null);
    try { setAdvice(await api<Advice>('/api/advise', { model, n_ctx: ctx, kv_type: kv })); }
    catch (e) { setErr(String((e as Error).message)); setAdvice(null); }
    finally { setBusy(false); }
  };
  const e = advice?.estimate;
  return (
    <div className="space-y-2 font-terminal text-[15px]">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={model} onChange={(e) => setModel(e.target.value)} className="bg-white border border-black max-w-[14rem]" aria-label="Model">
          {models.length === 0 && <option value="">no Ollama models found</option>}
          {models.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select value={ctx} onChange={(e) => setCtx(Number(e.target.value))} className="bg-white border border-black" aria-label="Context length">
          {[2048, 4096, 8192, 16384, 32768, 65536].map((c) => <option key={c} value={c}>ctx {c}</option>)}
        </select>
        <select value={kv} onChange={(e) => setKv(e.target.value)} className="bg-white border border-black" aria-label="KV cache type">
          {['f16', 'q8_0', 'q4_0'].map((k) => <option key={k}>{k}</option>)}
        </select>
        <button disabled={!model || busy} onClick={run} className="px-2 py-0.5 bg-black text-white font-bold disabled:opacity-50">
          {busy ? 'Checking…' : 'Will it fit?'}
        </button>
      </div>
      {err && <div className="text-rose-700">{err}</div>}
      {advice && e && (
        <div className={`${bevelIn} p-2 space-y-1`}>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1">
            <span>weights {fmtMB(e.weights_mb)}</span><span>KV {fmtMB(e.kv_mb)}</span><span>buffers {fmtMB(e.buffer_mb)}</span>
            <span>CUDA {fmtMB(e.overhead_mb)}</span><b>= {fmtMB(e.total_mb)}</b>
          </div>
          <div className={advice.verdict === 'SAFE' ? 'text-emerald-700 font-bold' : advice.verdict === 'FIXABLE' ? 'text-amber-700 font-bold' : 'text-rose-700 font-bold'}>
            {advice.verdict}{advice.verdict !== 'SAFE' ? ` — ${advice.reason}` : ` — ${fmtMB(advice.available_mb[0])} free for new claims`}
          </div>
          {advice.verdict === 'FIXABLE' && advice.suggested && (
            <div>Suggested: ctx {advice.suggested.config.n_ctx}, KV {advice.suggested.config.kv_type}
              {advice.suggested.config.flash_attn ? ', flash-attn' : ''}, GPU layers {advice.suggested.config.n_gpu_layers >= 999 ? 'all' : advice.suggested.config.n_gpu_layers}
              {' '}→ {fmtMB(advice.suggested.vram_mb)}. Launch with <code className="bg-slate-200 px-1">spillguard run -- ollama run {model}</code>
            </div>
          )}
          <div className="text-slate-500 text-[12px]">estimator: {advice.calibration}</div>
        </div>
      )}
    </div>
  );
};

export const SpillGuardApp: React.FC = () => {
  const { mode, latest, history, events, machine, loadDemoTrace, play, setMode } = useSpillStore();

  const lastStart = useMemo(() => [...events].reverse().find((e) => e.type === 'SPILL_START'), [events]);

  if (mode === 'simulated' || !latest) {
    return (
      <div className="h-full w-full text-black p-3 font-pixel overflow-y-auto space-y-3 text-xs min-h-0 bg-white">
        <div className={`${bevelOut} p-2.5 flex items-center justify-between gap-2 flex-wrap`}>
          <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-black" /><b>SpillGuard · GPU memory tiers</b></div>
          <ModeSwitch />
        </div>
        <div className={`${bevelIn} p-3 space-y-2 leading-relaxed`}>
          <p><b>What this shows.</b> GPU-memory pressure can coincide with slower execution and increased shared-memory use.
            These counters flag a hypothesis; they do not prove resource residency or its performance cost.
            Earlier synthetic write probes on this RTX 3050 laptop reported about 13 versus 163 GB/s for slow and fast blocks.
            Those probe results do not establish an application-wide speedup.</p>
          <p><b>Live</b> streams real per-process GPU memory from the SpillGuard agent on this PC
            (<code className="bg-slate-200 px-1">spillguard serve</code>). <b>Replay</b> plays a recorded trace in any browser —
            press <i>Demo trace</i> to watch a real spill captured on the author's laptop.</p>
          {mode === 'live' && <p className="text-[#c0261b]">Waiting for the agent… run <code className="bg-[var(--rt-side)] px-1">python -m spillguard serve</code> in <code>agent/</code> and open the link it prints.</p>}
          {mode !== 'live' && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="rt-btn" onClick={async () => { await loadDemoTrace(); setTimeout(play, 100); }}>Watch the demo spill</button>
              <button className="rt-btn" onClick={() => setMode('live')}>Connect to this PC (Live)</button>
            </div>
          )}
        </div>
        <ReproPanel />
      </div>
    );
  }

  const ad = latest.adapter;
  const sys = latest.system;
  const V = ad.vram_total_mb;
  const scale = Math.max(V, ...latest.procs.map((p) => p.dedicated_mb + p.shared_mb));
  const state = latest.summary.state;
  const banner = state === 'SPILL' ? 'bg-rose-600 text-white' : state === 'PRESSURE' ? 'bg-amber-400 text-black' : 'bg-emerald-600 text-white';

  return (
    <div className="h-full w-full text-black p-3 font-pixel overflow-y-auto space-y-3 text-xs min-h-0 min-w-0 overscroll-contain bg-white">
      <div className={`${bevelOut} p-2.5 flex items-center justify-between gap-2 flex-wrap`}>
        <div className="flex items-center gap-2 min-w-0"><HardDrive className="w-4 h-4 text-black shrink-0" />
          <b className="truncate">{ad.name}</b>
          <span className="text-slate-600 truncate font-terminal text-[14px]">{machine.nvidia_driver ? `driver ${machine.nvidia_driver}` : ''}</span>
        </div>
        <ModeSwitch />
      </div>
      {mode === 'replay' && <div className={`${bevelOut} p-2`}><ReplayControls /></div>}

      <div className={`p-2.5 border-2 border-black flex items-center gap-2 ${banner}`} role="status" aria-live="polite">
        {state === 'OK' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        <div className="font-bold text-sm">
          {state === 'SPILL' && `Spill heuristic triggered: ${latest.summary.spilling.map((s) => `${s.name} (${fmtMB(s.spill_mb)}, ${Math.round(s.ratio * 100)}%)`).join(', ')}`}
          {state === 'PRESSURE' && `VRAM pressure: ${Math.round(ad.load * 100)}% of physical VRAM in use — next allocation may spill`}
          {state === 'OK' && `No heuristic alert · ${Math.round(ad.load * 100)}% of VRAM in use`}
        </div>
      </div>
      {state === 'SPILL' && lastStart?.culprit && (
        <div className={`${bevelIn} p-2 font-terminal text-[15px]`}>
          <b>Growth heuristic (correlation; cause unverified):</b> {lastStart.culprit.self_inflicted
            ? `${lastStart.name} grew by ${fmtMB(lastStart.culprit.growth_mb)} in the 30 s before the alert.`
            : `${lastStart.culprit.name} (PID ${lastStart.culprit.pid}) grew by ${fmtMB(lastStart.culprit.growth_mb)} in the 30 s before ${lastStart.name}'s onset.`}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Gauge label="Dedicated VRAM" value={ad.dedicated_mb} max={V} danger={state !== 'OK'}
          detail={ad.budget_mb ? `OS budget ${fmtMB(ad.budget_mb)}` : ''}
          marks={[...(ad.budget_mb ? [{ at: ad.budget_mb, label: 'DXGI budget' }] : []), { at: V * 0.92, label: 'θhi 92%' }]} />
        <Gauge label="Shared GPU memory" value={ad.shared_mb} max={ad.shared_cap_mb} danger={latest.summary.total_spill_mb > 0}
          detail="cap = ½ RAM" />
        <Gauge label="RAM commit" value={sys.commit_mb ?? 0} max={sys.commit_limit_mb ?? 1} danger={sys.ram_pressure}
          detail={`${sys.avail_mb ?? '—'} MB free`} />
      </div>

      <div className={`${bevelOut} p-2 space-y-1`}>
        <div className="flex justify-between font-bold text-[12.5px]"><span className="flex items-center gap-1"><GaugeIcon className="w-3.5 h-3.5" />Last {history.length} s</span>
          <span className="font-normal font-terminal text-[14px]"><span style={{ color: '#4f46e5' }}>■</span> VRAM <span style={{ color: '#e11d48' }}>━</span> spilled · dashed = physical VRAM</span></div>
        <div className={`${bevelIn} p-1`}><Sparkline frames={history} /></div>
      </div>

      <div className={`${bevelOut} p-2 space-y-1.5`}>
        <div className="flex justify-between flex-wrap gap-1"><b className="text-[12.5px]">Per-process memory tiers</b><TierLegend /></div>
        <div className={`${bevelIn} p-2 space-y-1`}>
          {latest.procs.slice(0, 8).map((p) => <TierBar key={p.pid} p={p} scaleMb={scale} />)}
        </div>
        {latest.ollama && latest.ollama.length > 0 && (
          <div className="font-terminal text-[15px]">
            {latest.ollama.map((m) => (
              <div key={m.name}>Ollama {m.name}: {fmtMB(m.size_vram_mb)} / {fmtMB(m.size_mb)} in VRAM
                {m.size_vram_mb < m.size_mb && <b className="text-black"> — {Math.round(100 - (100 * m.size_vram_mb) / m.size_mb)}% on CPU (type A: framework offload)</b>}</div>
            ))}
          </div>
        )}
      </div>

      <div className={`${bevelOut} p-2 space-y-1.5`}>
        <b className="text-[12.5px]">Admission check (Banker's)</b>
        <FitChecker />
      </div>

      <div className={`${bevelOut} p-2 space-y-1`}>
        <b className="text-[12.5px]">Events</b>
        <div className={`${bevelIn} p-2 max-h-48 overflow-y-auto`}><EventLog events={events} /></div>
      </div>

      <ReproPanel />
    </div>
  );
};
