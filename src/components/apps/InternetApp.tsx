import React, { useState, useEffect } from 'react';
import { retroAudio } from '../../utils/audio';
import { useWindowStore } from '../../stores/useWindowStore';
import { ArrowLeft, ArrowRight, RotateCw, Home, Search, Globe, ExternalLink } from 'lucide-react';

interface MockSite {
  url: string;
  title: string;
  category: string;
  content: React.ReactNode;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  targetSite?: string;
}

export const InternetApp: React.FC = () => {
  const { snoogleSearchQuery, setSnoogleSearchQuery } = useWindowStore();
  const [currentUrl, setCurrentUrl] = useState<string>('home');
  const [addressBar, setAddressBar] = useState<string>('snoogle.com');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<string[]>(['home']);
  const [historyIdx, setHistoryIdx] = useState<number>(0);

  // Sync external search requests (e.g. from terminal "snoogle <query>")
  useEffect(() => {
    if (snoogleSearchQuery) {
      performSearch(snoogleSearchQuery);
      setSnoogleSearchQuery('');
    }
  }, [snoogleSearchQuery]);

  const mockSites: Record<string, MockSite> = {
    'toastcounts.org': {
      url: 'toastcounts.org',
      title: 'TOAST COUNTS - Nutritional Position Paper',
      category: 'Scientific Publication',
      content: (
        <div className="space-y-4 text-black bg-[#fffdfa] p-4 border border-black font-terminal text-[17px]">
          <div className="border-b-2 border-black pb-2">
            <h2 className="text-base font-bold text-amber-900">TOAST COUNTS: A NUTRITIONAL POSITION PAPER</h2>
            <p className="text-slate-500 text-[12px]">Published in the Journal of Retro Culinary Physics (2026)</p>
          </div>
          <p>
            <strong>Abstract:</strong> Bread subjected to radiant heating undergoes the Maillard reaction, transforming starches into aromatic compounds. We argue that toast constitutes a distinct thermodynamic state from soft bread.
          </p>
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-sm">
            <p className="font-bold text-amber-900">Key Finding:</p>
            <p className="text-amber-800 text-[12.5px]">
              When butter is applied within 8 seconds of ejection, lipid absorption increases by 340%, optimizing breakfast satisfaction coefficients.
            </p>
          </div>
          <p className="text-slate-600 italic text-[12.5px]">"Toast is bread that went to university and came back cultured."</p>
        </div>
      )
    },
    'thebackshelf.net': {
      url: 'thebackshelf.net',
      title: 'The Back Shelf - Undernet Archive',
      category: 'Software Repository',
      content: (
        <div className="space-y-3 text-black font-terminal text-[17px]">
          <div className="p-3 bg-[#f0e68c] border-2 border-black font-bold">
            WARNING: UNVERIFIED THIRD-PARTY SYSTEM UTILITIES
          </div>
          <p>Welcome to The Back Shelf. Software archived from decommissioned labs and private networks.</p>
          <div className="p-2 border border-black bg-[#fff] space-y-1">
            <div className="font-bold text-black">[PKG] RootBeer v1.4 (Root Privilege Patcher)</div>
            <p className="text-slate-600">Elevates user permissions and bypasses legacy 1990s machine safeguards.</p>
            <div className="text-emerald-700 text-[12px]">MD5: e4d909c290d0fb1ca068ffaddf22cbd0</div>
          </div>
          <div className="p-2 border border-black bg-[#fff] space-y-1">
            <div className="font-bold text-black">[SYS] MorphyDriver v2.1</div>
            <p className="text-slate-600">Canine process daemon and memory guardian driver.</p>
          </div>
        </div>
      )
    },
    'bytemart.com': {
      url: 'bytemart.com',
      title: 'BYTEMART - Electronics & Silicon',
      category: 'Marketplace',
      content: (
        <div className="space-y-3 text-black font-terminal text-[17px]">
          <div className="p-2 bg-black text-white font-bold text-center">
            BYTEMART SUPERSTORE: CLEARANCE ON VINTAGE SILICON
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 border border-slate-400 bg-white">
              <div className="font-bold">68040 Microprocessor 33MHz</div>
              <div className="text-emerald-700 font-bold">$129.99</div>
              <p className="text-slate-500 text-[12.5px]">Perfect for retro desktop sandboxes.</p>
            </div>
            <div className="p-2 border border-slate-400 bg-white">
              <div className="font-bold">16MB 72-pin SIMM RAM</div>
              <div className="text-emerald-700 font-bold">$49.95</div>
              <p className="text-slate-500 text-[12.5px]">Fast page mode, 60ns parity.</p>
            </div>
          </div>
        </div>
      )
    },
    'orbitpages.net/~ditkovich': {
      url: 'orbitpages.net/~ditkovich',
      title: 'Building Notice: Rent Due',
      category: 'Personal Web Page',
      content: (
        <div className="space-y-2 text-black bg-[#fffdd0] p-4 border border-black font-terminal text-[17px]">
          <h2 className="text-sm font-bold text-rose-800">BUILDING MANAGER NOTICE</h2>
          <p>This is Mr. Ditkovich. Rent was due yesterday.</p>
          <p>If door is broken, you fix door. Then I fix door.</p>
          <p className="italic text-slate-600">"Give me rent."</p>
        </div>
      )
    },
    'neotechlabs.com': {
      url: 'neotechlabs.com',
      title: 'NeoTech Labs - Operating Systems Research',
      category: 'Research Institute',
      content: (
        <div className="space-y-3 text-black font-terminal text-[17px]">
          <h2 className="text-sm font-bold text-black border-b border-black pb-1">
            Research Brief: Deterministic Discrete Event Microkernels
          </h2>
          <p>
            Traditional operating systems schedule processes via non-deterministic wall-clock interrupts.
            NeoTech's AetherOS architecture isolates scheduling and virtual paging into an isolated monotonic tick clock, ensuring 100% reproducible experiments.
          </p>
          <div className="p-2 bg-slate-100 border border-slate-300">
            <strong>Key Principles:</strong>
            <ul className="list-disc pl-4 space-y-0.5 mt-1 text-[12.5px]">
              <li>Dual-Core Symmetric Multiprocessing (SMP) with Work-Stealing queues.</li>
              <li>Write-Ahead Log (WAL) Crash-Consistent Inode Journaling with automated fsck replay.</li>
              <li>In-Kernel eBPF Probes on SCHED_SWITCH, PAGE_FAULT, and SYSCALL_ENTER.</li>
              <li>Dual-Mode Protection Rings (Ring 0 Kernel vs Ring 3 User Isolation).</li>
            </ul>
          </div>
        </div>
      )
    }
  };

  const bookmarks = [
    { label: 'THE BACK SHELF', url: 'thebackshelf.net' },
    { label: 'BYTEMART', url: 'bytemart.com' },
    { label: 'Building Notices', url: 'orbitpages.net/~ditkovich' },
    { label: 'NeoTech Labs', url: 'neotechlabs.com' }
  ];

  const recentSearches = [
    'what is bread then',
    'how do you get a smell out of a room permanently',
    'who is varad patil',
    'what is ebpf',
    'how to avoid deadlock in operating systems'
  ];

  const navigateTo = (url: string) => {
    retroAudio.playClickSound();
    setIsLoading(true);
    setCurrentUrl(url);
    setAddressBar(url === 'home' ? 'snoogle.com' : url);

    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push(url);
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);

    setTimeout(() => {
      setIsLoading(false);
      retroAudio.playWindowSound();
    }, 280);
  };

  const performSearch = (q: string) => {
    const cleanQ = q.trim();
    if (!cleanQ) return;
    setSearchTerm(cleanQ);
    const searchUrl = `snoogle.com/search?q=${encodeURIComponent(cleanQ)}`;
    navigateTo(searchUrl);
  };

  const handleBack = () => {
    if (historyIdx > 0) {
      retroAudio.playClickSound();
      const prev = history[historyIdx - 1];
      setHistoryIdx(historyIdx - 1);
      setCurrentUrl(prev);
      setAddressBar(prev === 'home' ? 'snoogle.com' : prev);
    }
  };

  const handleForward = () => {
    if (historyIdx < history.length - 1) {
      retroAudio.playClickSound();
      const next = history[historyIdx + 1];
      setHistoryIdx(historyIdx + 1);
      setCurrentUrl(next);
      setAddressBar(next === 'home' ? 'snoogle.com' : next);
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = addressBar.trim();
    if (clean.startsWith('snoogle.com/search?q=')) {
      const q = decodeURIComponent(clean.split('?q=')[1] || '');
      performSearch(q);
    } else if (mockSites[clean]) {
      navigateTo(clean);
    } else if (clean === 'snoogle.com' || clean === 'home' || clean === '') {
      navigateTo('home');
    } else {
      performSearch(clean);
    }
  };

  // Generate dynamic matching search results
  const getSearchResults = (query: string): SearchResult[] => {
    const q = query.toLowerCase();
    const results: SearchResult[] = [];

    if (q.includes('bread') || q.includes('toast')) {
      results.push({
        title: 'TOAST COUNTS',
        url: 'toastcounts.org',
        snippet: 'a nutritional position paper on whether warm bread counts as a separate state of matter.',
        targetSite: 'toastcounts.org'
      });
    }

    if (q.includes('varad') || q.includes('creator') || q.includes('author')) {
      results.push({
        title: 'Varad Patil - Systems & Microkernel Engineering Portfolio',
        url: 'github.com/VaradPatil5005',
        snippet: 'Creator of AetherOS: Dual-Core SMP, Crash-Consistent Journaling VFS, In-Kernel eBPF Probes, and Ring 0/Ring 3 isolation.'
      });
    }

    if (q.includes('ebpf') || q.includes('probe') || q.includes('trace')) {
      results.push({
        title: 'eBPF in Modern OS: In-Kernel Hookpoints without Recompilation',
        url: 'neotechlabs.com',
        snippet: 'Tracing SCHED_SWITCH, PAGE_FAULT, and SYSCALL_ENTER via in-kernel hash maps and dynamic BPF byte-filtering.',
        targetSite: 'neotechlabs.com'
      });
    }

    if (q.includes('deadlock') || q.includes('banker') || q.includes('mutex')) {
      results.push({
        title: "Dijkstra Banker's Algorithm: Real-Time Resource Safety Detection",
        url: 'neotechlabs.com',
        snippet: 'Detecting resource allocation deadlocks and discovering safe vector paths across multi-instance lock matrices.',
        targetSite: 'neotechlabs.com'
      });
    }

    if (q.includes('smell') || q.includes('room') || q.includes('odor')) {
      results.push({
        title: 'Permanent Odor Elimination in Vintage Server Enclosures',
        url: 'cleanbytes.net/air-filtration',
        snippet: 'Airflow optimization and activated carbon techniques for 1990s vintage computer laboratories.'
      });
    }

    // Default fallback result so every search returns something cool
    if (results.length === 0) {
      results.push({
        title: `AetherNet Archive: Comprehensive Index on "${query}"`,
        url: `undernet.aether/query?q=${encodeURIComponent(query)}`,
        snippet: `Archived technical documentation, forum threads, and systems engineering papers relating to "${query}".`
      });
      results.push({
        title: 'NeoTech Labs Systems Documentation',
        url: 'neotechlabs.com',
        snippet: 'Technical specifications for AetherOS discrete event simulation, memory segmentation, and scheduler runqueues.',
        targetSite: 'neotechlabs.com'
      });
    }

    return results;
  };

  const isSearchResult = currentUrl.startsWith('snoogle.com/search?q=');
  const activeQuery = isSearchResult ? decodeURIComponent(currentUrl.split('?q=')[1] || searchTerm) : searchTerm;

  return (
    <div className="h-full w-full text-black flex flex-col font-pixel select-none overflow-hidden text-xs min-h-0 min-w-0 bg-white">
      {/* Browser Navigation Toolbar */}
      <div className="p-2 border-b-2 flex items-center gap-2 bg-[var(--rt-soft)] border-black">
        <button
          onClick={handleBack}
          disabled={historyIdx === 0}
          title="Back"
          className="p-1 disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--rt-panel)] rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleForward}
          disabled={historyIdx >= history.length - 1}
          title="Forward"
          className="p-1 disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--rt-panel)] rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => navigateTo(currentUrl)}
          title="Reload"
          className="p-1 bg-[var(--rt-panel)] rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => navigateTo('home')}
          title="Home (Snoogle)"
          className="p-1 bg-[var(--rt-panel)] rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <Home className="w-3.5 h-3.5" />
        </button>

        {/* Address Field Bar */}
        <form onSubmit={handleAddressSubmit} className="flex-1 flex items-center gap-1">
          <div className="flex-1 flex items-center bg-white px-2 py-0.5 rt-sunken-sm">
            <Globe className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <input
              type="text"
              value={addressBar}
              onChange={(e) => setAddressBar(e.target.value)}
              className="w-full bg-transparent text-black outline-none font-terminal text-[17px]"
              placeholder="Enter site address or search..."
            />
          </div>
          <button
            type="submit"
            className="px-3 py-0.5 font-bold bg-[var(--rt-panel)] rt-raised-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            Go
          </button>
        </form>
      </div>

      {/* Main Browser Viewport */}
      <div className="flex-1 min-h-0 overflow-auto bg-white p-4 relative">
        {isLoading ? (
          /* Retro Fetching Page Loader */
          <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-64 p-4 bg-[var(--rt-soft)] rt-raised">
              <div className="font-bold text-xs mb-2">Fetching Page...</div>
              <div className="w-full h-3 bg-white border border-black p-0.5 overflow-hidden">
                <div className="h-full bg-black animate-pulse w-full" />
              </div>
              <div className="text-slate-600 mt-2 text-[12px]">Connecting to host node...</div>
            </div>
          </div>
        ) : currentUrl === 'home' ? (
          /* Snoogle Search Home Page (Exact AetherOS Replica Matching Frame 25s) */
          <div className="min-h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-2">
            {/* Snoogle Pixel Title / Logo */}
            <div className="mb-2">
              <img 
                src="/assets/icons/snoogle.webp" 
                alt="Snoogle" 
                className="h-16 object-contain drop-shadow-sm inline-block" 
                onError={(e) => {
                  // Fallback to high-fidelity pixel typography if image asset is missing
                  e.currentTarget.style.display = 'none';
                  const fallback = document.getElementById('snoogle-text-logo');
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              <div id="snoogle-text-logo" className="hidden font-silkscreen text-3xl font-extrabold tracking-wider">
                <span className="text-[#4285F4]">S</span>
                <span className="text-[#EA4335]">n</span>
                <span className="text-[#FBBC05]">o</span>
                <span className="text-[#4285F4]">o</span>
                <span className="text-[#34A853]">g</span>
                <span className="text-[#EA4335]">l</span>
                <span className="text-[#4285F4]">e</span>
              </div>
            </div>

            <p className="text-slate-600 font-pixel mb-5 italic text-[12.5px]">
              Coz it knows everything you snoop for!
            </p>

            {/* Interactive Search Input Form */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                performSearch(searchTerm);
              }} 
              className="w-full mb-6 flex gap-1.5"
            >
              <div className="flex-1 flex items-center bg-white px-3 py-1 rt-sunken">
                <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Click a bookmark or recent search..."
                  className="w-full outline-none text-black bg-transparent font-terminal text-[17px]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-1 font-bold text-xs bg-[var(--rt-panel)] rt-raised"
              >
                Go
              </button>
            </form>

            {/* Bookmarks Carousel Strip (Matching Video) */}
            <div className="w-full mb-5">
              <div className="font-bold text-black uppercase tracking-wider mb-2 text-center border-b border-black pb-1 text-[12.5px]">
                BOOKMARKS
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {bookmarks.map((bm) => (
                  <button
                    key={bm.url}
                    onClick={() => navigateTo(bm.url)}
                    className="underline text-black hover:text-black font-pixel text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>{bm.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Searches (Matching Video Frame 25s) */}
            <div className="w-full mb-4 text-left">
              <div className="font-bold text-black uppercase tracking-wider mb-2 text-center border-b border-black pb-1 text-[12.5px]">
                RECENT
              </div>
              <div className="space-y-1 mt-2">
                {recentSearches.map((rs, i) => (
                  <button
                    key={i}
                    onClick={() => performSearch(rs)}
                    className="w-full text-left text-slate-700 hover:text-black hover:bg-slate-100 px-2 py-0.5 rounded cursor-pointer block truncate font-terminal text-[17px]"
                  >
                    {rs}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-slate-500 mt-auto font-terminal text-[14px]">
              Snoogle has indexed 52 pages across AetherNet.
            </p>
          </div>
        ) : isSearchResult ? (
          /* Snoogle Search Results Page (Exact AetherOS Replica Matching Frame 65s) */
          <div className="max-w-xl mx-auto py-2 text-left font-pixel">
            <div className="text-center font-bold tracking-widest text-sm mb-2 uppercase border-b border-black pb-1">
              SNOOGLE
            </div>

            <div className="mb-2">
              <div className="text-xs font-bold text-black">
                Snoogle results for: <span className="underline">{activeQuery}</span>
              </div>
              <div className="text-slate-500 mt-0.5 font-terminal text-[15px]">
                About {getSearchResults(activeQuery).length} results. (0.43 seconds)
              </div>
            </div>

            <div className="border-b border-black mb-4" />

            {/* Results List */}
            <div className="space-y-5">
              {getSearchResults(activeQuery).map((res, i) => (
                <div key={i} className="space-y-0.5">
                  <button
                    onClick={() => {
                      if (res.targetSite) {
                        navigateTo(res.targetSite);
                      }
                    }}
                    className={`text-sm font-bold text-black hover:underline block text-left ${res.targetSite ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {res.title}
                  </button>
                  <div className="text-emerald-800 font-terminal text-[15px]">
                    {res.url}
                  </div>
                  <p className="text-slate-800 leading-relaxed font-terminal text-[17px]">
                    {res.snippet}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : mockSites[currentUrl] ? (
          /* Site Page View */
          <div className="max-w-xl mx-auto py-2 text-left">
            <div className="border-b-2 border-black pb-2 mb-3 flex items-baseline justify-between">
              <h1 className="text-base font-bold text-black font-silkscreen">{mockSites[currentUrl].title}</h1>
              <span className="text-slate-500 font-terminal text-[14px]">{mockSites[currentUrl].category}</span>
            </div>
            {mockSites[currentUrl].content}
          </div>
        ) : (
          /* 404 Node Not Found View */
          <div className="min-h-full flex flex-col items-center justify-center text-center p-6">
            <div className="p-4 bg-rose-50 border-2 border-rose-500 max-w-md">
              <div className="font-bold text-rose-800 text-sm mb-1">HTTP 404: Node Not Reachable</div>
              <p className="text-slate-700 mb-3 font-terminal text-[17px]">
                The node '{currentUrl}' could not be reached through the local mesh router.
              </p>
              <button
                onClick={() => navigateTo('home')}
                className="px-3 py-1 border border-black font-bold text-xs bg-[var(--rt-panel)]"
              >
                Return to Snoogle
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
