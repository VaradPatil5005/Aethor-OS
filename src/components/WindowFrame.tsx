import React from 'react';
import { Rnd } from 'react-rnd';
import { useWindowStore, AppId } from '../stores/useWindowStore';
import { retroAudio } from '../utils/audio';

interface WindowFrameProps {
  id: AppId;
  children: React.ReactNode;
  /** Kept for callers; the Retrium-style title bar is text-only. */
  icon?: React.ReactNode;
}

const TITLE_H = 36;

export const WindowFrame: React.FC<WindowFrameProps> = ({ id, children }) => {
  const { windows, close, minimize, maximize, focus, updateBounds, activeId } = useWindowStore();
  const win = windows[id];

  if (!win || !win.isOpen || win.isMinimized) return null;
  const isActive = activeId === id;

  const stop = (fn: () => void, sound: 'click' | 'window') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (sound === 'click') retroAudio.playClickSound();
    else retroAudio.playWindowSound();
    fn();
  };

  const handleFocus = () => {
    if (!isActive) focus(id);
  };

  const chrome = (
    <div
      className={`rt-window ${isActive ? 'is-active' : ''} ${win.isMaximized ? 'is-maximized' : ''} absolute inset-0 flex flex-col overflow-hidden`}
      role="dialog"
      aria-label={win.title}
    >
      <div
        className="rt-titlebar retro-win-titlebar shrink-0 flex items-center justify-between gap-3 cursor-move select-none"
        onDoubleClick={stop(() => maximize(id), 'window')}
      >
        <span className="truncate">{win.title}</span>
        <div className="flex items-center gap-1.5 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
          <button type="button" className="rt-ctrl rt-ctrl-min" onClick={stop(() => minimize(id), 'window')} title="Minimize" aria-label="Minimize">
            -
          </button>
          <button type="button" className="rt-ctrl rt-ctrl-max" onClick={stop(() => maximize(id), 'window')} title={win.isMaximized ? 'Restore' : 'Maximize'} aria-label={win.isMaximized ? 'Restore' : 'Maximize'}>
            o
          </button>
          <button type="button" className="rt-ctrl rt-ctrl-close" onClick={stop(() => close(id), 'click')} title="Close" aria-label="Close">
            x
          </button>
        </div>
      </div>

      {/* Body. Fixed height (flex-1 + min-h-0) so each app's own scroll area is the one that scrolls. */}
      <div className="rt-content flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col relative select-text">
        {children}
      </div>
    </div>
  );

  if (win.isMaximized) {
    return (
      <div style={{ zIndex: win.zIndex }} className="fixed left-0 right-0 top-7 bottom-0" onMouseDown={handleFocus}>
        {chrome}
      </div>
    );
  }

  return (
    <Rnd
      size={{ width: win.width, height: win.height }}
      position={{ x: win.x, y: win.y }}
      minWidth={320}
      minHeight={TITLE_H + 160}
      bounds="parent"
      dragHandleClassName="retro-win-titlebar"
      cancel=".rt-ctrl"
      // react-rnd sets display:inline-block itself; the chrome is absolutely positioned
      // inside it so the body always gets exactly (window height - title bar).
      style={{ zIndex: win.zIndex }}
      onDragStop={(_, d) => updateBounds(id, d.x, Math.max(28, d.y), win.width, win.height)}
      onResizeStop={(_, __, ref, ___, position) => {
        updateBounds(id, position.x, Math.max(28, position.y), parseInt(ref.style.width, 10), parseInt(ref.style.height, 10));
      }}
      onMouseDown={handleFocus}
    >
      {chrome}
    </Rnd>
  );
};
