// Wire protocol shared with the SpillGuard agent (agent/spillguard/analyzer.py + runtime.py).
// The same frame objects are written to JSONL traces, so Live and Replay share one code path.

export type SpillMode = 'simulated' | 'live' | 'replay';
export type ProcState = 'OK' | 'PRESSURED' | 'SPILLING';
export type AdapterState = 'OK' | 'PRESSURE' | 'SPILL';

export interface SgProc {
  pid: number;
  name: string;
  dedicated_mb: number;
  shared_mb: number;
  committed_mb?: number;
  private_mb?: number | null;
  baseline_shared_mb: number;
  spill_mb: number;
  ratio: number;
  state: ProcState;
}

export interface SgCulprit {
  pid: number;
  name: string;
  growth_mb: number;
  held_mb: number;
  self_inflicted: boolean;
}

export interface SgEvent {
  type:
    | 'SPILL_START' | 'SPILL_END' | 'PRESSURE_START' | 'PRESSURE_END'
    | 'BUDGET_CHANGE' | 'OFFLOAD_SPLIT' | 'RAM_PRESSURE_START' | 'RAM_PRESSURE_END';
  t: number;
  pid?: number;
  name?: string;
  spill_mb?: number;
  ratio?: number;
  cause?: 'A' | 'B' | 'C' | 'B+C';
  culprit?: SgCulprit | null;
  duration_s?: number;
  peak_spill_mb?: number;
  model?: string;
  cpu_pct?: number;
  [k: string]: unknown;
}

export interface SgFrame {
  t: number;
  adapter: {
    luid: string;
    name: string;
    vram_total_mb: number;
    budget_mb: number | null;
    shared_cap_mb: number;
    dedicated_mb: number;
    shared_mb: number;
    load: number;
    state: AdapterState;
    nvml?: { used_mb: number; total_mb: number } | null;
  };
  procs: SgProc[];
  system: {
    commit_mb: number | null;
    commit_limit_mb: number | null;
    commit_pct: number | null;
    avail_mb: number | null;
    pages_per_sec: number;
    pagefile_pct: number;
    ram_pressure: boolean;
  };
  ollama: { name: string; size_mb: number; size_vram_mb: number; context_length?: number }[] | null;
  agent?: { cpu_pct: number; rss_mb: number };
  events: SgEvent[];
  summary: { state: AdapterState; spilling: { pid: number; name: string; spill_mb: number; ratio: number }[]; total_spill_mb: number; episodes: number };
}

export interface SgMachine {
  hostname?: string;
  os?: string;
  nvidia_driver?: string | null;
  ram_mb?: number;
  primary_luid?: string;
  adapters?: { luid: string; name: string; vendor: string; dedicated_vram_mb: number; budget_local_mb: number | null }[];
}

// Worker <-> main thread messages
export type BridgeIn =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'load-trace'; text: string; name: string }
  | { type: 'play' } | { type: 'pause' }
  | { type: 'speed'; value: number }
  | { type: 'seek'; index: number };

export type BridgeOut =
  | { type: 'status'; status: 'idle' | 'connecting' | 'live' | 'closed' | 'error'; detail?: string }
  | { type: 'hello'; machine: SgMachine; history: SgFrame[]; events: SgEvent[] }
  | { type: 'frame'; frame: SgFrame }
  | { type: 'replay-meta'; name: string; machine: SgMachine; count: number; t0: number; t1: number; relativeTime: boolean }
  | { type: 'replay-pos'; index: number; playing: boolean; history: SgFrame[]; events: SgEvent[] };
