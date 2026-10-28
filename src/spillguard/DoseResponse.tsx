import React from 'react';
import { label, number, records } from './report';

type Rec = Record<string, unknown>;

const OUTCOME_FILL: Record<string, string> = { FAIL: '#e11d48', PASS: '#111111', INCONCLUSIVE: '#ffffff' };
const OUTCOME_TEXT: Record<string, string> = { FAIL: 'slowdown reproduced', PASS: 'no slowdown', INCONCLUSIVE: 'inconclusive' };
const mono = 'VT323, monospace';

interface Point { x: number; y: number | null; outcome: string; reason: string; trial: number; idle: boolean }

const pointsOf = (levels: Rec[], idle: boolean): Point[] => levels.flatMap((level) => records(level.trials, 100).map((t) => {
  const v = t.verdict as Rec;
  return { x: Number(level.planned_overflow_mib), y: number(v.slowdown), outcome: String(v.outcome),
    reason: label(v.reason), trial: Number(t.trial), idle };
}));

const fmtX = (x: number) => (x > 0 ? `+${x}` : `${x}`);

/** Slowdown of a real local LLM against planned VRAM overflow; circles = active co-tenant, squares = idle. */
const Chart: React.FC<{ active: Point[]; idle: Point[] }> = ({ active, idle }) => {
  const all = [...active, ...idle];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y).filter((y): y is number => y !== null);
  const xMin = Math.min(...xs, -512) - 80, xMax = Math.max(...xs, 512) + 80;
  const yMax = Math.max(2.6, ...ys) * 1.1;
  const W = 560, H = 250, L = 44, R = 12, T = 14, B = 36;
  const px = (x: number) => L + ((x - xMin) / (xMax - xMin)) * (W - L - R);
  const py = (y: number) => T + (1 - y / yMax) * (H - T - B);
  const xTicks = [...new Set(xs)].sort((a, b) => a - b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[680px] bg-white border-2 border-black" role="img"
      aria-label="Decode slowdown against planned VRAM overflow">
      <line x1={px(0)} x2={px(0)} y1={T} y2={H - B} stroke="#000" strokeDasharray="4 3" />
      <text x={px(0) + 4} y={T + 10} fontSize="11" fontFamily={mono}>VRAM full</text>
      <line x1={L} x2={W - R} y1={py(2)} y2={py(2)} stroke="#e11d48" strokeDasharray="6 3" />
      <text x={W - R - 4} y={py(2) - 4} fontSize="11" textAnchor="end" fill="#e11d48" fontFamily={mono}>2× failure threshold</text>
      <line x1={L} x2={W - R} y1={py(1)} y2={py(1)} stroke="#999" strokeWidth="0.75" />
      {[0, 1, 2].filter((t) => t <= yMax).map((t) => (
        <text key={t} x={L - 6} y={py(t) + 3} fontSize="11" textAnchor="end" fontFamily={mono}>{t}×</text>
      ))}
      {xTicks.map((t) => <text key={t} x={px(t)} y={H - B + 14} fontSize="11" textAnchor="middle" fontFamily={mono}>{fmtX(t)}</text>)}
      <text x={(L + W - R) / 2} y={H - 4} fontSize="12" textAnchor="middle" fontFamily={mono}>planned overflow beyond physical VRAM (MiB)</text>
      <line x1={L} x2={L} y1={T} y2={H - B} stroke="#000" />
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#000" />
      {all.map((p, i) => {
        const y = py(p.y ?? 0.12);
        const x = px(p.x) + (p.idle ? 14 : -10) + (p.trial - 1.5) * 7;
        const fill = OUTCOME_FILL[p.outcome] ?? '#fff';
        const tip = `${p.idle ? 'idle' : 'active'} co-tenant, overflow ${fmtX(p.x)} MiB, trial ${p.trial}: ${OUTCOME_TEXT[p.outcome] ?? p.outcome}${p.y !== null ? `, ${p.y.toFixed(2)}×` : ''} — ${p.reason}`;
        return (
          <g key={i}>
            <title>{tip}</title>
            {p.idle
              ? <rect x={x - 6} y={y - 6} width={12} height={12} fill={fill} stroke="#000" strokeWidth="2" strokeDasharray={p.y === null ? '2 2' : undefined} />
              : <circle cx={x} cy={y} r={6} fill={fill} stroke="#000" strokeWidth="2" strokeDasharray={p.y === null ? '2 2' : undefined} />}
          </g>
        );
      })}
    </svg>
  );
};

const TrialTable: React.FC<{ levels: Rec[]; idle: boolean }> = ({ levels, idle }) => (
  <table className="w-full text-left">
    <thead><tr className="border-b-2 border-black"><th>Co-tenant</th><th>Overflow</th><th>Holds</th><th>Trial</th><th>Baseline</th><th>Pressure</th><th>Recovery</th><th>Verdict</th></tr></thead>
    <tbody>
      {levels.flatMap((level) => records(level.trials, 100).map((t) => {
        const v = t.verdict as Rec;
        const ms = (stage: unknown) => { const n = number((stage as Rec | undefined)?.ms_per_token); return n === null ? '—' : `${n.toFixed(1)} ms`; };
        const ratio = number(v.slowdown);
        return (
          <tr key={`${idle}-${String(level.planned_overflow_mib)}-${String(t.trial)}`} className="border-b border-black/15">
            <td>{idle ? 'idle' : 'active'}</td>
            <td>{fmtX(Number(level.planned_overflow_mib))} MiB</td>
            <td>{String(level.holder_mib)} MiB</td>
            <td>{String(t.trial)}</td>
            <td>{ms(t.baseline)}</td><td>{ms(t.pressure)}</td><td>{ms(t.recovery)}</td>
            <td title={label(v.reason)}>{OUTCOME_TEXT[String(v.outcome)] ?? String(v.outcome)}{ratio !== null ? ` (${ratio.toFixed(2)}×)` : ''}</td>
          </tr>
        );
      }))}
    </tbody>
  </table>
);

