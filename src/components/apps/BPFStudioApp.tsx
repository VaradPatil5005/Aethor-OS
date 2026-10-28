import React, { useState } from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { BPFHookType } from '../../types/kernel';
import { retroAudio } from '../../utils/audio';
import { SpillEventsPanel } from '../../spillguard/panels';
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
    <div className="h-full w-full flex flex-col min-h-0 min-w-0 bg-white font-pixel text-[13px]">
      <header className="shrink-0 border-b-2 border-black px-3 py-2 flex items-center justify-between gap-2 flex-wrap bg-[var(--rt-panel)]">
        <span className="font-bold flex items-center gap-2"><Activity className="w-4 h-4" /> eBPF tracing & probe studio</span>
        <span className="flex items-center gap-1.5 font-terminal text-[16px] px-1.5 border-2 border-black bg-[var(--rt-min)]">
          <span className="w-2 h-2 rounded-full bg-black animate-pulse" /> JIT active
        </span>
      </header>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        {/* Left: attach form + probe list */}
        <div className="md:w-1/2 min-h-0 flex flex-col gap-3 p-3 overflow-y-auto border-b-2 md:border-b-0 md:border-r-2 border-black bg-[var(--rt-side)]">
          <section className="bg-white rt-raised p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap font-bold border-b-2 border-black pb-1">
              <span className="flex items-center gap-1"><Plus className="w-4 h-4" /> Compile & attach a probe</span>
              <span className="flex gap-1">
                {presets.map((pr) => (
                  <button key={pr.name} type="button" onClick={() => applyPreset(pr)} className="rt-btn rt-btn-sm !text-[15px] !px-1.5" title={`Preset: ${pr.name}`}>
                    {pr.name.split('_')[0]}
                  </button>
                ))}
              </span>
            </div>

            <form onSubmit={handleAttach} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block font-bold mb-0.5 text-[12px]">Probe name</span>
                  <input type="text" value={newProbeName} onChange={(e) => setNewProbeName(e.target.value)} placeholder="my_kprobe" required className="w-full px-2 font-terminal text-[18px]" />
                </label>
                <label className="block">
                  <span className="block font-bold mb-0.5 text-[12px]">Hook point</span>
                  <select value={selectedHook} onChange={(e) => setSelectedHook(e.target.value as BPFHookType)} className="w-full px-1 font-terminal text-[18px] cursor-pointer">
                    <option value="SCHED_SWITCH">SCHED_SWITCH (context switch)</option>
                    <option value="PAGE_FAULT">PAGE_FAULT (paging)</option>
                    <option value="SYSCALL_ENTER">SYSCALL_ENTER (syscalls)</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block font-bold mb-0.5 text-[12px]">Filter & aggregation script</span>
                <input type="text" value={filterScript} onChange={(e) => setFilterScript(e.target.value)} placeholder="count(pid) or filter pid == 101" required className="w-full px-2 font-terminal text-[18px]" />
              </label>
              <button type="submit" className="rt-btn w-full">
                <Sparkles className="w-4 h-4" /> Compile bytecode & load hook
              </button>
            </form>
          </section>

          <section className="bg-white rt-raised">
            <div className="px-2 py-1 border-b-2 border-black flex justify-between items-center gap-2 bg-[var(--rt-panel)]">
              <span className="font-bold">Attached probes ({probes.length})</span>
              <span className="font-terminal text-[15px] text-[var(--rt-muted)]">select to view its map</span>
            </div>
            {probes.map((probe) => {
              const isSelected = activeProbe?.id === probe.id;
              return (
                <div
                  key={probe.id}
                  onClick={() => setSelectedProbeId(probe.id)}
                  className={`px-2 py-1.5 flex items-center justify-between gap-2 cursor-pointer border-b border-black/15 last:border-b-0 ${isSelected ? 'bg-black text-white' : 'hover:bg-[#e6e6e6]'}`}
                >
                  <div className="min-w-0">
                    <div className="font-bold flex items-center gap-1.5 min-w-0">
                      <span className={`w-2.5 h-2.5 shrink-0 rounded-full border-2 ${isSelected ? 'border-white' : 'border-black'} ${probe.enabled ? 'bg-[var(--rt-min)]' : 'bg-[#bbb]'}`} />
                      <span className="truncate">{probe.name}</span>
                      <span className={`font-terminal text-[14px] px-1 border ${isSelected ? 'border-white' : 'border-black'}`}>{probe.hook}</span>
                    </div>
                    <div className={`font-terminal text-[16px] leading-tight truncate ${isSelected ? 'text-[#d0d0d0]' : 'text-[var(--rt-muted)]'}`}>
                      {probe.filterScript} · {probe.eventCount} events
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { retroAudio.playClickSound(); toggleProbe(probe.id); }}
                      className={`rt-btn rt-btn-sm !text-[15px] ${probe.enabled ? '!bg-[var(--rt-min)] !text-black' : ''}`}
                      aria-pressed={probe.enabled}
                    >
                      {probe.enabled ? 'ON' : 'OFF'}
                    </button>
                    <button onClick={() => { retroAudio.playClickSound(); removeProbe(probe.id); }} className="p-1 hover:text-[var(--rt-close)]" title="Detach probe" aria-label={`Detach ${probe.name}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        </div>

        {/* Right: map, ring buffer, real host events */}
        <div className="md:w-1/2 min-h-0 flex flex-col gap-3 p-3 overflow-y-auto bg-[var(--rt-panel)]">
          <section className="flex-1 min-h-[150px] flex flex-col bg-white rt-raised p-2.5">
            <div className="shrink-0 flex items-center justify-between gap-2 border-b-2 border-black pb-1 mb-2">
              <span className="font-bold flex items-center gap-1 min-w-0"><BarChart3 className="w-4 h-4 shrink-0" /> <span className="truncate">Map: {activeProbe?.name || 'none'}</span></span>
              <span className="font-terminal text-[15px] text-[var(--rt-muted)]">BPF_MAP_TYPE_HASH</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 font-terminal text-[17px]">
              {activeProbe && Object.keys(activeProbe.mapOutput).length > 0 ? (
                Object.entries(activeProbe.mapOutput).map(([key, count]) => {
                  const max = Math.max(...Object.values(activeProbe.mapOutput), 1);
                  return (
                    <div key={key}>
                      <div className="flex justify-between leading-tight"><span>{key}</span><span>{count} hits</span></div>
                      <div className="h-3 bg-[var(--rt-soft)] border-2 border-black">
                        <div className="h-full bg-black transition-[width] duration-300" style={{ width: `${Math.min(100, Math.round((count / max) * 100))}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-[var(--rt-muted)]">Waiting for probe samples…</div>
              )}
            </div>
          </section>

          <section className="shrink-0 h-40 flex flex-col rt-raised bg-[#222]">
            <div className="shrink-0 px-2 py-1 bg-[#333] text-white text-[12px] flex justify-between border-b-2 border-black">
              <span>Ring buffer stream</span><span>{bpfEvents.length} events</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto rt-dark-scroll p-2 space-y-0.5 font-terminal text-[16px] leading-tight text-[#e0e0e0]">
              {bpfEvents.slice(-20).map((ev, idx) => (
                <div key={idx} className="truncate">
                  <span className="text-[#8a8a8a]">[t:{ev.timestamp}]</span>{' '}
                  <span className="text-[#5af78e]">[{ev.hook}]</span>{' '}
                  {ev.details}
                </div>
              ))}
              {bpfEvents.length === 0 && <div className="text-[#8a8a8a]">Tracing queue empty.</div>}
            </div>
          </section>

          {/* Real host events from the SpillGuard agent (Live / Replay) */}
          <section className="shrink-0 bg-white rt-raised p-2.5">
            <SpillEventsPanel />
          </section>
        </div>
      </div>
    </div>
  );
};
