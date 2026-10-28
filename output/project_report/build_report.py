from pathlib import Path
import json, hashlib, re, math
from xml.sax.saxutils import escape
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Table, TableStyle, Flowable, Image, KeepTogether, NextPageTemplate)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_LEFT
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent
QA=ROOT/'tmp/report_qa'
for n,f in [('TNR','times.ttf'),('TNR-Bold','timesbd.ttf'),('TNR-Italic','timesi.ttf'),('TNR-BoldItalic','timesbi.ttf')]:
    pdfmetrics.registerFont(TTFont(n,str(Path('C:/Windows/Fonts')/f)))
pdfmetrics.registerFontFamily('TNR',normal='TNR',bold='TNR-Bold',italic='TNR-Italic',boldItalic='TNR-BoldItalic')
W,H=A4
M=62
CW=W-2*M
styles={
 'body':ParagraphStyle('body',fontName='TNR',fontSize=11,leading=14.3,alignment=TA_JUSTIFY,spaceAfter=7,allowWidows=0,allowOrphans=0),
 'h1':ParagraphStyle('h1',fontName='TNR-Bold',fontSize=17,leading=21,spaceAfter=13,keepWithNext=True),
 'h2':ParagraphStyle('h2',fontName='TNR-Bold',fontSize=12.5,leading=16,spaceBefore=8,spaceAfter=6,keepWithNext=True),
 'cap':ParagraphStyle('cap',fontName='TNR-Italic',fontSize=10,leading=13,alignment=TA_CENTER,spaceBefore=7,spaceAfter=12),
 'tablecap':ParagraphStyle('tablecap',fontName='TNR-Italic',fontSize=10,leading=13,alignment=TA_CENTER,spaceBefore=7,spaceAfter=9,keepWithNext=True),
 'cell':ParagraphStyle('cell',fontName='TNR',fontSize=9.5,leading=12),
 'headcell':ParagraphStyle('headcell',fontName='TNR-Bold',fontSize=9.5,leading=12),
 'small':ParagraphStyle('small',fontName='TNR',fontSize=9.5,leading=12.5,spaceAfter=6),
 'code':ParagraphStyle('code',fontName='Courier',fontSize=8,leading=11,spaceAfter=7),
 'title':ParagraphStyle('title',fontName='TNR-Bold',fontSize=30,leading=37,alignment=TA_CENTER,spaceAfter=22),
 'subtitle':ParagraphStyle('subtitle',fontName='TNR',fontSize=17,leading=23,alignment=TA_CENTER,spaceAfter=18),
 'center':ParagraphStyle('center',fontName='TNR',fontSize=12,leading=18,alignment=TA_CENTER,spaceAfter=10),
}
for s in styles.values(): s.textColor=colors.black
story=[]
FIGS=[]; TABLES=[]; sections=[]
def p(t,style='body'): story.append(Paragraph(t,styles[style]))
def h(t): p(t,'h2')
def chapter(t):
    if story: story.append(PageBreak())
    sections.append(t);p(t,'h1')
def table(title,headers,rows,widths):
    num=len(TABLES)+1;TABLES.append((num,title))
    cap=Paragraph(f'Table {num}  {title}',styles['tablecap'])
    data=[[Paragraph(escape(str(v)),styles['headcell']) for v in headers]]
    data += [[Paragraph(escape(str(v)),styles['cell']) for v in row] for row in rows]
    t=Table(data,colWidths=[CW*x/sum(widths) for x in widths],repeatRows=1,hAlign='CENTER')
    t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),0.55,colors.black),('BACKGROUND',(0,0),(-1,-1),colors.white),('TEXTCOLOR',(0,0),(-1,-1),colors.black),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    if len(rows)<=8:
        group=[cap,t]
        if story and isinstance(story[-1],Paragraph) and story[-1].style.name=='h2':group.insert(0,story.pop())
        story.append(KeepTogether(group))
    else: story.extend([cap,t])
    story.append(Spacer(1,9))
def figure(obj,title):
    num=len(FIGS)+1;FIGS.append((num,title));group=[obj,Paragraph(f'Figure {num}  {title}',styles['cap'])]
    if story and isinstance(story[-1],Paragraph) and story[-1].style.name=='h2':group.insert(0,story.pop())
    story.append(KeepTogether(group))
def code(lines):
    block=Paragraph('<br/>'.join(escape(line).replace(' ','&#160;') for line in lines.split('\n')),styles['code'])
    group=[block]
    if story and isinstance(story[-1],Paragraph):
        group.insert(0,story.pop())
        if story and isinstance(story[-1],Paragraph) and story[-1].style.name=='h2': group.insert(0,story.pop())
    story.append(KeepTogether(group))

class Diagram(Flowable):
    def __init__(self,kind,height=270):Flowable.__init__(self);self.kind=kind;self.width=CW;self.height=height
    def draw(self):
        c=self.canv;c.setStrokeColor(colors.black);c.setFillColor(colors.white);c.setLineWidth(.8)
        def box(x,y,w,hh,txt):
            c.setFillColor(colors.white);c.rect(x,y,w,hh,fill=1,stroke=1);c.setFillColor(colors.black)
            ls=txt.split('\n');size=10
            for i,l in enumerate(ls):c.setFont('TNR-Bold' if i==0 else 'TNR',size);c.drawCentredString(x+w/2,y+hh/2+(len(ls)-1)*6-i*12,l)
        def arrow(x1,y1,x2,y2,dash=False):
            c.setDash(3,2) if dash else c.setDash();c.line(x1,y1,x2,y2);c.setDash()
            ang=math.atan2(y2-y1,x2-x1);r=6
            c.line(x2,y2,x2-r*math.cos(ang-.45),y2-r*math.sin(ang-.45));c.line(x2,y2,x2-r*math.cos(ang+.45),y2-r*math.sin(ang+.45))
        if self.kind=='architecture':
            box(3,219,CW-6,45,'Desktop and application views\nTask Manager   Memory Map   Deadlock Lab   Shell   SpillGuard')
            box(3,152,220,43,'Browser state and simulation\nZustand stores and TypeScript kernel')
            box(247,152,CW-250,43,'HostBridge Web Worker\nLive WebSocket or JSONL replay')
            box(3,71,220,57,'Educational subsystems\nScheduler   Memory   VFS\nBanker safety   Wait-for graph   Probes')
            box(247,71,CW-250,57,'SpillGuard Python agent\nCollector   Analyzer   Runtime\nFit estimator   Admission   FastAPI')
            box(247,3,CW-250,44,'Windows and GPU telemetry\nPDH   DXGI   NVML   psutil   Ollama')
            arrow(112,219,112,195);arrow(355,219,355,195);arrow(112,152,112,128);arrow(355,152,355,128);arrow(355,128,355,152);arrow(355,47,355,71)
            c.setFont('TNR-Italic',9);c.drawString(7,35,'Separate state models');c.drawString(7,21,'Browser processes do not schedule host processes')
        elif self.kind=='dispatch':
            box(100,233,270,34,'Advance one logical tick')
            box(100,178,270,38,'Requeue and synchronize\nApply eligible stealing and periodic aging')
            box(3,101,215,48,'Core 0 selection\nPolicy and affinity eligible process')
            box(252,101,CW-255,48,'Core 1 selection\nExclude the selected Core 0 PID')
            box(100,22,270,50,'Execute and publish state\nDecrement burst   Account time\nRelease finished memory   Append Gantt')
            arrow(235,233,235,216);arrow(167,178,110,149);arrow(300,178,360,149);arrow(110,101,170,72);arrow(360,101,300,72)
        elif self.kind=='detector':
            box(3,178,140,57,'OK\nUnpressured baseline\nShared-memory history')
            box(166,178,140,57,'PRESSURED\nLoad above high threshold\nBaseline held')
            box(329,178,CW-332,57,'SPILLING\nShared excess and\nk consecutive hits')
            arrow(143,205,166,205);arrow(306,205,329,205)
            box(82,58,310,64,'Clear with hysteresis\nLoad below low threshold or excess at most half delta\nThree clear samples close the episode')
            arrow(400,178,360,122);arrow(82,90,72,178)
            c.setFont('TNR-Italic',10);c.drawCentredString(CW/2,20,'An alert is a memory-pressure indicator; severe slowdown needs a matched experiment.')
        elif self.kind=='protocol':
            box(3,170,140,56,'BASELINE\nFrozen target work\nEmpty holder context')
            box(166,170,140,56,'PRESSURE\nSame target work\nOwned active co-tenant')
            box(329,170,CW-332,56,'RECOVERY\nSame target work\nCo-tenant released')
            arrow(143,198,166,198);arrow(306,198,329,198)
            box(88,61,300,65,'Validate before classifying\nWork and environment match   Pressure overlap\nHost memory guards   Output hashes   Recovery')
            arrow(235,170,235,126)
            c.setFont('TNR-Bold',11);c.drawCentredString(CW/2,27,'FAIL = reproduced slowdown    PASS = valid non-reproduction')
            c.setFont('TNR',10);c.drawCentredString(CW/2,10,'Invalid or uncertain evidence remains INCONCLUSIVE')
        elif self.kind=='wal':
            box(3,158,133,50,'PENDING\nLog the intended operation')
            box(168,158,133,50,'COMMITTED\nMark the transaction')
            box(336,158,CW-339,50,'CHECKPOINTED\nUpdate the inode model')
            arrow(136,183,168,183);arrow(301,183,336,183)
            box(76,39,320,63,'Simulated power cut and fsck\nUnmount and mark dirty   Remove pending entries\nMark committed entries checkpointed   Remount')
            arrow(65,158,160,102,True);arrow(233,158,233,102,True)
            c.setFont('TNR-Italic',9.5);c.drawCentredString(CW/2,10,'No durable block device or general operation-payload redo is implemented.')
        elif self.kind=='deadlock':
            box(25,110,160,60,'Process Alpha\nHolds MUTEX_GPU\nWaits for MUTEX_DISK')
            box(285,110,160,60,'Process Beta\nHolds MUTEX_DISK\nWaits for MUTEX_GPU')
            arrow(185,153,285,153);arrow(285,124,185,124)
            c.setFont('TNR',10);c.drawCentredString(CW/2,185,'Wait-for cycle under the injected single-instance mutex scenario')
            c.drawCentredString(CW/2,65,'A directed cycle explains the circular wait.');c.drawCentredString(CW/2,47,'The separate Banker module handles declared multi-instance maximum claims.')

