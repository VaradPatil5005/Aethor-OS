import React, { useState } from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { retroAudio } from '../../utils/audio';
import { ShieldAlert, CheckCircle2, AlertOctagon, Zap, Calculator, ArrowRight } from 'lucide-react';
import { runBankersSafetyCheck } from '../../kernel/BankersAlgorithm';
import { BankerResult, BankerScenario } from '../../types/kernel';

const BANKER_DEMO_SCENARIO: BankerScenario = {
  processNames: ['P0', 'P1', 'P2', 'P3', 'P4'],
  resourceNames: ['A', 'B', 'C'],
  available: [3, 3, 2],
  maximum: [
    [7, 5, 3],
    [3, 2, 2],
    [9, 0, 2],
    [2, 2, 2],
    [4, 3, 3]
  ],
  allocation: [
    [0, 1, 0],
    [2, 0, 0],
    [3, 0, 2],
    [2, 1, 1],
    [0, 0, 2]
  ]
};

export const DeadlockLabApp: React.FC = () => {
  const { deadlockState, triggerDeadlock, terminateProcess } = useKernelStore();
  const [bankerResult, setBankerResult] = useState<BankerResult | null>(null);

  const handleInjectDeadlock = () => {
    retroAudio.playErrorSound();
    triggerDeadlock();
  };

  const handleRunBankers = () => {
    retroAudio.playClickSound();
    const res = runBankersSafetyCheck(BANKER_DEMO_SCENARIO);
    setBankerResult(res);
  };

  return (
    <div className="h-full w-full bg-[#cecece] text-black flex flex-col p-3 font-pixel select-none overflow-y-auto space-y-3 text-xs min-h-0 min-w-0 overscroll-contain">
      {/* Top Status Banner */}
      <div className={`p-3 border-2 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] flex items-center justify-between ${
        deadlockState.isDeadlocked 
          ? 'bg-rose-100 border-rose-600 text-rose-900 animate-pulse' 
          : 'bg-emerald-100 border-emerald-600 text-emerald-900'
      }`}>
        <div className="flex items-center gap-2">
          {deadlockState.isDeadlocked ? (
            <AlertOctagon className="w-5 h-5 text-rose-700 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          )}
          <div>
            <div className="font-bold text-sm">
              {deadlockState.isDeadlocked ? 'DEADLOCK DETECTED (Tarjan SCC Cycle)' : 'SYSTEM HEALTHY (No Circular Wait)'}
            </div>
            <div className="text-[11px] font-mono">
              {deadlockState.isDeadlocked 
                ? `Cyclic dependency found among PIDs: [${deadlockState.cyclePids.join(', ')}]` 
                : 'All process resource allocation matrices verified acyclic.'}
            </div>
          </div>
        </div>

        <button
          onClick={handleInjectDeadlock}
          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold border border-black rounded-sm active:translate-y-0.5 flex items-center gap-1 cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>Inject Deadlock</span>
        </button>
      </div>

      {/* Deadlock Resolution Section */}
      {deadlockState.isDeadlocked && (
        <div className="bg-[#dedede] border-2 border-t-white border-l-white border-r-black border-b-black p-2.5 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] space-y-1.5">
          <div className="font-bold text-[11px] text-rose-900 uppercase">Preempt Offending Cycle Processes:</div>
          <div className="flex flex-wrap gap-2">
            {deadlockState.cyclePids.map((pid) => (
              <button
                key={pid}
                onClick={() => { retroAudio.playClickSound(); terminateProcess(pid); }}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xs border border-black text-xs active:scale-95 cursor-pointer"
              >
                Preempt PID #{pid}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Banker's Algorithm Matrix Suite */}
      <div className="bg-[#dedede] border-2 border-t-white border-l-white border-r-black border-b-black p-3 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] space-y-2">
        <div className="flex items-center justify-between border-b border-[#aaa] pb-1">
          <div className="font-bold text-xs flex items-center gap-1.5 text-black">
            <Calculator className="w-4 h-4 text-indigo-700" />
            <span>Banker's Algorithm Multi-Instance Resource Safety Check</span>
          </div>
          <button
            onClick={handleRunBankers}
            className="px-3 py-0.5 bg-[#cecece] hover:bg-white border border-t-white border-l-white border-r-black border-b-black active:border-t-black active:border-l-black active:border-r-white active:border-b-white font-bold cursor-pointer"
          >
            Compute Safe Sequence
          </button>
        </div>

        <p className="text-[11px] text-slate-700">
          Evaluates multi-instance resources (A: 3, B: 3, C: 2) across 5 competing processes to find a deadlock-free execution vector where Work ≥ Need.
        </p>

        {/* Matrix Table */}
        <div className="bg-white border-2 border-t-black border-l-black border-r-white border-b-white p-2 shadow-inner overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="bg-[#f0f0f0] border-b border-[#ccc] text-slate-800">
              <tr>
                <th className="p-1">PROC</th>
                <th className="p-1">ALLOCATION [A, B, C]</th>
                <th className="p-1">MAX CLAIM [A, B, C]</th>
                <th className="p-1">NEED [A, B, C]</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {BANKER_DEMO_SCENARIO.processNames.map((name, i) => {
                const alloc = BANKER_DEMO_SCENARIO.allocation[i];
                const max = BANKER_DEMO_SCENARIO.maximum[i];
                const need = [max[0] - alloc[0], max[1] - alloc[1], max[2] - alloc[2]];
                return (
                  <tr key={name} className="hover:bg-indigo-50">
                    <td className="p-1 font-bold text-slate-800">{name}</td>
                    <td className="p-1 font-bold text-emerald-800">[{alloc.join(', ')}]</td>
                    <td className="p-1 font-bold text-indigo-800">[{max.join(', ')}]</td>
                    <td className="p-1 font-bold text-amber-800">[{need.join(', ')}]</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Banker Result Output */}
        {bankerResult && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-600 rounded-sm text-emerald-900 font-mono text-[11px] space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Safe State Discovered! Safe Execution Sequence:</span>
            </div>
            <div className="text-sm font-bold text-indigo-900 pl-5">
              {bankerResult.safeSequence.map((idx) => BANKER_DEMO_SCENARIO.processNames[idx]).join(' ➜ ')}
            </div>
            <div className="text-[10px] text-slate-600 pl-5">
              All processes successfully release acquired resource instances without starvation.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
