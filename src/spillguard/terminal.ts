// `spillguard ...` commands for aethersh. Async because `fit` asks the local agent.
import { useSpillStore } from '../stores/useSpillStore';
import { describeEvent, fmtMB, fmtTime } from './components';
import type { SpillMode } from './types';

const HELP = `spillguard — real GPU memory spill on this PC (Live) or a recorded trace (Replay)
  spillguard status              VRAM / shared / RAM tiers and per-process state
  spillguard why <pid>           explain one process's spill state and its culprit
  spillguard events              recent SPILL_START / SPILL_END / OFFLOAD_SPLIT events
  spillguard fit <model> [ctx] [f16|q8_0|q4_0]   VRAM estimate + Banker's admission (Live)
  spillguard mode <simulated|live|replay>         switch the data source
  spillguard demo                replay the RTX 3050 spill trace
  spillguard run -- <cmd>        (host CLI only; launching programs is never done from the browser)`;

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);

export async function runSpillguardCommand(args: string[]): Promise<string> {
  const st = useSpillStore.getState();
  const sub = args[0]?.toLowerCase();
  if (!sub || sub === 'help') return HELP;

  if (sub === 'mode') {
    const m = args[1] as SpillMode;
    if (!['simulated', 'live', 'replay'].includes(m)) return 'usage: spillguard mode <simulated|live|replay>';
    st.setMode(m);
    return `[SpillGuard] data source -> ${m}`;
  }
  if (sub === 'demo') {
    await st.loadDemoTrace();
    setTimeout(() => useSpillStore.getState().play(), 100);
    return '[SpillGuard] replaying W1 spill stress trace (RTX 3050 6 GB laptop). Open SpillGuard to watch.';
  }
  if (sub === 'run') {
    return `For safety, the browser never launches programs. In a host terminal run:
  python -m spillguard run ${args.slice(1).join(' ') || '-- ollama run <model>'}
It checks the launch with Banker's admission control and asks before starting anything.`;
  }

  const f = st.latest;
  if (!f || st.mode === 'simulated') return 'No real data. Use `spillguard mode live` (agent running) or `spillguard demo`.';
  const ad = f.adapter;

  if (sub === 'status') {
    let out = `${ad.name}  [${ad.state}]  (${st.mode})\n`;
    out += `  VRAM    ${lpad(ad.dedicated_mb, 6)} / ${ad.vram_total_mb} MB (${Math.round(ad.load * 100)}%)  OS budget ${ad.budget_mb ?? '—'} MB\n`;
    out += `  shared  ${lpad(ad.shared_mb, 6)} MB of ${ad.shared_cap_mb} MB cap\n`;
    out += `  RAM     commit ${f.system.commit_pct ?? '—'}%  available ${f.system.avail_mb ?? '—'} MB${f.system.ram_pressure ? '  RAM PRESSURE (type C)' : ''}\n\n`;
    out += `  ${lpad('PID', 6)}  ${pad('PROCESS', 26)}${lpad('VRAM', 7)}${lpad('SHARED', 8)}${lpad('SPILL', 7)}  STATE\n`;
    for (const p of f.procs.slice(0, 10)) {
      out += `  ${lpad(p.pid, 6)}  ${pad(p.name.slice(0, 25), 26)}${lpad(p.dedicated_mb, 7)}${lpad(p.shared_mb, 8)}${lpad(p.spill_mb, 7)}  ${p.state}\n`;
    }
    return out;
  }

  if (sub === 'why') {
    const pid = Number(args[1]);
    const p = f.procs.find((x) => x.pid === pid);
    if (!p) return `PID ${args[1] ?? '?'} holds no memory on ${ad.name}. Try \`spillguard status\`.`;
    let out = `${p.name} (PID ${p.pid})\n  in VRAM        ${fmtMB(p.dedicated_mb)}\n  in shared RAM  ${fmtMB(p.shared_mb)} (baseline ${fmtMB(p.baseline_shared_mb)})\n`;
    out += `  spilled        ${fmtMB(p.spill_mb)}  -> ${Math.round(p.ratio * 100)}% of its GPU memory is in system RAM\n`;
    out += p.state === 'SPILLING'
      ? '  verdict        SPILLING (type B: driver/WDDM paged its allocations out of VRAM)\n'
      : p.state === 'PRESSURED' ? '  verdict        VRAM under pressure; this process has not spilled\n' : '  verdict        no spill\n';
    const evs = st.events.filter((e) => e.pid === pid).slice(-4);
    for (const e of evs) out += `  ${fmtTime(e.t)} ${e.type} ${describeEvent(e)}\n`;
    return out;
  }

  if (sub === 'events') {
    if (!st.events.length) return '(no events yet)';
    return st.events.slice(-15).map((e) => `${fmtTime(e.t)}  ${pad(e.type, 19)}${describeEvent(e)}`).join('\n');
  }

  if (sub === 'fit') {
    const model = args[1];
    if (!model) return 'usage: spillguard fit <model> [ctx] [f16|q8_0|q4_0]';
    try {
      const r = await st.api<any>('/api/advise', { model, n_ctx: Number(args[2]) || 4096, kv_type: args[3] || 'f16' });
      const e = r.estimate;
      let out = `${r.model.name} (${r.model.quant}, ${r.model.n_layer} layers)\n`;
      out += `  weights ${fmtMB(e.weights_mb)} + KV ${fmtMB(e.kv_mb)} + buffers ${fmtMB(e.buffer_mb)} + CUDA ${fmtMB(e.overhead_mb)} = ${fmtMB(e.total_mb)}\n`;
      out += `  verdict: ${r.verdict}${r.verdict !== 'SAFE' ? ` — ${r.reason}` : ''}\n`;
      if (r.verdict === 'FIXABLE') {
        const c = r.suggested.config;
        out += `  suggested: ctx ${c.n_ctx}, KV ${c.kv_type}${c.flash_attn ? ', flash-attn' : ''} -> ${fmtMB(r.suggested.vram_mb)}\n`;
      }
      return out + `  [${r.calibration}]`;
    } catch (err) {
      return `fit failed: ${(err as Error).message}`;
    }
  }
  return `unknown subcommand '${sub}'.\n${HELP}`;
}