class DosePlot(Flowable):
    def __init__(self,data): Flowable.__init__(self);self.width=CW;self.height=250;self.data=data
    def draw(self):
        c=self.canv;c.setStrokeColor(colors.black);c.setFillColor(colors.black);left=52;bottom=42;ww=CW-78;hh=173
        c.setLineWidth(.7);c.line(left,bottom,left,bottom+hh);c.line(left,bottom,left+ww,bottom)
        for y in [1,1.5,2,2.5]:
            yy=bottom+(y-.8)/1.8*hh;c.line(left-3,yy,left,yy);c.setFont('TNR',10);c.drawRightString(left-8,yy-3,f'{y:.1f}')
        xvals=[-512,0,256,512];points=[]
        for i,l in enumerate(self.data['levels']):
            x=left+25+(l['planned_overflow_mib']+512)/1024*(ww-50);rs=[t['verdict']['slowdown'] for t in l['trials']];mean=sum(rs)/len(rs)
            y=bottom+(mean-.8)/1.8*hh;points.append((x,y));c.setFont('TNR',10);c.drawCentredString(x,24,str(l['planned_overflow_mib']))
            for v in rs: yy=bottom+(v-.8)/1.8*hh;c.circle(x,yy,3,fill=0,stroke=1)
            c.rect(x-2,y-2,4,4,fill=1,stroke=1)
        for a,b in zip(points,points[1:]):c.line(*a,*b)
        c.setDash(4,3);yy=bottom+(2-.8)/1.8*hh;c.line(left,yy,left+ww,yy);c.setDash()
        c.setFont('TNR-Italic',9);c.drawString(left+6,yy+6,'Declared severe-slowdown threshold 2.0')
        c.setFont('TNR',10);c.drawCentredString(CW/2,7,'Planned overflow beyond measured capacity headroom in MiB')
        c.saveState();c.translate(12,126);c.rotate(90);c.drawCentredString(0,0,'Pressure time / baseline time');c.restoreState()
        c.setFont('TNR',9);c.drawString(left,232,'Open circles: individual trials. Squares: arithmetic mean. Two trials per level.')

class Report(BaseDocTemplate):
    def afterFlowable(self,f):
        if isinstance(f,Paragraph) and f.style.name=='h1':
            t=f.getPlainText();key='s'+str(len(self._tocmarks));self._tocmarks.append(key)
            self.canv.bookmarkPage(key);self.canv.addOutlineEntry(t,key,0,False);self.notify('TOCEntry',(0,t,self.page,key))
    def beforeDocument(self):self._tocmarks=[]
def page(c,d):
    c.saveState();c.setFillColor(colors.black);c.setStrokeColor(colors.black)
    if d.page>1:
        c.setFont('TNR',9);c.drawString(M,H-34,'AETHOR OS   |   OPERATING SYSTEMS LAB PROJECT')
        c.drawRightString(W-M,30,str(d.page));c.setFont('TNR-Italic',9);c.drawString(M,30,'Project report   •   22 October 2026')
    c.restoreState()

# Cover and front matter
story.append(Spacer(1,24))
p('<b>Vellore Institute of Technology</b>','subtitle')
p('IT Department','center')
story.append(Spacer(1,22))
p('Aethor OS','title')
p('An Observable Operating Systems Simulator<br/>with SpillGuard GPU Memory Diagnostics','subtitle')
story.append(Spacer(1,12))
p('OPERATING SYSTEMS LABORATORY<br/>PROJECT REPORT','center')
story.append(Spacer(1,19))
p('<b>Submitted by</b><br/>Varad Patil<br/>Registration Number 24BIT0175','center')
p('Individual Project','center')
story.append(Spacer(1,14))
p('<b>Course Code</b><br/>BITE303P','center')
p('<b>Faculty</b><br/>Dr. Harshita Patel','center')
story.append(Spacer(1,17))
p('22 October 2026','center')

chapter('Abstract')
p('Aethor OS, named AetherOS in the source tree and interface, is a browser-based operating systems laboratory that connects interactive simulation with a native Windows GPU-memory diagnostic workflow. Its TypeScript kernel models process dispatch on two logical cores, scheduling policies, frame allocation, page replacement, resource-allocation safety, wait-for cycles, a virtual file system, and event probes. A React desktop exposes the model through process tables, Gantt histories, memory views, a shell, and diagnostic applications. The browser kernel is an educational model; it does not boot hardware or execute native user programs.')
p('The SpillGuard extension collects process and adapter memory observations through Windows PDH, DXGI, optional NVML, and system-process information. It provides memory-pressure alerts, a model-footprint estimator, admission advice, trace replay, and controlled baseline–pressure–recovery experiments. Saved measurements on one RTX 3050 6 GB laptop show a reproducible performance cliff for a fixed Qwen2.5 3B inference workload: planned overflow of 256 MiB produced 2.35–2.37 times baseline decode time in the initial two trials. A subsequent remedy experiment reproduced the witness and reduced slowdown to approximately 1.01 times baseline by pausing the owned co-tenant while retaining its allocation.')
p('The result establishes a local performance failure under a controlled intervention. It does not establish a universal residency mechanism. Similar memory counters accompanied both severe and benign outcomes, demonstrating the importance of work-preserving intervention and recovery checks. Current software verification comprises 66 passing frontend tests, 149 passing agent tests, and a successful production build. Remaining limitations include simplified simulator semantics, small hardware samples, a single validated real application target, and unvalidated empirical advantages of scenario reduction.')
p('<b>Keywords</b> Operating systems education; CPU scheduling; paging; deadlock; virtual file systems; GPU memory; Windows telemetry; performance diagnosis; reproducibility.')
h('Reading the report')
p('Chapters 1–3 establish the problem, objectives, background and methodology. Chapters 4–7 describe the architecture and implementation of the simulator and native agent. Chapters 8–10 present the experimental method, software tests, results and limitations. Chapters 11–12 provide the user manual, conclusions and future enhancements. References identify the theoretical sources and retained project evidence.')

