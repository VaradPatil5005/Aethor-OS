import React, { useState, useEffect, useRef } from 'react';
import { useWindowStore } from '../../stores/useWindowStore';
import { retroAudio } from '../../utils/audio';
import { Image, Monitor, Volume2, Sparkles, Check, RotateCcw } from 'lucide-react';

// Live Video Thumbnail that safely autoplays inside the Control Panel with poster fallback
const VideoThumbnail: React.FC<{ src: string; poster: string }> = ({ src, poster }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.loop = true;

    const play = () => {
      v.play().catch(() => {});
    };

    if (v.readyState >= 2) {
      play();
    } else {
      v.addEventListener('loadeddata', play);
      v.addEventListener('canplay', play);
    }

    return () => {
      v.removeEventListener('loadeddata', play);
      v.removeEventListener('canplay', play);
    };
  }, [src]);

  return (
    <div className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden min-h-0 min-w-0">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover group-hover:scale-105 transition duration-300 pointer-events-none"
      />
    </div>
  );
};

// Live Animated Matrix Thumbnail for Control Panel
const MatrixThumbnail: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 180;
    canvas.height = 100;
    const chars = '0101AETHEROS';
    const fontSize = 10;
    const cols = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array.from({ length: cols }, () => Math.floor(Math.random() * (canvas.height / fontSize)));

    let frame: number;
    const draw = () => {
      ctx.fillStyle = 'rgba(5, 17, 9, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = 'bold 9px monospace';
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillStyle = '#c7ffd5';
        ctx.fillText(char, x, y);

        if (drops[i] > 1) {
          ctx.fillStyle = '#00ff66';
          ctx.fillText(chars[Math.floor(Math.random() * chars.length)], x, y - fontSize);
        }

        if (y > canvas.height && Math.random() > 0.95) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full object-cover pointer-events-none" />;
};

