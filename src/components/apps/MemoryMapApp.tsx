import React, { useState } from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { retroAudio } from '../../utils/audio';
import { Layers, AlertTriangle, Cpu, HardDrive } from 'lucide-react';
import { PageReplacementPolicy } from '../../types/kernel';

export const MemoryMapApp: React.FC = () => {
  const { frames, stats, memoryPolicy, setMemoryPolicy } = useKernelStore();
  const [selectedFrameId, setSelectedFrameId] = useState<number | null>(null);

  const allocatedCount = frames.filter((f) => f.pid !== null).length;
  const memoryUtilization = Math.round((allocatedCount / frames.length) * 100);

  const selectedFrame = selectedFrameId !== null ? frames.find((f) => f.frameId === selectedFrameId) : null;

  return (
    <div className="h-full w-full bg-[#cecece] text-black flex flex-col p-3 font-pixel select-none overflow-y-auto space-y-3 text-xs min-h-0 min-w-0 overscroll-contain">
      {/* Top Controls & Policy */}
      <div className="bg-[#dedede] border-2 border-t-white border-l-white border-r-black border-b-black p-2.5 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-700" />
          <span className="font-bold text-xs text-black">Virtual Memory & Paging Unit</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-bold text-[11px] text-slate-700">Eviction Policy:</span>
          <select
            value={memoryPolicy}
            onChange={(e) => {
              retroAudio.playClickSound();
              setMemoryPolicy(e.target.value as PageReplacementPolicy);
            }}
            className="bg-white text-black border border-t-black border-l-black border-r-white border-b-white px-2 py-0.5 font-bold text-xs outline-none"
          >
            <option value="LRU">LRU (Least Recently Used)</option>
            <option value="FIFO">FIFO (First-In First-Out)</option>
            <option value="CLOCK">Clock Algorithm</option>
            <option value="OPTIMAL">Optimal (Reference Lookahead)</option>
          </select>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2 bg-white border-2 border-t-black border-l-black border-r-white border-b-white shadow-inner">
          <div className="text-[10px] font-bold text-slate-600 uppercase">Total Physical RAM</div>
          <div className="text-base font-bold font-mono text-slate-900">128 KB (32 Frames)</div>
        </div>
        <div className="p-2 bg-white border-2 border-t-black border-l-black border-r-white border-b-white shadow-inner">
          <div className="text-[10px] font-bold text-slate-600 uppercase">Allocated Frames</div>
          <div className="text-base font-bold font-mono text-indigo-700">{allocatedCount} Used / {32 - allocatedCount} Free</div>
        </div>
        <div className="p-2 bg-white border-2 border-t-black border-l-black border-r-white border-b-white shadow-inner">
          <div className="text-[10px] font-bold text-slate-600 uppercase">Memory Load</div>
          <div className="text-base font-bold font-mono text-emerald-700">{memoryUtilization}%</div>
        </div>
        <div className="p-2 bg-white border-2 border-t-black border-l-black border-r-white border-b-white shadow-inner">
          <div className="text-[10px] font-bold text-slate-600 uppercase">Total Page Faults</div>
          <div className="text-base font-bold font-mono text-rose-700">{stats.totalPageFaults}</div>
        </div>
      </div>

      {/* 32-Frame Physical Memory Grid */}
      <div className="bg-[#dedede] border-2 border-t-white border-l-white border-r-black border-b-black p-3 shadow-[2px_2px_0px_rgba(0,0,0,0.3)] space-y-2">
        <div className="flex items-center justify-between font-bold text-[11px] text-slate-800">
          <span>Physical Frame Bitmap Matrix (32 Frames × 4KB Pages)</span>
          <span className="text-[10px] text-slate-600 font-mono">Click frame to inspect</span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 bg-white border-2 border-t-black border-l-black border-r-white border-b-white p-3 shadow-inner">
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
                className={`h-12 border-2 rounded-xs flex flex-col items-center justify-center cursor-pointer transition relative active:scale-95 shadow-xs ${
                  isSelected ? 'ring-2 ring-black border-white' : 'border-black/50 hover:border-black'
                }`}
              >
                <span className={`text-[10px] font-mono font-bold ${isAllocated ? 'text-white' : 'text-slate-600'}`}>
                  F{frame.frameId}
                </span>
                <span className={`text-[9px] font-mono ${isAllocated ? 'text-white/90 font-bold' : 'text-slate-400'}`}>
                  {isAllocated ? `P${frame.pid}` : 'FREE'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Frame Detail Inspector */}
      {selectedFrame && (
        <div className="bg-white border-2 border-t-black border-l-black border-r-white border-b-white p-3 shadow-inner">
          <div className="font-bold text-xs text-black border-b border-[#ccc] pb-1 mb-2 flex justify-between">
            <span>Frame #{selectedFrame.frameId} Inspector</span>
            <button onClick={() => setSelectedFrameId(null)} className="text-slate-500 hover:text-black font-bold">×</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
            <div><strong>Status:</strong> {selectedFrame.pid !== null ? 'Allocated' : 'Unallocated'}</div>
            <div><strong>Owning PID:</strong> {selectedFrame.pid ?? 'N/A'}</div>
            <div><strong>Virtual Page:</strong> {selectedFrame.pageNumber ?? 'N/A'}</div>
            <div><strong>Last Access Tick:</strong> #{selectedFrame.lastAccessTick}</div>
          </div>
        </div>
      )}
    </div>
  );
};
