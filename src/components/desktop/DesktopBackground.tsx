import React, { useEffect, useRef } from 'react';
import { useWindowStore } from '../../stores/useWindowStore';

export const DesktopBackground: React.FC = () => {
  const { wallpaper } = useWindowStore();

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {wallpaper === 'mainframe' && <MainframeWallpaper />}
      {wallpaper === 'lavender' && <LavenderWallpaper />}
      {wallpaper === 'orbit' && <OrbitWallpaper />}
      {wallpaper === 'matrix' && <MatrixWallpaper />}
      {!['mainframe', 'lavender', 'orbit', 'matrix'].includes(wallpaper) && <MainframeWallpaper />}
    </div>
  );
};

// 1. MAINFRAME VIDEO WALLPAPER (Seamless Crimson Edge Matching & Full Character Visibility)
const MainframeWallpaper: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const blurVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const blurVideo = blurVideoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    if (blurVideo) {
      blurVideo.muted = true;
      blurVideo.defaultMuted = true;
      blurVideo.playsInline = true;
    }

    let targetTime = 0.5;
    let rAF = 0;

    const performSeek = () => {
      if (!video || !video.duration) return;
      if (Math.abs(video.currentTime - targetTime) > 0.04 && !video.seeking) {
        const clamped = Math.max(0, Math.min(video.duration - 0.05, targetTime));
        video.currentTime = clamped;
        if (blurVideo && blurVideo.duration) blurVideo.currentTime = clamped;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!video.duration) return;
      const ratio = Math.max(0, Math.min(1, e.clientX / window.innerWidth));
      targetTime = ratio * video.duration;
      cancelAnimationFrame(rAF);
      rAF = requestAnimationFrame(performSeek);
    };

    const handleSeeked = () => {
      if (Math.abs(video.currentTime - targetTime) > 0.05) {
        video.currentTime = targetTime;
        if (blurVideo) blurVideo.currentTime = targetTime;
      }
    };

    video.addEventListener('seeked', handleSeeked);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Initial position
    video.currentTime = 0.5;
    if (blurVideo) blurVideo.currentTime = 0.5;

    return () => {
      cancelAnimationFrame(rAF);
      video.removeEventListener('seeked', handleSeeked);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-[#7e0113] overflow-hidden flex items-center justify-center">
      {/* Ambient Color Extension: Fills 100% of the screen with identical crimson tones, no black bars */}
      <video
        ref={blurVideoRef}
        src="/assets/wallpapers/mainframe.mp4"
        poster="/assets/wallpapers/mainframe_thumb.jpg"
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover filter blur-[36px] scale-110 opacity-95 pointer-events-none"
      />

      {/* Main Sharp Video: Full boy character, hair, and shirt completely in view, seamlessly blended */}
      <video
        ref={videoRef}
        src="/assets/wallpapers/mainframe.mp4"
        poster="/assets/wallpapers/mainframe_thumb.jpg"
        muted
        playsInline
        preload="auto"
        className="relative w-full h-full object-contain pointer-events-none z-10"
        style={{ objectPosition: '70% center' }}
      />
    </div>
  );
};

// 2. LAVENDER CHARACTER VIDEO WALLPAPER (Seamless Lavender Matching & Eye-Tracking)
const TAU = Math.PI * 2;
const wrappedAngle = (angle: number) => (angle % TAU + TAU) % TAU;

const gazeFrames: [number, number][] = [
  [0.037186, 2.54167], [0.130722, 2.58333], [0.234912, 2.625], [0.321399, 2.66667],
  [0.419378, 2.70833], [0.493296, 2.75], [0.597784, 2.79167], [0.763067, 2.83333],
  [0.778708, 2.875], [0.878749, 2.91667], [0.993308, 2.95833], [1.262791, 3.0],
  [1.388902, 3.04167], [1.466609, 0.25], [1.473318, 0.29167], [1.520011, 3.08333],
  [1.53824, 0.33333], [1.6056, 0.375], [1.640696, 3.125], [1.691747, 0.41667],
  [1.779194, 0.45833], [1.869867, 0.5], [1.984485, 0.54167], [2.07265, 0.58333],
  [2.183915, 0.625], [2.267155, 0.66667], [2.36138, 0.70833], [2.44749, 0.75],
  [2.517676, 0.79167], [2.605329, 0.83333], [2.670889, 0.875], [2.809991, 0.91667],
  [2.918365, 0.95833], [3.134177, 1.0], [3.240289, 1.04167], [3.35949, 1.08333],
  [3.464119, 1.125], [3.549317, 1.16667], [3.663539, 1.20833], [3.78152, 1.25],
  [3.878742, 1.29167], [3.989446, 1.33333], [4.066996, 1.375], [4.225574, 1.45833],
  [4.260255, 1.41667], [4.276468, 1.5], [4.404025, 1.54167], [4.487075, 1.58333],
  [4.552949, 1.625], [4.628837, 1.66667], [4.701131, 1.70833], [4.773675, 1.75],
  [4.833089, 1.79167], [4.894145, 1.83333], [4.962593, 1.875], [5.028737, 1.91667],
  [5.090028, 1.95833], [5.212041, 2.0], [5.28302, 2.04167], [5.349352, 2.08333],
  [5.412121, 2.125], [5.473636, 2.16667], [5.573871, 2.20833], [5.656364, 2.25],
  [5.759153, 2.29167], [5.85261, 2.33333], [5.938647, 2.375], [6.048453, 2.41667],
  [6.153327, 2.45833], [6.222603, 2.5]
];

