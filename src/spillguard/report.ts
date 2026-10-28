export type Outcome = 'FAIL' | 'PASS' | 'INCONCLUSIVE';
type RecordValue = Record<string, unknown>;
export interface ResearchDocument { kind: 'experiment' | 'reduction' | 'analysis' | 'dose'; data: RecordValue }
const object = (value: unknown): RecordValue => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a report object.');
  return value as RecordValue;
};
export const records = (value: unknown, limit = 1000): RecordValue[] => {
  if (!Array.isArray(value) || value.length > limit) throw new Error('Invalid report list.');
  return value.map(object);
};
export const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
export const label = (value: unknown): string => typeof value === 'string' ? value.slice(0, 500) : 'Unavailable';
export const outcomeLabel = (value: unknown): string => value === 'FAIL' ? 'Slowdown reproduced' : value === 'PASS' ? 'Valid non-reproduction' : 'Inconclusive';
const outcome = (value: unknown) => { if (!['FAIL', 'PASS', 'INCONCLUSIVE'].includes(String(value))) throw new Error('Invalid outcome.'); };
export function parseResearchDocument(source: string): ResearchDocument {
  if (source.length > 8 * 1024 * 1024) throw new Error('Report exceeds 8 MiB.');
  const data = object(JSON.parse(source));
  // Dose-response summary written by bench/dose_response.py (no schema_version of its own).
  if (Array.isArray(data.levels) && typeof data.physical_vram_mib === 'number') {
    for (const level of records(data.levels, 100)) {
      if (typeof level.planned_overflow_mib !== 'number' || number(level.holder_mib) === null) throw new Error('Invalid dose level.');
      for (const trial of records(level.trials, 100)) outcome(object(trial.verdict).outcome);
    }
    return { kind: 'dose', data };
  }
  if (data.schema_version !== 1) throw new Error('Unsupported report version.');
  if (Array.isArray(data.groups)) {
    for (const group of records(data.groups)) {
      for (const field of ['planned_blocks', 'reproduced', 'valid_non_reproductions', 'invalid_or_missing']) {
        const value = number(group[field]);
        if (value === null || !Number.isInteger(value)) throw new Error('Invalid whole-block count.');
      }
      if (Number(group.reproduced) + Number(group.valid_non_reproductions) + Number(group.invalid_or_missing) !== group.planned_blocks) throw new Error('Block counts do not reconcile.');
    }
    return { kind: 'analysis', data };
  }
  if (data.reduced_recipe) {
    object(data.reduced_recipe); object(data.original_recipe);
    records(data.history, 10000);
    if (data.fresh_validation !== null && data.fresh_validation !== undefined) outcome(object(data.fresh_validation).outcome);
    return { kind: 'reduction', data };
  }
  if (data.method === 'plain-ddmin-action-deletion' && data.recipe) {
    object(data.recipe);
    const history = records(data.search, 10000);
    return { kind: 'reduction', data: { ...data, reduced_recipe: data.recipe, history,
      fresh_validation: data.validation, executed_tests: history.length + (data.validation ? 1 : 0) } };
  }
  const verdict = object(data.verdict);
  outcome(verdict.outcome);
  if (typeof data.complete !== 'boolean') throw new Error('Missing completion status.');
  for (const trial of records(data.trials, 1000)) {
    outcome(object(trial.verdict).outcome);
    const stages = records(trial.stages, 3);
    const names = stages.map(stage => stage.stage);
    if (new Set(names).size !== names.length || names.some(name => !['baseline', 'pressure', 'recovery'].includes(String(name)))) throw new Error('Invalid or duplicate stage.');
    for (const stage of stages) {
      if (typeof stage.completed !== 'boolean') throw new Error('Missing stage completion status.');
      for (const field of ['latency_ms', 'metric_value']) if (stage[field] !== null && stage[field] !== undefined && number(stage[field]) === null) throw new Error('Invalid stage measurement.');
    }
  }
  return { kind: 'experiment', data };
}
