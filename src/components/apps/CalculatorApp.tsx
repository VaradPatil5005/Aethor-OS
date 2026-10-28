import React, { useState } from 'react';
import { retroAudio } from '../../utils/audio';

export const CalculatorApp: React.FC = () => {
  const [display, setDisplay] = useState<string>('0');
  const [secretUnlocked, setSecretUnlocked] = useState<boolean>(false);

  const handleInput = (val: string) => {
    retroAudio.playClickSound();
    setDisplay((prev) => (prev === '0' ? val : prev + val));
  };

  const handleClear = () => {
    retroAudio.playClickSound();
    setDisplay('0');
    setSecretUnlocked(false);
  };

  const handleCalculate = () => {
    retroAudio.playClickSound();
    // Check for AetherOS Secret Backdoor code: 25%1976
    if (display.includes('25%1976') || display === '25%1976') {
      retroAudio.playBootChime();
      setSecretUnlocked(true);
      setDisplay('ADMIN: ACCESS GRANTED');
      return;
    }

    try {
      let expression = display
        .replace(/\^/g, '**')
        .replace(/√(\d+(\.\d+)?)/g, 'Math.sqrt($1)');
      
      // Basic math evaluation safely
      // eslint-disable-next-line no-new-func
      const result = Function(`'use strict'; return (${expression})`)();
      setDisplay(String(Number(result.toFixed(6))));
    } catch (e) {
      retroAudio.playErrorSound();
      setDisplay('Error');
    }
  };

  const buttons = [
    '^', '√', '%', '/',
    '7', '8', '9', '*',
    '4', '5', '6', '-',
    '1', '2', '3', '+',
    'AC', '0', '.', '='
  ];

  return (
    <div className="h-full w-full text-black flex flex-col p-3 select-none font-pixel min-h-0 min-w-0 overflow-hidden bg-white">
      {/* Display Screen */}
      <div className="mb-3 bg-white p-2 text-right rt-sunken">
        <div className="font-terminal text-2xl font-bold tracking-wider text-black truncate">
          {display}
        </div>
      </div>

      {secretUnlocked && (
        <div className="mb-2 p-1.5 bg-emerald-100 border border-emerald-700 text-emerald-900 rounded animate-pulse text-[12.5px]">
          <strong>★ SECRET BACKDOOR UNLOCKED (1976) ★</strong>
          <p>Father's Master Safeguard active. Memory and admin keys restored.</p>
        </div>
      )}

      {/* Calculator Keypad */}
      <div className="grid grid-cols-4 gap-1.5 flex-1">
        {buttons.map((btn) => (
          <button
            key={btn}
            onClick={() => {
              if (btn === 'AC') handleClear();
              else if (btn === '=') handleCalculate();
              else handleInput(btn);
            }}
            className={`py-2 text-sm font-bold border-2 rounded-sm active:translate-y-0.5 shadow-sm ${
              btn === '=' 
                ? 'bg-black text-white border-t-indigo-400 border-l-indigo-400 border-r-black border-b-black hover:bg-[#333]'
                : btn === 'AC'
                ? 'bg-rose-600 text-white border-t-rose-400 border-l-rose-400 border-r-black border-b-black hover:bg-rose-700'
                : 'text-black hover:bg-white bg-[var(--rt-panel)] rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
            }`}
          >
            {btn}
          </button>
        ))}
      </div>

      <div className="mt-2 text-slate-600 text-center text-[12px]">
        AetherOS Calculator Standard Edition
      </div>
    </div>
  );
};
