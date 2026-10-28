import React, { useState } from 'react';
import { useWindowStore, AppId } from '../../stores/useWindowStore';
import { WindowFrame } from '../WindowFrame';
import { TopMenuBar } from './TopMenuBar';
import { RetroDock } from './RetroDock';
import { BootScreen } from './BootScreen';
import { DesktopBackground } from './DesktopBackground';
import { WelcomeModal } from './WelcomeModal';
import { ComicDialogue } from './ComicDialogue';

// Core OS Simulation Apps
import { TaskManagerApp } from '../apps/TaskManagerApp';
import { MemoryMapApp } from '../apps/MemoryMapApp';
import { DeadlockLabApp } from '../apps/DeadlockLabApp';
import { TerminalApp } from '../apps/TerminalApp';
import { FileExplorerApp } from '../apps/FileExplorerApp';
import { KernelQuestApp } from '../apps/KernelQuestApp';
import { KernelMonitorApp } from '../apps/KernelMonitorApp';
import { AboutApp } from '../apps/AboutApp';
import { SettingsApp } from '../apps/SettingsApp';

// AetherOS Vintage Entertainment & Diagnostic Apps
import { InternetApp } from '../apps/InternetApp';
import { MusicApp } from '../apps/MusicApp';
import { CalculatorApp } from '../apps/CalculatorApp';
import { MessagesApp } from '../apps/MessagesApp';
import { TestRunnerApp } from '../apps/TestRunnerApp';
import { CommunityApp } from '../apps/CommunityApp';
import { TrashApp } from '../apps/TrashApp';
import { BPFStudioApp } from '../apps/BPFStudioApp';
import { SpillGuardApp } from '../apps/SpillGuardApp';
import { FalconPet } from '../apps/FalconPet';

import { retroAudio } from '../../utils/audio';
import { 
  HardDrive,
  Globe, 
  Cpu, 
  Layers, 
  ShieldAlert, 
  Terminal, 
  Folder, 
  Trophy, 
  Activity, 
  Info, 
  Disc, 
  Calculator, 
  MessageSquare, 
  CheckCircle2, 
  Sliders, 
  Users, 
  Trash2,
  Radio
} from 'lucide-react';

