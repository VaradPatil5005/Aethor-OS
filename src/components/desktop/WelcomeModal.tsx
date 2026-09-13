import React from 'react';
import { useWindowStore } from '../../stores/useWindowStore';
import { retroAudio } from '../../utils/audio';

export const WelcomeModal: React.FC = () => {
  const { welcomeModalOpen, setWelcomeModalOpen, activeUser, open } = useWindowStore();

  if (!welcomeModalOpen) return null;

  const handleOpenReadme = () => {
    retroAudio.playClickSound();
    setWelcomeModalOpen(false);
    open('about');
  };

  const handleClose = () => {
    retroAudio.playClickSound();
    setWelcomeModalOpen(false);
  };

  return (
    <div 
      className="fixed inset-0 z-[65] flex items-center justify-center p-4 select-none animate-fadeIn bg-black/40 backdrop-blur-[2px]"
      onClick={handleClose}
    >
      <div 
        className="relative w-full max-w-[540px] rounded-2xl overflow-hidden bg-[#0a0d14] border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-white font-pixel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-20 w-6 h-6 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-rose-600 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
        >
          ✕
        </button>

        {/* Pixel Illustration Header with Baked-in Crisp Aethor OS Title */}
        <div className="w-full h-52 overflow-hidden relative bg-[#4bb178]">
          <img 
            src="/assets/icons/welcome_retro_pc.png" 
            alt="Aethor OS Desktop Illustration" 
            className="w-full h-full object-cover"
          />
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs leading-relaxed text-slate-200">
          <p className="text-[13px] text-slate-100 font-pixel tracking-wide leading-relaxed">
            Aethor OS is an interactive desktop inspired by classic Mac OS. Click around, open the apps, and discover more about me. Check your Messages, and look for the secrets hiding in here.
          </p>

          <div className="text-slate-300">
            Built by <span className="text-cyan-400 font-bold underline underline-offset-2">{activeUser}</span>
          </div>

          <div className="pt-2 border-t border-white/10">
            <button
              onClick={handleOpenReadme}
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 cursor-pointer font-bold text-xs flex items-center gap-1 transition-colors"
            >
              Open ReadMe.txt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
