import React, { useEffect, useState } from 'react';

export interface ResearchItem {
  id: string;
  group: string;
  title: string;
  kind: 'report' | 'trace';
  file: string;
  note: string;
}

/** Index of the measured results shipped in public/research/ (written by bench/publish_demo.py). */
export async function fetchResearchIndex(): Promise<ResearchItem[]> {
  const r = await fetch('/research/index.json');
  if (!r.ok) throw new Error('research index missing');
  const data = await r.json();
  if (!data || !Array.isArray(data.items)) throw new Error('invalid research index');
  return (data.items as ResearchItem[]).filter((i) =>
    typeof i.file === 'string' && i.file.startsWith('/research/') && (i.kind === 'report' || i.kind === 'trace'));
}

/** One-click list of the saved results, grouped the way the research is told. */
export const ResearchLibrary: React.FC<{
  active: string;
  onReport: (item: ResearchItem) => void;
  onTrace: (item: ResearchItem) => void;
}> = ({ active, onReport, onTrace }) => {
  const [items, setItems] = useState<ResearchItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchResearchIndex().then((i) => { if (!cancelled) setItems(i); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  if (failed) return <p className="text-[14px]">Saved results are not included in this build. Use “Open your own file” below.</p>;
  if (!items) return <p className="text-[14px]">Loading saved results…</p>;

  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <div className="space-y-2" aria-label="Saved research results">
      {groups.map((group, g) => (
        <details key={group} open={g < 2} className="rt-sunken bg-white">
          <summary className="cursor-pointer px-2 py-1 font-pixel font-bold text-[12px] bg-[var(--rt-side)] border-b-2 border-black">{group}</summary>
          <ul>
            {items.filter((i) => i.group === group).map((item) => {
              const isActive = active === item.title;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => (item.kind === 'trace' ? onTrace(item) : onReport(item))}
                    className={`w-full text-left px-2 py-1 flex items-baseline justify-between gap-3 border-b border-black/15 rt-row ${isActive ? 'is-active' : ''}`}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <span>{item.kind === 'trace' ? '▶ ' : ''}{item.title}</span>
                    <span className="text-[14px] opacity-75 shrink-0">{item.note}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  );
};
