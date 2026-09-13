import React, { useState, useEffect } from 'react';
import { useWindowStore } from '../../stores/useWindowStore';
import { retroAudio } from '../../utils/audio';

export const ComicDialogue: React.FC = () => {
  const { dialogueMessage, showDialogue, closeDialogue } = useWindowStore();
  const [displayedText, setDisplayedText] = useState<string>('');

  useEffect(() => {
    if (!showDialogue || !dialogueMessage) {
      setDisplayedText('');
      return;
    }

    setDisplayedText('');
    let index = 0;
    const interval = setInterval(() => {
      if (index < dialogueMessage.length) {
        setDisplayedText(dialogueMessage.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 28);

    return () => clearInterval(interval);
  }, [showDialogue, dialogueMessage]);

  if (!showDialogue || !dialogueMessage) return null;

  const handleClose = () => {
    retroAudio.playClickSound();
    closeDialogue();
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-3xl flex items-end select-none font-pixel pointer-events-auto animate-slideUp">
      {/* Dash Avatar Portrait in Thick Black Box (Matching Frame 50s) */}
      <div className="w-28 h-28 shrink-0 bg-white border-4 border-black shadow-[4px_4px_0px_rgba(0,0,0,0.8)] overflow-hidden z-10 -mr-2 mb-[-2px]">
        <img 
          src="/assets/icons/dash_portrait.png" 
          alt="Dash Character" 
          className="w-full h-full object-contain"
        />
      </div>

      {/* Comic Dialogue Speech Box (Matching Frame 50s) */}
      <div className="flex-1 relative bg-[#f7f2e7] border-4 border-black shadow-[6px_6px_0px_rgba(0,0,0,0.8)] p-4 min-h-[96px] flex flex-col justify-between">
        {/* Top Header: DASH Badge & Red Close Button */}
        <div className="flex items-center justify-between mb-2">
          <div className="bg-black text-white px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase">
            DASH
          </div>

          <button
            onClick={handleClose}
            className="w-4 h-4 rounded-full bg-[#f25c54] border border-black text-black hover:bg-rose-600 flex items-center justify-center text-[9px] font-bold cursor-pointer leading-none transition-colors"
            title="Close"
          >
            ?
          </button>
        </div>

        {/* Typewriter Dialogue Text */}
        <div className="text-black text-sm md:text-base font-pixel tracking-wide leading-snug pr-4">
          {displayedText}
          <span className="animate-pulse inline-block ml-0.5 font-bold">|</span>
        </div>

        {/* Bottom Right Down-Arrow Indicator */}
        <div className="self-end text-black text-[10px] animate-bounce">
          ?
        </div>
      </div>
    </div>
  );
};