export const SettingsApp: React.FC = () => {
  const { 
    wallpaper, 
    setWallpaper, 
    crtScanlines, 
    toggleScanlines, 
    crtGrain, 
    toggleGrain,
    resetLayout
  } = useWindowStore();

  const [activeTab, setActiveTab] = useState<'wallpapers' | 'display' | 'sound'>('wallpapers');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const wallpapers = [
    {
      id: 'mainframe',
      title: 'Mainframe Video',
      tagline: 'Mouse-Scrubbed Agency Video',
      src: '/assets/wallpapers/mainframe.mp4',
      poster: '/assets/wallpapers/mainframe_thumb.jpg',
      type: 'video' as const,
      badge: 'Video MP4'
    },
    {
      id: 'lavender',
      title: 'Lavender Studio',
      tagline: 'Interactive Character Video',
      src: '/assets/wallpapers/lavender.mp4',
      poster: '/assets/wallpapers/lavender_thumb.jpg',
      type: 'video' as const,
      badge: 'Video MP4'
    },
    {
      id: 'orbit',
      title: 'Orbit Lilies',
      tagline: 'Dual-Layer Pixel Art Lilies',
      src: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_192942_e1086505-d7da-433b-a59b-8220f4e6c808.png',
      poster: '',
      type: 'image' as const,
      badge: 'Morph Art'
    },
    {
      id: 'matrix',
      title: 'Cyber Matrix',
      tagline: 'Phosphor Rain Digital Canvas',
      src: '',
      poster: '',
      type: 'matrix' as const,
      badge: 'Live Canvas'
    }
  ];

  const handleWallpaperChange = (id: string) => {
    retroAudio.playClickSound();
    setWallpaper(id);
  };

  const handleToggleSound = () => {
    const muted = retroAudio.toggleMute();
    setSoundEnabled(!muted);
    if (!muted) retroAudio.playClickSound();
  };

  return (
    <div className="h-full flex flex-col text-black font-pixel select-none text-xs bg-[var(--rt-panel)]">
      {/* Top Title Banner */}
      <div className="p-2 border-b bg-[#ececec] flex items-center justify-between border-black">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-slate-300 flex items-center justify-center font-bold text-[12px] rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            CP
          </div>
          <div>
            <h2 className="font-bold text-[13px]">Control Panel & Settings</h2>
            <p className="text-slate-600 text-[12px]">Personalize your desktop background and visual effects</p>
          </div>
        </div>
        <div className="bg-slate-200 px-2 py-0.5 border rounded border-black text-[12px]">
          AetherOS v2.0
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Tabs */}
        <div className="w-36 bg-[#d4d4d4] border-r p-2 flex flex-col gap-1 border-black">
          <button
            onClick={() => { retroAudio.playClickSound(); setActiveTab('wallpapers'); }}
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-left font-bold ${
              activeTab === 'wallpapers'
                ? 'bg-black text-white shadow-sm'
                : 'hover:bg-black/10 text-black'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            <span>Wallpapers</span>
          </button>

          <button
            onClick={() => { retroAudio.playClickSound(); setActiveTab('display'); }}
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-left font-bold ${
              activeTab === 'display'
                ? 'bg-black text-white shadow-sm'
                : 'hover:bg-black/10 text-black'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Display FX</span>
          </button>

          <button
            onClick={() => { retroAudio.playClickSound(); setActiveTab('sound'); }}
            className={`flex items-center gap-2 px-2 py-1.5 rounded text-left font-bold ${
              activeTab === 'sound'
                ? 'bg-black text-white shadow-sm'
                : 'hover:bg-black/10 text-black'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Sound FX</span>
          </button>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 min-h-0 p-3 overflow-y-auto bg-[#ececec] overscroll-contain">
          {/* TAB 1: WALLPAPERS */}
          {activeTab === 'wallpapers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-black/40">
                <span className="font-bold text-[12px] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  Select Desktop Wallpaper
                </span>
                <span className="text-slate-600 text-[12px]">Pure backgrounds • No overlays</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {wallpapers.map((wp) => {
                  const isSelected = wallpaper === wp.id;

                  return (
                    <div
                      key={wp.id}
                      onClick={() => handleWallpaperChange(wp.id)}
                      className={`cursor-pointer rounded border-2 transition-all p-2 flex flex-col justify-between group ${
                        isSelected 
                          ? 'border-black bg-white shadow-[3px_3px_0px_rgba(0,0,0,0.4)]' 
                          : 'hover:border-black/50 hover:bg-[#e4e4e4] bg-[var(--rt-panel)] border-black/40'
                      }`}
                    >
                      {/* Thumbnail Preview Box */}
                      <div className="relative w-full h-24 rounded overflow-hidden bg-black flex items-center justify-center border border-black/30">
                        {wp.type === 'video' ? (
                          <VideoThumbnail src={wp.src} poster={wp.poster} />
                        ) : wp.type === 'matrix' ? (
                          <MatrixThumbnail />
                        ) : (
                          <img 
                            src={wp.src} 
                            alt={wp.title} 
                            className="w-full h-full object-contain p-1 group-hover:scale-105 transition duration-300" 
                          />
                        )}

                        <span className="absolute top-1 right-1 px-1.5 py-0.2 bg-black/80 text-white rounded z-10 font-terminal text-[13px]">
                          {wp.badge}
                        </span>

                        {isSelected && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
                            <span className="bg-black text-white px-2 py-0.5 rounded font-bold flex items-center gap-1 shadow text-[12px]">
                              <Check className="w-3 h-3 text-emerald-400" /> Active
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <div className="font-bold flex items-center gap-1 text-[12.5px]">
                            {wp.title}
                          </div>
                          <div className="text-slate-600 truncate max-w-[150px] text-[11px]">
                            {wp.tagline}
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleWallpaperChange(wp.id); }}
                          className={`px-2 py-0.5 font-bold rounded border text-[12px] ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-800'
                              : 'bg-white hover:bg-slate-100 border-black'
                          }`}
                        >
                          {isSelected ? 'Applied' : 'Set'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: DISPLAY FX */}
          {activeTab === 'display' && (
            <div className="space-y-4">
              <div className="font-bold text-[12px] pb-1 border-b border-black/40">
                CRT Screen & Retro Filters
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-white border rounded border-black/40">
                  <div>
                    <div className="font-bold">CRT Horizontal Scanlines</div>
                    <div className="text-slate-500 text-[12px]">Simulates classic cathode-ray tube phosphor scan lines</div>
                  </div>
                  <button
                    onClick={() => { retroAudio.playClickSound(); toggleScanlines(); }}
                    className={`px-3 py-1 font-bold rounded border ${
                      crtScanlines ? 'bg-black text-white border-black' : 'bg-slate-200 text-black border-black'
                    }`}
                  >
                    {crtScanlines ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white border rounded border-black/40">
                  <div>
                    <div className="font-bold">Subtle Screen Grain</div>
                    <div className="text-slate-500 text-[12px]">Adds an ultra-fine phosphor noise texture to the screen</div>
                  </div>
                  <button
                    onClick={() => { retroAudio.playClickSound(); toggleGrain(); }}
                    className={`px-3 py-1 font-bold rounded border ${
                      crtGrain ? 'bg-black text-white border-black' : 'bg-slate-200 text-black border-black'
                    }`}
                  >
                    {crtGrain ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => { retroAudio.playClickSound(); resetLayout(); }}
                    className="w-full flex items-center justify-center gap-1.5 p-2 hover:bg-[#cecece] font-bold bg-[var(--rt-panel)] rt-raised"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Windows Layout to Factory State</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SOUND */}
          {activeTab === 'sound' && (
            <div className="space-y-4">
              <div className="font-bold text-[12px] pb-1 border-b border-black/40">
                Audio & Sound Synthesizer
              </div>

              <div className="p-3 bg-white border rounded space-y-3 border-black/40">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">Retro UI Sound Effects</div>
                    <div className="text-slate-500 text-[12px]">WebAudio mechanical mouse clicks and window snaps</div>
                  </div>
                  <button
                    onClick={handleToggleSound}
                    className={`px-3 py-1 font-bold rounded border ${
                      soundEnabled ? 'bg-emerald-600 text-white border-emerald-800' : 'bg-slate-200 text-black border-black'
                    }`}
                  >
                    {soundEnabled ? 'ENABLED' : 'MUTED'}
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={() => retroAudio.playClickSound()}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 border rounded font-bold border-black"
                  >
                    Test Click Sound
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
