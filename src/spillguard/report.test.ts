import { describe, expect, it } from 'vitest';
import { number, outcomeLabel, parseResearchDocument } from './report';

const experiment = { schema_version: 1, complete: true, verdict: { outcome: 'PASS' },
  trials: [{ verdict: { outcome: 'PASS' }, stages: [{ stage: 'baseline', completed: true, latency_ms: 12 }] }] };
describe('research report imports', () => {
  it('keeps valid non-reproductions distinct from failures', () => {
    expect(parseResearchDocument(JSON.stringify(experiment)).kind).toBe('experiment');
    expect(outcomeLabel('PASS')).toBe('Valid non-reproduction');
    expect(outcomeLabel('FAIL')).toBe('Slowdown reproduced');
    expect(number(null)).toBeNull();
    expect(number(Infinity)).toBeNull();
  });
  it('rejects ambiguous stages and invalid measurements', () => {
    const trial = experiment.trials[0];
    expect(() => parseResearchDocument(JSON.stringify({ ...experiment, trials: [{ ...trial, stages: [trial.stages[0], trial.stages[0]] }] }))).toThrow('duplicate');
    expect(() => parseResearchDocument(JSON.stringify({ ...experiment, trials: [{ ...trial, stages: [{ ...trial.stages[0], latency_ms: -1 }] }] }))).toThrow('measurement');
    expect(() => parseResearchDocument(JSON.stringify({ ...experiment, verdict: { outcome: 'success' } }))).toThrow('outcome');
  });
  it('rejects analysis that hides missing or invalid blocks', () => {
    const data = { schema_version: 1, groups: [{ planned_blocks: 6, reproduced: 2, valid_non_reproductions: 1, invalid_or_missing: 3 }] };
    expect(parseResearchDocument(JSON.stringify(data)).kind).toBe('analysis');
    data.groups[0].invalid_or_missing = 0;
    expect(() => parseResearchDocument(JSON.stringify(data))).toThrow('reconcile');
  });
  it('accepts the earlier plain-ddmin report format', () => {
    const data = { schema_version: 1, method: 'plain-ddmin-action-deletion', recipe: {}, search: [], validation: null };
    expect(parseResearchDocument(JSON.stringify(data)).kind).toBe('reduction');
  });
  it('bounds the import and rejects unknown schemas', () => {
    expect(() => parseResearchDocument(' '.repeat(8 * 1024 * 1024 + 1))).toThrow('exceeds');
    expect(() => parseResearchDocument('{"schema_version":2}')).toThrow('version');
  });
});

describe('dose-response summaries', () => {
  const dose = { gpu: 'RTX 3050', physical_vram_mib: 6002, target_estimate_mib: 2421, levels: [
    { planned_overflow_mib: -512, holder_mib: 2941, trials: [{ trial: 1, verdict: { outcome: 'PASS', slowdown: 1.01 } }] },
    { planned_overflow_mib: 256, holder_mib: 3709, trials: [{ trial: 1, verdict: { outcome: 'FAIL', slowdown: 3.2 } }] },
  ] };
  it('recognises a dose-response summary', () => {
    expect(parseResearchDocument(JSON.stringify(dose)).kind).toBe('dose');
  });
  it('rejects levels with invalid verdicts or sizes', () => {
    expect(() => parseResearchDocument(JSON.stringify({ ...dose, levels: [{ ...dose.levels[0], holder_mib: -1 }] }))).toThrow('dose level');
    expect(() => parseResearchDocument(JSON.stringify({ ...dose, levels: [{ ...dose.levels[0], trials: [{ verdict: { outcome: 'ok' } }] }] }))).toThrow('outcome');
  });
});