exec((OUT/'novelty_section.py').read_text(encoding='utf-8-sig'))

chapter('Contents')
toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc',fontName='TNR',fontSize=10.5,leading=15,spaceBefore=5,textColor=colors.black)]
story.append(toc)

chapter('1 Introduction and Problem Statement')
h('1.1 Practical problem')
p('Operating systems teaching frequently separates scheduling calculations, paging exercises and deadlock matrices from the behavior visible in a running application. Students can compute a safe sequence without seeing how assumptions about resource release affect a real long-running service. Similarly, a user observing a slow local AI workload may see high GPU-memory usage without knowing whether the symptom is intentional CPU offload, memory pressure, or a reproducible performance failure. These are related problems of observability and explanation, but they require different evidence.')
p('The project addresses both through a shared desktop: an inspectable simulation for fundamental concepts and a native telemetry path for GPU-memory experiments. The simulator makes state transitions visible and controllable. SpillGuard supplies observations from the actual host and experimental records whose workload, pressure schedule and recovery can be inspected. The problem statement is therefore to build a modular operating systems laboratory that demonstrates core algorithms and supports evidence-based diagnosis of local GPU-memory performance problems. [1, 3–8]')
h('1.2 Objectives')
table('Project objectives and acceptance evidence',['ID','Objective','Acceptance evidence'],[
('O1','Expose process state and two-core dispatch','Executable process table, affinity controls and Gantt history'),
('O2','Implement memory and resource algorithms','Frame allocation, LRU/FIFO/CLOCK, Banker safety and wait-for cycles'),
('O3','Demonstrate storage and shell operations','VFS operations, simulated crash recovery and shell commands'),
('O4','Connect OS concepts to measured host behavior','Collector, replay, fit estimation and admission explanations'),
('O5','Support reproducible evaluation','Matched trials, tri-state verdicts, manifests and retained controls'),
('O6','Deliver a demonstrable modular application','Passing software checks, operating manual and feature walkthrough')],[.10,.43,.47])
h('1.3 Scope and boundaries')
p('The implemented platform is a React application with a TypeScript simulation kernel and a Python Windows agent. CPU cores, processes, privilege rings, page faults and storage crashes inside the browser are simulated. The native agent observes the Windows host and starts only its own bounded experimental helpers. The project does not replace Windows, implement a bootloader, provide a hardware memory-protection boundary, or load Linux eBPF programs.')
p('The project integrates algorithm visualization, native GPU-memory observation and controlled performance experiments. Its distinctive feature is the connection between inspectable OS concepts and a recorded real-application slowdown. Scheduling, Banker safety and delta debugging remain established algorithms; the empirical claim concerns the measured local workload and the interventions evaluated here.')

chapter('2 Background and Related Work')
p('The conceptual organization follows virtualization, concurrency and persistence [1]. Processes expose CPU allocation, frame and resource models expose capacity constraints, and inodes illustrate naming and storage. Intermediate states remain visible to the learner.')
h('2.1 Teaching systems and algorithm simulators')
p('MIT xv6 is a complete teaching operating system with a real kernel [2]. Aethor OS runs inside a browser and prioritizes visualization and rapid demonstration. A simulator exposes queues and matrices with little setup; xv6 provides actual traps, page tables, system calls and kernel concurrency. No controlled learning comparison was performed.')
h('2.2 Native GPU-memory observation')
p('DXGI distinguishes an application budget from its current usage and describes penalties from exceeding that budget [3]. NVIDIA documents system-memory fallback when GPU memory is exhausted [4]. SpillGuard distinguishes physical capacity, observer budget, committed memory and shared counters. These observations indicate allocation and pressure rather than tracing every page migration.')
h('2.3 Reduction and experimental diagnosis')
p('Delta debugging isolates failure-inducing circumstances by testing smaller inputs [5]. SpillGuard Repro searches action deletion, allocation size, duration and overlap within explicit budgets. Reduction is established prior art. The phase-aware variant preserves measured proxy signatures; preservation of a verified residency mechanism remains unestablished. [10, 12]')
table('Relationship to relevant approaches',['Approach','Established role','Role in this project'],[
('Operating systems textbook and exercises [1]','Explain policies and invariants','Algorithm background and learning vocabulary'),
('xv6 [2]','Study a working teaching kernel','Boundary reference for real kernel versus simulation'),
('DXGI and vendor memory guidance [3, 4]','Describe memory budgets and fallback','Interpretation of host telemetry'),
('Delta debugging [5]','Reduce a failing input through experiments','Baseline for action-level scenario reduction'),
('Retained project experiments [8–11]','Local measurements and engineering records','Evidence for scoped performance conclusions')],[.32,.34,.34])
h('2.4 Distinctive integration')
p('The integration links simulated scheduling, paging and resource-allocation decisions with native memory observations and controlled experiments in one interface. Offline replay makes recorded host behavior available on a lab computer without compatible GPU hardware. Diagnostic accuracy, reducer efficiency and educational effectiveness remain separate evaluation questions; the present results establish the local behavior reported in Chapter 10.')

chapter('3 Requirements and Development Methodology')
h('3.1 Functional requirements')
table('Functional requirements and implementation routes',['Requirement','Implementation','Observable output'],[
('FR1 Process creation and termination','Kernel.ts and useKernelStore.ts','PID, state, burst, priority, affinity'),
('FR2 Scheduling and two-core execution','Scheduler.ts and Kernel.step','Per-core Gantt and utilization'),
('FR3 Frame allocation and replacement','MemoryManager.ts','Frame ownership and fault count'),
('FR4 Resource safety and deadlock','BankersAlgorithm.ts; DeadlockEngine.ts','Safe sequence or wait-for cycle'),
('FR5 Shell and virtual storage','TerminalApp.tsx; VFS.ts','Built-in commands, inodes and journal'),
('FR6 Event observability','Kernel probes and BPFStudioApp.tsx','Hook counts and bounded events'),
('FR7 Host telemetry and replay','collector.py; HostBridge; useSpillStore','Live or recorded process memory frames'),
('FR8 Advice and evidence inspection','gguf_fit.py; bankers.py; ReproPanel','Fit verdict, report and trial outcomes')],[.32,.36,.32])
h('3.2 Quality requirements')
p('Quality requirements are inspectable intermediate state, explicit simulation boundaries, bounded histories, predictable replay and conservative error classification. The teaching path runs independently of optional host services. Native experiments retain invalid trials and missing blocks, while the local service checks its session token and loopback origin. Security checks implement the intended local access model; comprehensive security auditing is outside this evaluation.')
h('3.3 Methodology')
p('Development proceeds through five stages: define the typed data structures and algorithm modules; coordinate discrete execution ticks; expose state and controls through the desktop; integrate the native telemetry and replay path; and evaluate unchanged workloads with controlled pressure and recovery. Separate simulation and host-state stores maintain the boundary between educational examples and hardware observations.')
p('Verification separates algorithm assertions, application build checks and hardware experiments. Unit tests check specified software behavior; compilation checks type consistency and packaging. The dated experiment records support the performance conclusions in Chapter 10, including negative controls and inconclusive attempts.')

