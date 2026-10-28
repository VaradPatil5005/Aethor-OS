import React, { useState, useEffect, useRef } from 'react';
import { useWindowStore } from '../../stores/useWindowStore';
import { useKernelStore } from '../../stores/useKernelStore';
import { retroAudio } from '../../utils/audio';
import { Volume2, VolumeX, Wifi, Battery } from 'lucide-react';

export const TopMenuBar: React.FC = () => {
  const { 
    open, 
    toggleScanlines, 
    toggleGrain, 
    crtScanlines, 
    crtGrain, 
    wallpaper, 
    setWallpaper, 
    resetLayout,
    setWelcomeModalOpen 
  } = useWindowStore();
  
  const { 
    isPaused, 
    togglePause, 
    refresh, 
    schedulerAlgorithm, 
    setAlgorithm, 
    spawnProcess, 
    triggerDeadlock,
    triggerPowerCut,
    triggerSimulatedGPF
  } = useKernelStore();

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(retroAudio.getMuted());
  const [showWifiModal, setShowWifiModal] = useState<boolean>(false);
  const [showBatteryModal, setShowBatteryModal] = useState<boolean>(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (menu: string) => {
    retroAudio.playClickSound();
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleAction = (cb: () => void) => {
    retroAudio.playClickSound();
    setActiveMenu(null);
    cb();
  };

  const toggleSound = () => {
    const muted = retroAudio.toggleMute();
    setIsMuted(muted);
    if (!muted) retroAudio.playClickSound();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <>
      <div 
        ref={menuRef}
        className="h-7 w-full backdrop-blur-md bg-white/40 text-black border-b border-black/20 flex items-center justify-between px-3 select-none z-50 text-xs font-semibold relative shadow-sm"
      >
        {/* Left Menus */}
        <div className="flex items-center gap-2">
          {/* Classic Apple Logo from AetherOS */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('apple')}
              className={`p-1 rounded hover:bg-black/10 flex items-center gap-1 ${activeMenu === 'apple' ? 'bg-black/20' : ''}`}
            >
              <img src="/assets/icons/logo.webp" alt="Apple" className="w-4 h-4 object-contain" />
            </button>
            {activeMenu === 'apple' && (
              <div className="absolute top-full left-0 mt-1 w-52 rt-menu p-1.5 z-50 text-black font-pixel">
                <button onClick={() => handleAction(() => open('about'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>About AetherOS</span>
                </button>
                <div className="my-1 border-t-2 border-black" />
                <button onClick={() => handleAction(() => open('settings'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white font-bold text-indigo-800">
                  <span>Control Panels / Settings...</span>
                </button>
                <button onClick={() => handleAction(() => open('test_runner'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>Diagnostic Test Runner</span>
                </button>
                <button onClick={() => handleAction(() => open('kernel_monitor'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>Kernel Audit Journal</span>
                </button>
                <button onClick={() => handleAction(() => open('bpf_studio'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>eBPF Telemetry Studio</span>
                </button>
                <button onClick={() => handleAction(() => open('spillguard'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white font-bold text-rose-800">
                  <span>SpillGuard (Live GPU Memory)</span>
                </button>
                <div className="my-1 border-t-2 border-black" />
                <button onClick={() => handleAction(() => resetLayout())} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>Reset Windows Layout</span>
                </button>
              </div>
            )}
          </div>

          {/* File Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('file')}
              className={`px-2 py-0.5 rounded hover:bg-black/10 ${activeMenu === 'file' ? 'bg-black/20' : ''}`}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div className="absolute top-full left-0 mt-1 w-48 rt-menu p-1.5 z-50 text-black font-pixel">
                <button onClick={() => handleAction(() => spawnProcess('gui_task_' + Math.floor(Math.random()*100), 1, 6, 16))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>Spawn CPU Process</span>
                </button>
                <button onClick={() => handleAction(() => open('file_explorer'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>Open Finder VFS</span>
                </button>
                <button onClick={() => handleAction(() => open('internet'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>Launch Snoogle Web</span>
                </button>
                <button onClick={() => handleAction(() => open('terminal'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>Open Terminal CLI</span>
                </button>
                <div className="my-1 border-t-2 border-black" />
                <button onClick={() => handleAction(() => setWelcomeModalOpen(true))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white font-bold text-amber-900">
                  <span>Lock Screen / Guidelines</span>
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('edit')}
              className={`px-2 py-0.5 rounded hover:bg-black/10 ${activeMenu === 'edit' ? 'bg-black/20' : ''}`}
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div className="absolute top-full left-0 mt-1 w-52 rt-menu p-1.5 z-50 text-black font-pixel">
                <button onClick={() => handleAction(() => refresh())} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>Step Kernel Tick</span>
                </button>
                <button onClick={() => handleAction(() => triggerDeadlock())} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white text-rose-700">
                  <span>Simulate Deadlock</span>
                </button>
                <button onClick={() => handleAction(() => triggerPowerCut())} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white text-amber-700">
                  <span>Simulate Power Cut (WAL)</span>
                </button>
                <button onClick={() => handleAction(() => triggerSimulatedGPF())} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white text-purple-700">
                  <span>Trigger Ring 3 Fault (#GP)</span>
                </button>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('view')}
              className={`px-2 py-0.5 rounded hover:bg-black/10 ${activeMenu === 'view' ? 'bg-black/20' : ''}`}
            >
              View
            </button>
            {activeMenu === 'view' && (
              <div className="absolute top-full left-0 mt-1 w-56 rt-menu p-1.5 z-50 text-black font-pixel">
                <button onClick={() => handleAction(toggleFullscreen)} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white flex items-center justify-between font-bold text-indigo-800">
                  <span>Toggle Fullscreen</span>
                  <span className="text-[12px]">F11</span>
                </button>
                <button onClick={() => handleAction(toggleSound)} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white flex items-center justify-between">
                  <span>Sound Effects (8-Bit)</span>
                  <span>{!isMuted ? '✓' : 'Muted'}</span>
                </button>
                <div className="my-1 border-t-2 border-black" />
                <button onClick={() => handleAction(toggleScanlines)} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white flex items-center justify-between">
                  <span>CRT Scanlines</span>
                  <span>{crtScanlines ? '✓' : ''}</span>
                </button>
                <button onClick={() => handleAction(toggleGrain)} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white flex items-center justify-between">
                  <span>CRT Screen Grain</span>
                  <span>{crtGrain ? '✓' : ''}</span>
                </button>

                <div className="my-1 border-t-2 border-black" />
                <div className="px-3 py-0.5 text-[#666] font-bold text-[12px]">DESKTOP WALLPAPERS</div>
                
                <button onClick={() => handleAction(() => setWallpaper('mainframe'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white flex items-center justify-between">
                  <span>1. Mainframe Video</span>
                  <span>{wallpaper === 'mainframe' ? '✓' : ''}</span>
                </button>

                <button onClick={() => handleAction(() => setWallpaper('lavender'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white flex items-center justify-between">
                  <span>2. Lavender Studio Video</span>
                  <span>{wallpaper === 'lavender' ? '✓' : ''}</span>
                </button>

                <button onClick={() => handleAction(() => setWallpaper('orbit'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white flex items-center justify-between">
                  <span>3. Orbit Lilies (Pixel Art)</span>
                  <span>{wallpaper === 'orbit' ? '✓' : ''}</span>
                </button>

                <button onClick={() => handleAction(() => setWallpaper('matrix'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white flex items-center justify-between">
                  <span>4. Cyber Matrix Rain</span>
                  <span>{wallpaper === 'matrix' ? '✓' : ''}</span>
                </button>

                <div className="my-1 border-t-2 border-black" />
                <button onClick={() => handleAction(() => open('settings'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white font-bold text-indigo-700">
                  <span>Wallpaper Settings...</span>
                </button>
              </div>
            )}
          </div>

          {/* Kernel Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('kernel')}
              className={`px-2 py-0.5 rounded hover:bg-black/10 ${activeMenu === 'kernel' ? 'bg-black/20' : ''}`}
            >
              Kernel
            </button>
            {activeMenu === 'kernel' && (
              <div className="absolute top-full left-0 mt-1 w-52 rt-menu p-1.5 z-50 text-black font-pixel">
                <button onClick={() => handleAction(togglePause)} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white flex items-center justify-between">
                  <span>{isPaused ? '▶ Resume Clock' : '⏸ Pause Clock'}</span>
                </button>
                <button onClick={() => handleAction(refresh)} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white flex items-center justify-between">
                  <span>Step Single Tick</span>
                </button>
                <div className="my-1 border-t-2 border-black" />
                <div className="px-3 py-0.5 text-[#666] font-bold text-[12px]">SCHEDULER</div>
                {(['MLFQ', 'ROUND_ROBIN', 'SRTF', 'FCFS', 'PRIORITY'] as const).map((algo) => (
                  <button key={algo} onClick={() => handleAction(() => setAlgorithm(algo))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white flex items-center justify-between">
                    <span>{algo}</span>
                    <span>{schedulerAlgorithm === algo ? '✓' : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Diagnostic Menu */}
          <div className="relative">
            <button
              onClick={() => handleMenuClick('diagnostic')}
              className={`px-2 py-0.5 rounded hover:bg-black/10 ${activeMenu === 'diagnostic' ? 'bg-black/20' : ''}`}
            >
              Diagnostic
            </button>
            {activeMenu === 'diagnostic' && (
              <div className="absolute top-full left-0 mt-1 w-52 rt-menu p-1.5 z-50 text-black font-pixel">
                <button onClick={() => handleAction(() => open('test_runner'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white font-bold text-emerald-700">
                  <span>Run Kernel Test Suite</span>
                </button>
                <button onClick={() => handleAction(() => open('deadlock_lab'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>Open Deadlock Engine</span>
                </button>
                <button onClick={() => handleAction(() => open('memory_map'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>Virtual Memory Map</span>
                </button>
                <button onClick={() => handleAction(() => open('kernel_quest'))} className="w-full text-left px-3 py-1 hover:bg-black hover:text-white">
                  <span>KernelQuest Challenges</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Status Tray */}
        <div className="flex items-center gap-3 pr-1 text-xs">
          {/* Audio Mute Button */}
          <button 
            onClick={toggleSound}
            title={isMuted ? 'Unmute retro audio' : 'Mute retro audio'}
            className="p-1 hover:bg-black/10 rounded flex items-center justify-center"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-700" /> : <Volume2 className="w-3.5 h-3.5 text-black" />}
          </button>

          {/* Wi-Fi Status */}
          <button 
            onClick={() => setShowWifiModal(!showWifiModal)}
            title="AetherNet Status"
            className="p-1 hover:bg-black/10 rounded flex items-center justify-center"
          >
            <Wifi className="w-3.5 h-3.5 text-black" />
          </button>

          {/* Battery Status */}
          <button 
            onClick={() => setShowBatteryModal(!showBatteryModal)}
            title="System Battery: 100% AC Powered"
            className="p-1 hover:bg-black/10 rounded flex items-center gap-1"
          >
            <Battery className="w-3.5 h-3.5 text-black" />
            <span className="font-terminal text-[14px]">100%</span>
          </button>

          {/* Live Retro Clock */}
          <div className="font-pixel text-xs font-bold tracking-wider px-1 text-black">
            {currentTime || '11:28 AM'}
          </div>
        </div>
      </div>

      {/* Wi-Fi Info Popover */}
      {showWifiModal && (
        <div className="absolute top-8 right-20 w-56 p-3 z-50 text-black select-none text-xs font-pixel bg-[var(--rt-panel)] rt-raised">
          <div className="font-bold flex items-center gap-1.5 mb-1 text-[13px]">
            <Wifi className="w-4 h-4 text-indigo-700" />
            <span>AetherNet Status</span>
          </div>
          <div className="text-slate-700 space-y-1 text-[12.5px]">
            <p><strong>Status:</strong> Connected (Loopback)</p>
            <p><strong>IP:</strong> 127.0.0.1 (Isolated Kernel)</p>
          </div>
          <button 
            onClick={() => setShowWifiModal(false)}
            className="mt-2.5 w-full py-0.5 font-bold bg-white rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Close
          </button>
        </div>
      )}

      {/* Battery Info Popover */}
      {showBatteryModal && (
        <div className="absolute top-8 right-12 w-56 p-3 z-50 text-black select-none text-xs font-pixel bg-[var(--rt-panel)] rt-raised">
          <div className="font-bold flex items-center gap-1.5 mb-1 text-[13px]">
            <Battery className="w-4 h-4 text-emerald-700" />
            <span>Battery & Power</span>
          </div>
          <div className="text-slate-700 space-y-1 text-[12.5px]">
            <p><strong>State:</strong> AC Power (Direct)</p>
            <p><strong>Health:</strong> 100% Optimal</p>
          </div>
          <button 
            onClick={() => setShowBatteryModal(false)}
            className="mt-2.5 w-full py-0.5 font-bold bg-white rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
};
