import React, { useState, useRef, useEffect } from 'react';
import { useKernelStore } from '../../stores/useKernelStore';
import { useWindowStore, AppId } from '../../stores/useWindowStore';
import { retroAudio } from '../../utils/audio';
import { runSpillguardCommand } from '../../spillguard/terminal';

export const TerminalApp: React.FC = () => {
  const { executeTerminalCommand, currentVfsPath, stats } = useKernelStore();
  const { setWallpaper, open, close, activeUser, triggerTrashSpeech, setSnoogleSearchQuery } = useWindowStore();
  const [input, setInput] = useState('');
  const [matrixActive, setMatrixActive] = useState<boolean>(false);
  const [startTime] = useState<number>(Date.now());
  const [history, setHistory] = useState<{ cmd: string; output: string | React.ReactNode }[]>([
    {
      cmd: '',
      output: [
        'Welcome to aethersh v2.4 (AetherOS Microkernel)',
        'Type "help" for desktop & kernel commands, "neofetch" for system info.',
        'Try: "open music", "theme classic", "ps", "memstat", "matrix".'
      ].join('\n')
    }
  ]);

  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [history]);

  // Matrix Rain Canvas Animation
  useEffect(() => {
    if (!matrixActive || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 600;
    canvas.height = canvas.parentElement?.clientHeight || 350;

    const chars = '0123456789ABCDEF01010101AETHEROS2026';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array(columns).fill(1);

    const interval = setInterval(() => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00ff66';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }, 45);

    return () => clearInterval(interval);
  }, [matrixActive]);

  const formatHelpOutput = () => {
    return (
      <div className="space-y-3 select-text">
        <div className="grid grid-cols-[100px_1fr] gap-y-1">
          <span className="text-[#5af78e] font-bold">pwd</span>
          <span className="text-slate-300">Print the current absolute path</span>
          <span className="text-[#5af78e] font-bold">cat</span>
          <span className="text-slate-300">Read a text file</span>
          <span className="text-[#5af78e] font-bold">ls</span>
          <span className="text-slate-300">List directory contents</span>
        </div>

        <div>
          <div className="text-[#ff79c6] font-bold tracking-wider uppercase mb-1">DESKTOP</div>
          <div className="grid grid-cols-[100px_1fr] gap-y-1">
            <span className="text-[#5af78e] font-bold">open</span>
            <span className="text-slate-300">Open an app, file, folder, link, or web search</span>
            <span className="text-[#5af78e] font-bold">close</span>
            <span className="text-slate-300">Close an open AetherOS window or popup</span>
            <span className="text-[#5af78e] font-bold">finder</span>
            <span className="text-slate-300">Open Finder at an AetherOS location</span>
            <span className="text-[#5af78e] font-bold">messages</span>
            <span className="text-slate-300">Count conversations, list them, or open one</span>
            <span className="text-[#5af78e] font-bold">theme</span>
            <span className="text-slate-300">Change the desktop wallpaper</span>
          </div>
        </div>

        <div>
          <div className="text-[#ff79c6] font-bold tracking-wider uppercase mb-1">SYSTEM</div>
          <div className="grid grid-cols-[100px_1fr] gap-y-1">
            <span className="text-[#5af78e] font-bold">whoami</span>
            <span className="text-slate-300">Show the active AetherOS user</span>
            <span className="text-[#5af78e] font-bold">date</span>
            <span className="text-slate-300">Show the current local date and time</span>
            <span className="text-[#5af78e] font-bold">uname</span>
            <span className="text-slate-300">Show OS information</span>
            <span className="text-[#5af78e] font-bold">uptime</span>
            <span className="text-slate-300">Show how long this session has been running</span>
            <span className="text-[#5af78e] font-bold">neofetch</span>
            <span className="text-slate-300">Display AetherOS system information</span>
            <span className="text-[#5af78e] font-bold">ps</span>
            <span className="text-slate-300">Show active processes & CPU states</span>
            <span className="text-[#5af78e] font-bold">memstat</span>
            <span className="text-slate-300">Show RAM allocation & paging faults</span>
            <span className="text-[#5af78e] font-bold">matrix</span>
            <span className="text-slate-300">Toggle digital matrix stream</span>
            <span className="text-[#5af78e] font-bold">spillguard</span>
            <span className="text-slate-300">Real GPU memory spill: status, why, events, fit, demo</span>
          </div>
        </div>
      </div>
    );
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    retroAudio.playClickSound();

    if (/^(spillguard|sg)(\s|$)/i.test(cmd)) {
      const args = cmd.split(/\s+/).slice(1);
      setInput('');
      setHistory((prev) => [...prev, { cmd, output: '…' }]);
      runSpillguardCommand(args).then((output) =>
        setHistory((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].cmd === cmd && next[i].output === '…') { next[i] = { cmd, output }; break; }
          }
          return next;
        })
      );
      return;
    }

    if (cmd === 'clear' || cmd === 'cls') {
      setHistory([]);
      setInput('');
      return;
    }

    if (cmd === 'help') {
      setHistory((prev) => [...prev, { cmd, output: formatHelpOutput() }]);
      setInput('');
      return;
    }

    if (cmd.startsWith('open ')) {
      const target = cmd.slice(5).trim().toLowerCase();
      const appMap: Record<string, AppId> = {
        'music': 'music',
        'internet': 'internet',
        'browser': 'internet',
        'terminal': 'terminal',
        'messages': 'messages',
        'calculator': 'calculator',
        'finder': 'file_explorer',
        'files': 'file_explorer',
        'community': 'community',
        'trash': 'trash',
        'settings': 'settings',
        'tasks': 'task_manager',
        'about': 'about',
        'readme': 'about',
        'memory': 'memory_map',
        'memmap': 'memory_map',
        'deadlock': 'deadlock_lab',
        'bpf': 'bpf_studio',
        'quest': 'kernel_quest',
        'monitor': 'kernel_monitor',
        'spillguard': 'spillguard'
      };

      if (appMap[target]) {
        open(appMap[target]);
        setHistory((prev) => [...prev, { cmd, output: `[OK] Launched ${target}` }]);
      } else {
        setHistory((prev) => [...prev, { cmd, output: `Unknown app: '${target}'. Try: music, internet, community, trash, finder, messages, calculator` }]);
      }
      setInput('');
      return;
    }

    if (cmd.startsWith('close ')) {
      const target = cmd.slice(6).trim().toLowerCase();
      const appMap: Record<string, AppId> = {
        'music': 'music',
        'internet': 'internet',
        'terminal': 'terminal',
        'messages': 'messages',
        'calculator': 'calculator',
        'finder': 'file_explorer',
        'community': 'community',
        'trash': 'trash'
      };

      if (appMap[target]) {
        close(appMap[target]);
        setHistory((prev) => [...prev, { cmd, output: `[OK] Closed ${target}` }]);
      } else {
        setHistory((prev) => [...prev, { cmd, output: `Window '${target}' not open or unrecognized.` }]);
      }
      setInput('');
      return;
    }

    if (cmd === 'finder') {
      open('file_explorer');
      setHistory((prev) => [...prev, { cmd, output: '[OK] Opened Finder at ~/' }]);
      setInput('');
      return;
    }

    if (cmd === 'messages') {
      open('messages');
      setHistory((prev) => [...prev, { cmd, output: '[OK] Opened Messages (1 active conversation with Bob)' }]);
      setInput('');
      return;
    }

    if (cmd === 'matrix' || cmd === 'matrix start') {
      setMatrixActive(true);
      setHistory((prev) => [...prev, { cmd, output: 'Matrix stream initiated. Type "matrix stop" to exit.' }]);
      setInput('');
      return;
    }

    if (cmd === 'matrix stop') {
      setMatrixActive(false);
      setHistory((prev) => [...prev, { cmd, output: 'Matrix stream terminated.' }]);
      setInput('');
      return;
    }

    if (cmd.startsWith('theme ')) {
      const themeName = cmd.split(' ')[1];
      if (['classic', 'matrix', 'indigo', 'lavender', 'mainframe'].includes(themeName)) {
        setWallpaper(themeName);
        setHistory((prev) => [...prev, { cmd, output: `Desktop wallpaper changed to: ${themeName}` }]);
      } else {
        setHistory((prev) => [...prev, { cmd, output: 'Available themes: mainframe, lavender, matrix, indigo, classic' }]);
      }
      setInput('');
      return;
    }

    if (cmd === 'whoami') {
      setHistory((prev) => [...prev, { 
        cmd, 
        output: `${activeUser.toLowerCase().replace(/\\s+/g, '_')}@aetheros\nRole: Superuser\nStatus: Online (Handmade Computer Lab)` 
      }]);
      setInput('');
      return;
    }

    if (cmd === 'date') {
      setHistory((prev) => [...prev, { cmd, output: new Date().toString() }]);
      setInput('');
      return;
    }

    if (cmd === 'uname' || cmd === 'uname -a') {
      setHistory((prev) => [...prev, { cmd, output: 'AetherOS 7.0-x86_64 Deterministic Microkernel #1 SMP PREEMPT' }]);
      setInput('');
      return;
    }

    if (cmd === 'uptime') {
      const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;
      setHistory((prev) => [...prev, { 
        cmd, 
        output: `up ${mins} min ${secs} sec, 1 user, tick #${stats.tick}, load avg: 0.18, 0.12, 0.07` 
      }]);
      setInput('');
      return;
    }

    if (cmd === 'neofetch' || cmd === 'fetch') {
      const neofetchArt = [
        `        .:*#*.        ${activeUser.toLowerCase().replace(/\\s+/g, '_')}@aetheros-system7`,
        '       .+====+.       ---------------------',
        '      .+#++++#+.      OS: AetherOS System 7 (aethersh v2.4)',
        '     .+##++++##+.     Host: AetherOS Dual-Core SMP Engine',
        '    .###++++++###.    Kernel: Deterministic Tick Engine',
        `   .####++++++####.   User: ${activeUser}`,
        '  .#####++++++#####.  Memory: 32 Frames (128 KB Physical)',
        ' .######++++++######. Schedulers: MLFQ, RR, SRTF, FCFS',
        '                      VFS: Hierarchical Inode Storage'
      ].join('\n');

      setHistory((prev) => [...prev, { cmd, output: neofetchArt }]);
      setInput('');
      return;
    }

    // Default to Kernel VFS / Process Command Engine
    const output = executeTerminalCommand(cmd);
    setHistory((prev) => [...prev, { cmd, output }]);
    setInput('');
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#222] p-3 font-terminal text-[18px] leading-tight text-[#5af78e] select-text overflow-hidden relative min-h-0 min-w-0">
      {/* Matrix Canvas Overlay */}
      {matrixActive && (
        <div className="absolute inset-0 z-20 bg-black/90 pointer-events-none">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
      )}

      {/* Terminal History */}
      <div ref={terminalScrollRef} className="flex-1 min-h-0 overflow-y-auto rt-dark-scroll space-y-2 pr-1 relative z-10 overscroll-contain">
        {history.map((h, i) => (
          <div key={i} className="space-y-1">
            {h.cmd && (
              <div className="flex items-center gap-1 text-slate-300">
                <span className="text-indigo-400 font-bold">{activeUser.toLowerCase().replace(/\s+/g, '_')}@aether:{currentVfsPath}$</span>
                <span className="font-semibold text-white">{h.cmd}</span>
              </div>
            )}
            {typeof h.output === 'string' ? (
              <pre className="text-[#e0e0e0] whitespace-pre-wrap font-terminal leading-tight">{h.output}</pre>
            ) : (
              h.output
            )}
          </div>
        ))}
        
      </div>

      {/* Terminal Input Bar */}
      <form onSubmit={handleCommand} className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/15 relative z-30 shrink-0">
        <span className="text-[#c792ea] whitespace-nowrap">{activeUser.toLowerCase().replace(/\s+/g, '_')}@aether:{currentVfsPath}$</span>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          className="rt-bare flex-1 min-w-0 bg-transparent text-white outline-none font-terminal text-[18px]"
          placeholder="type command (e.g. help, open music, ps, matrix)..."
          autoFocus
        />
      </form>
    </div>
  );
};