h('3.4 Tools and implementation responsibility')
p('The frontend uses TypeScript, React 18 and Vite; Zustand manages shared state, react-rnd provides window geometry, and Tailwind CSS supplies styling. The native component uses Python 3.12, FastAPI and uvicorn, with pywin32, ctypes, NVML bindings, psutil and httpx for collection and integration. GGUF metadata supports model estimation. Vitest and pytest provide automated tests, while Git records source history. Varad Patil is responsible for the individual project implementation and demonstration. [6, 7]')

chapter('4 System Architecture')
figure(Diagram('architecture',270),'Layered architecture and the boundary between simulation and host observation')
h('4.1 Presentation and state')
p('The desktop imports 18 registered window applications. Window state records position, size, z-index and open, minimized and maximized flags. The frame component supplies dragging and resizing, while the window store clamps its vertical position below the menu. The active-user and boot screens are presentation features rather than host authentication. Supporting music, calculator, messages, community and companion features enrich the desktop experience but do not implement native operating systems services. [6, 7]')
p('useKernelStore publishes process arrays, frame state, per-core execution histories, VFS metadata, probes, fault information and statistics after kernel updates. useSpillStore separately stores the latest host frame, a 300-frame history, events, replay controls and observed memory peaks. This separation prevents simulation PIDs and logical ticks from being mistaken for Windows processes and wall-clock measurements.')
h('4.2 Host data path')
p('The Python collector obtains per-process and adapter counters, the analyzer annotates samples, and the runtime records and publishes them through FastAPI. HostBridge owns WebSocket and replay behavior in a Web Worker, keeping transport and JSONL processing off the main rendering path. The same frame schema supports online inspection and offline demonstration. The browser replay path consumes analyzed traces; raw samples must first pass through the analyzer. [7, 8]')
h('4.3 Persistence model')
p('No relational database is required by the implemented design. The simulator VFS and execution histories are in-memory structures. Native traces use JSONL; research recipes, reports and manifests use JSON; metadata and calibration use structured files. A downloaded disk snapshot is an export, not automatic VFS persistence across sessions. The session token is retained in browser session storage for reconnection. These storage mechanisms have distinct lifetimes and should not be described as one persistent database.')

chapter('5 Operating Systems Algorithms')
h('5.1 Process lifecycle and dispatch')
p('A process control block (PCB) records each simulated process and its PID, name, READY/RUNNING/WAITING/TERMINATED state, priority, burst, remaining ticks, arrival and first-run ticks, completion, waiting time, memory demand, frame IDs, locks and core affinity. PIDs start at 100. The kernel bootstraps four model processes. Its default wall-clock interval is 800 ms, but the logical step method can be exercised directly by tests. Each tick permits at most one process on each of two model cores. [6]')
figure(Diagram('dispatch',273),'One kernel tick and two-core process selection')
p('At the start of a tick, previously RUNNING processes return to READY. Scheduler synchronization removes stale entries and inserts eligible processes into queues. Idle-core work stealing considers the other queue only when it contains more than one task, scanning its tail and respecting affinity. The second selection excludes the PID chosen for the first core. Execution consumes one burst tick, updates first response and completion fields, touches allocated frames and publishes a bounded Gantt history.')
h('5.2 Scheduling policies and actual semantics')
table('Scheduling policies in the current dispatcher',['Policy','Selection rule','Important boundary'],[
('FCFS','Earliest arrival among eligible core candidates','Selection is reconsidered every tick'),
('SJF','Smallest total burst among candidates','No separate running-process retention rule'),
('SRTF','Smallest remaining burst','Tick-level preemption is modeled'),
('PRIORITY','Lowest priority number, then arrival','Priority is constrained to 1–5 on spawn'),
('ROUND_ROBIN','Core queue head until quantum rotation','Default quantum is four ticks'),
('MLFQ','Core queue order with level-dependent rotation','Quanta 4/8/16; boost every 40 ticks; core selection does not sort by queue level')],[.20,.39,.41])
p('FCFS means first-come, first-served; SJF, shortest job first; SRTF, shortest remaining time first; and MLFQ, multilevel feedback queue. The integrated multicore MLFQ dispatcher uses core-queue order with level-dependent quanta; the legacy single-core method checks queue levels in priority order. FCFS and SJF are also reconsidered each tick. The current model therefore demonstrates these policies through simplified multicore selection; strict textbook MLFQ priority and non-preemptive retention require additional rules.')
h('5.3 Time accounting')
p('Waiting ticks increase for READY processes that are not selected. Response time is firstRunTick minus arrivalTick, and turnaround is completionTick minus arrivalTick. Because step increments the clock before first dispatch, a process created at tick zero and first run on the first step records response one. This convention must be preserved when comparing hand calculations with exported fields.')
p('CPU utilization is accumulated busy core-ticks divided by total available core-ticks. The reported throughput multiplies completed-process count per logical tick by 100, so it is interpreted as completions per 100 ticks. It is not host CPU utilization or processes per second. Killed processes enter the terminated population without all normal completion metrics, so averages that mix killed and normally completed processes require care.')
h('5.4 Memory allocation and replacement')
p('MemoryManager creates 32 physical frame records by default. Each page occupies four kibibytes (KiB), so a process needs ceil(memorySizeKB / 4) frames and modeled physical capacity is 128 KiB. Free frames are assigned first. For a deficit, the fault counter increases by the additional pages needed and occupied frames may be evicted. Least recently used (LRU) orders victims by last access tick; first in, first out (FIFO) orders them by load tick. CLOCK gives referenced frames a second chance through a moving hand.')
p('This is an allocation and replacement model, not an instruction-level demand-paging engine. There is no complete virtual-page reference stream, TLB, swap-device latency or page-table fault handler. The optional OPTIMAL label falls back to LRU because future references are not available. Frame records and process allocation lists also need stronger ownership invariants under eviction; the current touch path indexes frames from a process list without revalidating the owning PID. A failed allocation may leave partial assignments, and the spawn path does not reject the new process based on the allocation result.')
p('The privilege demonstration reserves logical addresses 0x0000–0x3FFF for kernel space and allows user-space addresses through 0xFFFF. A simulated Ring 3 violation creates a register dump and places the process in WAITING. The 64 KiB logical address range and the 128 KiB frame pool are separate teaching abstractions rather than a validated coherent hardware address-translation system.')
h('5.5 Resource allocation safety')
p('The Banker module computes Need as Maximum minus Allocation, copies Available into Work, and finds unfinished processes whose Need does not exceed Work in any resource dimension. Simulated completion adds each process allocation back to Work. A complete sequence establishes safety under the declared claims and completion assumptions. An unsafe result means no complete safe sequence was found; it does not itself prove an existing deadlock. The function validates matrix dimensions but requires callers to supply non-negative, consistent claims with Maximum at least Allocation. [6]')
table('Worked Banker safety example',['Process','Allocation A B','Maximum A B','Need A B'],[
('P0','1  0','2  1','1  1'),('P1','0  1','1  2','1  1')],[.19,.27,.27,.27])
p('For Available = (1, 1), P0 can complete, producing Work = (2, 1); P1 can then complete, producing Work = (2, 2). The sequence P0, P1 is safe. This is a worked illustrative input, not a hardware measurement. Its purpose is to show how each allocation is returned only when completion is permitted.')
h('5.6 Wait-for deadlock detection')
figure(Diagram('deadlock',225),'Injected circular wait between two simulated mutex holders')
p('DeadlockEngine builds waiter-to-holder edges from locksHeld and waitingFor, then runs depth-first search with a recursion stack to find a cycle. It reports the first detected cycle. The injected two-mutex case is a suitable single-instance demonstration. General multi-instance resource deadlock detection would require counts and a resource-allocation analysis beyond the current graph model; the separate Banker module addresses declared maximum claims rather than converting every graph cycle into a universal deadlock result.')

