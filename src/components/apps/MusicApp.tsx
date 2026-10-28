import React, { useState } from 'react';
import { retroAudio } from '../../utils/audio';
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react';

const TRACKS = [
  { title: 'Neon Kyoto 1994', artist: 'Aether Sound Labs', genre: 'Lo-fi pentatonic', label: '#e11d48' },
  { title: 'Aether Dream Core', artist: 'Kernel FM', genre: 'Lydian chiptune', label: '#2563eb' },
];

/** Retrium-style chunky player button: 3px outline, 5px hard shadow, VT323. */
const playerBtn =
  'inline-flex items-center justify-center gap-1.5 min-w-[88px] px-5 py-1.5 bg-[var(--rt-side)] border-[3px] border-black shadow-[5px_5px_0_rgba(0,0,0,0.9)] font-terminal text-[19px] leading-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-[3px_3px_0_rgba(0,0,0,0.9)] hover:bg-white';

export const MusicApp: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(retroAudio.isTrackPlaying());
  const [trackIndex, setTrackIndex] = useState<number>(retroAudio.getCurrentTrack());
  const [volume, setVolume] = useState(0.5);
  const track = TRACKS[trackIndex];

  const togglePlay = () => {
    retroAudio.playClickSound();
    if (isPlaying) { retroAudio.pauseMusic(); setIsPlaying(false); }
    else { retroAudio.playMusic(trackIndex); setIsPlaying(true); }
  };

  const pick = (i: number) => {
    retroAudio.playClickSound();
    setTrackIndex(i);
    retroAudio.setTrack(i);
    if (isPlaying) retroAudio.playMusic(i);
  };

  return (
    // Content is centred with m-auto, not justify-center: a centred column that overflows
    // would push its top out of reach of the scrollbar.
    <div className="h-full w-full flex flex-col overflow-y-auto min-h-0 bg-[var(--rt-panel)] text-black">
      <div className="m-auto w-full max-w-sm flex flex-col items-center text-center px-5 py-5">
        {/* Turntable: the record turns on a black platter; pause freezes it mid-turn */}
        <div className="mb-3.5 p-2 rounded-full border-[3px] border-black bg-[#1a1a1a] leading-none">
          <div
            className="animate-spin w-32 h-32 rounded-full flex items-center justify-center bg-[#0d0d0d] bg-[repeating-radial-gradient(circle,#151515_0_2px,#222_2px_3px)]"
            style={{ animationDuration: '8s', animationPlayState: isPlaying ? 'running' : 'paused' }}
          >
            <div className="w-12 h-12 rounded-full border-2 border-white flex flex-col items-center justify-center" style={{ background: track.label }}>
              <span className="font-pixel text-[9px] font-bold uppercase text-white leading-none">Aether</span>
              <span className="w-2 h-2 rounded-full bg-white mt-1" />
            </div>
          </div>
        </div>

        <h2 className="font-pixel text-[22px] leading-tight uppercase tracking-wide m-0">{track.title}</h2>
        <p className="font-terminal text-[17px] leading-tight text-[#333] mb-3">{track.artist} · {track.genre}</p>

        <div className="flex gap-2.5 mb-3.5">
          <button onClick={togglePlay} className={playerBtn} aria-pressed={isPlaying}>
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button onClick={() => pick((trackIndex + 1) % TRACKS.length)} className={playerBtn} title="Next track">
            <SkipForward className="w-4 h-4" /> Next
          </button>
        </div>

        <div className="flex flex-col items-center gap-1.5 w-full">
          <p className="font-terminal text-[14px] uppercase tracking-[0.14em] text-[#555] m-0">Discs</p>
          <div className="flex gap-2" role="radiogroup" aria-label="Choose a record">
            {TRACKS.map((t, i) => (
              <button
                key={t.title}
                role="radio"
                aria-checked={i === trackIndex}
                aria-label={t.title}
                title={t.title}
                onClick={() => pick(i)}
                className={`w-8 h-8 rounded-full bg-[#111] flex items-center justify-center ${i === trackIndex ? 'outline outline-2 outline-black outline-offset-2' : ''}`}
              >
                <span className="w-3 h-3 rounded-full border border-white" style={{ background: t.label }} />
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 mt-2 font-terminal text-[17px]">
            <Volume2 className="w-4 h-4" />
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); retroAudio.setVolume(v); }}
              className="w-32 cursor-pointer"
            />
            {Math.round(volume * 100)}%
          </label>
        </div>
      </div>
    </div>
  );
};