export const Desktop: React.FC = () => {
  const { open, crtScanlines, crtGrain, triggerDialogue } = useWindowStore();
  const [hasBooted, setHasBooted] = useState<boolean>(false);
  const [showSocialsModal, setShowSocialsModal] = useState<boolean>(false);

  const leftIcons: { id: AppId; label: string; iconSrc: string }[] = [
    { id: 'about', label: 'ReadMe.txt', iconSrc: '/assets/icons/TxtIcon.webp' },
    { id: 'calculator', label: 'Calculator', iconSrc: '/assets/icons/calculator.webp' },
    { id: 'task_manager', label: "Dash's Journal", iconSrc: '/assets/icons/blogs.webp' },
    { id: 'file_explorer', label: 'archive', iconSrc: '/assets/icons/folderIcon.webp' },
    { id: 'bpf_studio', label: 'eBPF Studio', iconSrc: '/assets/icons/terminal.webp' },
    { id: 'spillguard', label: 'SpillGuard', iconSrc: '/assets/icons/spillguard.svg' }
  ];

  const handleIconClick = (id: AppId) => {
    retroAudio.playClickSound();
    open(id);
  };

  const handleOpenSocials = () => {
    retroAudio.playClickSound();
    setShowSocialsModal(true);
    triggerDialogue("it's been a long time since i used this computer");
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none font-pixel bg-black">
      {/* 4 Selectable Dynamic Wallpapers */}
      <DesktopBackground />

      {/* Boot Screen & Lock Screen on visit */}
      {!hasBooted && (
        <BootScreen onBootComplete={() => setHasBooted(true)} />
      )}

      {/* Soft Scanlines & Grain if enabled */}
      {crtScanlines && <div className="absolute inset-0 scanlines pointer-events-none z-50" />}
      {crtGrain && <div className="absolute inset-0 opacity-[0.02] pointer-events-none z-50 crt-flicker bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:4px_4px]" />}

      {/* Top Menu Bar */}
      <TopMenuBar />

      {/* Desktop Workspace: Left Column Icons */}
      <div className="absolute top-12 left-5 flex flex-col gap-5 z-10">
        {leftIcons.map(({ id, label, iconSrc }) => (
          <button
            key={id}
            onClick={() => handleIconClick(id)}
            onDoubleClick={() => handleIconClick(id)}
            className="flex flex-col items-center justify-center w-20 group cursor-pointer active:scale-95 transition"
          >
            <img 
              src={iconSrc} 
              alt={label} 
              className="w-11 h-11 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:scale-105 transition" 
            />
            <span className="text-[12px] font-bold text-white mt-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] text-center tracking-wide">
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* Desktop Workspace: Right Column Icons */}
      <div className="absolute top-12 right-5 flex flex-col items-center gap-6 z-10">
        {/* My Socials Icon Box */}
        <button
          onClick={handleOpenSocials}
          className="flex flex-col items-center justify-center w-20 group cursor-pointer active:scale-95 transition"
        >
          <div className="w-12 h-12 rounded-xl bg-white/40 backdrop-blur-md border border-white/60 shadow-lg flex flex-wrap p-1 gap-1 items-center justify-center group-hover:scale-105 transition">
            <img src="/assets/icons/twitter.webp" alt="Twitter / X" className="w-4 h-4 object-contain rounded-sm" />
            <img src="/assets/icons/instagram.webp" alt="Instagram" className="w-4 h-4 object-contain rounded-sm" />
            <img src="/assets/icons/linkedin.webp" alt="LinkedIn" className="w-4 h-4 object-contain rounded-sm" />
            <img src="/assets/icons/github.webp" alt="GitHub" className="w-4 h-4 object-contain rounded-sm" />
          </div>
          <span className="text-[12px] font-bold text-white mt-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] text-center tracking-wide">
            My Socials
          </span>
        </button>

        {/* Community Guestbook Icon */}
        <button
          onClick={() => handleIconClick('community')}
          className="flex flex-col items-center justify-center w-20 group cursor-pointer active:scale-95 transition"
        >
          <img 
            src="/assets/icons/guestbook.webp" 
            alt="Community" 
            className="w-11 h-11 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:scale-105 transition" 
          />
          <span className="text-[12px] font-bold text-white mt-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)] text-center tracking-wide">
            Community
          </span>
        </button>
      </div>

      {/* Centered Frosted Glass "My Socials" Pop-up Modal (Matching Frame 08s) */}
      {showSocialsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px] animate-fadeIn"
          onClick={() => setShowSocialsModal(false)}
        >
          <div 
            className="relative bg-white/25 backdrop-blur-xl border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-3xl p-6 px-8 flex flex-col items-center text-white font-pixel select-none animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-white mb-6 tracking-wider font-silkscreen drop-shadow">
              My Socials
            </h3>

            <div className="flex items-center gap-5">
              <a
                href="https://x.com/VaradPatil____"
                target="_blank"
                rel="noreferrer"
                onClick={() => retroAudio.playClickSound()}
                className="flex flex-col items-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center border border-white/30 shadow-md group-hover:scale-110 group-hover:-translate-y-1 transition-all">
                  <img src="/assets/icons/twitter.webp" alt="Twitter / X" className="w-7 h-7 object-contain" />
                </div>
                <span className="text-[10px] text-white/90 mt-2 font-bold tracking-wide group-hover:text-white">
                  Twitter
                </span>
              </a>

              <a
                href="https://www.instagram.com/varadpatil___/"
                target="_blank"
                rel="noreferrer"
                onClick={() => retroAudio.playClickSound()}
                className="flex flex-col items-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center border border-white/30 shadow-md group-hover:scale-110 group-hover:-translate-y-1 transition-all">
                  <img src="/assets/icons/instagram.webp" alt="Instagram" className="w-7 h-7 object-contain" />
                </div>
                <span className="text-[10px] text-white/90 mt-2 font-bold tracking-wide group-hover:text-white">
                  Instagram
                </span>
              </a>

              <a
                href="https://www.linkedin.com/in/varad-patil-98a851338?utm_source=share_via&utm_content=profile&utm_medium=member_android"
                target="_blank"
                rel="noreferrer"
                onClick={() => retroAudio.playClickSound()}
                className="flex flex-col items-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-[#0077b5] flex items-center justify-center border border-white/30 shadow-md group-hover:scale-110 group-hover:-translate-y-1 transition-all">
                  <img src="/assets/icons/linkedin.webp" alt="LinkedIn" className="w-7 h-7 object-contain" />
                </div>
                <span className="text-[10px] text-white/90 mt-2 font-bold tracking-wide group-hover:text-white">
                  LinkedIn
                </span>
              </a>

              <a
                href="https://github.com/VaradPatil5005"
                target="_blank"
                rel="noreferrer"
                onClick={() => retroAudio.playClickSound()}
                className="flex flex-col items-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-[#24292e] flex items-center justify-center border border-white/30 shadow-md group-hover:scale-110 group-hover:-translate-y-1 transition-all">
                  <img src="/assets/icons/github.webp" alt="GitHub" className="w-7 h-7 object-contain" />
                </div>
                <span className="text-[10px] text-white/90 mt-2 font-bold tracking-wide group-hover:text-white">
                  GitHub
                </span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Peregrine Falcon Desktop Companion */}
      <FalconPet />

      {/* Welcome Guidelines Modal */}
      <WelcomeModal />

      {/* Comic Dialogue Guide System */}
      <ComicDialogue />

      {/* --- ALL WINDOWS (Classic System 7 Window Frame) --- */}
      <WindowFrame id="spillguard" icon={<HardDrive className="w-3.5 h-3.5 text-rose-700" />}>
        <SpillGuardApp />
      </WindowFrame>

      <WindowFrame id="bpf_studio" icon={<Radio className="w-3.5 h-3.5 text-purple-700" />}>
        <BPFStudioApp />
      </WindowFrame>

      <WindowFrame id="community" icon={<Users className="w-3.5 h-3.5 text-blue-700" />}>
        <CommunityApp />
      </WindowFrame>

      <WindowFrame id="trash" icon={<Trash2 className="w-3.5 h-3.5 text-slate-700" />}>
        <TrashApp />
      </WindowFrame>

      <WindowFrame id="settings" icon={<Sliders className="w-3.5 h-3.5 text-indigo-700" />}>
        <SettingsApp />
      </WindowFrame>

      <WindowFrame id="internet" icon={<Globe className="w-3.5 h-3.5 text-blue-700" />}>
        <InternetApp />
      </WindowFrame>

      <WindowFrame id="task_manager" icon={<Cpu className="w-3.5 h-3.5 text-indigo-700" />}>
        <TaskManagerApp />
      </WindowFrame>

      <WindowFrame id="memory_map" icon={<Layers className="w-3.5 h-3.5 text-emerald-700" />}>
        <MemoryMapApp />
      </WindowFrame>

      <WindowFrame id="deadlock_lab" icon={<ShieldAlert className="w-3.5 h-3.5 text-amber-700" />}>
        <DeadlockLabApp />
      </WindowFrame>

      <WindowFrame id="terminal" icon={<Terminal className="w-3.5 h-3.5 text-cyan-700" />}>
        <TerminalApp />
      </WindowFrame>

      <WindowFrame id="file_explorer" icon={<Folder className="w-3.5 h-3.5 text-yellow-700" />}>
        <FileExplorerApp />
      </WindowFrame>

      <WindowFrame id="music" icon={<Disc className="w-3.5 h-3.5 text-rose-700" />}>
        <MusicApp />
      </WindowFrame>

      <WindowFrame id="calculator" icon={<Calculator className="w-3.5 h-3.5 text-orange-700" />}>
        <CalculatorApp />
      </WindowFrame>

      <WindowFrame id="messages" icon={<MessageSquare className="w-3.5 h-3.5 text-sky-700" />}>
        <MessagesApp />
      </WindowFrame>

      <WindowFrame id="test_runner" icon={<CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />}>
        <TestRunnerApp />
      </WindowFrame>

      <WindowFrame id="kernel_quest" icon={<Trophy className="w-3.5 h-3.5 text-purple-700" />}>
        <KernelQuestApp />
      </WindowFrame>

      <WindowFrame id="kernel_monitor" icon={<Activity className="w-3.5 h-3.5 text-pink-700" />}>
        <KernelMonitorApp />
      </WindowFrame>

      <WindowFrame id="about" icon={<Info className="w-3.5 h-3.5 text-slate-700" />}>
        <AboutApp />
      </WindowFrame>

      {/* Floating Retro Glass Dock */}
      <RetroDock />
    </div>
  );
};