chapter('6 Storage Shell and Observability')
h('6.1 Virtual file system')
p('VFS represents files and directories as inode records containing an inode number, name, type, size, permissions, parent ID and content. It initializes root, user and etc directories, plus sample files. Current-directory traversal supports named child directories, parent traversal, root and home shortcuts. File creation, directory creation and removal check the mounted flag and same-directory name collisions. The permission string is displayed metadata rather than an enforced host access-control policy. [6]')
figure(Diagram('wal',237),'Journal states and the implemented simulated crash-recovery path')
p('Normal updates move through PENDING, COMMITTED and CHECKPOINTED states in one synchronous operation. triggerPowerCut marks the superblock dirty, unmounts the model and appends a pending torn-write entry. recoverFSCK removes pending entries, marks committed entries checkpointed and remounts. It does not reconstruct a durable inode table from block storage or generally reapply operation payloads. The exercise demonstrates transaction states and rollback reasoning, not validated disk crash consistency.')
p('The journal is bounded at 25 entries. Removing a node filters the node and its immediate children, so arbitrary-depth recursive deletion is not fully implemented. Some file sizes are display approximations rather than encoded-byte counts. These boundaries matter when presenting the VFS as an educational model and when choosing future tests.')
h('6.2 Shell interface')
p('aethersh routes built-in commands to the simulation store and SpillGuard views. Process commands include ps, run, kill, sched, quantum and affinity. Memory and diagnostic commands include memstat, gpf and bpf. Storage commands include ls, pwd, cd, cat, touch, mkdir, rm, powercut and fsck. SpillGuard commands expose status, explanations, events, a fit request and demo replay. The shell does not parse general Unix pipelines, execute arbitrary host binaries or implement POSIX job control.')
h('6.3 Event probes')
p('The kernel provides hook categories and named probes with enabled flags, event counts and map outputs. emitBPFEvent appends to a bounded event list and increments matching probe maps. The stored filterScript describes the requested probe but is not an executed eBPF program or an arbitrary filter interpreter. The studio is therefore an eBPF-inspired observability model. Simulator page-fault events include memory mapping and injected GPF notifications; their event counts are not identical to MemoryManager.totalPageFaults.')
h('6.4 Application module inventory')
table('Registered desktop applications and responsibilities',['Module','Role'],[
('Task Manager','Spawn, terminate and inspect processes; schedule and affinity controls'),
('Memory Map','Physical-frame view and host GPU-memory twin view'),
('Deadlock Lab','Banker matrix, wait-for graph and live/replay VRAM admission'),
('Terminal','Built-in simulation and SpillGuard command interface'),
('Finder and Trash','Virtual inode browsing and desktop deletion presentation'),
('Kernel Monitor and Test Runner','Statistics, fault dumps, audit journal, tests and snapshot export'),
('eBPF Studio and KernelQuest','Event probes and guided learning scenarios'),
('SpillGuard','Live/replay memory, fit advice and research evidence desk'),
('About, Settings, Internet','Project information, visual settings and simulated browser'),
('Music, Calculator, Messages, Community','Supporting desktop interactions; application-level behavior')],[.36,.64])

chapter('7 SpillGuard Native Implementation')
h('7.1 Collector and observation semantics')
p('The collector enumerates Windows Performance Data Helper (PDH) counter instances, extracts process identifiers and locally unique adapter identifiers (LUIDs), and aggregates one selected adapter. DirectX Graphics Infrastructure (DXGI) supplies capacity and the calling observer budget; NVIDIA Management Library (NVML) can supply device totals. psutil supplies process and host-memory information, and Ollama polling identifies framework-reported model allocation. Missing optional sources remain unavailable rather than fabricated. Process creation time distinguishes a reused PID from the original process. [7, 8]')
p('Fields ending in _mb use mebibytes (MiB), where one MiB is 1,048,576 bytes. PDH dedicated usage, shared usage and committed usage measure different quantities. Dedicated usage concerns the local GPU-memory segment, shared usage concerns system-memory-backed GPU allocations, and committed usage describes committed demand. These counters do not expose each page migration; shared usage alone cannot establish a severe slowdown.')
h('7.2 Detector and classifier')
figure(Diagram('detector',250),'Memory-pressure detector with entry and exit hysteresis')
p('The detector computes adapter load as dedicated usage divided by physical VRAM. Defaults are a high threshold of 0.92, low threshold of 0.85, shared excess of more than 128 MiB, two consecutive entry hits and three clear samples for exit. A process baseline is the minimum shared usage observed during its retained unpressured history; initial observation is a fallback when no such history exists. Shared excess and recent growth support entry. Hysteresis reduces transitions caused by a single fluctuating sample.')
p('The analyzer distinguishes framework-reported CPU offload (A), its memory-spill heuristic (B), and host RAM pressure (C). Combined B+C events indicate overlapping conditions. Culprit ranking selects the process with the greatest dedicated-memory growth in the preceding window, using held memory as a tie-breaker. This is an explanation heuristic, not proof that the selected process caused a paging mechanism. [8]')
h('7.3 Fit estimation')
p('The estimator decomposes the GPU footprint into weights, the key–value (KV) cache, compute buffers and runtime overhead. GGUF, the model file format used by the supported local inference workflow, supplies tensor metadata for layer and auxiliary weights. KV demand depends on GPU layers, context length, KV heads, head dimensions, element format and parallel sequences. The implementation handles f16 and quantized KV formats and relevant vision weights and buffers. Machine-specific calibration is stored in agent/calibration.json. [7, 8]')
p('For an architecture with equal key and value head dimensions, the explanatory relationship is KV bytes = 2 × GPU layers × context tokens × KV heads × head dimension × bytes per element × parallel sequences. The actual implementation uses available model metadata. This estimate is advisory: it does not reserve host VRAM or prevent a competing process from allocating after the check.')
h('7.4 Admission for long-lived processes')
p('The native Banker-style model tracks VRAM and commit resources. Long-lived jobs reserve their remaining maximum claim up front, because a browser or service cannot be assumed to finish and release its allocation during a new launch. The classic search then applies to finite jobs. The browser comparison uses a single VRAM resource with a 256 MiB margin and observed peak multiplier 1.1. It shows how a textbook safe sequence and a long-lived reservation can disagree.')
p('The adviser searches configurations such as context length, KV type, flash attention and offloaded layers. A FIXABLE result means a modeled configuration meets its checks; it is not an externally enforced guarantee. Maximum demand inferred from past peaks can underestimate future demand, and a prelaunch check can become stale. The native launch workflow is CLI-only and requests interactive confirmation; the dashboard API provides observation and advice.')
h('7.5 Transport and local service boundary')
p('FastAPI checks the Host and Origin headers and compares a session token for protected HTTP and WebSocket paths. The served page receives the token through a URL fragment and removes it from the address bar after reading it. WebSocket messages then carry the analyzed frames. A bounded queue drops the oldest pending frame for a slow client instead of growing without limit. These checks support the intended loopback workflow; they do not imply protection against arbitrary local code or a compromised browser context.')