function timeForAngle(angle: number) {
  const target = wrappedAngle(angle);
  let nearestTime = gazeFrames[0][1];
  let nearestDistance = Infinity;
  for (const [sampleAngle, time] of gazeFrames) {
    const difference = Math.abs(target - sampleAngle);
    const distance = Math.min(difference, TAU - difference);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestTime = time;
    }
  }
  return nearestTime + 1 / 240;
}

const LavenderWallpaper: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const blurVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const blurVideo = blurVideoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    if (blurVideo) {
      blurVideo.muted = true;
      blurVideo.defaultMuted = true;
      blurVideo.playsInline = true;
    }

    let rAF = 0;
    let desiredTime = 2.5;

    const performSeek = () => {
      if (!video || video.seeking || !video.duration) return;
      if (Math.abs(video.currentTime - desiredTime) > 1 / 48) {
        const clamped = Math.min(desiredTime, video.duration - 1 / 24);
        video.currentTime = clamped;
        if (blurVideo && blurVideo.duration) blurVideo.currentTime = clamped;
      }
    };

    const updateGaze = (e: MouseEvent) => {
      const rect = video.getBoundingClientRect();
      const scale = Math.max(rect.width / 1920, rect.height / 1080);
      const eyeX = rect.left + rect.width / 2 + (948 - 960) * scale;
      const eyeY = rect.top + rect.height / 2 + (418 - 540) * scale;
      const dx = e.clientX - eyeX;
      const dy = e.clientY - eyeY;

      if (Math.hypot(dx, dy) > 8) {
        desiredTime = timeForAngle(Math.atan2(dy, dx));
        cancelAnimationFrame(rAF);
        rAF = requestAnimationFrame(performSeek);
      }
    };

    const handleSeeked = () => {
      if (Math.abs(video.currentTime - desiredTime) > 1 / 48) {
        const clamped = Math.min(desiredTime, (video.duration || 7) - 1 / 24);
        video.currentTime = clamped;
        if (blurVideo) blurVideo.currentTime = clamped;
      }
    };

    video.addEventListener('seeked', handleSeeked);
    window.addEventListener('mousemove', updateGaze, { passive: true });

    video.currentTime = 2.54;
    if (blurVideo) blurVideo.currentTime = 2.54;

    return () => {
      cancelAnimationFrame(rAF);
      video.removeEventListener('seeked', handleSeeked);
      window.removeEventListener('mousemove', updateGaze);
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-[#f0eefa] overflow-hidden flex items-center justify-center">
      {/* Ambient Pale Lavender Backdrop: Extends color to all 4 sides seamlessly */}
      <video
        ref={blurVideoRef}
        src="/assets/wallpapers/lavender.mp4"
        poster="/assets/wallpapers/lavender_thumb.jpg"
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover filter blur-[30px] scale-110 opacity-85 pointer-events-none"
      />

      {/* Main Character: Full ears, body, and pink heart completely in view, no cutoff */}
      <video
        ref={videoRef}
        src="/assets/wallpapers/lavender.mp4"
        poster="/assets/wallpapers/lavender_thumb.jpg"
        muted
        playsInline
        preload="auto"
        className="relative w-full h-full object-contain pointer-events-none z-10"
        style={{ objectPosition: 'center' }}
      />
    </div>
  );
};

