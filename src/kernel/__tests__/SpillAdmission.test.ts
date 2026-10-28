import { describe, expect, it } from 'vitest';
import { vramAdmission, VRAM_MARGIN_MB } from '../../spillguard/admission';
import type { SgFrame } from '../../spillguard/types';

const frame = (procs: [number, string, number][]): SgFrame => ({
  t: 0,
  adapter: { luid: 'x', name: 'RTX 3050 6GB', vram_total_mb: 6000, budget_mb: 5200, shared_cap_mb: 7800, dedicated_mb: procs.reduce((s, p) => s + p[2], 0), shared_mb: 0, load: 0, state: 'OK' },
  procs: procs.map(([pid, name, d]) => ({ pid, name, dedicated_mb: d, shared_mb: 0, baseline_shared_mb: 0, spill_mb: 0, ratio: 0, state: 'OK' })),
  system: { commit_mb: 1, commit_limit_mb: 2, commit_pct: 50, avail_mb: 4000, pages_per_sec: 0, pagefile_pct: 0, ram_pressure: false },
  ollama: null, events: [], summary: { state: 'OK', spilling: [], total_spill_mb: 0, episodes: 0 },
});

describe('SpillGuard VRAM admission (browser Banker\'s)', () => {
  it('builds Allocation / Max / Available from a real frame', () => {
    const a = vramAdmission(frame([[1, 'chrome.exe', 1000], [2, 'dwm.exe', 200]]), { 1: 1200 }, 2000);
    expect(a.scenario.allocation.map((r) => r[0])).toEqual([1000, 200, 0]);
    expect(a.scenario.maximum.map((r) => r[0])).toEqual([1320, 220, 2000]); // peak x 1.1
    expect(a.scenario.available[0]).toBe(6000 - VRAM_MARGIN_MB - 1200);
  });

  it('textbook check can say SAFE while the long-lived check denies', () => {
    // chrome may still grow to 3.3 GB; a 2.5 GB claim only fits if chrome eventually exits
    const a = vramAdmission(frame([[1, 'chrome.exe', 2000]]), { 1: 3000 }, 2500);
    expect(a.classic.isSafe).toBe(true);
    expect(a.longLivedSafe).toBe(false);
    expect(a.reason).toContain('chrome.exe');
  });

  it('admits a claim that fits after reserving running apps\' growth', () => {
    const a = vramAdmission(frame([[1, 'dwm.exe', 200]]), {}, 4000);
    expect(a.longLivedSafe).toBe(true);
    expect(a.freeAfterReserveMb).toBe(6000 - 256 - 200 - 20);
  });
});