chapter('8 Experimental Framework and Evaluation Method')
h('8.1 Research questions')
table('Research questions and current evidence',['Question','Evidence available','Status'],[
('RQ1 Can controlled memory pressure reproduce a real application slowdown?','October 18 dose response and fresh witness validation','Supported locally for one fixed Qwen2.5 workload'),
('RQ2 Can smaller scenarios preserve the relevant failure?','Plain and phase-aware reducer code; software fixtures','Implemented; live-witness reduction benefit not established'),
('RQ3 Can an owned intervention restore target performance without changing work?','Five remedy conditions with matched trials','Supported in the saved one-machine pilot'),
('RQ4 Do counter alerts identify harmful pressure reliably?','Nine valid dose/idle trials and retained W1 traces','Scope-dependent; harmfulness cannot be inferred from counters alone')],[.39,.36,.25])
h('8.2 Matched trial protocol')
figure(Diagram('protocol',240),'Baseline–pressure–recovery protocol and conservative verdicts')
p('A recipe freezes the target, number of work units, protocol bounds, repetitions, preparation mode and pressure actions. An action defines allocated bytes, timing, duration and touch interval. Fixed baseline, pressure and recovery stages run in order. A pressure manipulation must be observed while the target executes. For inference, model identity, context, prompt, generated output and thinking hashes are checked; partial CPU offload or changed work makes the result inconclusive. [9, 10, 12]')
p('The primary inference metric is server-reported decode milliseconds per token. The slowdown ratio is pressure metric divided by baseline metric; recovery is recovery metric divided by baseline metric. FAIL means the declared slowdown threshold was reproduced after the validity and recovery checks. PASS means a valid trial remained below that threshold. An error, missing observation, changed environment, guard stop or mixed repeated outcomes remains INCONCLUSIVE. FAIL is therefore the experimental target outcome, not a failing software unit test.')
h('8.3 Evidence bundles and bounded execution')
p('The runner stores a recipe, report, readable summary, stage observations, helper events, errors and a SHA-256 manifest. Bundle verification checks paths, expected files and hashes. A hash manifest detects changes relative to the recorded manifest; it is not an authenticity signature. Local evidence may include process names and paths, so publication exports require review. The browser evidence desk parses a report but does not itself verify the complete bundle manifest.')
p('Only owned experiment helpers may be stopped. Host-memory floors and commit limits abort unsafe or confounded runs, and cleanup failures invalidate the stage. Default protocol limits and the October 18 pilot settings differ; the report identifies the actual pilot rather than presenting one universal configuration. No new pressure-generating hardware experiment was run during preparation of this report; empirical numbers come from retained records.')
h('8.4 Scenario reduction')
p('The plain baseline attempts action deletion while accepting only reproduced failures. The extended search supports phase-aware, greedy, ddmin, ProbDD-style, no-reduction and tiny exhaustive methods, with explicit candidate and execution budgets. Fresh validation is reserved separately from search. The phase-aware method compares observed proxy signatures and can reject a mechanism-class switch, but those signatures are not direct residency ground truth. A locally minimal result under specified transforms is not a global minimum, and fixture success is not empirical superiority on the real witness.')

chapter('9 Software Testing and Error Handling')
h('9.1 Software verification results')
p('Software verification on 22 October 2026 completed 66 frontend tests in 12 files and 149 Python agent tests. TypeScript compilation and the Vite production build succeeded, transforming 1,544 modules. These results validate the recorded software assertions and build process. Hardware performance results are evaluated separately using the retained matched trials. [13]')
table('Current automated verification results',['Check','Command or location','Observed result'],[
('Frontend suite','npm test -- --run','66 passed; 12 test files'),
('Production build','npm run build','TypeScript and Vite succeeded'),
('Agent suite','From agent: .venv/Scripts/python.exe -m pytest -q --basetemp <new writable directory>','149 passed'),
('Build output','dist/assets index JS; CSS; worker','474.19 kB JS; 64.80 kB CSS; 2.37 kB worker, before gzip')],[.23,.51,.26])
p('The agent tests run from the agent directory so pytest resolves the local spillguard package and configuration. The successful verification used a new writable temporary directory through --basetemp. No production-source modification was required to complete the checks.')
h('9.2 Representative test cases')
table('Representative executable test cases and results',['ID','Input or trigger','Expected behavior','Result'],[
('T1','RR, quantum 2; A/B/C pinned to core 0','First eight names A A B B C C A A','Passed'),
('T2','One process with burst 5','Runs for five ticks and terminates','Passed'),
('T3','MLFQ two runnable processes','Initial level-0 quantum then rotation','Passed'),
('T4','Memory and replacement scenarios','Expected allocation/replacement assertions','4 tests passed'),
('T5','Well-formed Banker scenarios','Need and safe/unsafe outcomes','4 tests passed'),
('T6','Wait-for graph scenarios','Cycle and non-cycle classification','3 tests passed'),
('T7','VFS operations and recovery','Directory/file and journal expectations','3 tests passed'),
('T8','Spill admission fixtures','Classic and long-lived verdicts','3 tests passed'),
('T9','Research report and replay fixtures','Schema validation and bundled data parsing','Frontend suites passed'),
('T10','Recipe, evidence and cleanup failures','Conservative verdicts and bundle integrity','Agent suites passed')],[.08,.33,.42,.17])
p('The test suites cover their stated assertions; they do not remove the documented scheduler, memory-ownership, VFS-persistence and validation limitations. The interface screenshot in Chapter 10 records an earlier evidence-desk checkpoint. Current GUI interaction and live hardware operation should be evaluated separately from unit-test success.')
h('9.3 Error-handling design')
table('Error conditions and implemented responses',['Condition','Response','User or evidence effect'],[
('Wrong service token','HTTP 401; WebSocket closes with 4401','Reconnect using the current agent session link'),
('Unapproved Host or Origin','HTTP or handshake rejection','Prevents cross-origin use in intended local model'),
('Disconnected WebSocket','Bounded increasing retry delay','Visible connection state'),
('Raw or malformed replay trace','Worker reports an error','Analyze raw trace or choose valid JSONL'),
('Malformed research report','Schema and size checks reject it','Visible import failure'),
('Host-memory or commit guard','Stop trial and retain record','INCONCLUSIVE rather than a false result'),
('Changed workload or failed recovery','Invalidate matched trial','Failure is not attributed to the manipulation'),
('Bundle tampering or unsafe manifest path','Verification raises an error','Do not rely on the altered bundle'),
('Unmounted VFS','Reject normal file operations','Run simulated fsck to remount')],[.30,.35,.35])
h('9.4 Additional regression priorities')
p('Future tests should add integrated policy traces for strict non-preemptive FCFS/SJF, MLFQ priority across core queues, affinity changes after enqueue, eviction ownership consistency, rejected oversized allocation rollback, nested-directory deletion and actual committed-operation redo. UI accessibility and full browser workflows need separate validation. These are identified improvement areas, not fabricated failing test results.')

chapter('10 Results Performance and Discussion')
h('10.1 Hardware and workload context')
table('Environment recorded for the October 18 pilot',['Component','Recorded configuration'],[
('GPU','NVIDIA GeForce RTX 3050 6 GB Laptop GPU; recorded physical capacity 6,002 MiB'),
('Operating system and driver','Windows 11 build 26200; NVIDIA 581.83'),
('CPU and RAM','AMD Ryzen 7 7840HS; 16 logical threads; 16 GB system RAM'),
('Inference runtime','Private Ollama 0.34.4 server; qwen2.5:3b-instruct'),
('Frozen work','Context 2,048; 128 generated tokens; temperature zero; fixed prompt'),
('Pressure process','Owned CUDA holder; active touch interval 250 ms'),
('Design','Two matched trials per active dose level; baseline, pressure and recovery')],[.30,.70])
p('The recorded capacity is a counter-derived MiB value, while the product name says 6 GB. The dose recipe estimates capacity headroom from physical capacity minus desktop residency and target footprint, then adds a planned overflow. Planned overflow is an experimental setting, not a direct measurement of bytes currently resident outside VRAM. [9, 11]')
h('10.2 Dose response')
dose=json.loads((ROOT/'traces/repro/20261018-dose-response/summary.json').read_text())
rows=[]
for l in dose['levels']:
    ts=l['trials'];rows.append((str(l['planned_overflow_mib']),str(l['holder_mib']), ' / '.join(f"{t['baseline']['ms_per_token']:.2f}" for t in ts),' / '.join(f"{t['pressure']['ms_per_token']:.2f}" for t in ts),' / '.join(f"{t['verdict']['slowdown']:.2f}" for t in ts),' / '.join(t['verdict']['outcome'] for t in ts)))
