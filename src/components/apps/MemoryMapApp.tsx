import React, { useState } from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { retroAudio } from '../../utils/audio';
import { Layers, AlertTriangle, Cpu, HardDrive } from 'lucide-react';
import { PageReplacementPolicy } from '../../types/kernel';
import { VramTwinPanel } from '../../spillguard/panels';

export const MemoryMapApp: React.FC = () => {
  const { frames, stats, memoryPolicy, setMemoryPolicy } = useKernelStore();
  const [selectedFrameId, setSelectedFrameId] = useState<number | null>(null);

  const allocatedCount = frames.filter((f) => f.pid !== null).length;
  const memoryUtilization = Math.round((allocatedCount / frames.length) * 100);

  const selectedFrame = selectedFrameId !== null ? frames.find((f) => f.frameId === selectedFrameId) : null;

  return (
    <div className="h-full w-full text-black flex flex-col p-3 font-pixel select-none overflow-y-auto space-y-3 text-xs min-h-0 min-w-0 overscroll-contain bg-white">
      {/* Top Controls & Policy */}
      <div className="p-2.5 flex items-center justify-between bg-[var(--rt-panel)] rt-raised">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-black" />
          <span className="font-bold text-xs text-black">Virtual Memory & Paging Unit</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-700 text-[12.5px]">Eviction Policy:</span>
          <select
            value={memoryPolicy}
            onChange={(e) => {
              retroAudio.playClickSound();
              setMemoryPolicy(e.target.value as PageReplacementPolicy);
            }}
            className="bg-white text-black px-2 py-0.5 font-bold text-xs outline-none rt-sunken-sm"
          >
            <option value="LRU">LRU (Least Recently Used)</option>
            <option value="FIFO">FIFO (First-In First-Out)</option>
            <option value="CLOCK">Clock (Second Chance)</option>
            <option value="OPTIMAL">Optimal (needs future refs: runs LRU)</option>
          </select>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2 bg-white rt-sunken">
          <div className="font-bold text-slate-600 uppercase text-[12px]">Total Physical RAM</div>
          <div className="font-bold text-slate-900 font-terminal text-[22px]">128 KB (32 Frames)</div>
        </div>
        <div className="p-2 bg-white rt-sunken">
          <div className="font-bold text-slate-600 uppercase text-[12px]">Allocated Frames</div>
          <div className="font-bold text-black font-terminal text-[22px]">{allocatedCount} Used / {32 - allocatedCount} Free</div>
        </div>
        <div className="p-2 bg-white rt-sunken">
          <div className="font-bold text-slate-600 uppercase text-[12px]">Memory Load</div>
          <div className="font-bold text-emerald-700 font-terminal text-[22px]">{memoryUtilization}%</div>
        </div>
        <div className="p-2 bg-white rt-sunken">
          <div className="font-bold text-slate-600 uppercase text-[12px]">Total Page Faults</div>
          <div className="font-bold text-rose-700 font-terminal text-[22px]">{stats.totalPageFaults}</div>
        </div>
      </div>

      {/* 32-Frame Physical Memory Grid */}
      <div className="p-3 space-y-2 bg-[var(--rt-panel)] rt-raised">
        <div className="flex items-center justify-between font-bold text-slate-800 text-[12.5px]">
          <span>Physical Frame Bitmap Matrix (32 Frames × 4KB Pages)</span>
          <span className="text-slate-600 font-terminal text-[14px]">Click frame to inspect</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 bg-white p-3 rt-sunken">
          {frames.map((frame) => {
            const isAllocated = frame.pid !== null;
            const isSelected = selectedFrameId === frame.frameId;

            return (
              <button
                key={frame.frameId}
                onClick={() => {
                  retroAudio.playClickSound();
                  setSelectedFrameId(frame.frameId);
                }}
                style={{ backgroundColor: isAllocated ? frame.color : '#e2e8f0' }}
                className={`h-12 border-2 flex flex-col items-center justify-center cursor-pointer transition relative active:scale-95 shadow-xs ${
                  isSelected ? 'ring-2 ring-black border-white' : 'border-black/50 hover:border-black'
                }`}
              >
                <span className={`font-bold font-terminal text-[14px] ${isAllocated ? 'text-white' : 'text-slate-600'}`}>
                  F{frame.frameId}
                </span>
                <span className={`font-terminal text-[13px] ${isAllocated ? 'text-white/90 font-bold' : 'text-slate-400'}`}>
                  {isAllocated ? `P${frame.pid}` : 'FREE'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Frame Detail Inspector */}
      {selectedFrame && (
        <div className="bg-white p-3 rt-sunken">
          <div className="font-bold text-xs text-black border-b pb-1 mb-2 flex justify-between border-black/25">
            <span>Frame #{selectedFrame.frameId} Inspector</span>
            <button onClick={() => setSelectedFrameId(null)} className="text-slate-500 hover:text-black font-bold">×</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-terminal text-[15px]">
            <div><strong>Status:</strong> {selectedFrame.pid !== null ? 'Allocated' : 'Unallocated'}</div>
            <div><strong>Owning PID:</strong> {selectedFrame.pid ?? 'N/A'}</div>
            <div><strong>Virtual Page:</strong> {selectedFrame.pageNumber ?? 'N/A'}</div>
            <div><strong>Last Access Tick:</strong> #{selectedFrame.lastAccessTick}</div>
          </div>
        </div>
      )}

      {/* Twin view: real VRAM residency from SpillGuard (Live / Replay) */}
      <VramTwinPanel />
    </div>
  );
};
