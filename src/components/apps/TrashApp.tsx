import React, { useState } from 'react';
import { useWindowStore } from '../../stores/useWindowStore';
import { retroAudio } from '../../utils/audio';

export const TrashApp: React.FC = () => {
  const { triggerDialogue } = useWindowStore();
  const [selected, setSelected] = useState<boolean>(false);

  const handleFolderClick = () => {
    retroAudio.playClickSound();
    setSelected(true);
    triggerDialogue("i hated putting that in here");
  };

  return (
    <div className="h-full w-full bg-white p-6 font-pixel select-none flex flex-col justify-start min-h-0 min-w-0 overflow-hidden">
      <div 
        onClick={handleFolderClick}
        onDoubleClick={handleFolderClick}
        className={`w-28 flex flex-col items-center p-2 rounded cursor-pointer transition-colors ${
          selected ? 'bg-[var(--rt-soft)]/70 border border-black' : 'hover:bg-slate-100'
        }`}
      >
        <img 
          src="/assets/icons/folderIcon.webp" 
          alt="Folder" 
          className="w-12 h-12 object-contain drop-shadow" 
        />
        <span className="text-xs text-black text-center mt-2 font-bold leading-tight">
          I&apos;m just joking... or am I?
        </span>
        <span className="text-slate-500 text-center mt-0.5 text-[12px]">
          (DO NOT OPEN)
        </span>
      </div>
    </div>
  );
};
