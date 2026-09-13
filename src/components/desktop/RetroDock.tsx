import React, { useState } from 'react';
import { useWindowStore, AppId } from '../../stores/useWindowStore';
import { retroAudio } from '../../utils/audio';

interface DockIconItem {
  id: AppId;
  label: string;
  iconSrc: string;
  badge?: string;
  comicTooltip?: string;
}

export const RetroDock: React.FC = () => {
  const { 
    open, 
    windows, 
    activeId, 
    trashSpeech, 
    showTrashSpeech, 
    unreadMessagesCount, 
    decrementUnreadMessages,
    triggerTrashSpeech 
  } = useWindowStore();

  const [hoveredId, setHoveredId] = useState<AppId | null>(null);

  const dockItems: DockIconItem[] = [
    { 
      id: 'file_explorer', 
      label: 'Finder', 
      iconSrc: '/assets/icons/finder.webp',
      comicTooltip: 'Browse filesystem & project archives.'
    },
    { 
      id: 'internet', 
      label: 'Internet', 
      iconSrc: '/assets/icons/internet.webp',
      comicTooltip: 'Browse Snoogle & vintage web.'
    },
    { 
      id: 'music', 
      label: 'Music', 
      iconSrc: '/assets/icons/music.webp',
      comicTooltip: 'Want background music? Open the Music player.'
    },
    { 
      id: 'messages', 
      label: 'Messages', 
      iconSrc: '/assets/icons/messageBubble.webp', 
      badge: unreadMessagesCount > 0 ? unreadMessagesCount.toString() : undefined,
      comicTooltip: 'Chat with Bob & community friends.'
    },
    { 
      id: 'terminal', 
      label: 'Terminal', 
      iconSrc: '/assets/icons/terminal.webp',
      comicTooltip: 'Run shell commands & kernel diagnostics.'
    },
    { 
      id: 'trash', 
      label: 'Trash', 
      iconSrc: '/assets/icons/trash.webp',
      comicTooltip: 'Trash bin. Secrets discarded here.'
    }
  ];

  const handleClick = (id: AppId) => {
    if (id === 'trash') {
      retroAudio.playTrashSound();
      const funnyQuotes = [
        '*scratch scratch*',
        'Mmm, delicious discarded bytes!',
        'Hey! Who threw homework in here?',
        'Emptying the trash won\'t cure your sleep debt.'
      ];
      triggerTrashSpeech(funnyQuotes[Math.floor(Math.random() * funnyQuotes.length)], 3000);
    } else {
      retroAudio.playClickSound();
    }

    if (id === 'messages') {
      decrementUnreadMessages();
    }

    open(id);
  };

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 select-none">
      <div className="flex items-center gap-3 px-4 py-2 backdrop-blur-md bg-white/40 border border-white/60 shadow-2xl rounded-2xl">
        {dockItems.map((item) => {
          const win = windows[item.id];
          const isOpen = win && win.isOpen;
          const isActive = activeId === item.id;
          const isHovered = hoveredId === item.id;
          const isTrashWithSpeech = item.id === 'trash' && showTrashSpeech && trashSpeech;

          return (
            <div 
              key={item.id} 
              className="relative group flex flex-col items-center"
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Dynamic Trash Comic Speech Bubble (Matching Frame 33s in AetherOS) */}
              {isTrashWithSpeech && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 pointer-events-none z-50 animate-bounce whitespace-nowrap">
                  <div className="relative bg-white text-black text-xs font-pixel px-3 py-1 border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,0.8)] rounded-sm text-center">
                    <p className="font-bold text-[11px]">{trashSpeech}</p>
                    
                    {/* Bottom Center Pointer Triangle */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-black" />
                    <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-white z-10" />
                  </div>
                </div>
              )}

              {/* Standard Comic Speech Bubble Tooltip on Hover */}
              {!isTrashWithSpeech && isHovered && item.comicTooltip && (
                <div className="absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none z-50 animate-fadeIn whitespace-normal min-w-[170px] max-w-[220px]">
                  <div className="relative bg-white text-black text-xs font-pixel px-3 py-1.5 border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,0.8)] rounded-sm text-center leading-snug">
                    <p className="font-bold text-[11px]">{item.comicTooltip}</p>
                    
                    {/* Bottom Center Pointer Triangle */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-black" />
                    <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-white z-10" />
                  </div>
                </div>
              )}

              {/* Icon Button */}
              <button
                onClick={() => handleClick(item.id)}
                className={`relative transition-transform duration-150 ${
                  isActive ? '-translate-y-1.5 scale-105' : 'hover:-translate-y-1 hover:scale-105 active:scale-95'
                }`}
              >
                <img 
                  src={item.iconSrc} 
                  alt={item.label} 
                  className="w-11 h-11 object-contain drop-shadow-md" 
                />

                {/* Unread badge */}
                {item.badge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white font-pixel text-[10px] font-bold rounded-full flex items-center justify-center border border-white shadow">
                    {item.badge}
                  </span>
                )}
              </button>

              {/* Active Dot Indicator */}
              <div className="h-1 flex items-center justify-center mt-1">
                {isOpen && (
                  <span className="w-1.5 h-1.5 rounded-full bg-black/70 shadow-sm" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
