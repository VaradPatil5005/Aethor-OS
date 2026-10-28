import { runBankersSafetyCheck } from '../kernel/BankersAlgorithm';
import type { BankerResult, BankerScenario } from '../types/kernel';
import type { SgFrame } from './types';

export const VRAM_MARGIN_MB = 256;
export const PEAK_FACTOR = 1.1;

export interface VramAdmission {
  scenario: BankerScenario;
  classic: BankerResult;          // textbook: assumes every process eventually finishes
  longLivedSafe: boolean;         // realistic: running apps never release, so reserve their need
  freeAfterReserveMb: number;
  claimMb: number;
  reason: string;
}

/**
 * Build a single-resource (VRAM, MB) Banker's scenario from a live/replayed frame.
 * Allocation = measured dedicated VRAM, Max = observed peak x 1.1, plus a new job
 * whose Max is `claimMb`. Available = physical VRAM - margin - sum(Allocation).
 * Mirrors agent/spillguard/bankers.py so the browser can show it offline in Replay.
 */
export function vramAdmission(frame: SgFrame, peaks: Record<number, number>, claimMb: number, topN = 6): VramAdmission {
  const V = frame.adapter.vram_total_mb;
  const holders = [...frame.procs].sort((a, b) => b.dedicated_mb - a.dedicated_mb);
  const shown = holders.slice(0, topN);
  const rest = holders.slice(topN);
  const restAlloc = rest.reduce((s, p) => s + p.dedicated_mb, 0);
  const restMax = rest.reduce((s, p) => s + Math.max(p.dedicated_mb, peaks[p.pid] ?? 0) * PEAK_FACTOR, 0);

  const processNames = [...shown.map((p) => `${p.name} (${p.pid})`), ...(rest.length ? [`${rest.length} others`] : []), 'NEW LAUNCH'];
  const allocation = [...shown.map((p) => [p.dedicated_mb]), ...(rest.length ? [[restAlloc]] : []), [0]];
  const maximum = [
    ...shown.map((p) => [Math.round(Math.max(p.dedicated_mb, peaks[p.pid] ?? 0) * PEAK_FACTOR)]),
    ...(rest.length ? [[Math.round(restMax)]] : []),
    [Math.round(claimMb)],
  ];
  const held = allocation.reduce((s, r) => s + r[0], 0);
  const available = [Math.max(0, V - VRAM_MARGIN_MB - held)];
  const scenario: BankerScenario = { processNames, resourceNames: ['VRAM (MB)'], available, maximum, allocation };
  const classic = runBankersSafetyCheck(scenario);

  const runningNeed = maximum.slice(0, -1).reduce((s, r, i) => s + Math.max(0, r[0] - allocation[i][0]), 0);
  const freeAfterReserveMb = available[0] - runningNeed;
  const longLivedSafe = claimMb <= freeAfterReserveMb;
  const top = shown[0];
  const reason = longLivedSafe
    ? `fits: ${(claimMb / 1024).toFixed(1)} GB requested, ${(freeAfterReserveMb / 1024).toFixed(1)} GB free after reserving running apps' growth`
    : `needs ${(claimMb / 1024).toFixed(1)} GB VRAM, ${(Math.max(0, freeAfterReserveMb) / 1024).toFixed(1)} GB free` +
      (top ? `; ${top.name} holds ${(top.dedicated_mb / 1024).toFixed(1)} GB` : '');
  return { scenario, classic, longLivedSafe, freeAfterReserveMb, claimMb, reason };
}
