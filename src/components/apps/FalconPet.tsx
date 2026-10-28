import React, { useEffect, useRef, useState } from 'react';
import { retroAudio } from '../../utils/audio';
import { useWindowStore, AppId } from '../../stores/useWindowStore';
import { useSpillStore } from '../../stores/useSpillStore';

interface Tip {
  text: string;
  /** Optional app the bubble offers to open. */
  open?: { app: AppId; label: string };
}

const SPILLGUARD_TIPS: Tip[] = [
  { text: 'SpillGuard watches your real GPU: VRAM, shared memory and RAM for every app, live.', open: { app: 'spillguard', label: 'Open SpillGuard' } },
  { text: 'When VRAM runs out, Windows quietly moves GPU memory into system RAM. On an RTX 3050 that memory was 12× slower.', open: { app: 'spillguard', label: 'See it happen' } },
  { text: 'No NVIDIA GPU here? SpillGuard → Replay → Demo trace plays a real spill from an RTX 3050 laptop.', open: { app: 'spillguard', label: 'Open SpillGuard' } },
  { text: 'The app that spills is often a victim. SpillGuard names the culprit that grabbed VRAM first.' },
  { text: 'Type "spillguard status" in the terminal to see which apps hold your VRAM.', open: { app: 'terminal', label: 'Open Terminal' } },
  { text: 'Before launching a local AI model, "spillguard fit <model> 8192" tells you if it fits in VRAM.', open: { app: 'terminal', label: 'Open Terminal' } },
  { text: 'Memory Map has a twin view: the simulated page frames next to your GPU\'s real VRAM.', open: { app: 'memory_map', label: 'Open Memory Map' } },
  { text: 'Deadlock Lab can run Banker\'s algorithm on your real VRAM. Slide the claim and watch the verdict.', open: { app: 'deadlock_lab', label: 'Open Deadlock Lab' } },
  { text: 'Ollama reports how much of a model is on the GPU, but missed the real footprint by about 900 MB. SpillGuard measures it.' },
  { text: 'KernelQuest has two GPU puzzles: find the spill culprit, and size a model to fit.', open: { app: 'kernel_quest', label: 'Open KernelQuest' } },
];

const KERNEL_TIPS: Tip[] = [
  { text: 'Kreeee! I am Zephyr, your peregrine falcon. Click me any time for a tip.' },
  { text: 'Typing "matrix" in the terminal starts the digital rain.', open: { app: 'terminal', label: 'Open Terminal' } },
  { text: 'Secret: enter 1976 into the Calculator.', open: { app: 'calculator', label: 'Open Calculator' } },
  { text: 'Try a power cut in Finder, then run fsck to replay the write-ahead log.', open: { app: 'file_explorer', label: 'Open Finder' } },
  { text: 'eBPF Studio attaches probes to the simulated kernel and streams real GPU events too.', open: { app: 'bpf_studio', label: 'Open eBPF Studio' } },
];

// Alternate SpillGuard and kernel tips so the new feature is introduced early but not exclusively.
const TIPS: Tip[] = SPILLGUARD_TIPS.flatMap((t, i) => (KERNEL_TIPS[i] ? [t, KERNEL_TIPS[i]] : [t]));

const IDLE_TIP_MS = 25000;

