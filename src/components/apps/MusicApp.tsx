import React, { useState, useEffect } from 'react';
import { retroAudio } from '../../utils/audio';
import { Play, Pause, SkipForward, Volume2, Disc } from 'lucide-react';

export const MusicApp: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(retroAudio.isTrackPlaying());
  const [trackIndex, setTrackIndex] = useState<number>(retroAudio.getCurrentTrack());
  const [volume, setVolume] = useState<number>(0.5);

  const tracks = [
    { title: 'Neon Kyoto 1994', artist: 'Aether Sound Labs', genre: 'Lo-Fi Pentatonic' },
    { title: 'Aether Dream Core', artist: 'Kernel FM', genre: 'Lydian Chiptune' }
  ];

  useEffect(() => {
    setIsPlaying(retroAudio.isTrackPlaying());
  }, []);

  const togglePlay = () => {
    retroAudio.playClickSound();
    if (isPlaying) {
      retroAudio.pauseMusic();
      setIsPlaying(false);
    } else {
      retroAudio.playMusic(trackIndex);
      setIsPlaying(true);
    }
  };

  const nextTrack = () => {
    retroAudio.playClickSound();
    const next = (trackIndex + 1) % tracks.length;
    setTrackIndex(next);
    retroAudio.setTrack(next);
    if (isPlaying) {
      retroAudio.playMusic(next);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    retroAudio.setVolume(val);
  };

  const activeTrack = tracks[trackIndex];

  return (
    <div className="h-full w-full bg-[#1e2029] text-slate-100 flex flex-col p-4 select-none font-pixel min-h-0 min-w-0 overflow-hidden">
      {/* Turntable Platter Deck */}
      <div className="flex-1 bg-[#252836] border-2 border-t-[#3b4054] border-l-[#3b4054] border-r-black border-b-black rounded-sm p-4 flex flex-col items-center justify-center relative shadow-inner">
        {/* Turntable Circular Platter */}
        <div className="relative w-44 h-44 rounded-full bg-[#121318] border-4 border-[#33384a] flex items-center justify-center shadow-2xl overflow-hidden">
          {/* Vinyl Grooves with Rotation Animation when playing */}
          <div className={`w-40 h-40 rounded-full bg-[radial-gradient(#2a2d3b_1px,transparent_1px)] [background-size:6px_6px] border-2 border-[#1e202a] flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
            {/* Center Vinyl Label */}
            <div className="w-16 h-16 rounded-full bg-rose-600 border-2 border-white flex flex-col items-center justify-center shadow">
              <span className="text-[8px] font-bold tracking-tighter text-white uppercase">Aether</span>
              <span className="text-[7px] font-mono text-white/90">33 RPM</span>
              <div className="w-2.5 h-2.5 rounded-full bg-white mt-0.5" />
            </div>
          </div>

          {/* Tonearm */}
          <div 
            className={`absolute top-2 right-4 w-12 h-20 border-r-4 border-slate-400 origin-top-right transition-transform duration-700 pointer-events-none ${
              isPlaying ? 'rotate-12' : '-rotate-12'
            }`}
          >
            <div className="w-3 h-4 bg-amber-500 rounded-sm absolute bottom-0 -right-1 shadow" />
          </div>
        </div>

        {/* Current Track Label Banner */}
        <div className="mt-4 w-full text-center bg-[#181a24] border border-[#3a3f55] py-1.5 px-3 rounded shadow">
          <div className="text-sm font-bold text-emerald-400 tracking-wide truncate">
            {activeTrack.title}
          </div>
          <div className="text-[11px] text-slate-400">
            {activeTrack.artist} • <span className="text-amber-400">{activeTrack.genre}</span>
          </div>
        </div>
      </div>

      {/* Control Deck */}
      <div className="mt-3 bg-[#cecece] text-black border-2 border-t-white border-l-white border-r-black border-b-black p-2.5 flex items-center justify-between shadow">
        {/* Playback Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="px-3 py-1 bg-[#dedede] border border-t-white border-l-white border-r-black border-b-black active:border-t-black active:border-l-black active:border-r-white active:border-b-white font-bold flex items-center gap-1 text-xs hover:bg-white"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={nextTrack}
            className="px-2.5 py-1 bg-[#dedede] border border-t-white border-l-white border-r-black border-b-black active:border-t-black active:border-l-black active:border-r-white active:border-b-white font-bold flex items-center gap-1 text-xs hover:bg-white"
            title="Next Track"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2 text-xs font-bold">
          <Volume2 className="w-3.5 h-3.5 text-black" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 accent-indigo-600 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
