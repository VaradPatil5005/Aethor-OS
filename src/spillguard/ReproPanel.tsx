import React, { useEffect, useRef, useState } from 'react';
import { ResearchLibrary, ResearchItem, fetchResearchIndex } from './ResearchLibrary';
import { useSpillStore } from '../stores/useSpillStore';
import { label, number, outcomeLabel, parseResearchDocument, records } from './report';
import { useResearchReport } from './useResearchReport';
import { DoseResponse } from './DoseResponse';

const value = (input: unknown) => { const n = number(input); return n === null ? 'Unavailable' : n.toFixed(3); };

export const ReproPanel: React.FC = () => {
  const { document, fileName, trialIndex, accept, clear, selectTrial } = useResearchReport();
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const loadTrace = useSpillStore(state => state.loadTrace);
  const traceError = useSpillStore(state => state.mode === 'replay' && state.status === 'error' ? state.statusDetail : null);
  const importReport = async (file?: File) => {
    if (!file) return;
    const request = ++sequence.current;
    setError('');
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Report exceeds 8 MiB.');
      const parsed = parseResearchDocument(await file.text());
      if (request === sequence.current) accept(parsed, file.name);
    } catch (e) { if (request === sequence.current) { clear(); setError(String((e as Error).message)); } }
  };
  const importTrace = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 32 * 1024 * 1024) throw new Error('Trace exceeds 32 MiB.');
      await loadTrace(await file.text(), file.name);
      setError('');
    } catch (e) { setError(String((e as Error).message)); }
  };
  const [traceNote, setTraceNote] = useState('');
  const openBuiltIn = async (item: ResearchItem) => {
    const request = ++sequence.current;
    try {
      const r = await fetch(item.file);
      if (!r.ok) throw new Error(`${item.title}: file missing from this build.`);
      const parsed = parseResearchDocument(await r.text());
      if (request === sequence.current) { setError(''); setTraceNote(''); accept(parsed, item.title); }
    } catch (e) { if (request === sequence.current) setError(String((e as Error).message)); }
  };
  const openBuiltInTrace = async (item: ResearchItem) => {
    try {
      const r = await fetch(item.file);
      if (!r.ok) throw new Error(`${item.title}: file missing from this build.`);
      await loadTrace(await r.text(), item.title);
      setError('');
      setTraceNote(`Loaded "${item.title}" into Replay. Scroll up and press Play to watch the GPU memory tiers.`);
    } catch (e) { setError(String((e as Error).message)); }
  };
  // Show the headline result straight away the first time the desk opens.
  useEffect(() => {
    if (useResearchReport.getState().document) return;
    let cancelled = false;
    void fetchResearchIndex().then((items) => {
      const first = items.find((i) => i.kind === 'report');
      if (first && !cancelled && !useResearchReport.getState().document) void openBuiltIn(first);
    }).catch(() => { /* library unavailable: the desk still works with your own files */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const data = document?.data;
  const trials = document?.kind === 'experiment' ? records(data?.trials) : [];
  const trial = trials[trialIndex];
  return <section className="border-2 border-black p-3 space-y-3 font-terminal text-[15px]" aria-label="SpillGuard research evidence">
    <div><h2 className="font-bold text-lg">SpillGuard Repro · evidence desk</h2>
      <p>Saved measurements from the RTX 3050 laptop open with one click. Everything stays in this browser.</p></div>
    <ResearchLibrary active={fileName} onReport={openBuiltIn} onTrace={openBuiltInTrace} />
    <details className="text-[14px]">
      <summary className="cursor-pointer">Open your own file instead…</summary>
      <div className="flex gap-3 flex-wrap mt-2">
        <label className="rt-btn cursor-pointer">Open research report<input aria-label="Open research report" className="block max-w-[15rem]" type="file" accept=".json,application/json" onChange={e => void importReport(e.target.files?.[0])} /></label>
        <label className="rt-btn cursor-pointer">Replay stage trace<input aria-label="Replay stage trace" className="block max-w-[15rem]" type="file" accept=".jsonl" onChange={e => void importTrace(e.target.files?.[0])} /></label>
      </div>
    </details>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    {traceError && <p role="alert" className="text-rose-700">Trace: {traceError}</p>}
    {traceNote && !traceError && <p role="status" className="bg-[#dcf7d9] border-2 border-black p-2">{traceNote}</p>}
    {data && <><div className="flex gap-2 items-center flex-wrap"><p className="font-bold break-all">{fileName} · {document?.kind}</p><button className="rt-btn" onClick={() => { ++sequence.current; clear(); }}>Clear imported report</button></div>
      <p className="bg-amber-50 border border-amber-700 p-2">Imported claims: this view has not verified the bundle manifest or the physical mechanism. Use the local verification command before relying on the evidence.</p>
      {document?.kind === 'experiment' && <>
        <p>{outcomeLabel((data.verdict as Record<string, unknown>).outcome)} · {label(data.data_origin)} · {data.complete ? 'Run complete' : 'Run incomplete'}</p>
        <p>Primary metric: {label(data.primary_metric)}. Counter signatures are proxies; residency cause remains unverified.</p>
        {trials.length > 0 && <label>Matched block <select aria-label="Matched block" className="border border-black" value={trialIndex} onChange={e => selectTrial(Number(e.target.value))}>{trials.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label>}
        {trial && <><p>{outcomeLabel((trial.verdict as Record<string, unknown>).outcome)}</p><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Stage</th><th>Primary metric</th><th>Total ms</th><th>Overlap samples</th><th>Validity</th></tr></thead><tbody>
          {records(trial.stages, 3).map(stage => <tr key={label(stage.stage)} className="border-t border-slate-300"><td>{label(stage.stage)}</td><td>{value(stage.metric_value ?? (data.primary_metric === 'completion_ms' ? stage.latency_ms : null))}</td><td>{value(stage.latency_ms)}</td><td>{value(stage.overlap_samples)}</td><td>{stage.completed ? 'Completed' : 'Incomplete'}{Array.isArray(stage.errors) && stage.errors.length > 0 && <p className="text-rose-700">{stage.errors.map(label).join('; ')}</p>}</td></tr>)}
        </tbody></table></div></>}
      </>}
      {document?.kind === 'reduction' && <>
        <p>Data origin: {label(data.data_origin)}. Earlier reports without an origin label require inspection of their referenced bundles.</p>
        <p>Method: {label(data.method)} · Oracle calls: {value(data.executed_tests)} · Fresh validation: {data.fresh_validation && typeof data.fresh_validation === 'object' ? outcomeLabel((data.fresh_validation as Record<string, unknown>).outcome) : 'Not performed'}</p>
        <p>One-minimal certificate: {data.one_minimal === true ? 'Reported for the declared neighborhood' : 'Not established'}. No global minimum or verified residency mechanism is implied.</p>
        <details><summary>Candidate decisions and witness checks</summary><pre className="overflow-auto max-h-72 text-xs">{JSON.stringify(data.history, null, 2)}</pre></details>
      </>}
      {document?.kind === 'dose' && <DoseResponse data={data} />}
      {document?.kind === 'analysis' && <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Purpose / origin</th><th>Planned</th><th>Reproduced</th><th>Valid negative</th><th>Invalid / missing</th><th>Median ratio</th></tr></thead><tbody>{records(data.groups).map((group, i) => <tr key={i} className="border-t border-slate-300"><td>{label(group.purpose)} / {label(group.data_origin)}</td><td>{value(group.planned_blocks)}</td><td>{value(group.reproduced)}</td><td>{value(group.valid_non_reproductions)}</td><td>{value(group.invalid_or_missing)}</td><td>{value(group.median_slowdown)}</td></tr>)}</tbody></table><p>Whole matched blocks are the replication unit. Search, validation, live measurements, and fixtures remain separate.</p></div>}
    </>}
  </section>;
};