export const FalconPet: React.FC = () => {
  const open = useWindowStore((s) => s.open);
  const events = useSpillStore((s) => s.events);
  const [isAtRoost, setIsAtRoost] = useState(true);
  const [tip, setTip] = useState<Tip | null>(null);
  const [alert, setAlert] = useState(false);
  const [isDiving, setIsDiving] = useState(false);
  const [idx, setIdx] = useState(-1);
  const lastAlertT = useRef(0);

  const say = (t: Tip, isAlert = false) => {
    setTip(t);
    setAlert(isAlert);
  };

  const nextTip = () => {
    retroAudio.playFalconCry();
    const n = (idx + 1) % TIPS.length;
    setIdx(n);
    say(TIPS[n]);
  };

  // One gentle tip after the user has been on the desktop for a while (like Retrium's dock prompts).
  useEffect(() => {
    const t = setTimeout(() => setTip((cur) => cur ?? TIPS[0]), IDLE_TIP_MS);
    return () => clearTimeout(t);
  }, []);

  // A real (Live) or replayed spill makes the falcon speak up, roosting or not.
  useEffect(() => {
    const start = [...events].reverse().find((e) => e.type === 'SPILL_START');
    if (!start || start.t <= lastAlertT.current) return;
    lastAlertT.current = start.t;
    retroAudio.playFalconCry();
    say(
      {
        text: `${start.name} is spilling ${start.spill_mb} MB of GPU memory into system RAM${start.culprit && !start.culprit.self_inflicted ? `. Culprit: ${start.culprit.name}` : ''}.`,
        open: { app: 'spillguard', label: 'Open SpillGuard' },
      },
      true,
    );
  }, [events]);

  // Tips close themselves; alerts stay until dismissed.
  useEffect(() => {
    if (!tip || alert) return;
    const t = setTimeout(() => setTip(null), 12000);
    return () => clearTimeout(t);
  }, [tip, alert]);

  const act = (e: React.MouseEvent, fn: () => void) => {
    e.stopPropagation();
    fn();
  };

  // Out of the way while a window is maximized (same as the dock).
  const anyMaximized = useWindowStore((st) => Object.values(st.windows).some((w) => w.isOpen && !w.isMinimized && w.isMaximized));
  if (anyMaximized) return null;

  return (
    <div className="fixed bottom-16 right-8 z-30 select-none font-pixel flex flex-col items-end">
      {tip && (
        <div
          className={`rt-note relative mb-4 mr-6 w-72 px-3 py-2 text-[19px] leading-[1.15] ${alert ? '!bg-[#ffe3e1]' : ''}`}
          role={alert ? 'alert' : 'status'}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-pixel text-[11px] uppercase tracking-wide">{alert ? 'Spill alert' : 'Zephyr says'}</span>
            <button className="rt-ctrl rt-ctrl-close !w-4 !h-4 !text-[13px]" onClick={() => setTip(null)} aria-label="Dismiss">x</button>
          </div>
          <p className="mt-0.5">{tip.text}</p>
          {tip.open && (
            <button
              className="rt-btn rt-btn-sm mt-2"
              onClick={() => { retroAudio.playClickSound(); open(tip.open!.app); setTip(null); }}
            >
              {tip.open.label}
            </button>
          )}
          {/* Tail: a rotated square with two borders, Retrium's bubble idiom */}
          <span className="absolute -bottom-[13px] right-10 w-[18px] h-[18px] rotate-45 border-r-[3px] border-b-[3px] border-black" style={{ background: alert ? '#ffe3e1' : 'var(--rt-note)' }} />
        </div>
      )}

      {isAtRoost ? (
        <button
          onClick={() => { setIsAtRoost(false); nextTip(); }}
          className="flex flex-col items-center group"
          title="Click to summon Zephyr for a tip"
        >
          <span className="relative group-hover:-translate-y-1 transition-transform">
            <img src="/assets/icons/falcon_roost.png" alt="Zephyr's roost" className="w-20 h-20 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.6)]" />
            {(tip || events.some((e) => e.type === 'SPILL_START')) && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-black bg-[var(--rt-max)] animate-pulse" />
            )}
          </span>
          <span className="rt-note !text-[15px] px-2 py-0 leading-tight mt-1 !shadow-[3px_3px_0_rgba(0,0,0,0.9)]">Zephyr's roost</span>
        </button>
      ) : (
        <div className="flex flex-col items-center">
          <button onClick={nextTip} className={`group transition-transform duration-300 ${isDiving ? 'translate-y-2 scale-110' : ''}`} title="Click for another tip">
            <img
              src="/assets/icons/peregrine_falcon.png"
              alt="Zephyr the peregrine falcon"
              className={`w-28 h-36 object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.7)] group-hover:-translate-y-1 transition-transform ${isDiving ? 'animate-bounce' : ''}`}
            />
          </button>
          <div className="flex gap-1.5 mt-1">
            <button className="rt-btn rt-btn-sm" onClick={(e) => act(e, nextTip)}>Tip</button>
            <button
              className="rt-btn rt-btn-sm"
              onClick={(e) => act(e, () => {
                retroAudio.playFalconCry();
                setIsDiving(true);
                say({ text: 'Diving at 389 km/h! The fastest animal on Earth, and the fastest scheduler dispatch in AetherOS.' });
                setTimeout(() => setIsDiving(false), 1800);
              })}
            >
              Dive
            </button>
            <button
              className="rt-btn rt-btn-sm"
              onClick={(e) => act(e, () => { retroAudio.playClickSound(); setIsAtRoost(true); setTip(null); setIsDiving(false); })}
            >
              Roost
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Re-export as MorphyPet for backward-compatibility
export const MorphyPet = FalconPet;
