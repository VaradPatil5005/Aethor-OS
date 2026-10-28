import React, { useMemo, useState } from 'react';
import { useSpillStore } from '../stores/useSpillStore';
import { useWindowStore } from '../stores/useWindowStore';

type Status = { tone: 'done' | 'warn' | 'idle'; text: string };

const TONE: Record<Status['tone'], string> = {
  done: 'bg-[var(--rt-min)] text-black',
  warn: 'bg-[var(--rt-max)] text-black',
  idle: 'bg-black text-white',
};

/** Shared card for every KernelQuest challenge (Retrium-style outlined panel). */
export const QuestCard: React.FC<{ n: number; title: string; status?: Status; children: React.ReactNode }> = ({ n, title, status, children }) => (
  <section className="bg-white rt-raised p-3 space-y-2">
    <div className="flex items-start justify-between gap-2 flex-wrap">
      <h3 className="font-bold text-[14px] leading-snug">
        <span className="inline-block bg-black text-white px-1.5 mr-1.5">Q{n}</span>{title}
      </h3>
      {status && <span className={`font-terminal text-[16px] px-2 border-2 border-black ${TONE[status.tone]}`}>{status.text}</span>}
    </div>
    {children}
  </section>
);

export const questText = 'font-terminal text-[18px] leading-tight text-[var(--rt-muted)]';

/** Answer buttons: green when right, red when wrong (Retrium traffic-light colours). */
const answerClass = (picked: boolean, right: boolean) =>
  `rt-btn rt-btn-sm !justify-start text-left ${picked ? (right ? '!bg-[var(--rt-min)] !text-black' : '!bg-[var(--rt-close)] !text-black') : ''}`;

/** Quest 3: find the process responsible for a real spill (culprit vs victim). */
export const CulpritQuest: React.FC = () => {
  const { events, history, mode, loadDemoTrace, play } = useSpillStore();
  const open = useWindowStore((s) => s.open);
  const [pick, setPick] = useState<number | null>(null);
  const start = useMemo(() => events.find((e) => e.type === 'SPILL_START' && e.culprit), [events]);
  const options = useMemo(() => {
    if (!start) return [];
    const f = [...history].reverse().find((h) => h.t <= start.t) ?? history[history.length - 1];
    const names = new Map<number, string>();
    for (const p of (f?.procs ?? []).slice(0, 4)) names.set(p.pid, p.name);
    if (start.culprit) names.set(start.culprit.pid, start.culprit.name);
    if (start.pid != null && start.name) names.set(start.pid, start.name);
    return [...names.entries()].sort((a, b) => a[0] - b[0]);
  }, [start, history]);
  const correct = start?.culprit?.pid;
  const status: Status = pick != null && pick === correct
    ? { tone: 'done', text: 'Solved' }
    : { tone: start ? 'warn' : 'idle', text: start ? 'Spill detected: choose' : mode === 'simulated' ? 'Needs Replay or Live' : 'Waiting for a spill…' };

  return (
    <QuestCard n={3} title="Who is the culprit? (real GPU trace)" status={status}>
      <p className={questText}>
        The process that spills is often a <i>victim</i>: another app grabbed VRAM first. Replay the trace, wait for
        SPILL_START, then name the process whose VRAM grew the most in the 30 s before the spill.
      </p>
      {!start && (
        <button onClick={async () => { await loadDemoTrace(); setTimeout(play, 100); open('spillguard'); }} className="rt-btn rt-btn-sm">
          Replay the RTX 3050 spill trace
        </button>
      )}
      {start && (
        <div className="flex flex-wrap gap-2">
          {options.map(([pid, name]) => (
            <button key={pid} onClick={() => setPick(pid)} className={answerClass(pick === pid, pid === correct)}>
              {name} ({pid})
            </button>
          ))}
        </div>
      )}
      {pick != null && start?.culprit && (
        <p className={`${questText} !text-black`}>
          {pick === correct ? 'Correct. ' : 'Not quite. '}
          {start.culprit.self_inflicted
            ? `${start.name} grew its own VRAM by ${start.culprit.growth_mb} MB and overflowed the card: a self-inflicted spill.`
            : `${start.culprit.name} grew by ${start.culprit.growth_mb} MB just before ${start.name} spilled, so ${start.name} is the victim.`}
        </p>
      )}
    </QuestCard>
  );
};

const FIT_OPTIONS = [
  { id: 'a', label: '16k context, f16 KV', kv: 2.0, ok: false },
  { id: 'b', label: '16k context, q8_0 KV', kv: 1.06, ok: false },
  { id: 'c', label: '8k context, q8_0 KV', kv: 0.53, ok: true },
  { id: 'd', label: '8k context, f16 KV', kv: 1.0, ok: false },
];

/** Quest 4: the fit equation M = W + KV + B + O, by hand. */
export const FitQuest: React.FC = () => {
  const [pick, setPick] = useState<string | null>(null);
  const chosen = FIT_OPTIONS.find((o) => o.id === pick);
  const status: Status | undefined = chosen ? (chosen.ok ? { tone: 'done', text: 'Solved' } : { tone: 'warn', text: 'It would spill' }) : undefined;
  return (
    <QuestCard n={4} title="Will this model fit?" status={status}>
      <p className={questText}>
        VRAM needed = weights + KV cache + buffers + CUDA overhead. Weights 3.9 GB, buffers + overhead 0.7 GB,
        KV cache 2.0 GB at 16k context in f16 (it scales with context; q8_0 is about half). 5.5 GB is free.
        Which launch fits without spilling?
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {FIT_OPTIONS.map((o) => (
          <button key={o.id} onClick={() => setPick(o.id)} className={answerClass(pick === o.id, o.ok)}>
            {o.label}
          </button>
        ))}
      </div>
      {chosen && (
        <p className={`${questText} !text-black`}>
          3.9 + {chosen.kv.toFixed(2)} + 0.7 = {(4.6 + chosen.kv).toFixed(2)} GB {chosen.ok ? '≤' : '>'} 5.5 GB free
          {chosen.ok ? ': it fits. This is the Banker\'s check SpillGuard runs before a launch.' : ': over budget, so the driver would spill the rest into system RAM.'}
        </p>
      )}
    </QuestCard>
  );
};
