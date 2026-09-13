import React from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { Trophy, CheckCircle, AlertTriangle } from 'lucide-react';

export const KernelQuestApp: React.FC = () => {
  const { deadlockState, stats, triggerDeadlock, spawnProcess } = useKernelStore();

  return (
    <div className="h-full w-full p-4 space-y-4 text-xs font-sans min-h-0 min-w-0 overflow-y-auto bg-[#13151f] text-slate-200 overscroll-contain">
      <div className="bg-gradient-to-r from-indigo-900/60 to-purple-900/60 p-3 rounded-lg border border-indigo-700/50">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span className="font-bold text-sm text-white">KernelQuest: OS Debugging Challenges</span>
        </div>
        <p className="text-slate-300 mt-1">
          Master real-world operating system mechanics by solving kernel panics, resolving resource contentions, and avoiding thrashing.
        </p>
      </div>

      <div className="space-y-3">
        <div className="p-3 rounded border bg-slate-900 border-slate-700">
          <div className="flex justify-between items-center">
            <span className="font-bold text-indigo-300">Quest 1: Break the Mutual Exclusion Deadlock</span>
            {deadlockState.isDeadlocked ? (
              <span className="text-amber-400 flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" /> Deadlock Active (Preempt a thread in Deadlock Lab)
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Solved / Safe
              </span>
            )}
          </div>
          <p className="text-slate-400 mt-1">
            Trigger a circular wait scenario and resolve it by preempting one of the competing mutex lock holders.
          </p>
          <button onClick={triggerDeadlock} className="mt-2 px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-medium">
            Start Quest 1: Trigger Deadlock
          </button>
        </div>

        <div className="p-3 rounded border bg-slate-900 border-slate-700">
          <div className="flex justify-between items-center">
            <span className="font-bold text-indigo-300">Quest 2: CPU Starvation Prevention with MLFQ</span>
            <span className="text-slate-400">Total Completed: {stats.completedProcesses}</span>
          </div>
          <p className="text-slate-400 mt-1">
            Spawn 5 high-burst tasks and verify how MLFQ dynamically degrades their priority to prevent starving interactive tasks.
          </p>
          <button 
            onClick={() => {
              for (let i = 1; i <= 4; i++) spawnProcess(`heavy_job_${i}`, 1, 30, 16);
            }} 
            className="mt-2 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
          >
            Spawn Heavy Workload Batch
          </button>
        </div>
      </div>
    </div>
  );
};
