import React, { useState, useEffect } from 'react';
import { retroAudio } from '../../utils/audio';
import { useWindowStore } from '../../stores/useWindowStore';

interface BootScreenProps {
  onBootComplete: () => void;
}

export const BootScreen: React.FC<BootScreenProps> = ({ onBootComplete }) => {
  const { setActiveUser, setWelcomeModalOpen } = useWindowStore();
  const [bootPhase, setBootPhase] = useState<'kernel' | 'login'>('kernel');
  const [progress, setProgress] = useState<number>(0);
  const [caption, setCaption] = useState<string>('Initializing AetherOS Microkernel...');
  const [passwordInput, setPasswordInput] = useState<string>('');

  useEffect(() => {
    const steps = [
      { p: 25, msg: 'Mounting Inode Virtual File System...' },
      { p: 50, msg: 'Initializing Dual-Core Schedulers (MLFQ/RR)...' },
      { p: 75, msg: 'Allocating 32-Frame Virtual Memory Matrix...' },
      { p: 100, msg: 'AetherOS System 7 Ready.' }
    ];

    let currentStep = 0;
    const timer = setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].p);
        setCaption(steps[currentStep].msg);
        currentStep++;
      } else {
        clearInterval(timer);
        setTimeout(() => {
          setBootPhase('login');
        }, 300);
      }
    }, 180);

    return () => clearInterval(timer);
  }, []);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const entered = passwordInput.trim();
    if (entered) {
      setActiveUser(entered);
    } else {
      setActiveUser('Varad Patil');
    }
    retroAudio.playBootChime();
    setWelcomeModalOpen(true);
    onBootComplete();
  };

  if (bootPhase === 'kernel') {
    return (
      <div className="fixed inset-0 z-[100] text-black flex flex-col items-center justify-center select-none font-pixel bg-white">
        <div className="w-full max-w-sm p-6 flex flex-col items-center text-center bg-[var(--rt-soft)] rt-raised">
          <img src="/assets/icons/logo.webp" alt="" className="w-14 h-14 mb-3 animate-pulse object-contain" style={{ imageRendering: 'pixelated' }} />
          <h1 className="text-xl font-bold tracking-wider mb-1 text-black font-silkscreen">
            AetherOS System 7
          </h1>
          <p className="text-xs text-slate-700 mb-4">
            Deterministic Microkernel & AetherOS Environment
          </p>

          <div className="w-full mb-2">
            <div className="w-full h-4 bg-white p-0.5 relative overflow-hidden rt-sunken-sm">
              <div 
                className="h-full bg-black transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="w-full flex justify-between font-bold mb-2 text-slate-800 font-terminal text-[15px]">
            <span className="truncate max-w-[80%] text-left">{caption}</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center select-none font-pixel bg-black/60 backdrop-blur-md overflow-hidden">
      <div className="relative z-10 flex flex-col items-center animate-fadeIn">
        {/* Dash Circular Avatar (Matching Frame 05s) */}
        <div className="w-28 h-28 rounded-full bg-white border-2 border-white shadow-2xl overflow-hidden flex items-center justify-center mb-3 group hover:scale-105 transition-transform">
          <img 
            src="/assets/icons/dash_circle.png" 
            alt="Dash Avatar" 
            className="w-full h-full object-cover"
          />
        </div>

        {/* User / Creator Heading */}
        <h2 className="text-2xl font-bold text-white mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tracking-wider font-silkscreen">
          {passwordInput.trim() || 'Dash'}
        </h2>

        {/* Password Pill Input with Comic Hint Bubble */}
        <form onSubmit={handleLogin} className="relative flex items-center">
          <input
            type="text"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Enter Password"
            autoFocus
            className="w-64 px-4 py-2 text-center text-sm font-pixel text-white placeholder-white/60 bg-white/20 backdrop-blur-md border border-white/40 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.4)] focus:outline-none focus:ring-2 focus:ring-white/80 transition-all"
          />

          {/* Comic Speech Bubble Hint (Matching Frame 05s) */}
          <div className="absolute left-[106%] top-1/2 -translate-y-1/2 whitespace-nowrap">
            <div className="relative bg-white text-black text-xs font-pixel px-3 py-2 border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,0.8)] rounded-sm">
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-black" />
              <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-white z-10" />
              <p className="font-bold leading-tight">It's open.</p>
              <p className="text-slate-700 text-[12.5px]">Just press Enter.</p>
              <p className="text-indigo-700 mt-0.5 font-semibold text-[11px]">(Hint: Varad)</p>
            </div>
          </div>
        </form>

        <p className="text-white/60 text-xs mt-6 drop-shadow">
          Press [Enter] or type your name to personalize your session
        </p>
      </div>
    </div>
  );
};
