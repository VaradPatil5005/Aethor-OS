# Aethor OS (AetherOS)

> **Interactive Deterministic Microkernel & Operating Systems Evaluation Platform**  
> *Architected and developed by [Varad Patil](https://github.com/VaradPatil5005)*

[![Build & Typecheck](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Unit Tests](https://img.shields.io/badge/tests-33%20vitest%20%2B%2020%20pytest-emerald.svg)]()
[![Architecture](https://img.shields.io/badge/architecture-SMP%20Dual--Core%20Work--Stealing-blue.svg)]()
[![Kernel](https://img.shields.io/badge/kernel-Deterministic%20Microkernel-purple.svg)]()
[![VFS](https://img.shields.io/badge/VFS-Crash--Consistent%20WAL-orange.svg)]()
[![License](https://img.shields.io/badge/license-MIT-lightgrey.svg)]()

---

## Table of Contents
1. [Abstract](#abstract)
   - [SpillGuard: real GPU memory spill, live](#spillguard-real-gpu-memory-spill-live)
2. [Overview](#overview)
3. [Detailed Architecture](#detailed-architecture)
   - [3.1 High-Level Architectural Schema](#31-high-level-architectural-schema)
   - [3.2 CPU Scheduling & Multi-Level Feedback Queue (MLFQ)](#32-cpu-scheduling--multi-level-feedback-queue-mlfq)
   - [3.3 Symmetric Multiprocessing (SMP) & Work-Stealing Engine](#33-symmetric-multiprocessing-smp--work-stealing-engine)
   - [3.4 Virtual Memory Management & Page Frame Mapping](#34-virtual-memory-management--page-frame-mapping)
   - [3.5 Crash-Consistent Virtual File System (VFS) with Write-Ahead Logging](#35-crash-consistent-virtual-file-system-vfs-with-write-ahead-logging)
   - [3.6 Concurrency, Deadlock Detection & Banker's Algorithm Safety Matrix](#36-concurrency-deadlock-detection--bankers-algorithm-safety-matrix)
   - [3.7 Simulated eBPF Probes & Observability Studio](#37-simulated-ebpf-probes--observability-studio)
   - [3.8 Window Management & Pinned Titlebar Geometry](#38-window-management--pinned-titlebar-geometry)
4. [Key Features](#key-features)
5. [How It Is Different From Any Other Things](#how-it-is-different-from-any-other-things)
6. [How It Works (Operational Guide)](#how-it-works-operational-guide)
7. [Research References](#research-references)
8. [Future Scope](#future-scope)
9. [Getting Started & Verification](#getting-started--verification)
10. [Author & Social Profiles](#author--social-profiles)

---

## Abstract

Modern operating systems education suffers from a profound cognitive gap between theoretical systems literature and practical visual intuition. Classical teaching operating systems (e.g., Pintos, Nachos, xv6) require complex hardware emulators, execute headlessly with steep learning curves, and offer no dynamic visual runtime introspection. Conversely, typical "WebOS" projects merely create superficial CSS desktop mockups devoid of authentic kernel state machines, scheduling algorithms, or memory hardware abstractions.

**Aethor OS (AetherOS)** bridges this divide. It is a full-featured, mathematically rigorous, interactive operating system simulation platform built from the ground up using **TypeScript**, **React 18**, **Tailwind CSS**, and **Zustand**. Aethor OS implements a deterministic clock-driven microkernel featuring:
- **6 CPU Scheduling Algorithms** including a 3-level Multi-Level Feedback Queue (MLFQ) with dynamic priority aging and preemption.
- **Symmetric Multiprocessing (SMP)** across simulated dual cores with dynamic work-stealing load balancing.
- **Virtual Memory Paging** across 32 physical page frames (4 KB each) with LRU, FIFO and CLOCK (second-chance) page replacement and page-fault accounting.
- **Crash-Consistent Virtual File System (VFS)** governed by a Write-Ahead Log (WAL) that guarantees metadata durability across simulated power failures.
- **Dijkstra's Banker's Algorithm** with multi-resource safety matrices and Wait-For Graph (WFG) cycle detection.
- **Simulated Extended Berkeley Packet Filter (eBPF)** runtime providing non-intrusive kprobe telemetry.

All subsystems are unified beneath a vintage **Classic Mac OS / System 7 retro desktop** providing real-time Gantt execution streams, interactive diagnostic consoles, and full test suite verification.

### SpillGuard: real GPU memory spill, live

The new [SpillGuard Repro workflow](docs/SPILLGUARD_REPRO.md) builds on the existing
agent with controlled baseline/pressure/recovery experiments, rerunnable evidence
bundles and a plain ddmin reducer. The first live target is a synthetic CUDA probe;
real application and phase/residency-aware research validation remain open.

The [local AI adapter](docs/SPILLGUARD_REPRO_OLLAMA.md) now pins installed Ollama
models and measures streamed inference with owned server cleanup.

**First reproduced witness (18 Oct 2026, [results](docs/SPILLGUARD_REPRO_RESULTS_20261018.md)):** an active
co-tenant pushing demand 256–512 MiB past the RTX 3050's VRAM slowed Qwen2.5-3B decode **2.28–2.38×**
(4/4 matched trials, full recovery, identical output) versus 1.15–1.22× while it still fit. An idle co-tenant
of the same size gave 1.03× with the same memory counters, and the counter-based detector raised 3 false
alarms in 9 valid trials. Pilot sample sizes, one laptop; the residency mechanism is not yet verified. In
AetherOS: SpillGuard → evidence desk → **Load measured dose-response**.

The expanded [research guide](docs/SPILLGUARD_RESEARCH_GUIDE.md) covers phase-aware
and baseline reducers, guarded remedies, campaign planning, analysis, source exports
and the AetherOS evidence desk. The [execution ledger](docs/SPILLGUARD_EXECUTION.md)
maps every dossier phase to delivered work and missing evidence. The 72-cell study
is gated: current pilots did not establish severe application slowdown before host
memory limits. A software feature is not a completed research result.
The 17 October 2026 release check passed 148 agent tests, 44 frontend tests and the
production build; older test-output examples below describe earlier checkpoints.

AetherOS also has a real-hardware mode. **SpillGuard** is a small Windows agent (`agent/`, Python) that watches
the GPU's actual video memory manager and detects *silent spill*: when a game or local AI model needs more VRAM
than the card has, Windows and the NVIDIA driver (536.40+) quietly page the overflow into system RAM over PCIe.
Nothing errors; the app just gets slower. SpillGuard detects it, names the process responsible, and checks
*before launch* whether a model will fit (Banker's-style admission control on VRAM). AetherOS is its dashboard:
the SpillGuard app, a twin view in Memory Map, real events in eBPF Studio, real Banker's matrices in Deadlock Lab,
`spillguard` commands in `aethersh`, and two KernelQuest challenges.

Measured on an RTX 3050 6 GB laptop (driver 581.83, Windows 11 26200), mean ± sd over repeated runs:

| Experiment | Result |
| --- | --- |
| E1 cost of spill: GPU write bandwidth, resident vs spilled block | 163.3 ± 0.1 GB/s vs 13.2 ± 0.0 GB/s, **12.4× slower** (n = 3) |
| E2 detection (W1 stress, 3 spill + 2 near-full no-spill runs) | recall 3/3, **0 false positives**, latency **0.95 ± 0.03 s** after true onset |
| E3 VRAM fit estimator vs measured runner footprint (Ollama, 2 models × 5 contexts) | leave-one-out MAE **46 MB** (max 93); Ollama's own `size_vram` is off by 902 MB |
| E5 agent overhead at 1 Hz | 2.3 % of one core (≈ 0.14 % of the 16-thread CPU), 52 MB RSS |

Run it: `npm run build`, then in `agent/`: `python -m spillguard serve` and open the link it prints. No NVIDIA GPU?
Open SpillGuard → **Replay** → **Demo trace** to play a spill recorded on the author's laptop.
Design, method, raw numbers and limitations: [docs/SPILLGUARD.md](docs/SPILLGUARD.md).

---

## Overview

Aethor OS is designed as an interactive sandbox for computer science undergraduates, systems researchers, and software engineers to visualize, evaluate, and stress-test core operating systems primitives.

Instead of treating kernel behavior as a black box, Aethor OS exposes internal registers, runqueues, memory allocations, inode tables, and deadlock graphs directly to the user interface. Every action—from spawning a process in Task Manager to triggering a crash in the file explorer—updates the underlying kernel data structures deterministically tick-by-tick.

### Core Design Principles
1. **Mathematical Rigor:** Algorithms are implemented exactly as specified in foundational computer science literature (Dijkstra, Corbató, Blumofe).
2. **Determinism:** The kernel advances via a discrete clock engine, making scheduling states, memory allocations, and race conditions 100% reproducible.
3. **Observability:** Every subsystem provides live telemetry, from CPU register dumps upon simulated General Protection Faults (GPFs) to live Gantt execution timelines.
4. **Rich Retro Aesthetics:** Wrapped in an authentic vintage System 7 desktop complete with retro sound synthesis, CRT scanlines, and pixel typography.

---

## Detailed Architecture

### 3.1 High-Level Architectural Schema

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 AETHOR OS PRESENTATION LAYER                           │
│   System 7 Top Menu  │  Retro Dock  │  17 Interactive Apps  │  Falcon Companion (Zephyr)│
├────────────────────────────────────────────────────────────────────────────────────────┤
│                           WINDOWING & DESKTOP RUNTIME ENGINE                           │
│   Pinned Titlebars  │  Draggable Rnd Viewports  │  Z-Index Priority  │  Scoped Scrolling│
├────────────────────────────────────────────────────────────────────────────────────────┤
│                              AETHOR OS MICROKERNEL CORE                                │
│  ┌───────────────────────┬───────────────────────┬──────────────────────────────────┐  │
│  │    CPU SCHEDULER      │     SMP MULTI-CORE    │     VIRTUAL MEMORY (PAGING)      │  │
│  │  - FCFS, SJF, SRTF    │  - Dual Runqueues     │  - 32 Physical Frames            │  │
│  │  - Round Robin (RR)   │  - Core Affinity Pids │  - LRU / FIFO / CLOCK            │  │
│  │  - 3-Level MLFQ Aging │  - Work-Stealing      │  - Page-Fault Accounting         │  │
│  ├───────────────────────┼───────────────────────┼──────────────────────────────────┤  │
│  │   DEADLOCK & SYNC     │  CRASH-CONSISTENT VFS │       SIMULATED eBPF PROBES      │  │
│  │  - Banker's Algorithm │  - Inode Table & Tree │  - Kprobes & Tracepoints         │  │
│  │  - Safety Matrix      │  - Write-Ahead Log    │  - Non-Intrusive Syscall Hooks   │  │
│  │  - Wait-For Graph WFG │  - Replay & Recovery  │  - Ring Buffer Telemetry         │  │
│  └───────────────────────┴───────────────────────┴──────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                          HARDWARE ABSTRACTION & CLOCK TICK ENGINE                      │
│   Discrete Tick Loop (100ms - 2000ms) │ System Bus │ General Protection Fault Logger   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 CPU Scheduling & Multi-Level Feedback Queue (MLFQ)
*Implementation: `src/kernel/Scheduler.ts`*

The CPU Scheduler is responsible for arbitrating processor execution across all runnable processes. Aethor OS supports six distinct scheduling algorithms selectable dynamically at runtime:

1. **First-Come, First-Served (FCFS):** Non-preemptive queue sorted strictly by process arrival tick (`arrivalTick`).
2. **Shortest Job First (SJF):** Non-preemptive policy that schedules the job with the minimum total burst requirement (`totalBurstTicks`), provably minimizing average waiting time.
3. **Shortest Remaining Time First (SRTF):** Preemptive variant of SJF. Preempts the running task if an arriving process has a strictly shorter remaining execution time (`remainingBurstTicks`).
4. **Round Robin (RR):** Preemptive scheduling where processes receive a fixed execution quantum (`timeQuantum`, configurable from 1 to 16 ticks). If a process does not complete before its quantum expires, it rotates to the queue tail.
5. **Static Priority:** Strict priority-based scheduling with arrival tick tie-breaking.
6. **Multi-Level Feedback Queue (MLFQ):**
   - **Queue 0 (Q0):** Quantum = 4 ticks. High priority for interactive I/O tasks.
   - **Queue 1 (Q1):** Quantum = 8 ticks. Medium priority for moderate tasks.
   - **Queue 2 (Q2):** Quantum = 16 ticks / FCFS. Low priority for long CPU-intensive batches.
   - **Demotion Rule:** If a process exhausts its quantum without yielding, it is demoted to the lower queue level.
   - **Priority Boost / Aging:** Every 40 clock ticks, the scheduler executes an aging sweep that boosts all starved processes back to Queue 0, preventing indefinite starvation.

---

### 3.3 Symmetric Multiprocessing (SMP) & Work-Stealing Engine
*Implementation: `src/kernel/Scheduler.ts` (methods: `selectNextForCore`, `stealWork`)*

Aethor OS models a dual-core SMP processor (**Core 0** and **Core 1**):
- **Independent Runqueues:** Core 0 and Core 1 maintain separate process ID arrays (`coreQueues[0]` and `coreQueues[1]`).
- **Core Affinity:** Processes can be pinned to `CORE 0`, `CORE 1`, or set to `ANY CORE`. When `ANY CORE` is specified, the dispatcher assigns the process to the core with the shortest backlog.
- **Work-Stealing Algorithm (Blumofe-Leiserson):** When Core $A$ (thief) empties its runqueue while Core $B$ (victim) has $N \ge 2$ runnable processes, Core $A$ performs an atomic work-stealing operation:
  $$\text{Stolen Tasks} = \left\lfloor \frac{N}{2} \right\rfloor$$
  Tasks are stolen from the tail of the victim's queue to preserve cache locality for recently executed processes, updating total steal telemetry.

---

### 3.4 Virtual Memory Management & Page Frame Mapping
*Implementation: `src/kernel/MemoryManager.ts`*

The virtual memory subsystem manages a physical address space divided into **32 Physical Page Frames** of 4 KB (128 KB total simulated physical RAM):
- **Address Translation:** Maps virtual pages from active processes into physical frame indices via a software page table.
- **Page Fault Handler:** When a process needs more frames than are free, a page fault is counted for each missing page and the replacement engine picks victims.
- **Page Replacement Policies:**
  - **Least Recently Used (LRU):** Tracks the exact tick of last access for each frame, evicting the frame that has remained unreferenced for the longest time interval.
  - **FIFO (First-In, First-Out):** Evicts the frame that was loaded earliest.
  - **CLOCK (Second Chance):** A reference bit is set on load and on every access; the clock hand clears set bits as it sweeps and evicts the first frame whose bit is already clear.
  - **Optimal** needs the future reference string, which this kernel does not model, so it runs LRU (the Memory Map says so).
- **Twin view (SpillGuard):** next to the simulated frames, Memory Map shows the real GPU's VRAM residency and the pages it has spilled to system RAM — the same paging idea on real hardware.

---

### 3.5 Crash-Consistent Virtual File System (VFS) with Write-Ahead Logging
*Implementation: `src/kernel/VFS.ts`*

The Virtual File System implements a hierarchical inode tree with atomic transaction guarantees grounded in modern storage literature:
- **Inode Table:** Manages files, directories, permissions, file size, and creation timestamps.
- **Write-Ahead Log (WAL):** Before any metadata modification (file creation, directory creation, deletion) is committed to the active inode tree, a transactional log entry is appended to the WAL buffer.
- **Crash Injection:** Users can trigger an instant power crash midway through disk operations.
- **Recovery Engine:** Upon reboot or crash recovery, the VFS scans the WAL:
  - Committed transactions without corresponding inode state are **replayed forward**.
  - Incomplete or uncommitted transactions are **rolled back**, guaranteeing zero filesystem corruption.

---

### 3.6 Concurrency, Deadlock Detection & Banker's Algorithm Safety Matrix
*Implementation: `src/kernel/BankersAlgorithm.ts`, `src/kernel/DeadlockEngine.ts`*

Aethor OS provides an interactive concurrency and deadlock laboratory:
- **Dijkstra's Banker's Algorithm:** Manages multi-resource allocation across three distinct system resource types ($R_1, R_2, R_3$).
  - Evaluates the safety condition:
    $$\text{Need}[i][j] = \text{Max}[i][j] - \text{Allocation}[i][j]$$
  - Discovers whether a safe sequence exists where all processes can finish without deadlock. The simulated lab performs the safety check only; it does not grant or deny requests.
  - **On real hardware (SpillGuard):** Deadlock Lab also fills the matrices with your GPU's real VRAM Allocation / Max / Available, and the agent uses the same check to grant or deny a model launch. Because a game or chat server never "finishes", long-lived processes have their remaining need reserved up front instead of joining the safe sequence; the panel shows the textbook and the long-lived verdict side by side.
- **Wait-For Graph (WFG) & Cycle Detection:**
  - Constructs a directed graph where nodes are processes and edges represent dependency ($P_A \to P_B$ means $P_A$ is blocked waiting for a resource held by $P_B$).
  - Runs depth-first cycle detection to identify deadlocks in real time, highlighting deadlocked processes in crimson and offering automated deadlock recovery (killing victim process or releasing resources).

---

### 3.7 Simulated eBPF Probes & Observability Studio
*Implementation: `src/components/apps/BPFStudioApp.tsx`, `src/stores/useKernelStore.ts`*

Provides a high-performance observability subsystem inspired by modern Linux eBPF:
- **Kprobes & Tracepoints:** Attach non-intrusive probe hooks to critical kernel event points:
  - `sched/sched_switch`: Fires on every context switch.
  - `vfs/vfs_write`: Fires on file system operations.
  - `mm/page_fault`: Fires on memory allocation misses.
  - `net/packet_rx`: Fires on network packets.
- **Live Ring Buffer:** Streams live execution telemetry into a filterable terminal log with byte counts, execution duration, and caller PIDs.

---

### 3.8 Window Management & Pinned Titlebar Geometry
*Implementation: `src/components/WindowFrame.tsx`*

Aethor OS features a custom System 7 window manager built on `react-rnd`:
- **Stationary Titlebar Pinning:** Window headers feature `shrink-0 relative z-20`, guaranteeing that control buttons (`_`, `□`, `✕`) remain pinned at the top regardless of window content size.
- **Container-Scoped Scrolling:** All 17 applications feature `min-h-0 min-w-0` bounding with internal `overflow-y-auto overscroll-contain`. Scopes mousewheel and scroll events exclusively to the application view, eliminating browser scroll jumping.
- **Boundary Clamping:** Windows are clamped to $Y \ge 28\text{px}$, preventing windows from being dragged beneath the global top menu bar.

---

## Key Features

| Application | Icon | Subsystem Highlight |
| :--- | :---: | :--- |
| **Task Manager** | ⚙️ | Real-time process dispatcher, 6 CPU algorithms, live Gantt chart stream, dual-core affinity toggle. |
| **Kernel Monitor** | 📊 | SMP multi-core CPU usage meters, GPF register dumps (`eip`, `esp`, `cr3`, `eax`, `cs`, `eflags`), event log. |
| **BPF Studio** | 📡 | Simulated eBPF kprobes, tracepoint hook attachments, live packet/syscall stream. |
| **Deadlock Lab** | 🛡️ | Dijkstra's Banker's Algorithm matrix editor, Wait-For Graph cycle visualization, deadlock resolution. |
| **Memory Map** | 📑 | 32-frame physical memory map, LRU / FIFO / CLOCK replacement, page-fault counter, and a twin view of real GPU VRAM residency (SpillGuard). |
| **Test Runner** | ✅ | Interactive kernel audit suite executing 28 automated unit tests with microsecond timing. |
| **KernelQuest** | 🏆 | Gamified educational challenges testing CPU scheduling, paging, and deadlock problem solving. |
| **Terminal (`aethersh`)** | 💻 | Unix-style CLI: `ps`, `kill`, `run`, `sched`, `quantum`, `affinity`, `memstat`, `gpf`, `deadlock`, `bpf`, `powercut`, `fsck`, VFS commands, and `spillguard status / why / events / fit / demo`. |
| **SpillGuard** | 🟥 | Real GPU memory tiers on this PC (Live) or a recorded trace (Replay): spill detection, culprit attribution, VRAM fit check. |
| **Finder / Files** | 📁 | Inode file manager backed by Crash-Consistent VFS, directory tree, and file reader. |
| **Snoogle Browser** | 🌐 | Retro simulated search engine and web browser with interactive search queries. |
| **Messages** | 💬 | Interactive chat with OS Ma'am (with ready-to-post template bubbles) and Marathi family chats (Baba & Aai). |
| **Falcon Companion** | 🦅 | Interactive Peregrine Falcon (**Zephyr**) with cliff roost, 389 km/h dives, and secret OS tips. |
| **Vinyl Music Player** | 🎵 | 8-bit chiptune audio player with customizable vinyl tracks synthesized via Web Audio API. |
| **Calculator** | 🧮 | Retro desktop calculator featuring secret historical codes (e.g. `1976` for Apple I discovery). |
| **Settings** | 🎛️ | Wallpaper selector (Mainframe, Classic, Lavender, Matrix), CRT scanlines, CRT grain toggle. |
| **Community** | 👥 | Interactive guestbook permitting users to write real-time community messages. |
| **Trash** | 🗑️ | Interactive wastebasket with comic dialogue speech bubbles, file restoration, and emptying audio. |

---

## How It Is Different From Any Other Things

| Capability | Generic WebOS Demos | Traditional Teaching OS (xv6 / Pintos) | **Aethor OS** |
| :--- | :---: | :---: | :---: |
| **Real Kernel Primitives** | ❌ None (Dummy CSS skins) | ✅ Full C/Assembly implementation | ✅ **Fully simulated deterministic microkernel in TypeScript** |
| **Interactive GUI & Visualization** | ⚠️ Static or basic | ❌ None (Headless serial/QEMU terminal) | ✅ **Full System 7 Retro Desktop with live Gantt charts & graphs** |
| **SMP Multi-Core & Work-Stealing** | ❌ No | ⚠️ Minimal / Complex setup | ✅ **Dual-core runqueues with automatic work-stealing and affinity** |
| **Crash-Consistent VFS (WAL)** | ❌ No | ⚠️ Complex block device hacking | ✅ **Visual Write-Ahead Log with simulated power failure and recovery** |
| **Deadlock Safety Matrices** | ❌ No | ❌ Theoretical homework only | ✅ **Interactive Banker's Algorithm matrix & Wait-For Graph cycles** |
| **Non-Intrusive eBPF Tracing** | ❌ No | ❌ Requires Linux 4.x+ kernel | ✅ **Built-in simulated kprobes & tracepoint telemetry engine** |
| **Setup & Installation** | Browser-only | Hours of cross-compiler & QEMU debugging | ✅ **Single command (`npm run dev`) or instant web access** |
| **Automated Verification** | ❌ No tests | ⚠️ Complex Python test harness | ✅ **33 Vitest kernel tests + 20 pytest agent tests (one replays a real GPU trace)** |

---

## How It Works (Operational Guide)

### 1. Booting Aethor OS
1. Upon loading `http://localhost:3000`, the system displays the vintage **System 7 Boot & Login Screen**.
2. Enter your name as the password (hint provided) and press Enter. The kernel initializes all microkernel subsystems and logs user credentials.

### 2. Live CPU Scheduling Demonstration
1. Launch **Task Manager** from the dock or desktop.
2. Select **Round Robin (RR)** from the algorithm dropdown and adjust the **Quantum** slider to `4`.
3. Watch the live Gantt execution stream update tick-by-tick.
4. Click **"Dispatch Process"** to spawn a custom process (`Burst: 12`, `Priority: 1`).
5. Click a process's affinity tag to cycle between `ANY CORE`, `CORE 0`, and `CORE 1` to witness SMP work-stealing when one core runs idle.

### 3. Inducing and Resolving Deadlocks
1. Launch **Deadlock Lab**.
2. Examine the Allocation, Maximum, Available, and Need matrices for the Banker's Algorithm.
3. Click **Compute Safe Sequence** to run the safety check and step through Work / Need.
4. Scroll to **Banker's algorithm on real VRAM** (needs SpillGuard Live or Replay): slide the new launch's claim and compare the textbook verdict with the long-lived one.
5. Switch to the **Wait-For Graph** tab and inject cyclic dependencies; observe the cycle detection highlight deadlocked processes in red.

### 4. Interactive Terminal Commands (`aethersh`)
Open **Terminal** from the dock and try these commands:
```bash
# Process Management
ps                     # Processes, PCBs and core affinities
run worker 12          # Create a process with a 12-tick burst
kill 3                 # Terminate process with PID 3
sched MLFQ             # Switch scheduler (MLFQ, ROUND_ROBIN, SRTF, PRIORITY, FCFS, SJF)
quantum 4              # Set the Round Robin quantum
affinity 3 1           # Pin PID 3 to core 1 (0 | 1 | any)

# Memory, Faults & Tracing
memstat                # Physical frame allocation and page-fault stats
gpf 3                  # Inject a simulated General Protection Fault
bpf                    # Dump active eBPF probes and their maps

# Concurrency & Storage
deadlock               # Inject a deadlock scenario
powercut               # Simulate a storage power failure mid-write
fsck                   # Replay the VFS journal and recover
ls, cd, cat, touch, mkdir, rm

# Real GPU memory (SpillGuard)
spillguard demo        # Replay a spill recorded on an RTX 3050 laptop
spillguard status      # VRAM / shared / RAM tiers per process
spillguard why 1234    # Explain one process's spill state and culprit
spillguard fit qwen2.5:3b-instruct 8192   # VRAM estimate + admission (Live)

# Fun
matrix                 # Toggle the matrix digital rain
theme classic          # Switch desktop wallpaper (classic, mainframe, lavender, matrix)
```

---

## Research References

Aethor OS draws theoretical inspiration and mathematical rigor from the following landmark operating systems literature:

1. **Corbató, F. J., Merwin-Daggett, M., & Daley, R. C. (1962).**  
   *An Experimental Time-Sharing System.* AFIPS Spring Joint Computer Conference, 335–344.  
   *(Foundational principles for the Multi-Level Feedback Queue scheduling engine).*

2. **Dijkstra, E. W. (1965).**  
   *Cooperating Sequential Processes.* Technological University, Eindhoven, The Netherlands.  
   *(The original Banker's Algorithm for deadlock avoidance and resource allocation safety).*

3. **Blumofe, R. D., & Leiserson, C. E. (1999).**  
   *Scheduling Multithreaded Computations by Work Stealing.* Journal of the ACM (JACM), 46(5), 720–748.  
   *(Basis for the dual-core SMP runqueue work-stealing engine).*

4. **Chidambaram, V., Pillai, T. S., Arpaci-Dusseau, A. C., & Arpaci-Dusseau, R. H. (2012).**  
   *Consistency Without Ordering in File Systems.* Proceedings of the 10th USENIX Symposium on Operating Systems Design and Implementation (OSDI '12).  
   *(Theoretical ground for the Crash-Consistent VFS Write-Ahead Log).*

5. **Gregg, B. (2019).**  
   *BPF Performance Tools: Linux System and Application Observability.* Addison-Wesley Professional.  
   *(Architecture for simulated kprobes, tracepoint attachment, and kernel telemetry).*

6. **Silberschatz, A., Galvin, P. B., & Gagne, G. (2018).**  
   *Operating System Concepts (10th Edition).* John Wiley & Sons.  
   *(Reference for virtual memory page table translation, LRU page replacement, and Wait-For Graphs).*

---

## Future Scope

1. **WebAssembly (WASM) Real Execution Engine:** Integrating a lightweight WebAssembly JIT runtime allowing users to compile and run real C/Rust binaries within the Aethor OS scheduler and memory sandbox.
2. **Multi-Node Distributed Clustering:** Expanding SMP to simulate distributed multi-node consensus (Raft/Paxos) across simulated network links with artificial packet latency and loss.
3. **IndexedDB Persistent VFS Storage:** Persisting the inode hierarchy and Write-Ahead Log directly to the browser's IndexedDB, maintaining real filesystem state across browser sessions.
4. **RISC-V 32-bit CPU Emulator:** Embedding an educational RV32I instruction set emulator into the Terminal to step through assembly instructions, register files, and ALU flags.

---

## Getting Started & Verification

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- npm (v9.0.0 or higher)

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/VaradPatil5005/Aethor-OS.git
cd Aethor-OS

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```
Open your browser at `http://localhost:3000`.

### Running Automated Test Suite
Aethor OS includes an extensive automated unit test suite covering every core kernel subsystem:
```bash
npm test -- --run
```
Expected output:
```
✓ src/kernel/__tests__/MemoryManager.test.ts    (4 tests)
✓ src/kernel/__tests__/DeadlockEngine.test.ts    (3 tests)
✓ src/kernel/__tests__/BankersAlgorithm.test.ts (4 tests)
✓ src/kernel/__tests__/Scheduler.test.ts        (5 tests)
✓ src/kernel/__tests__/VFSExtended.test.ts      (3 tests)
✓ src/kernel/__tests__/SpillAdmission.test.ts   (3 tests)
✓ src/kernel/__tests__/AdvancedSubsystems.test.ts (11 tests)

Test Files  7 passed (7)
Tests       33 passed (33)
```

The SpillGuard agent has its own suite (one test replays a real spill trace recorded on an RTX 3050):
```bash
cd agent
python -m pytest -q        # 20 passed
```

### Production Build
```bash
npm run build
```

---

## Author & Social Profiles

Developed with dedication by **Varad Patil**:

- **GitHub:** [@VaradPatil5005](https://github.com/VaradPatil5005)
- **LinkedIn:** [Varad Patil](https://www.linkedin.com/in/varad-patil-98a851338)
- **Twitter / X:** [@VaradPatil____](https://x.com/VaradPatil____)
- **Instagram:** [@varadpatil___](https://www.instagram.com/varadpatil___)

---

### License
This project is open-source and licensed under the [MIT License](LICENSE).
