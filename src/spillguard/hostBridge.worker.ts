/// <reference lib="webworker" />
// HostBridge: owns the agent WebSocket (Live) or a parsed JSONL trace (Replay) off the
// main thread, and posts analyzed frames to the UI. Same frame schema in both modes.
import type { BridgeIn, BridgeOut, SgEvent, SgFrame, SgMachine } from './types';

const post = (m: BridgeOut) => (self as unknown as Worker).postMessage(m);
const HISTORY = 300;

// ---- live -----------------------------------------------------------------------------
let ws: WebSocket | null = null;
let liveUrl: string | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function connect(url: string) {
  stopReplay();
  liveUrl = url;
  if (ws) ws.close();
  post({ type: 'status', status: 'connecting' });
  const sock = new WebSocket(url);
  ws = sock;
  sock.onopen = () => { retry = 0; post({ type: 'status', status: 'live' }); };
  sock.onmessage = (ev) => {
    const msg = JSON.parse(ev.data as string);
    if (msg.type === 'hello') post({ type: 'hello', machine: msg.machine, history: msg.history, events: msg.events });
    else if (msg.type === 'frame') post({ type: 'frame', frame: msg.frame });
  };
  sock.onclose = (ev) => {
    if (ws !== sock) return;
    ws = null;
    if (ev.code === 4401) { post({ type: 'status', status: 'error', detail: 'agent rejected the session token' }); liveUrl = null; return; }
    post({ type: 'status', status: 'closed', detail: 'agent connection lost; retrying' });
    if (liveUrl) {
      retry = Math.min(retry + 1, 5);
      retryTimer = setTimeout(() => liveUrl && connect(liveUrl), 1000 * retry);
    }
  };
}

function disconnect() {
  liveUrl = null;
  if (retryTimer) clearTimeout(retryTimer);
  if (ws) { const s = ws; ws = null; s.close(); }
  post({ type: 'status', status: 'idle' });
}

// ---- replay ---------------------------------------------------------------------------
let frames: SgFrame[] = [];
let pos = 0;
let playing = false;
let speed = 1;
let timer: ReturnType<typeof setTimeout> | null = null;

function stopReplay() {
  playing = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

function snapshot(index: number): { history: SgFrame[]; events: SgEvent[] } {
  const lo = Math.max(0, index - HISTORY + 1);
  const history = frames.slice(lo, index + 1);
  const events: SgEvent[] = [];
  for (let i = 0; i <= index; i++) events.push(...(frames[i].events || []));
  return { history, events: events.slice(-300) };
}

function emitPos() {
  if (!frames.length) return;
  post({ type: 'replay-pos', index: pos, playing, ...snapshot(pos) });
}

function scheduleNext() {
  if (!playing) return;
  if (pos >= frames.length - 1) { playing = false; emitPos(); return; }
  const dt = Math.max(50, (frames[pos + 1].t - frames[pos].t) * 1000 / speed);
  timer = setTimeout(() => {
    pos += 1;
    post({ type: 'frame', frame: frames[pos] });
    if (pos % 5 === 0 || pos === frames.length - 1) emitPos();
    scheduleNext();
  }, dt);
}

function loadTrace(text: string, name: string) {
  disconnect();
  stopReplay();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  let machine: SgMachine = {};
  let relativeTime = false;
  frames = [];
  for (const line of lines) {
    const obj = JSON.parse(line);
    if (obj.type === 'header') { machine = obj.machine || {}; relativeTime = obj.timestamps === 'relative seconds'; continue; }
    if (!obj.summary) {
      post({ type: 'status', status: 'error', detail: 'raw (un-analyzed) trace: run `spillguard analyze <trace> -o out.jsonl` first' });
      return;
    }
    frames.push(obj as SgFrame);
  }
  if (!frames.length) { post({ type: 'status', status: 'error', detail: 'trace has no frames' }); return; }
  pos = 0;
  post({ type: 'replay-meta', name, machine, relativeTime, count: frames.length, t0: frames[0].t, t1: frames[frames.length - 1].t });
  post({ type: 'frame', frame: frames[0] });
  emitPos();
}

self.onmessage = (ev: MessageEvent<BridgeIn>) => {
  const m = ev.data;
  switch (m.type) {
    case 'connect': connect(m.url); break;
    case 'disconnect': disconnect(); break;
    case 'load-trace':
      try { loadTrace(m.text, m.name); } catch (e) { post({ type: 'status', status: 'error', detail: `bad trace: ${String(e)}` }); }
      break;
    case 'play':
      if (!frames.length || playing) break;
      if (pos >= frames.length - 1) pos = 0;
      playing = true; emitPos(); scheduleNext(); break;
    case 'pause': stopReplay(); emitPos(); break;
    case 'speed': speed = m.value; break;
    case 'seek':
      if (!frames.length) break;
      pos = Math.max(0, Math.min(frames.length - 1, m.index));
      post({ type: 'frame', frame: frames[pos] });
      emitPos();
      if (playing) { if (timer) clearTimeout(timer); scheduleNext(); }
      break;
  }
};
