import React from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { Trophy } from 'lucide-react';
import { CulpritQuest, FitQuest, QuestCard, questText } from '../../spillguard/quests';

export const KernelQuestApp: React.FC = () => {
  const { deadlockState, stats, triggerDeadlock, spawnProcess } = useKernelStore();

  return (
    <div className="h-full w-full p-3 flex flex-col gap-3 overflow-y-auto min-h-0 min-w-0 bg-[var(--rt-panel)] font-pixel text-[13px]">
      <header className="bg-black text-white rt-raised px-3 py-2">
        <div className="flex items-center gap-2 font-bold text-[15px]">
          <Trophy className="w-5 h-5 text-[var(--rt-max)]" /> KernelQuest: OS debugging challenges
        </div>
        <p className="font-terminal text-[18px] leading-tight text-[#d8d8d8] mt-0.5">
          Solve deadlocks, starvation and real GPU memory spills.
        </p>
      </header>

      <QuestCard
        n={1}
        title="Break the mutual-exclusion deadlock"
        status={deadlockState.isDeadlocked ? { tone: 'warn', text: 'Deadlock active' } : { tone: 'done', text: 'Safe' }}
      >
        <p className={questText}>
          Trigger a circular wait, then resolve it in Deadlock Lab by preempting one of the mutex holders.
        </p>
        <button onClick={triggerDeadlock} className="rt-btn rt-btn-sm">Trigger deadlock</button>
      </QuestCard>

      <QuestCard n={2} title="Prevent CPU starvation with MLFQ" status={{ tone: 'idle', text: `${stats.completedProcesses} completed` }}>
        <p className={questText}>
          Spawn four long CPU-bound jobs and watch MLFQ demote them so short interactive tasks are not starved.
        </p>
        <button onClick={() => { for (let i = 1; i <= 4; i++) spawnProcess(`heavy_job_${i}`, 1, 30, 16); }} className="rt-btn rt-btn-sm">
          Spawn heavy workload
        </button>
      </QuestCard>

      <CulpritQuest />
      <FitQuest />
    </div>
  );
};
