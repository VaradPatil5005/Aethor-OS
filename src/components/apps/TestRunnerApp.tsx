import React, { useState } from 'react';
import { TestHarness, TestResult } from '../../kernel/TestHarness';
import { useKernelStore } from '../../stores/useKernelStore';
import { retroAudio } from '../../utils/audio';
import { CheckCircle2, XCircle, Play, Download, ShieldCheck } from 'lucide-react';

type Tab = 'tests' | 'journal' | 'export';
const FILTERS = ['ALL', 'SCHEDULER', 'MEMORY', 'DEADLOCK', 'VFS'];

export const TestRunnerApp: React.FC = () => {
  const { journal, stats, vfsInodes, processes } = useKernelStore();
  const [activeTab, setActiveTab] = useState<Tab>('tests');
  const [testResults, setTestResults] = useState<TestResult[]>(() => TestHarness.runAllTests());
  const [isRunning, setIsRunning] = useState(false);
  const [journalFilter, setJournalFilter] = useState('ALL');

  const runTests = () => {
    retroAudio.playClickSound();
    setIsRunning(true);
    setTimeout(() => {
      setTestResults(TestHarness.runAllTests());
      setIsRunning(false);
      retroAudio.playBootChime();
    }, 400);
  };

  const handleExportDisk = () => {
    retroAudio.playClickSound();
    const blob = new Blob([JSON.stringify({ timestamp: new Date().toISOString(), stats, processes, vfsInodes, journal }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aetheros-disk-snapshot-tick-${stats.tick}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredJournal = journal.filter((e) => journalFilter === 'ALL' || e.type.toUpperCase().includes(journalFilter));
  const passedCount = testResults.filter((r) => r.passed).length;
  const totalCount = testResults.length;
  const allPass = passedCount === totalCount;

  const tabs: [Tab, string][] = [
    ['tests', `Test suite (${passedCount}/${totalCount})`],
    ['journal', `Event journal (${journal.length})`],
    ['export', 'Disk snapshot'],
  ];

  return (
    <div className="h-full w-full flex flex-col min-h-0 min-w-0 bg-[var(--rt-panel)] font-pixel text-[13px]">
      {/* Tab strip */}
      <div className="shrink-0 flex items-center justify-between gap-2 flex-wrap px-2 py-2 border-b-2 border-black bg-[var(--rt-side)]">
        <div className="flex border-2 border-black bg-white" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => { retroAudio.playClickSound(); setActiveTab(id); }}
              className={`px-2.5 py-0.5 font-bold border-r-2 last:border-r-0 border-black ${activeTab === id ? 'bg-black text-white' : 'hover:bg-[var(--rt-soft)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={runTests} disabled={isRunning} className="rt-btn rt-btn-sm">
          <Play className="w-3.5 h-3.5 fill-current" /> {isRunning ? 'Running…' : 'Run all tests'}
        </button>
      </div>

      {activeTab === 'tests' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          <div className={`rt-raised p-3 flex items-center justify-between gap-3 flex-wrap ${allPass ? 'bg-[#dcf7d9]' : 'bg-[#ffe3e1]'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-6 h-6 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-[14px]">Kernel verification suite</div>
                <div className="font-terminal text-[17px] leading-tight text-[var(--rt-muted)]">
                  Checks the simulated kernel's invariants, not just the UI.
                </div>
              </div>
            </div>
            <div className="text-right font-terminal">
              <div className="text-[26px] leading-none">{passedCount} / {totalCount}</div>
              <div className="text-[16px]">{allPass ? 'all passing' : `${totalCount - passedCount} failing`}</div>
            </div>
          </div>

          {(['Unit', 'Integration', 'E2E'] as const).map((category) => {
            const items = testResults.filter((t) => t.category === category);
            if (!items.length) return null;
            return (
              <section key={category} className="space-y-1.5">
                <h3 className="font-bold uppercase tracking-wide border-b-2 border-black pb-0.5">
                  {category} tests ({items.filter((i) => i.passed).length}/{items.length})
                </h3>
                {items.map((t) => (
                  <div key={t.id} className="bg-white rt-sunken p-2 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      {t.passed
                        ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" aria-label="passed" />
                        : <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#c0261b]" aria-label="failed" />}
                      <div className="min-w-0">
                        <div className="font-bold">{t.name}</div>
                        <div className="font-terminal text-[17px] leading-tight text-[var(--rt-muted)] break-words">{t.message}</div>
                      </div>
                    </div>
                    <span className="font-terminal text-[16px] shrink-0">{t.durationMs} ms</span>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {activeTab === 'journal' && (
        <div className="flex-1 min-h-0 flex flex-col p-3 gap-2">
          <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
            <span className="font-bold mr-1">Filter:</span>
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => { retroAudio.playClickSound(); setJournalFilter(f); }}
                className={`rt-btn rt-btn-sm ${journalFilter === f ? '!bg-black !text-white' : ''}`}
                aria-pressed={journalFilter === f}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-auto bg-white rt-sunken font-terminal text-[17px]">
            {filteredJournal.length === 0 ? (
              <div className="p-4 text-center text-[var(--rt-muted)]">No events for this filter.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[var(--rt-side)] font-pixel text-[12px]">
                  <tr className="border-b-2 border-black">
                    <th className="px-2 py-1 w-16">Tick</th>
                    <th className="px-2 py-1 w-36">Subsystem</th>
                    <th className="px-2 py-1">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJournal.map((e, i) => (
                    <tr key={i} className="border-b border-black/15 rt-row">
                      <td className="px-2 py-0.5">#{e.tick}</td>
                      <td className="px-2 py-0.5 font-bold">{e.type}</td>
                      <td className="px-2 py-0.5">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'export' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <section className="bg-white rt-raised p-3 space-y-3">
            <div>
              <h3 className="font-bold text-[14px] mb-1">Deterministic disk image</h3>
              <p className="font-terminal text-[18px] leading-tight text-[var(--rt-muted)]">
                Save the whole OS state as a JSON snapshot: processes and their PCBs, physical frames, the inode tree
                and the full audit journal, for offline checking.
              </p>
            </div>
            <ul className="rt-sunken bg-[var(--rt-soft)] p-2 font-terminal text-[18px] leading-tight space-y-0.5">
              <li>System clock: tick #{stats.tick}</li>
              <li>Processes: {processes.length}</li>
              <li>VFS inodes: {vfsInodes.length}</li>
              <li>Journal entries: {journal.length}</li>
            </ul>
            <button onClick={handleExportDisk} className="rt-btn">
              <Download className="w-4 h-4" /> Export disk image (.json)
            </button>
          </section>
        </div>
      )}
    </div>
  );
};
