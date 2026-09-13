import { create } from 'zustand';

export type AppId = 
  | 'internet'
  | 'task_manager' 
  | 'memory_map' 
  | 'deadlock_lab' 
  | 'terminal' 
  | 'file_explorer' 
  | 'kernel_quest' 
  | 'kernel_monitor' 
  | 'about'
  | 'music'
  | 'calculator'
  | 'messages'
  | 'test_runner'
  | 'settings'
  | 'community'
  | 'trash'
  | 'bpf_studio';

export interface WindowState {
  id: AppId;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

interface WindowStore {
  windows: Record<AppId, WindowState>;
  activeId: AppId | null;
  highestZ: number;
  crtScanlines: boolean;
  crtGrain: boolean;
  wallpaper: string;
  activeUser: string;
  welcomeModalOpen: boolean;
  dialogueMessage: string | null;
  showDialogue: boolean;
  trashSpeech: string | null;
  showTrashSpeech: boolean;
  triggerTrashSpeech: (text: string, durationMs?: number) => void;
  closeTrashSpeech: () => void;
  unreadMessagesCount: number;
  decrementUnreadMessages: () => void;
  snoogleSearchQuery: string;
  setSnoogleSearchQuery: (q: string) => void;

  setActiveUser: (name: string) => void;
  setWelcomeModalOpen: (open: boolean) => void;
  triggerDialogue: (text: string) => void;
  closeDialogue: () => void;
  toggleScanlines: () => void;
  toggleGrain: () => void;
  setWallpaper: (wp: string) => void;
  open: (id: AppId) => void;
  close: (id: AppId) => void;
  minimize: (id: AppId) => void;
  maximize: (id: AppId) => void;
  focus: (id: AppId) => void;
  updateBounds: (id: AppId, x: number, y: number, width: number, height: number) => void;
  resetLayout: () => void;
}

export const useWindowStore = create<WindowStore>((set, get) => ({
  highestZ: 10,
  activeId: 'terminal',
  crtScanlines: false,
  crtGrain: false,
  wallpaper: 'mainframe',
  activeUser: 'Varad Patil',
  welcomeModalOpen: true,
  dialogueMessage: null,
  showDialogue: false,
  trashSpeech: null,
  showTrashSpeech: false,
  unreadMessagesCount: 4,
  snoogleSearchQuery: '',

  triggerTrashSpeech: (text: string, durationMs: number = 3500) => {
    set({ trashSpeech: text, showTrashSpeech: true });
    setTimeout(() => {
      if (get().trashSpeech === text) {
        set({ showTrashSpeech: false, trashSpeech: null });
      }
    }, durationMs);
  },
  closeTrashSpeech: () => set({ showTrashSpeech: false, trashSpeech: null }),
  decrementUnreadMessages: () => set((s) => ({ unreadMessagesCount: Math.max(0, s.unreadMessagesCount - 1) })),
  setSnoogleSearchQuery: (q: string) => set({ snoogleSearchQuery: q }),


  setActiveUser: (name: string) => set({ activeUser: name || 'Varad Patil' }),
  setWelcomeModalOpen: (open: boolean) => set({ welcomeModalOpen: open }),
  triggerDialogue: (text: string) => set({ dialogueMessage: text, showDialogue: true }),
  closeDialogue: () => set({ showDialogue: false, dialogueMessage: null }),

  toggleScanlines: () => set((s) => ({ crtScanlines: !s.crtScanlines })),
  toggleGrain: () => set((s) => ({ crtGrain: !s.crtGrain })),
  setWallpaper: (wp) => set({ wallpaper: wp }),

  windows: {
    internet: { id: 'internet', title: 'Internet - Snoogle Browser', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 720, height: 480, x: 120, y: 70 },
    task_manager: { id: 'task_manager', title: 'Task Manager - Dual-Core SMP Scheduler', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 780, height: 490, x: 60, y: 50 },
    memory_map: { id: 'memory_map', title: 'Virtual Memory & Paging Map', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 680, height: 450, x: 100, y: 70 },
    deadlock_lab: { id: 'deadlock_lab', title: 'Deadlock & Concurrency Engine', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 680, height: 440, x: 140, y: 90 },
    terminal: { id: 'terminal', title: 'aethersh v2.4 - Aether Shell CLI', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 10, width: 620, height: 390, x: 250, y: 110 },
    file_explorer: { id: 'file_explorer', title: 'Finder - Crash-Consistent WAL Inodes', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 760, height: 460, x: 150, y: 80 },
    music: { id: 'music', title: 'Vinyl Lo-Fi Audio Player', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 440, height: 380, x: 280, y: 130 },
    calculator: { id: 'calculator', title: 'Calculator', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 320, height: 390, x: 320, y: 120 },
    messages: { id: 'messages', title: 'Aether Messages', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 700, height: 490, x: 160, y: 70 },
    test_runner: { id: 'test_runner', title: 'Kernel Test Suite & Audit Journal', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 720, height: 480, x: 150, y: 70 },
    kernel_quest: { id: 'kernel_quest', title: 'KernelQuest (OS Scenarios)', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 640, height: 420, x: 200, y: 90 },
    kernel_monitor: { id: 'kernel_monitor', title: 'Kernel Audit Journal & Invariants', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 640, height: 420, x: 220, y: 110 },
    about: { id: 'about', title: 'About AetherOS', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 480, height: 340, x: 260, y: 130 },
    settings: { id: 'settings', title: 'Control Panel - Desktop & Settings', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 600, height: 410, x: 220, y: 90 },
    community: { id: 'community', title: 'Community', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 780, height: 480, x: 160, y: 70 },
    trash: { id: 'trash', title: 'Trash', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 440, height: 320, x: 280, y: 140 },
    bpf_studio: { id: 'bpf_studio', title: 'In-Kernel eBPF Tracing & Probe Studio', isOpen: false, isMinimized: false, isMaximized: false, zIndex: 5, width: 780, height: 490, x: 170, y: 75 }
  },

  open: (id) => {
    const nextZ = get().highestZ + 1;
    set({
      highestZ: nextZ,
      activeId: id,
      windows: { ...get().windows, [id]: { ...get().windows[id], isOpen: true, isMinimized: false, zIndex: nextZ } }
    });
  },
  close: (id) => set({ windows: { ...get().windows, [id]: { ...get().windows[id], isOpen: false } } }),
  minimize: (id) => set({ windows: { ...get().windows, [id]: { ...get().windows[id], isMinimized: true } } }),
  maximize: (id) => set({ windows: { ...get().windows, [id]: { ...get().windows[id], isMaximized: !get().windows[id].isMaximized } } }),
  focus: (id) => {
    const nextZ = get().highestZ + 1;
    set({
      highestZ: nextZ,
      activeId: id,
      windows: { ...get().windows, [id]: { ...get().windows[id], isMinimized: false, zIndex: nextZ } }
    });
  },
  updateBounds: (id, x, y, width, height) => set({ windows: { ...get().windows, [id]: { ...get().windows[id], x, y: Math.max(28, y), width, height } } }),
  resetLayout: () => {
    set((s) => ({
      windows: {
        internet: { ...s.windows.internet, isOpen: false, x: 120, y: 70 },
        task_manager: { ...s.windows.task_manager, isOpen: false, x: 60, y: 50 },
        terminal: { ...s.windows.terminal, isOpen: false, isMinimized: false, x: 250, y: 110 },
        memory_map: { ...s.windows.memory_map, isOpen: false, x: 100, y: 70 },
        deadlock_lab: { ...s.windows.deadlock_lab, isOpen: false, x: 140, y: 90 },
        file_explorer: { ...s.windows.file_explorer, isOpen: false, x: 150, y: 80 },
        music: { ...s.windows.music, isOpen: false, x: 280, y: 130 },
        calculator: { ...s.windows.calculator, isOpen: false, x: 320, y: 120 },
        messages: { ...s.windows.messages, isOpen: false, x: 180, y: 90 },
        test_runner: { ...s.windows.test_runner, isOpen: false, x: 150, y: 70 },
        kernel_quest: { ...s.windows.kernel_quest, isOpen: false, x: 200, y: 90 },
        kernel_monitor: { ...s.windows.kernel_monitor, isOpen: false, x: 220, y: 110 },
        about: { ...s.windows.about, isOpen: false, x: 260, y: 130 },
        settings: { ...s.windows.settings, isOpen: false, x: 220, y: 90 },
        community: { ...s.windows.community, isOpen: false, x: 160, y: 70 },
        trash: { ...s.windows.trash, isOpen: false, x: 280, y: 140 },
        bpf_studio: { ...s.windows.bpf_studio, isOpen: false, x: 170, y: 75 }
      }
    }));
  }
}));
