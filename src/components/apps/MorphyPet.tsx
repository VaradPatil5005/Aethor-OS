import React, { useState, useEffect } from 'react';
import { retroAudio } from '../../utils/audio';

export const FalconPet: React.FC = () => {
  const [isAtRoost, setIsAtRoost] = useState<boolean>(true);
  const [speech, setSpeech] = useState<string | null>(null);
  const [hearts, setHearts] = useState<boolean>(false);
  const [isDiving, setIsDiving] = useState<boolean>(false);
  const [currentTipIndex, setCurrentTipIndex] = useState<number>(0);

  const tips = [
    "Kreeee! I am Zephyr, your Peregrine Falcon! Patrolling the skies of AetherOS.",
    "Hunting at 389 km/h terminal velocity! Zero bottlenecks in your scheduler runqueues.",
    "Tip: Typing 'matrix' in aethersh starts the cybernetic rain.",
    "Secret: Enter '1976' into the Calculator for an Apple I discovery...",
    "VFS Scan: Crash-Consistent Write-Ahead Log (WAL) has 0 corrupted journal entries!",
    "Memory Telemetry: LRU page fault handler active, zero thrashing detected across frames.",
    "Deadlock Engine: Wait-For Graph verified as an acyclic DAG. System state 100% safe.",
    "Performance Tip: Double-click BPF Studio to inspect simulated kernel probe telemetry!"
  ];

  const handleSummon = () => {
    retroAudio.playFalconCry();
    setIsAtRoost(false);
    const nextIdx = (currentTipIndex + 1) % tips.length;
    setCurrentTipIndex(nextIdx);
    setSpeech(tips[nextIdx]);
  };

  const handleNextTip = (e: React.MouseEvent) => {
    e.stopPropagation();
    retroAudio.playFalconCry();
    const nextIdx = (currentTipIndex + 1) % tips.length;
    setCurrentTipIndex(nextIdx);
    setSpeech(tips[nextIdx]);
  };

  const handleDive = (e: React.MouseEvent) => {
    e.stopPropagation();
    retroAudio.playFalconCry();
    setIsDiving(true);
    setSpeech("⚡ DIVING AT 389 KM/H! Target acquired: High-priority kernel task dispatched!");
    setTimeout(() => {
      setIsDiving(false);
    }, 1800);
  };

  const handleFeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    retroAudio.playFalconCry();
    setHearts(true);
    setSpeech("Scarfed down fresh prey! Hunting prowess & kernel agility +100! 🦅");
    setTimeout(() => setHearts(false), 3500);
  };

  const handleReturnToRoost = (e: React.MouseEvent) => {
    e.stopPropagation();
    retroAudio.playClickSound();
    setIsAtRoost(true);
    setSpeech(null);
    setIsDiving(false);
  };

  // Auto-dismiss speech bubble after 10s if inactive
  useEffect(() => {
    if (speech && !isAtRoost) {
      const timer = setTimeout(() => {
        setSpeech(null);
      }, 9000);
      return () => clearTimeout(timer);
    }
  }, [speech, isAtRoost]);

  return (
    <div className="fixed bottom-16 right-10 z-30 select-none font-pixel pointer-events-auto">
      {/* Speech Bubble */}
      {speech && (
        <div className="absolute -top-24 -left-48 w-64 p-2.5 bg-white text-black border-2 border-black rounded-lg shadow-[4px_4px_0px_rgba(0,0,0,0.6)] text-xs z-50 animate-bounce">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">
            <span>🦅</span>
            <span>Peregrine Falcon Tips</span>
          </div>
          <p className="font-bold text-[11px] leading-snug text-slate-900">{speech}</p>
          <div className="absolute -bottom-2 right-12 w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[8px] border-t-black" />
        </div>
      )}

      {/* Floating Morale Hearts */}
      {hearts && (
        <div className="absolute -top-10 left-10 text-2xl animate-pulse drop-shadow-md z-50">
          🦅 ⚡ ❤️ 🪶
        </div>
      )}

      {/* Roost State (In House / Resting) */}
      {isAtRoost ? (
        <div 
          onClick={handleSummon}
          className="flex flex-col items-center group cursor-pointer"
          title="Click to summon your Peregrine Falcon!"
        >
          {/* Subtle resting feathers / zzz */}
          <div className="flex items-center gap-1 text-[11px] text-amber-300 font-bold mb-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-pulse">
            <span>🪶</span>
            <span>z z z</span>
          </div>

          {/* Wooden Cliff Roost Asset */}
          <div className="relative group-hover:scale-105 transition-transform duration-200">
            <img 
              src="/assets/icons/falcon_roost.png" 
              alt="Peregrine Falcon Roost" 
              className="w-20 h-20 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]"
            />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </div>

          {/* Roost Label & Quick Summon Button */}
          <div className="mt-1 flex flex-col items-center">
            <span className="px-2 py-0.5 bg-black/70 backdrop-blur-md text-[10px] text-amber-300 border border-amber-500/40 rounded-full font-mono shadow-md">
              Peregrine's Roost
            </span>
            <span className="text-[9px] text-slate-300 font-mono mt-0.5 drop-shadow bg-black/50 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              Click to Summon ⚡
            </span>
          </div>
        </div>
      ) : (
        /* Active Falcon State (Out of House, Hovering/Diving) */
        <div className={`flex flex-col items-center transition-all duration-300 ${isDiving ? 'scale-110 translate-y-2' : ''}`}>
          {/* Outstretched Wings Peregrine Falcon Asset */}
          <div 
            onClick={handleNextTip}
            className="relative cursor-pointer group hover:scale-105 transition-transform duration-200"
            title="Click for next falcon tip!"
          >
            <img 
              src="/assets/icons/peregrine_falcon.png" 
              alt="Peregrine Falcon" 
              className={`w-32 h-44 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] filter contrast-105 ${
                isDiving ? 'animate-bounce brightness-125' : 'animate-pulse'
              }`}
            />
            {/* Speed telemetry badge */}
            <div className="absolute top-2 -left-4 bg-black/80 backdrop-blur-sm border border-cyan-400 text-cyan-300 px-1.5 py-0.5 rounded text-[9px] font-mono shadow-lg flex items-center gap-1">
              <span>⚡</span>
              <span>{isDiving ? '389 km/h' : '124 km/h'}</span>
            </div>
          </div>

          {/* Falcon Action Dock */}
          <div className="mt-1 flex items-center gap-1 bg-[#1c1d28]/90 backdrop-blur-md border border-cyan-500/50 p-1 rounded-lg shadow-xl text-[10px] font-bold text-white">
            <button 
              onClick={handleNextTip}
              title="Get another OS tip"
              className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white rounded cursor-pointer transition shadow-sm flex items-center gap-1"
            >
              <span>💡</span>
              <span>Tip</span>
            </button>
            <button 
              onClick={handleDive}
              title="High-speed 389 km/h dive"
              className="px-2 py-1 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded cursor-pointer transition shadow-sm flex items-center gap-1"
            >
              <span>⚡</span>
              <span>Dive</span>
            </button>
            <button 
              onClick={handleFeed}
              title="Feed fresh prey"
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-50 active:bg-emerald-700 text-white rounded cursor-pointer transition shadow-sm flex items-center gap-1"
            >
              <span>🍖</span>
              <span>Feed</span>
            </button>
            <button 
              onClick={handleReturnToRoost}
              title="Return to cliff roost"
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-slate-200 rounded cursor-pointer transition shadow-sm flex items-center gap-1"
            >
              <span>🏡</span>
              <span>Roost</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Re-export as MorphyPet for backward-compatibility
export const MorphyPet = FalconPet;
