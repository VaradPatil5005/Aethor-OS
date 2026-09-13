import React, { useState } from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { SchedulingAlgorithm, CoreAffinity } from '../../types/kernel';
import { retroAudio } from '../../utils/audio';
import { Play, Pause, Plus, Trash2, Cpu, Activity, Clock, Sliders, Zap, ArrowRightLeft } from 'lucide-react';

export const TaskManagerApp: React.FC = () => {
  const { 
    processes, 
    stats, 
    ganttCore0,
    ganttCore1,
    cpus,
    schedulerAlgorithm, 
    setAlgorithm, 
    setQuantum, 
    spawnProcess, 
    terminateProcess, 
    setProcessAffinity,
    isPaused, 
    togglePause,
    speedMs,
    setSpeed
  } = useKernelStore();

  const [procName, setProcName] = useState('worker_task');
  const [priority, setPriority] = useState(2);
  const [burst, setBurst] = useState(12);
  const [memKB, setMemKB] = useState(16);
  const [affinity, setAffinity] = useState<CoreAffinity>('ANY');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!procName) return;
    retroAudio.playClickSound();
    spawnProcess(procName, Number(priority), Number(burst), Number(memKB), affinity);
    setProcName(`task_${Math.floor(Math.random() * 900 + 100)}`);
  };

  const handleKill = (pid: number) => {
    retroAudio.playClickSound();
    terminateProcess(pid);
  };

  const cycleAffinity = (pid: number, current: CoreAffinity = 'ANY') => {
    retroAudio.playClickSound();
    const next: CoreAffinity = current === 'ANY' ? 0 : current === 0 ? 1 : 'ANY';
    setProcessAffinity(pid, next);
  };

  return (
    <div className="h-full w-full bg-[#cecece] text-black flex flex-col p-3 font-pixel select-none overflow-y-auto space-y-3 text-xs min-h-0 min-w-0 overscroll-contain">
      {/* Top Retro Controls Panel */}
      <div className="bg-[#dedede] border-2 border-t-white border-l-white border-r-black border-b-black p-2.5 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] flex flex-wrap items-center justify-between gap-2">
        {/* Play/Pause Clock */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { retroAudio.playClickSound(); togglePause(); }}
            className="px-3 py-1 bg-[#cecece] border border-t-white border-l-white border-r-black border-b-black active:border-t-black active:border-l-black active:border-r-white active:border-b-white font-bold flex items-center gap-1.5 hover:bg-white cursor-pointer"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current text-emerald-700" /> : <Pause className="w-3.5 h-3.5 fill-current text-rose-700" />}
            <span>{isPaused ? 'Resume Clock' : 'Pause Clock'}</span>
          </button>

          <span className="font-mono text-xs font-bold text-slate-800 bg-white px-2 py-0.5 border border-[#888]">
            Tick: #{stats.tick}
          </span>
        </div>

        {/* Algorithm Dropdown */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-indigo-700" />
            <span className="font-bold text-[11px] text-slate-800">Policy:</span>
          </div>
          <select 
            value={schedulerAlgorithm}
            onChange={(e) => {
              retroAudio.playClickSound();
              setAlgorithm(e.target.value as SchedulingAlgorithm);
            }}
            className="bg-white border border-t-black border-l-black border-r-white border-b-white px-2 py-0.5 text-black font-pixel text-xs cursor-pointer shadow-inner outline-none"
          >
            <option value="MLFQ">MLFQ (Multi-Level Feedback)</option>
            <option value="ROUND_ROBIN">Round Robin (Preemptive)</option>
            <option value="SRTF">SRTF (Shortest Remaining)</option>
            <option value="PRIORITY">Priority (Preemptive)</option>
            <option value="SJF">SJF (Shortest Job First)</option>
            <option value="FCFS">FCFS (First-Come First-Served)</option>
          </select>
        </div>

        {/* Speed Slider */}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-slate-700" />
          <span className="font-bold text-[11px] text-slate-800">Speed:</span>
          <input 
            type="range" 
            min={200} 
            max={1800} 
            step={100}
            value={speedMs}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-20 accent-indigo-600 cursor-pointer"
          />
          <span className="font-mono text-[10px] text-slate-600 w-10 text-right">{speedMs}ms</span>
        </div>
      </div>

      {/* SMP Dual-Core Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Core 0 Card */}
        <div className="bg-[#dedede] border-2 border-t-white border-l-white border-r-black border-b-black p-2.5 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] space-y-1.5">
          <div className="flex items-center justify-between border-b border-[#aaa] pb-1">
            <div className="flex items-center gap-1.5 font-bold text-xs text-black">
              <Cpu className="w-4 h-4 text-indigo-700" />
              <span>CPU Core 0 (Primary)</span>
            </div>
            <span className="bg-indigo-100 text-indigo-900 px-1.5 py-0.2 border border-indigo-300 font-mono text-[10px] font-bold">
              Load: {cpus[0].loadPercentage}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-1 font-mono">
            <div className="bg-white p-1 border border-[#aaa]">
              <span className="text-slate-500 block">CURRENT</span>
              <span className="font-bold text-slate-800">{cpus[0].currentPid ? `#${cpus[0].currentPid}` : 'IDLE'}</span>
            </div>
            <div className="bg-white p-1 border border-[#aaa]">
              <span className="text-slate-500 block">RUNQUEUE</span>
              <span className="font-bold text-slate-800">{cpus[0].runqueue.length} tasks</span>
            </div>
            <div className="bg-white p-1 border border-[#aaa]">
              <span className="text-slate-500 block">STOLEN</span>
              <span className="font-bold text-emerald-700">+{cpus[0].stolenTasksCount}</span>
            </div>
          </div>
        </div>

        {/* Core 1 Card */}
        <div className="bg-[#dedede] border-2 border-t-white border-l-white border-r-black border-b-black p-2.5 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] space-y-1.5">
          <div className="flex items-center justify-between border-b border-[#aaa] pb-1">
            <div className="flex items-center gap-1.5 font-bold text-xs text-black">
              <Cpu className="w-4 h-4 text-emerald-700" />
              <span>CPU Core 1 (Secondary)</span>
            </div>
            <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.2 border border-emerald-300 font-mono text-[10px] font-bold">
              Load: {cpus[1].loadPercentage}%
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-1 font-mono">
            <div className="bg-white p-1 border border-[#aaa]">
              <span className="text-slate-500 block">CURRENT</span>
              <span className="font-bold text-slate-800">{cpus[1].currentPid ? `#${cpus[1].currentPid}` : 'IDLE'}</span>
            </div>
            <div className="bg-white p-1 border border-[#aaa]">
              <span className="text-slate-500 block">RUNQUEUE</span>
              <span className="font-bold text-slate-800">{cpus[1].runqueue.length} tasks</span>
            </div>
            <div className="bg-white p-1 border border-[#aaa]">
              <span className="text-slate-500 block">STOLEN</span>
              <span className="font-bold text-emerald-700">+{cpus[1].stolenTasksCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dual Parallel Live Gantt Streams */}
      <div className="bg-[#dedede] border-2 border-t-white border-l-white border-r-black border-b-black p-2.5 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] space-y-2">
        <div className="flex items-center justify-between font-bold text-[11px] text-slate-800">
          <span>SMP Dual-Core Concurrent Timeline Streams (Last 30 Ticks)</span>
          <span className="text-[10px] font-mono text-slate-600 flex items-center gap-1">
            <ArrowRightLeft className="w-3 h-3 text-indigo-600" /> CFS Work-Stealing Enabled
          </span>
        </div>

        {/* Core 0 Gantt Track */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-700">
            <span className="font-bold text-indigo-800">CPU 0 Timeline:</span>
            <span>Tick #{stats.tick}</span>
          </div>
          <div className="h-8 bg-white border-2 border-t-black border-l-black border-r-white border-b-white p-1 flex items-center gap-0.5 overflow-x-auto shadow-inner">
            {ganttCore0.slice(-30).map((g, idx) => (
              <div 
                key={idx} 
                style={{ backgroundColor: g.color || '#334155' }} 
                className="h-full w-5 rounded-xs shrink-0 flex items-center justify-center text-[9px] font-mono font-bold text-white border border-black/40 shadow-xs"
                title={`Core 0 - Tick #${g.tick} - ${g.name} (PID: ${g.pid ?? 'IDLE'})`}
              >
                {g.pid ?? ''}
              </div>
            ))}
            {ganttCore0.length === 0 && (
              <span className="text-slate-400 font-mono text-[10px] pl-2">CPU 0 timeline initializing...</span>
            )}
          </div>
        </div>

        {/* Core 1 Gantt Track */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-700">
            <span className="font-bold text-emerald-800">CPU 1 Timeline:</span>
            <span>Tick #{stats.tick}</span>
          </div>
          <div className="h-8 bg-white border-2 border-t-black border-l-black border-r-white border-b-white p-1 flex items-center gap-0.5 overflow-x-auto shadow-inner">
            {ganttCore1.slice(-30).map((g, idx) => (
              <div 
                key={idx} 
                style={{ backgroundColor: g.color || '#334155' }} 
                className="h-full w-5 rounded-xs shrink-0 flex items-center justify-center text-[9px] font-mono font-bold text-white border border-black/40 shadow-xs"
                title={`Core 1 - Tick #${g.tick} - ${g.name} (PID: ${g.pid ?? 'IDLE'})`}
              >
                {g.pid ?? ''}
              </div>
            ))}
            {ganttCore1.length === 0 && (
              <span className="text-slate-400 font-mono text-[10px] pl-2">CPU 1 timeline initializing...</span>
            )}
          </div>
        </div>
      </div>

      {/* Spawn New Process Form with Core Affinity */}
      <form onSubmit={handleCreate} className="bg-[#dedede] border-2 border-t-white border-l-white border-r-black border-b-black p-2.5 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] flex flex-wrap items-center gap-2">
        <span className="font-bold text-[11px] text-slate-800">Spawn Process:</span>
        <input 
          type="text" 
          value={procName} 
          onChange={(e) => setProcName(e.target.value)} 
          placeholder="Name" 
          className="bg-white border border-t-black border-l-black border-r-white border-b-white px-2 py-0.5 text-black font-mono text-xs w-28 outline-none"
        />
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-slate-700">Burst:</span>
          <input 
            type="number" 
            min={1} 
            max={50} 
            value={burst} 
            onChange={(e) => setBurst(Number(e.target.value))} 
            className="w-12 bg-white border border-t-black border-l-black border-r-white border-b-white px-1 py-0.5 text-black font-mono text-xs text-center"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-slate-700">Prio:</span>
          <input 
            type="number" 
            min={1} 
            max={5} 
            value={priority} 
            onChange={(e) => setPriority(Number(e.target.value))} 
            className="w-10 bg-white border border-t-black border-l-black border-r-white border-b-white px-1 py-0.5 text-black font-mono text-xs text-center"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold text-slate-700">Affinity:</span>
          <select
            value={affinity}
            onChange={(e) => setAffinity(e.target.value === 'ANY' ? 'ANY' : (Number(e.target.value) as 0 | 1))}
            className="bg-white border border-t-black border-l-black border-r-white border-b-white px-1 py-0.5 text-black font-mono text-xs outline-none cursor-pointer"
          >
            <option value="ANY">Any Core</option>
            <option value="0">Core 0 Only</option>
            <option value="1">Core 1 Only</option>
          </select>
        </div>
        <button 
          type="submit" 
          className="px-3 py-0.5 bg-[#cecece] border border-t-white border-l-white border-r-black border-b-black active:border-t-black active:border-l-black active:border-r-white active:border-b-white font-bold flex items-center gap-1 hover:bg-white cursor-pointer ml-auto"
        >
          <Plus className="w-3 h-3 text-black" />
          <span>Dispatch Process</span>
        </button>
      </form>

      {/* Process Control Block (PCB) Table with Core Affinity Controls */}
      <div className="bg-white border-2 border-t-black border-l-black border-r-white border-b-white shadow-inner overflow-hidden">
        <div className="bg-[#dedede] p-1.5 border-b border-[#888] font-bold text-[11px] text-black flex items-center justify-between">
          <span>Process Control Block (PCB) Multi-Core Register Table</span>
          <span className="text-[10px] text-slate-600 font-mono">Click Affinity to Toggle</span>
        </div>
        <div className="overflow-x-auto max-h-56">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#ececec] border-b border-[#aaa] text-slate-700 text-[10px] sticky top-0">
              <tr>
                <th className="p-1.5 w-12">PID</th>
                <th className="p-1.5">NAME</th>
                <th className="p-1.5">STATE</th>
                <th className="p-1.5">AFFINITY</th>
                <th className="p-1.5">LAST CORE</th>
                <th className="p-1.5">BURST</th>
                <th className="p-1.5">WAIT</th>
                <th className="p-1.5">LEVEL</th>
                <th className="p-1.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {processes.map((p) => (
                <tr key={p.pid} className="hover:bg-indigo-50">
                  <td className="p-1.5 font-bold text-slate-800">#{p.pid}</td>
                  <td className="p-1.5 font-bold flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs inline-block border border-black/50" style={{ backgroundColor: p.color }} />
                    <span className="text-black">{p.name}</span>
                  </td>
                  <td className="p-1.5">
                    <span className={`px-1.5 py-0.2 rounded-xs text-[10px] font-bold border border-black/30 ${
                      p.state === 'RUNNING' ? 'bg-emerald-200 text-emerald-900' :
                      p.state === 'WAITING' ? 'bg-rose-200 text-rose-900' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {p.state}
                    </span>
                  </td>
                  <td className="p-1.5">
                    <button
                      onClick={() => cycleAffinity(p.pid, p.coreAffinity ?? 'ANY')}
                      className={`px-1.5 py-0.5 rounded-xs font-bold text-[10px] border cursor-pointer hover:opacity-80 ${
                        p.coreAffinity === 'ANY' ? 'bg-blue-100 text-blue-900 border-blue-400' :
                        p.coreAffinity === 0 ? 'bg-indigo-100 text-indigo-900 border-indigo-400' :
                        'bg-emerald-100 text-emerald-900 border-emerald-400'
                      }`}
                      title="Click to toggle affinity"
                    >
                      {p.coreAffinity === 'ANY' ? 'ANY CORE' : `CORE ${p.coreAffinity}`}
                    </button>
                  </td>
                  <td className="p-1.5 text-slate-600 font-bold">
                    {p.lastExecutedCore !== null ? `CPU_${p.lastExecutedCore}` : ''}
                  </td>
                  <td className="p-1.5 font-bold text-slate-800">{p.remainingBurstTicks} / {p.totalBurstTicks}</td>
                  <td className="p-1.5 text-slate-600">{p.waitingTicks}t</td>
                  <td className="p-1.5 text-indigo-700 font-bold">Q{p.queueLevel}</td>
                  <td className="p-1.5 text-right">
                    <button 
                      onClick={() => handleKill(p.pid)} 
                      className="px-1.5 py-0.5 bg-rose-100 hover:bg-rose-600 hover:text-white border border-rose-700 rounded-xs text-[10px] font-bold"
                    >
                      KILL
                    </button>
                  </td>
                </tr>
              ))}
              {processes.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-slate-500">
                    No active processes in kernel runqueue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
