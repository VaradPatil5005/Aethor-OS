import React, { useEffect } from 'react';
import { useWindowStore } from '../../stores/useWindowStore';
import { retroAudio } from '../../utils/audio';

// Like Retrium's entry card, this is the one deliberate break from the hard-edged look:
// a soft navy card with rounded corners. The close control is still the window red dot.
export const WelcomeModal: React.FC = () => {
  const { welcomeModalOpen, setWelcomeModalOpen, activeUser, open } = useWindowStore();

  const close = () => {
    retroAudio.playClickSound();
    setWelcomeModalOpen(false);
  };

  useEffect(() => {
    if (!welcomeModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setWelcomeModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [welcomeModalOpen, setWelcomeModalOpen]);

  if (!welcomeModalOpen) return null;

  const openApp = (id: 'about' | 'spillguard') => {
    retroAudio.playClickSound();
    setWelcomeModalOpen(false);
    open(id);
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-5 select-none bg-[rgba(2,6,15,0.6)] backdrop-blur-[3px]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Aethor OS"
        className="relative w-full max-w-[580px] max-h-[calc(100vh-40px)] overflow-y-auto overflow-x-hidden rounded-[18px] bg-[#040e21] text-white shadow-[0_28px_70px_rgba(0,0,0,0.55),0_4px_14px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="rt-ctrl rt-ctrl-close absolute top-3 right-3 z-20 shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
          aria-label="Close"
        >
          x
        </button>

        <div className="w-full leading-[0]">
          <img src="/assets/icons/welcome_retro_pc.png" alt="" className="block w-full aspect-[1024/500] object-cover object-bottom" />
        </div>

        <div className="px-[22px] pt-4 pb-5 font-terminal text-[21px] leading-[1.25] space-y-3">
          <p>
            Aethor OS is an interactive desktop inspired by classic Mac OS. Click around, open the apps, and discover
            more about me. Check your Messages, and look for the secrets hiding in here.
          </p>
          <p className="text-[#b9c6e0]">
            New: <button onClick={() => openApp('spillguard')} className="underline underline-offset-4 text-white hover:text-[var(--rt-max)]">SpillGuard</button> shows
            your real GPU memory live, and catches the moment it spills into system RAM.
          </p>
          <p className="text-[#b9c6e0]">Built by <span className="text-white underline underline-offset-4">{activeUser}</span></p>
          <div className="pt-2 border-t border-white/15">
            <button onClick={() => openApp('about')} className="underline underline-offset-4 hover:text-[var(--rt-max)]">Open ReadMe.txt</button>
          </div>
        </div>
      </div>
    </div>
  );
};