table('Active co-tenant dose response with individual trials',['Overflow MiB','Holder MiB','Baseline ms/token','Pressure ms/token','Ratio','Verdict'],rows,[.13,.13,.20,.20,.16,.18])
figure(DosePlot(dose),'Recorded performance cliff near the planned capacity boundary')
p('The two below-capacity controls were approximately 1.15–1.17 times baseline. At capacity, ratios were approximately 1.20–1.22. At +256 MiB, they rose to 2.35–2.37; +512 MiB produced 2.28–2.38. The response therefore shows a local cliff followed by a plateau over the tested levels, rather than a linear relation between requested overflow and slowdown. These are descriptive pilot observations with only two trials per level; no statistical-significance or population-generalization claim follows.')
h('10.3 Activity intervention and detector limitations')
p('The retained analysis compares an active +256 MiB holder with an idle holder that allocated and touched once. The reported process and adapter memory counters were the same at the displayed resolution: the target held 2,033 MiB dedicated and 388 MiB shared, and the adapter was near its recorded ceiling. The active case slowed approximately 2.37 times, while the valid idle case was approximately 1.03 times baseline. Two other idle attempts were stopped by the host-commit guard and remain inconclusive. [9]')
p('Across nine valid dose/idle trials, the original counter detector alerted on all four severe failures and on three of five non-failures: trial-level recall 4/4 and precision 4/7. This does not contradict its earlier W1 pressure-detection results; the labels and target question differ. Detecting shared-memory growth is not equivalent to detecting harmful slowdown. An active holder also introduces bandwidth and compute interference. Repeated page migration remains a hypothesis pending validated residency-event evidence.')
h('10.4 Remedy evaluation')
table('Recorded interventions on the +256 MiB witness',['Intervention','Holder remaining MiB','Individual ratios','Outcome'],[
('Fresh original witness','3,709','2.35 / 2.34','FAIL / FAIL'),
('Release entire owned holder','0','1.02 / 1.00','PASS / PASS'),
('Serialize background after target','0 during target','1.00 / 1.00','PASS / PASS'),
('Release half the held bytes','1,854','1.10 / 1.10','PASS / PASS'),
('Release one eighth','3,245','1.19 / 1.20','PASS / PASS'),
('Pause activity and keep allocation','3,709','1.01 / 1.01','PASS / PASS')],[.42,.18,.21,.19])
p('The evidence summary reports six reproduced active witness trials across the initial doses and fresh validation, with ratios 2.28–2.38. Pausing activity while keeping the allocation restores the target near baseline in the retained two-trial remedy condition. Serialization also finishes the owned background work after the target. These outcomes support an owned-workload mitigation workflow; they do not authorize or validate automatically pausing unrelated third-party applications.')
h('10.5 Earlier calibration and synthetic results')
table('Earlier evaluation and its scope',['Experiment','Recorded result','Interpretation'],[
('W1 block-write bandwidth, n = 3','Resident 163.3 ± 0.1 GB/s; slow blocks 13.2 ± 0.0 GB/s','About 12.4 times bandwidth difference in this synthetic test'),
('W1 detector, 3 spill and 2 near-full controls','3/3 detected; zero alerts on two negative runs; latency 0.95 ± 0.03 s','Small historical trace set, not ordinary-session accuracy'),
('Fit estimator, 9 full-offload configurations','Leave-one-out MAE 46 MiB; maximum 93 MiB','Local calibration; related configurations are not independent machines'),
('Ollama size_vram comparison','Mean absolute difference 902 MiB','Comparison to measured runner footprint in that calibration'),
('Original agent overhead, five runs','2.3 ± 0.3% of one core; approximately 52 MiB RSS','About 0.14% of 16-thread aggregate CPU; not full framework overhead')],[.32,.38,.30])
p('The ± values are means and standard deviations retained from the earlier evaluation, not confidence intervals. The slow-block standard deviation rounds to 0.0 at the displayed precision. Mean absolute error (MAE) is the average absolute prediction difference; leave-one-out validation fits the estimator with each configuration omitted in turn. RSS is resident set size. The original 1 Hz agent overhead does not include every later experiment-orchestration cost. [8, 10, 11]')
h('10.6 Interface evidence')
src=ROOT/'artifacts/spillguard-repro/evidence-desk-final.jpg'
im=PILImage.open(src).convert('L');mono=im.point(lambda x:255 if x>152 else 0,mode='1');mono.save(QA/'evidence-desk-monochrome.png')
figure(Image(str(QA/'evidence-desk-monochrome.png'),width=CW,height=CW*im.height/im.width),'Retained October 16–17 evidence-desk screenshot rendered in black and white')
p('This retained interface checkpoint displays a valid native CUDA negative control and relative-time replay. It is included to document the evidence-inspection implementation. It does not depict the October 18 positive inference witness. The current research library contains separately labeled dose-response, remedy, earlier analysis, fixture and replay inputs, avoiding presentation of a fixture as a hardware result.')
h('10.7 Threats to validity')
p('External validity is limited by one laptop, one GPU vendor and driver, one validated real inference target, a synthetic owned co-tenant, and a small sample. Internal validity is limited by fixed baseline–pressure–recovery order, warm/cold preparation effects, and unmeasured temperature, clocks and fine-grained residency behavior. The idle intervention helps isolate holder activity but does not by itself establish a page-migration mechanism. Construct validity requires care because counter pressure, bandwidth proxies and severe application slowdown use different labels.')
p('The results establish executable software and a one-machine performance witness. Generalization is limited by the absence of an external reproduction, a completed multi-machine campaign, a user study and a validated reduction advantage on the real witness. These limits constrain the interpretation of the measured slowdown and the scope of future claims.')

chapter('11 User Manual and Demonstration Procedure')
h('11.1 Browser-only startup')
code('npm install\nnpm run dev')
p('Open http://localhost:3000. Complete the presentation boot/login flow and enter the desktop. On a machine using an existing dependency installation, the start command can be run directly. For a production package, run npm run build and npm run preview. The preview command reports its actual URL. The browser-only path demonstrates the simulator and replay without the native agent.')
h('11.2 Scheduling demonstration')
p('Open Task Manager and pause the clock. Terminate any existing simulated processes to isolate the example. Select Round Robin, set quantum to two, and create A, B and C in that order, each with a burst of at least six ticks and Core 0 Only affinity. Set a slow clock speed, resume and inspect the first six new Gantt entries: A A B B C C. Existing Gantt entries precede this example. The interface has pause and resume controls; exact tick-by-tick sequences are also checked by the dispatcher tests. These actions affect simulated processes, not Windows processes.')
h('11.3 Memory and deadlock demonstration')
p('Open Memory Map and inspect the 32-frame pool. Spawn processes until allocation requires replacement, then compare LRU, FIFO and CLOCK using controlled inputs. Explain that this view models allocations rather than a complete demand-paging trace. In Deadlock Lab, run a well-formed Banker scenario and read the Need matrix and safe-sequence steps. Trigger the injected circular wait and inspect the two-process graph. Keep the multi-instance safety example distinct from the single-instance wait-for cycle.')
h('11.4 Shell and virtual storage demonstration')
code('help\nps\nrun demo_worker 12\nsched ROUND_ROBIN\nquantum 2\nmemstat\nmkdir demo\ncd demo\ntouch sample.txt\nls\ncd ~\npowercut\nfsck')
p('Use the PID returned by run when demonstrating kill, affinity or gpf; do not assume a fixed PID. During the simulated power cut, show that file operations are unavailable. After fsck, inspect the pending-entry rollback and remount state. Explain the journal simulation boundary before describing recovery.')
h('11.5 Live native startup')
code('npm run build\ncd agent\n.venv/Scripts/python.exe -m spillguard serve')
p('If no environment exists, create a Python virtual environment and install agent/requirements.txt first. The retained project environment uses Python 3.12. The service prints a loopback URL containing the current session fragment; open that exact link, then launch SpillGuard. The default service port is 8765. A restarted agent uses a new token, so reopen the new printed link if the interface reports an expired session.')
h('11.6 Replay and research reports')
p('Open SpillGuard, choose Replay and load the demo trace. Use Play, speed and seek controls. An analyzed trace contains a header followed by frames with summary fields. Raw collector output must be processed with spillguard analyze before import. The evidence desk can open research JSON reports, including matched experiments and reductions. Report parsing is not equivalent to verifying the complete local evidence bundle.')
p('Load the measured dose-response entry to inspect individual outcomes. Explain PASS, FAIL and INCONCLUSIVE before presenting the chart. For the retained screenshot, identify it as an earlier negative-control checkpoint. Use Live only when the intended Windows agent and compatible hardware are available; Replay provides an alternative demonstration of recorded behavior.')
h('11.7 Reproduction and integrity commands')
code('agent/.venv/Scripts/python.exe bench/repro.py validate bench/recipes/cuda-smoke.json\nagent/.venv/Scripts/python.exe bench/repro.py verify <bundle-directory>')
p('Run the commands from the repository root, replacing the bracketed value with an existing evidence directory. A new experiment output directory must not already contain an earlier bundle. Live stress and inference commands require the prescribed model, hardware and sufficient host memory. Inspect the stored recipe, preparation mode and limits before attempting to reproduce the hardware pilot.')
h('11.8 Suggested final demonstration order')
table('Demonstration script with observable checkpoints',['Step','Demonstration','Evidence to explain'],[
('1','Desktop and scope boundary','Browser simulation versus native observation'),
('2','Process dispatch and RR quantum','Visible Gantt order and per-core state'),
('3','Memory and resource examples','Frame policy, safe sequence and wait-for cycle'),
('4','Shell and storage crash','Commands, journal states and remount'),
('5','Probes and verification','Event map, test results and export'),
('6','SpillGuard replay and dose response','Recorded work, ratios and detector limitations'),
('7','Remedy comparison and limitations','Unchanged target work, recovery and scoped conclusions')],[.10,.43,.47])

