import { create } from 'zustand';
import { ResearchDocument } from './report';

// Window maximize/restore remounts app content. Keep imports in memory across
// those transitions, without persisting report contents to browser storage.
interface ReportState {
  document: ResearchDocument | null;
  fileName: string;
  trialIndex: number;
  accept: (document: ResearchDocument, fileName: string) => void;
  clear: () => void;
  selectTrial: (trialIndex: number) => void;
}
export const useResearchReport = create<ReportState>(set => ({
  document: null, fileName: '', trialIndex: 0,
  accept: (document, fileName) => set({ document, fileName, trialIndex: 0 }),
  clear: () => set({ document: null, fileName: '', trialIndex: 0 }),
  selectTrial: trialIndex => set({ trialIndex }),
}));