export const DoseResponse: React.FC<{ data: Rec }> = ({ data }) => {
  const levels = records(data.levels, 100);
  const idleData = data.idle as Rec | undefined;
  const idleLevels = idleData ? records(idleData.levels, 100) : [];
  const detector = data.detector as Rec | undefined;
  const active = pointsOf(levels, false);
  const idle = pointsOf(idleLevels, true);

  return (
    <div className="space-y-3">
      <ol className="grid sm:grid-cols-4 gap-2 text-[15px] leading-tight">
        {[
          ['1 Reproduce', 'A co-tenant holds VRAM before a local LLM loads. Past capacity, decode slows sharply.'],
          ['2 Witness', 'Matched baseline → pressure → recovery, identical output, recovery required.'],
          ['3 Intervene', 'Same bytes held, co-tenant made idle: does the slowdown survive?'],
          ['4 Compare', 'Does the counter-based detector tell harmful from benign pressure?'],
        ].map(([h, b]) => (
          <li key={h} className="rt-sunken bg-[var(--rt-soft)] p-2"><b className="font-pixel text-[12px] block">{h}</b>{b}</li>
        ))}
      </ol>

      <p className="text-[15px]">
        <b>{label(data.gpu)}</b> · {String(data.physical_vram_mib)} MiB physical · target {String(data.target_estimate_mib)} MiB estimate ·
        ctx {String(data.ctx)}, {String(data.num_predict)} tokens · {label(data.data_origin)}
      </p>

      <Chart active={active} idle={idle} />
      <div className="flex flex-wrap gap-3 text-[14px]">
        {Object.entries(OUTCOME_TEXT).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full border-2 border-black" style={{ background: OUTCOME_FILL[k] }} />{v}</span>
        ))}
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full border-2 border-black" />● active co-tenant (touch every {String(data.touch_interval_ms)} ms)</span>
        {idleData && <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 border-2 border-black" />■ idle co-tenant (same bytes, untouched)</span>}
      </div>

      <details open className="rt-sunken bg-white p-2">
        <summary className="font-bold cursor-pointer">Every trial (invalid ones included)</summary>
        <div className="overflow-x-auto mt-1"><TrialTable levels={levels} idle={false} />{idleLevels.length > 0 && <TrialTable levels={idleLevels} idle />}</div>
      </details>

      {data.remedy !== undefined && (() => {
        const remedy = data.remedy as Rec;
        const names: Record<string, string> = {
          'original': 'none (fresh re-validation)', 'release-owned-holder': 'release the whole co-tenant',
          'serialize-owned-background': 'run the co-tenant after the target', 'release-half-owned-bytes': 'release half of its bytes',
          'release-eighth-owned-bytes': 'release one eighth of its bytes', 'pause-owned-activity': 'keep every byte, stop touching it',
        };
        return (
          <section className="rt-raised bg-white p-2 space-y-1">
            <h3 className="font-pixel font-bold text-[13px]">Which fix works, and which disrupts least? (+256 MiB witness, status: {label(remedy.status)})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b-2 border-black"><th>Remedy</th><th>Co-tenant keeps</th><th>Trials</th><th>Verdict</th></tr></thead>
                <tbody>
                  {records(remedy.rows, 20).map((r) => {
                    const trials = Array.isArray(r.trial_ratios) ? (r.trial_ratios as unknown[]).map((x) => `${Number(x).toFixed(2)}×`).join(', ') : '—';
                    const fixed = r.outcome === 'PASS';
                    return (
                      <tr key={label(r.intervention)} className={`border-b border-black/15 ${r.intervention === 'pause-owned-activity' ? 'bg-[#dcf7d9]' : ''}`}>
                        <td>{names[String(r.intervention)] ?? label(r.intervention)}</td>
                        <td>{String(r.cotenant_mib)} MiB</td>
                        <td>{trials}</td>
                        <td className={fixed ? '' : 'text-[#c0261b] font-bold'}>{OUTCOME_TEXT[String(r.outcome)] ?? label(r.outcome)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p>
              Every owned-only remedy restored performance without changing the target's work. Pausing the co-tenant's activity kept all
              of its memory yet recovered fully, which is the least disruptive fix here and replicates the idle-co-tenant result.
            </p>
          </section>
        );
      })()}

      {detector && (
        <section className="rt-raised bg-white p-2 space-y-1">
          <h3 className="font-pixel font-bold text-[13px]">Can memory counters tell harmful from benign pressure?</h3>
          <p>
            {label(detector.name)} on {String(detector.valid_trials)} valid trials: caught{' '}
            <b>{String(detector.true_positive)}/{Number(detector.true_positive) + Number(detector.false_negative)}</b> real slowdowns, but{' '}
            <b>{String(detector.false_positive)}</b> of its {Number(detector.true_positive) + Number(detector.false_positive)} alarms were on runs with no harmful slowdown.
            At +256 MiB the active and idle co-tenants produced the same residency counters, yet only the active one caused a 2.4× slowdown:
            the intervention separates them, the counters do not.
          </p>
        </section>
      )}

      <p className="text-[14px] text-[var(--rt-muted)]">
        Pilot: 2 trials per level on one laptop; planned overflow uses an estimated footprint. A reproduced slowdown requires completed matched
        runs with identical output and recovery after release; it does not prove the residency mechanism (page churn is a hypothesis pending
        PIX/ETW residency events). Inconclusive idle trials were stopped by the host-commit safety guard.
      </p>
    </div>
  );
};
