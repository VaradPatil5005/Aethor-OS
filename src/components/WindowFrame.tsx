import React from 'react';
import { Rnd } from 'react-rnd';
import { useWindowStore, AppId } from '../stores/useWindowStore';
import { retroAudio } from '../utils/audio';

interface WindowFrameProps {
  id: AppId;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({ id, children, icon }) => {
  const { windows, close, minimize, maximize, focus, updateBounds, activeId } = useWindowStore();
  const win = windows[id];

  if (!win || !win.isOpen || win.isMinimized) return null;
  const isActive = activeId === id;

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    retroAudio.playClickSound();
    close(id);
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    retroAudio.playWindowSound();
    minimize(id);
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    retroAudio.playWindowSound();
    maximize(id);
  };

  const handleFocus = () => {
    if (!isActive) {
      focus(id);
    }
  };

  if (win.isMaximized) {
    return (
      <div 
        style={{ zIndex: win.zIndex }}
        className="fixed top-7 left-0 right-0 bottom-14 flex flex-col bg-[#cecece] text-black border-2 border-t-white border-l-white border-r-[#333] border-b-[#333] shadow-2xl rounded-none overflow-hidden select-none"
        onMouseDown={handleFocus}
      >
        {/* Retro System 7 Titlebar */}
        <div className={`h-7 shrink-0 flex items-center justify-between px-2 cursor-default select-none z-20 ${isActive ? 'bg-[#cecece]' : 'bg-[#e0e0e0]'} border-b border-[#555] relative`}>
          {/* Background Pinstripes */}
          <div className={`absolute inset-0 ${isActive ? 'mac-stripes-dark opacity-60' : 'mac-stripes-dark opacity-20'} pointer-events-none`} />

          {/* Window Title on the Left */}
          <div className="relative z-10 px-2 py-0.5 bg-[#cecece] border border-[#888] flex items-center gap-1.5 shadow-sm max-w-[70%]">
            {icon}
            <span className="font-pixel text-[13px] font-bold tracking-wide text-black truncate">
              {win.title}
            </span>
          </div>

          {/* Window Control Buttons Clustered on the Right: Minimize, Maximize, Close */}
          <div className="relative z-10 flex items-center gap-1.5">
            {/* Minimize */}
            <button 
              onClick={handleMinimize}
              title="Minimize"
              className="w-5 h-5 bg-[#dfdfdf] border border-t-white border-l-white border-r-[#000] border-b-[#000] active:border-t-[#000] active:border-l-[#000] active:border-r-white active:border-b-white flex items-center justify-center text-[12px] font-bold text-black hover:bg-white cursor-pointer shadow-sm"
            >
              −
            </button>
            {/* Maximize / Zoom */}
            <button 
              onClick={handleMaximize}
              title="Restore / Fullscreen"
              className="w-5 h-5 bg-[#dfdfdf] border border-t-white border-l-white border-r-[#000] border-b-[#000] active:border-t-[#000] active:border-l-[#000] active:border-r-white active:border-b-white flex items-center justify-center text-[10px] font-bold text-black hover:bg-white cursor-pointer shadow-sm"
            >
              O
            </button>
            {/* Close Button with red hover */}
            <button 
              onClick={handleClose}
              title="Close window"
              className="w-5 h-5 bg-[#dfdfdf] border border-t-white border-l-white border-r-[#000] border-b-[#000] active:border-t-[#000] active:border-l-[#000] active:border-r-white active:border-b-white flex items-center justify-center text-[13px] font-bold text-black hover:bg-rose-600 hover:text-white cursor-pointer shadow-sm transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden bg-[#171822] text-slate-100 p-0.5 border-t border-[#444] flex flex-col relative z-10">
          {children}
        </div>
      </div>
    );
  }

  return (
    <Rnd
      size={{ width: win.width, height: win.height }}
      position={{ x: win.x, y: win.y }}
      minWidth={340}
      minHeight={240}
      bounds="parent"
      dragHandleClassName="retro-win-titlebar"
      style={{ zIndex: win.zIndex }}
      onDragStop={(_, d) => updateBounds(id, d.x, Math.max(28, d.y), win.width, win.height)}
      onResizeStop={(_, __, ref, ___, position) => {
        updateBounds(id, position.x, Math.max(28, position.y), parseInt(ref.style.width, 10), parseInt(ref.style.height, 10));
      }}
      onMouseDown={handleFocus}
      className="flex flex-col rounded-sm border-2 border-t-[#eee] border-l-[#eee] border-r-[#222] border-b-[#222] bg-[#cecece] shadow-[4px_4px_0px_rgba(0,0,0,0.5)] overflow-hidden select-none"
    >
      {/* Retro System 7 Titlebar */}
      <div className={`retro-win-titlebar h-7 shrink-0 flex items-center justify-between px-2 cursor-move select-none z-20 ${isActive ? 'bg-[#cecece]' : 'bg-[#dedede]'} border-b border-[#555] relative`}>
        {/* Background Pinstripes */}
        <div className={`absolute inset-0 ${isActive ? 'mac-stripes-dark opacity-60' : 'mac-stripes-dark opacity-15'} pointer-events-none`} />

        {/* Window Title on Left */}
        <div className="relative z-10 px-2 py-0.5 bg-[#cecece] border border-[#888] flex items-center gap-1.5 shadow-sm max-w-[70%]">
          {icon}
          <span className="font-pixel text-[13px] font-bold tracking-wide text-black truncate">
            {win.title}
          </span>
        </div>

        {/* All Three Controls on the Right: Minimize [−], Maximize [O], Close [×] */}
        <div className="relative z-10 flex items-center gap-1.5">
          {/* Minimize Button */}
          <button 
            onClick={handleMinimize}
            title="Minimize"
            className="w-5 h-5 bg-[#dfdfdf] border border-t-white border-l-white border-r-[#000] border-b-[#000] active:border-t-[#000] active:border-l-[#000] active:border-r-white active:border-b-white flex items-center justify-center text-[12px] font-bold text-black hover:bg-white cursor-pointer shadow-sm"
          >
            −
          </button>

          {/* Zoom / Maximize Button */}
          <button 
            onClick={handleMaximize}
            title="Zoom / Fullscreen"
            className="w-5 h-5 bg-[#dfdfdf] border border-t-white border-l-white border-r-[#000] border-b-[#000] active:border-t-[#000] active:border-l-[#000] active:border-r-white active:border-b-white flex items-center justify-center text-[10px] font-bold text-black hover:bg-white cursor-pointer shadow-sm"
          >
            O
          </button>

          {/* Close Button [×] */}
          <button 
            onClick={handleClose}
            title="Close window"
            className="w-5 h-5 bg-[#dfdfdf] border border-t-white border-l-white border-r-[#000] border-b-[#000] active:border-t-[#000] active:border-l-[#000] active:border-r-white active:border-b-white flex items-center justify-center text-[13px] font-bold text-black hover:bg-rose-600 hover:text-white cursor-pointer shadow-sm transition-colors"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content Area with Inset Border */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden bg-[#171822] text-slate-100 border-t border-[#333] flex flex-col relative z-10">
        {children}
      </div>
    </Rnd>
  );
};
