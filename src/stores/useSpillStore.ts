import { create } from 'zustand';
import type { BridgeIn, BridgeOut, SgEvent, SgFrame, SgMachine, SpillMode } from '../spillguard/types';

const HISTORY = 300;

interface AgentSession { base: string; token: string }

interface SpillStore {
  mode: SpillMode;
  status: 'idle' | 'connecting' | 'live' | 'closed' | 'error';
  statusDetail: string | null;
  session: AgentSession | null;
  machine: SgMachine;
  latest: SgFrame | null;
  history: SgFrame[];
  events: SgEvent[];
  peaks: Record<number, number>;
  replay: { name: string; count: number; index: number; playing: boolean; speed: number; relativeTime: boolean } | null;

  setMode: (m: SpillMode) => void;
  connect: (session?: AgentSession) => void;
  loadTrace: (text: string, name: string) => void;
  loadDemoTrace: () => Promise<void>;
  play: () => void;
  pause: () => void;
  setSpeed: (v: number) => void;
  seek: (i: number) => void;
  api: <T = unknown>(path: string, body?: unknown) => Promise<T>;
}

let worker: Worker | null = null;
const send = (m: BridgeIn) => worker?.postMessage(m);

function trackPeaks(peaks: Record<number, number>, f: SgFrame): Record<number, number> {
  const next: Record<number, number> = {};
  for (const p of f.procs) next[p.pid] = Math.max(peaks[p.pid] ?? 0, p.dedicated_mb);
  return next;
}

/** Read `#sg=<token>[&agent=host:port]` written by `spillguard serve`, then scrub it from the URL bar. */
function sessionFromHash(): AgentSession | null {
  if (typeof window === 'undefined') return null;
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token = h.get('sg');
  if (!token) return null;
  const agent = h.get('agent');
  const base = agent ? `http://${agent}` : window.location.origin;
  history.replaceState(null, '', window.location.pathname + window.location.search);
  try { sessionStorage.setItem('spillguard.session', JSON.stringify({ base, token })); } catch { /* storage blocked */ }
  return { base, token };
}

function storedSession(): AgentSession | null {
  try {
    const s = sessionStorage.getItem('spillguard.session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export const useSpillStore = create<SpillStore>((set, get) => {
  if (typeof Worker !== 'undefined') {
    worker = new Worker(new URL('../spillguard/hostBridge.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<BridgeOut>) => {
      const m = ev.data;
      switch (m.type) {
        case 'status':
          set({ status: m.status, statusDetail: m.detail ?? null });
          if (m.status === 'error' && m.detail?.includes('token')) {
            try { sessionStorage.removeItem('spillguard.session'); } catch { /* storage blocked */ }
            set({ statusDetail: 'session expired (agent restarted?): open the new link printed by `spillguard serve`' });
          }
          break;
        case 'hello': {
          let peaks: Record<number, number> = {};
          for (const f of m.history) peaks = trackPeaks(peaks, f);
          set({ machine: m.machine, history: m.history.slice(-HISTORY), events: m.events, latest: m.history[m.history.length - 1] ?? null, peaks });
          break;
        }
        case 'frame': {
          const f = m.frame;
          set((s) => ({
            latest: f,
            peaks: trackPeaks(s.peaks, f),
            // Replay also appends between the worker's periodic authoritative snapshots (replay-pos).
            history: s.mode !== 'simulated' ? [...s.history.slice(-(HISTORY - 1)), f] : s.history,
            events: s.mode !== 'simulated' && f.events.length ? [...s.events, ...f.events].slice(-300) : s.events,
          }));
          break;
        }
        case 'replay-meta':
          set({ machine: m.machine, replay: { name: m.name, count: m.count, index: 0, playing: false, speed: get().replay?.speed ?? 4, relativeTime: m.relativeTime }, status: 'idle', statusDetail: null, peaks: {} });
          break;
        case 'replay-pos':
          set((s) => ({
            history: m.history, events: m.events,
            replay: s.replay ? { ...s.replay, index: m.index, playing: m.playing } : s.replay,
          }));
          break;
      }
    };
  }

  const initial = sessionFromHash() ?? storedSession();

  const store: SpillStore = {
    mode: initial ? 'live' : 'simulated',
    status: 'idle',
    statusDetail: null,
    session: initial,
    machine: {},
    latest: null,
    history: [],
    events: [],
    peaks: {},
    replay: null,

    setMode: (mode) => {
      if (mode === get().mode) return;
      send({ type: 'pause' });
      set({ mode, latest: null, history: [], events: [], peaks: {}, statusDetail: null });
      if (mode === 'live') get().connect();
      else send({ type: 'disconnect' });
      if (mode !== 'replay') set({ replay: null });
    },
    connect: (session) => {
      const s = session ?? get().session;
      if (!s) { set({ status: 'error', statusDetail: 'no agent session: start `spillguard serve` and open the link it prints' }); return; }
      set({ session: s, mode: 'live' });
      const ws = s.base.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(s.token);
      send({ type: 'connect', url: ws });
    },
    loadTrace: (text, name) => {
      set({ mode: 'replay', latest: null, history: [], events: [], peaks: {} });
      send({ type: 'load-trace', text, name });
    },
    loadDemoTrace: async () => {
      const r = await fetch('/traces/demo-w1-rtx3050.jsonl');
      if (!r.ok) { set({ status: 'error', statusDetail: 'demo trace missing from this build' }); return; }
      get().loadTrace(await r.text(), 'W1 spill stress · RTX 3050 6 GB laptop');
    },
    play: () => send({ type: 'play' }),
    pause: () => send({ type: 'pause' }),
    setSpeed: (value) => { send({ type: 'speed', value }); set((s) => ({ replay: s.replay ? { ...s.replay, speed: value } : null })); },
    seek: (index) => send({ type: 'seek', index }),
    api: async (path, body) => {
      const s = get().session;
      if (!s || get().mode !== 'live') throw new Error('needs Live mode with the SpillGuard agent running');
      const r = await fetch(s.base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${s.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || j.detail || `HTTP ${r.status}`);
      return j;
    },
  };
  if (initial) setTimeout(() => get().connect(initial), 0);
  if (typeof window !== 'undefined') {
    // A restarted agent prints a new link; following it only changes the hash, not the page.
    window.addEventListener('hashchange', () => {
      const s = sessionFromHash();
      if (s) get().connect(s);
    });
  }
  return store;
});
