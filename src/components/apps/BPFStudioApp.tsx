import React, { useState } from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { BPFHookType } from '../../types/kernel';
import { retroAudio } from '../../utils/audio';
import { 
  Activity, 
  Plus, 
  Terminal, 
  Power, 
  Trash2, 
  Radio, 
  BarChart3, 
  Sparkles,
  Layers,
  Cpu
} from 'lucide-react';

export const BPFStudioApp: React.FC = () => {
  const { 
    probes, 
    bpfEvents, 
    attachProbe, 
    toggleProbe, 
    removeProbe 
  } = useKernelStore();

  const [newProbeName, setNewProbeName] = useState('');
  const [selectedHook, setSelectedHook] = useState<BPFHookType>('SCHED_SWITCH');
  const [filterScript, setFilterScript] = useState('count(pid)');
  const [selectedProbeId, setSelectedProbeId] = useState<string>(probes[0]?.id || '');

  const handleAttach = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProbeName.trim()) return;
    retroAudio.playClickSound();
    attachProbe(newProbeName.trim(), selectedHook, filterScript.trim());
    setNewProbeName('');
  };

  const activeProbe = probes.find(p => p.id === selectedProbeId) || probes[0];

  const presets = [
    { name: 'sched_switch_count', hook: 'SCHED_SWITCH' as BPFHookType, script: 'count(pid)' },
    { name: 'page_fault_rate', hook: 'PAGE_FAULT' as BPFHookType, script: 'count(pid)' },
    { name: 'vfs_syscall_tracer', hook: 'SYSCALL_ENTER' as BPFHookType, script: 'count(syscall)' }
  ];

  const applyPreset = (p: typeof presets[0]) => {
    retroAudio.playClickSound();
    setNewProbeName(p.name);
    setSelectedHook(p.hook);
    setFilterScript(p.script);
  };

  return (
    <div className="h-full w-full bg-[#cecece] text-black font-pixel select-none flex flex-col text-xs overflow-hidden min-h-0 min-w-0">
      {/* Top Header Banner */}
      <div className="bg-[#dedede] border-b-2 border-black p-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-700" />
          <span className="font-bold text-sm tracking-wide">In-Kernel eBPF Tracing & Probe Studio</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
          <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.2 border border-emerald-400 font-bold">
            eBPF VM Engine: JIT Active (Zero-Overhead)
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Probes List & Attach Form */}
        <div className="w-full md:w-1/2 border-r-2 border-black flex flex-col bg-[#e6e6e6] overflow-y-auto p-3 space-y-3">
          
          {/* Attach Probe Card */}
          <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_rgba(0,0,0,0.5)] space-y-2">
            <div className="flex items-center justify-between font-bold text-[11px] text-slate-800 border-b border-slate-300 pb-1">
              <span className="flex items-center gap-1">
                <Plus className="w-3.5 h-3.5 text-indigo-600" /> Compile & Attach eBPF Program
              </span>
              <div className="flex gap-1">
                {presets.map((pr) => (
                  <button
                    key={pr.name}
                    onClick={() => applyPreset(pr)}
                    className="px-1 py-0.2 bg-slate-100 hover:bg-slate-200 border border-slate-400 text-[9px] font-mono"
                  >
                    {pr.name.split('_')[0]}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAttach} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Probe Name:</label>
                  <input
                    type="text"
                    value={newProbeName}
                    onChange={(e) => setNewProbeName(e.target.value)}
                    placeholder="my_kprobe"
                    required
                    className="w-full px-2 py-0.5 bg-slate-50 border border-black font-mono text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Hook Point:</label>
                  <select
                    value={selectedHook}
                    onChange={(e) => setSelectedHook(e.target.value as BPFHookType)}
                    className="w-full px-1 py-0.5 bg-slate-50 border border-black font-mono text-xs outline-none cursor-pointer"
                  >
                    <option value="SCHED_SWITCH">SCHED_SWITCH (Context Switches)</option>
                    <option value="PAGE_FAULT">PAGE_FAULT (Memory Paging)</option>
                    <option value="SYSCALL_ENTER">SYSCALL_ENTER (VFS / Syscalls)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Filter & Aggregation Script:</label>
                <input
                  type="text"
                  value={filterScript}
                  onChange={(e) => setFilterScript(e.target.value)}
                  placeholder="count(pid) or filter pid == 101"
                  required
                  className="w-full px-2 py-0.5 bg-slate-50 border border-black font-mono text-xs outline-none text-indigo-700 font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold border border-black shadow active:translate-y-0.5 cursor-pointer text-xs flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Compile Bytecode & Load Hook</span>
              </button>
            </form>
          </div>

          {/* Active Probes Table */}
          <div className="bg-white border-2 border-black shadow-[2px_2px_0px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="bg-[#dedede] p-1.5 border-b border-black font-bold text-[11px] flex justify-between items-center">
              <span>Attached Kernel Probes ({probes.length})</span>
              <span className="text-[9px] text-slate-600 font-mono">Select to view map</span>
            </div>
            <div className="divide-y divide-slate-200 font-mono text-[11px]">
              {probes.map((probe) => {
                const isSelected = activeProbe?.id === probe.id;
                return (
                  <div 
                    key={probe.id}
                    onClick={() => setSelectedProbeId(probe.id)}
                    className={`p-2 flex items-center justify-between cursor-pointer transition ${
                      isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${probe.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span>{probe.name}</span>
                        <span className="text-[9px] bg-slate-200 px-1 py-0.2 rounded text-slate-700">
                          {probe.hook}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Filter: <span className="text-indigo-700">{probe.filterScript}</span>  {probe.eventCount} events
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { retroAudio.playClickSound(); toggleProbe(probe.id); }}
                        className={`px-1.5 py-0.5 text-[9px] font-bold border rounded-xs ${
                          probe.enabled 
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-400 hover:bg-emerald-200' 
                            : 'bg-slate-200 text-slate-700 border-slate-400 hover:bg-slate-300'
                        }`}
                      >
                        {probe.enabled ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={() => { retroAudio.playClickSound(); removeProbe(probe.id); }}
                        className="p-1 hover:text-rose-600 text-slate-400"
                        title="Detach probe"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: BPF Map Visualizer & Live Event Log */}
        <div className="w-full md:w-1/2 flex flex-col bg-[#dedede] p-3 space-y-3 overflow-hidden">
          
          {/* BPF Map Aggregation Inspector */}
          <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_rgba(0,0,0,0.5)] flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-300 pb-1.5 mb-2">
              <span className="font-bold text-xs flex items-center gap-1 text-slate-800 font-mono">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-700" /> BPF Map: {activeProbe?.name || 'None'}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Type: BPF_MAP_TYPE_HASH
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 font-mono text-[11px] overscroll-contain">
              {activeProbe && Object.keys(activeProbe.mapOutput).length > 0 ? (
                Object.entries(activeProbe.mapOutput).map(([key, count]) => {
                  const maxCount = Math.max(...Object.values(activeProbe.mapOutput), 1);
                  const pct = Math.min(100, Math.round((count / maxCount) * 100));
                  return (
                    <div key={key} className="space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="font-bold text-slate-800">{key}</span>
                        <span className="text-slate-600">{count} hits</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 border border-slate-300 rounded-xs overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Awaiting probe event samples...
                </div>
              )}
            </div>
          </div>

          {/* Zero-Overhead Telemetry Trace Stream */}
          <div className="h-40 bg-[#111218] text-white border-2 border-black p-2.5 flex flex-col font-mono text-[10px] shadow-inner">
            <div className="text-indigo-400 font-bold border-b border-slate-800 pb-1 mb-1.5 flex items-center justify-between">
              <span>Kernel Telemetry Ring Buffer Stream:</span>
              <span className="text-slate-500">{bpfEvents.length} events logged</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 text-slate-300 overscroll-contain">
              {bpfEvents.slice(-20).map((ev, idx) => (
                <div key={idx} className="truncate">
                  <span className="text-slate-500">[t:{ev.timestamp}]</span>{' '}
                  <span className="text-purple-400 font-bold">[{ev.hook}]</span>{' '}
                  <span className="text-slate-200">{ev.details}</span>
                </div>
              ))}
              {bpfEvents.length === 0 && (
                <div className="text-slate-500">Tracing queue empty.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