// 3. ORBIT INTERACTIVE DUAL LILIES
const OrbitWallpaper: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let time = 0;
    let headRadius = 0;
    let targetR = 0;

    interface TrailPoint {
      x: number;
      y: number;
      r: number;
      alpha: number;
      seed: number;
    }

    let points: TrailPoint[] = [];
    let mousePos = { x: -1000, y: -1000 };
    let hasMouse = false;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e: MouseEvent) => {
      mousePos = { x: e.clientX, y: e.clientY };
      hasMouse = true;
      targetR = 140;
    };

    const onMouseLeave = () => {
      hasMouse = false;
      targetR = 0;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave);

    const drawMorphBlob = (
      context: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      r: number,
      t: number,
      seed: number
    ) => {
      if (r < 2) return;
      const numPts = 24;
      const pts: { x: number; y: number }[] = [];

      for (let i = 0; i < numPts; i++) {
        const angle = (i / numPts) * Math.PI * 2;
        const n1 = Math.sin(angle * 3 + t * 1.4 + seed) * 0.45;
        const n2 = Math.sin(angle * 5 - t * 0.9 + seed * 2.3) * 0.3;
        const n3 = Math.cos(angle * 2 + t * 1.8 + seed * 0.7) * 0.25;
        const noise = (n1 + n2 + n3) * 44 * (r / 140);
        const rad = Math.max(2, r + noise);
        pts.push({
          x: cx + Math.cos(angle) * rad,
          y: cy + Math.sin(angle) * rad
        });
      }

      context.beginPath();
      const firstMidX = (pts[0].x + pts[numPts - 1].x) / 2;
      const firstMidY = (pts[0].y + pts[numPts - 1].y) / 2;
      context.moveTo(firstMidX, firstMidY);

      for (let i = 0; i < numPts; i++) {
        const next = pts[(i + 1) % numPts];
        const midX = (pts[i].x + next.x) / 2;
        const midY = (pts[i].y + next.y) / 2;
        context.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }
      context.closePath();
      context.fill();
    };

    const render = () => {
      time += 0.016;
      headRadius += (targetR - headRadius) * (hasMouse ? 0.14 : 0.04);

      if (hasMouse && headRadius > 5) {
        const last = points[points.length - 1];
        const dist = last ? Math.hypot(mousePos.x - last.x, mousePos.y - last.y) : 999;
        if (dist > 8) {
          points.push({
            x: mousePos.x,
            y: mousePos.y,
            r: headRadius,
            alpha: 1,
            seed: Math.random() * 100
          });
          if (points.length > 60) points.shift();
        }
      }

      for (let i = points.length - 1; i >= 0; i--) {
        points[i].alpha *= 0.92;
        points[i].r *= 0.995;
        if (points[i].alpha < 0.01) {
          points.splice(i, 1);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (points.length > 0 || (hasMouse && headRadius > 5)) {
        ctx.fillStyle = '#ffffff';
        points.forEach((p) => {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          drawMorphBlob(ctx, p.x, p.y, p.r, time, p.seed);
          ctx.restore();
        });

        if (hasMouse && headRadius > 5) {
          ctx.save();
          ctx.globalAlpha = 1;
          drawMorphBlob(ctx, mousePos.x, mousePos.y, headRadius, time, 42);
          ctx.restore();
        }
      }

      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-[#161616] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_192942_e1086505-d7da-433b-a59b-8220f4e6c808.png"
          alt="Orbit Front Lily"
          className="max-h-[75vh] max-w-[75vw] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)] select-none"
        />
      </div>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen opacity-90"
        />
        <img
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260808_151324_bf318a5f-5525-4fc7-aab5-e9a341018828.png"
          alt="Orbit Reveal Lily"
          className="max-h-[75vh] max-w-[75vw] object-contain select-none opacity-30 mix-blend-lighten"
        />
      </div>
    </div>
  );
};

// 4. MATRIX DIGITAL STREAM WALLPAPER
const MatrixWallpaper: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    const chars = '010101アイウエオカキクケコサシスセソタチツテトAETHEROS2026';
    const fontSize = 16;
    let columns = Math.floor(window.innerWidth / fontSize);
    
    let drops: number[] = Array.from({ length: columns }, () => 
      Math.floor(Math.random() * (window.innerHeight / fontSize))
    );

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = Array.from({ length: columns }, () => 
        Math.floor(Math.random() * (canvas.height / fontSize))
      );
      ctx.fillStyle = '#051109';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    ctx.fillStyle = '#051109';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const draw = () => {
      ctx.fillStyle = 'rgba(5, 17, 9, 0.14)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `bold ${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillStyle = '#c7ffd5';
        ctx.fillText(text, x, y);

        if (drops[i] > 1) {
          ctx.fillStyle = '#00ff66';
          const prevChar = chars.charAt(Math.floor(Math.random() * chars.length));
          ctx.fillText(prevChar, x, y - fontSize);
        }

        if (y > canvas.height && Math.random() > 0.97) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      animFrame = requestAnimationFrame(draw);
    };

    animFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-[#051109]">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </div>
  );
};
