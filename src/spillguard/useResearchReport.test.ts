import { expect, it } from 'vitest';
import { useResearchReport } from './useResearchReport';

it('retains a report in memory across subscribers and clears it explicitly', () => {
  useResearchReport.getState().accept({ kind: 'analysis', data: { groups: [] } }, 'summary.json');
  useResearchReport.getState().selectTrial(2);
  const unsubscribe = useResearchReport.subscribe(() => undefined);
  unsubscribe();
  expect(useResearchReport.getState().fileName).toBe('summary.json');
  expect(useResearchReport.getState().trialIndex).toBe(2);
  useResearchReport.getState().clear();
  expect(useResearchReport.getState().document).toBeNull();
});