chapter('12 Conclusion and Future Enhancements')
p('Aethor OS implements a substantial operating systems laboratory through a browser simulator and a native GPU-memory observation and experimentation path. Its core demonstrable concepts include process management, scheduling, memory allocation and replacement, resource safety, wait-for analysis, virtual storage, shell programming and process monitoring. The separation between simulated state and measured host state allows these concepts to be taught together without pretending that a browser application is a hardware kernel.')
p('Current verification supports an executable implementation: 66 frontend tests, 149 agent tests and a successful production build. Retained hardware records add a more specific empirical result: controlled co-tenant pressure reproduced a severe local inference slowdown, and owned interventions restored performance while preserving target work. Similar counters in active and idle conditions show why an alert should be treated as a diagnostic lead rather than sufficient evidence of harmful residency behavior.')
p('Future work should first improve scheduler fidelity, frame ownership and persistent storage, then expand experimental coverage. Each enhancement below has a concrete validation criterion so that implemented functionality and demonstrated benefit remain distinguishable.')
table('Prioritized future work and validation criteria',['Priority','Enhancement','Validation criterion'],[
('1','Strengthen scheduler and frame-ownership invariants','Integrated traces and ownership checks cover documented edge cases'),
('2','Implement persistent VFS with operation-payload redo','Restart and crash-injection tests verify recoverable committed changes'),
('3','Validate actual residency events','A reproducible PIX/ETW interpretation supports the proposed mechanism'),
('4','Evaluate reduction on a real positive witness','Fresh validation and comparator budgets show retained failure and search cost'),
('5','Expand hardware and target coverage','Predeclared trials include more GPUs, drivers, models and controls'),
('6','Measure educational and usability outcomes','A declared study evaluates comprehension and diagnostic tasks'),
('7','Improve accessibility and end-to-end UI verification','Keyboard, viewport and live/replay flows pass documented checks')],[.10,.41,.49])
p('The completed project connects OS algorithm inspection with native GPU-memory diagnosis and a reproducible local inference experiment. Further instruction emulation, WebAssembly execution or distributed scheduling would extend its scope. The immediate priorities are stronger simulator invariants and broader validation of the existing experimental workflow.')

chapter('References')
refs=[
('[1]','R. H. Arpaci-Dusseau and A. C. Arpaci-Dusseau. Operating Systems Three Easy Pieces. Author-maintained online textbook. https://pages.cs.wisc.edu/~remzi/OSTEP/ . Accessed 22 October 2026.'),
('[2]','MIT PDOS. Xv6 a simple Unix-like teaching operating system. Official project and teaching resources. https://pdos.csail.mit.edu/6.828/xv6/ . Accessed 22 October 2026.'),
('[3]','Microsoft. DXGI_QUERY_VIDEO_MEMORY_INFO structure and IDXGIAdapter3 QueryVideoMemoryInfo. Microsoft Learn. https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_4/ns-dxgi1_4-dxgi_query_video_memory_info . Accessed 22 October 2026.'),
('[4]','NVIDIA. System Memory Fallback for Stable Diffusion. Support article 5490. https://nvidia.custhelp.com/app/answers/detail/a_id/5490 . Accessed 22 October 2026.'),
('[5]','A. Zeller and R. Hildebrandt. Simplifying and Isolating Failure-Inducing Input. IEEE Transactions on Software Engineering, 28(2), 183–200, 2002. Author publication record: https://www.st.cs.uni-saarland.de/papers/tse2002 . Accessed 22 October 2026.'),
('[6]','Aethor OS working source. src/kernel/Kernel.ts, Scheduler.ts, MemoryManager.ts, BankersAlgorithm.ts, DeadlockEngine.ts, VFS.ts and src/types/kernel.ts. Workspace inspected 22 October 2026.'),
('[7]','Aethor OS integration source. src/stores/, src/components/, src/spillguard/ and agent/spillguard/. Workspace inspected 22 October 2026.'),
('[8]','Project technical record. docs/SPILLGUARD.md; bench/results/w1_eval.json; bench/results/e3_summary.json; agent/calibration.json. Retained local evidence and calibration, inspected 22 October 2026.'),
('[9]','Project pilot analysis. docs/SPILLGUARD_REPRO_RESULTS_20261018.md. First reproduced witness, dose response, activity intervention and remedies, 18 October 2026.'),
('[10]','Project methodology and scope. docs/SPILLGUARD_REPRO.md; docs/SPILLGUARD_REPRO_OLLAMA.md; docs/research/2026-10-16-spillguard-opportunity/claim-evidence.md. Dated development records, interpreted with the later October 18 results.'),
('[11]','Project experiment records. traces/repro/20261018-dose-response/summary.json; traces/repro/20261018-remedy-plus256-r2/; public/research/01-demo-dose-response.json and index.json. Local measured records and curated presentation inputs.'),
('[12]','Project experiment implementation. agent/spillguard/repro/evidence.py, runner.py, spec.py, reducer.py, search.py, signature.py and workflows.py; bench/dose_response.py. Workspace inspected 22 October 2026.'),
('[13]','Verification observed during report preparation. Vitest: 66 passed in 12 files; Python agent: 149 passed; TypeScript and Vite build: successful. Commands and environment handling recorded in Chapter 9.'),
]
refs.extend(NOVELTY_REFERENCES)
for label,t in refs:story.append(KeepTogether([Paragraph('<b>'+label+'</b> '+escape(t),styles['small'])]))

pdf=OUT/'Aethor_OS_Project_Report.pdf'
doc=Report(str(pdf),pagesize=A4,leftMargin=M,rightMargin=M,topMargin=62,bottomMargin=53,title='Aethor OS Project Report',author='Varad Patil',pageCompression=1)
doc.addPageTemplates(PageTemplate(id='report',frames=[Frame(M,53,CW,H-115,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=page))
doc.multiBuild(story)
print(json.dumps({'pdf':str(pdf),'figures':FIGS,'tables':len(TABLES),'sections':sections},indent=2))

