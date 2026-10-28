from pathlib import Path
import re
root=Path(__file__).resolve().parents[2]
path=root/'output/project_report/build_report.py'
s=path.read_text(encoding='utf-8-sig')
# Keep the final report body; the guidelines do not mandate an unconditional appendix.
a=s.index("chapter('Appendix A")
b=s.index("pdf=OUT/'Aethor_OS_Project_Report.pdf'",a)
s=s[:a]+s[b:]
a=s.index('from pypdf import PdfWriter\n')
b=s.index("print(json.dumps",a)
s=s[:a]+s[b:]
a=s.index('# Cover and front matter')
b=s.index("chapter('Abstract')",a)
s=s[:a]+'''# Cover and front matter
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

'''+s[b:]
def para(prefix,new):
    global s
    pattern=r"^p\('"+re.escape(prefix)+r".*$"
    found=list(re.finditer(pattern,s,re.M))
    if len(found)!=1: raise ValueError((prefix,len(found)))
    s=s[:found[0].start()]+"p("+repr(new)+")"+s[found[0].end():]
para('Chapters 1', 'Chapters 1–3 establish the problem, objectives, background and methodology. Chapters 4–7 describe the architecture and implementation of the simulator and native agent. Chapters 8–10 present the experimental method, software tests, results and limitations. Chapters 11–12 provide the user manual, conclusions and future enhancements. References identify the theoretical sources and retained project evidence.')
para('The research contribution at this stage', 'The project integrates algorithm visualization, native GPU-memory observation and controlled performance experiments. Its distinctive feature is the connection between inspectable OS concepts and a recorded real-application slowdown. Scheduling, Banker safety and delta debugging remain established algorithms; the empirical claim concerns the measured local workload and the interventions evaluated here.')
para('The development method separates', 'Development proceeds through five stages: define the typed data structures and algorithm modules; coordinate discrete execution ticks; expose state and controls through the desktop; integrate the native telemetry and replay path; and evaluate unchanged workloads with controlled pressure and recovery. Separate simulation and host-state stores maintain the boundary between educational examples and hardware observations.')
para('Verification is layered:', 'Verification separates algorithm assertions, application build checks and hardware experiments. Unit tests check specified software behavior; compilation checks type consistency and packaging. The dated experiment records support the performance conclusions in Chapter 10, including negative controls and inconclusive attempts.')
needle="\nchapter('4 System Architecture')"
replacement='''
h('3.4 Tools and implementation responsibility')
p('The frontend uses TypeScript, React 18 and Vite; Zustand manages shared state, react-rnd provides window geometry, and Tailwind CSS supplies styling. The native component uses Python 3.12, FastAPI and uvicorn, with pywin32, ctypes, NVML bindings, psutil and httpx for collection and integration. GGUF metadata supports model estimation. Vitest and pytest provide automated tests, while Git records source history. Varad Patil is responsible for the individual project implementation and demonstration. [6, 7]')

chapter('4 System Architecture')'''
assert s.count(needle)==1
s=s.replace(needle,replacement)
para('The distinctive design combines', 'The integration links simulated scheduling, paging and resource-allocation decisions with native memory observations and controlled experiments in one interface. Offline replay makes recorded host behavior available on a lab computer without compatible GPU hardware. Diagnostic accuracy, reducer efficiency and educational effectiveness remain separate evaluation questions; the present results establish the local behavior reported in Chapter 10.')
para('The design favors inspectable', 'Quality requirements are inspectable intermediate state, explicit simulation boundaries, bounded histories, predictable replay and conservative error classification. The teaching path runs independently of optional host services. Native experiments retain invalid trials and missing blocks, while the local service checks its session token and loopback origin. Security checks implement the intended local access model; comprehensive security auditing is outside this evaluation.')
para('collector.py enumerates', 'The collector enumerates Windows Performance Data Helper (PDH) counter instances, extracts process identifiers and locally unique adapter identifiers (LUIDs), and aggregates one selected adapter. DirectX Graphics Infrastructure (DXGI) supplies capacity and the calling observer budget; NVIDIA Management Library (NVML) can supply device totals. psutil supplies process and host-memory information, and Ollama polling identifies framework-reported model allocation. Missing optional sources remain unavailable rather than fabricated. Process creation time distinguishes a reused PID from the original process. [7, 8]')
para('Several inherited fields end', 'Fields ending in _mb use mebibytes (MiB), where one MiB is 1,048,576 bytes. PDH dedicated usage, shared usage and committed usage measure different quantities. Dedicated usage concerns the local GPU-memory segment, shared usage concerns system-memory-backed GPU allocations, and committed usage describes committed demand. These counters do not expose each page migration; shared usage alone cannot establish a severe slowdown.')
para('The estimator decomposes', 'The estimator decomposes the GPU footprint into weights, the key–value (KV) cache, compute buffers and runtime overhead. GGUF, the model file format used by the supported local inference workflow, supplies tensor metadata for layer and auxiliary weights. KV demand depends on GPU layers, context length, KV heads, head dimensions, element format and parallel sequences. The implementation handles f16 and quantized KV formats and relevant vision weights and buffers. Machine-specific calibration is stored in agent/calibration.json. [7, 8]')
para('The current working tree was checked', 'Software verification on 22 October 2026 completed 66 frontend tests in 12 files and 149 Python agent tests. TypeScript compilation and the Vite production build succeeded, transforming 1,544 modules. These results validate the recorded software assertions and build process. Hardware performance results are evaluated separately using the retained matched trials. [13]')
para('The first agent invocation', 'The agent tests run from the agent directory so pytest resolves the local spillguard package and configuration. The successful verification used a new writable temporary directory through --basetemp. No production-source modification was required to complete the checks.')
para('Passing tests establish', 'The test suites cover their stated assertions; they do not remove the documented scheduler, memory-ownership, VFS-persistence and validation limitations. The interface screenshot in Chapter 10 records an earlier evidence-desk checkpoint. Current GUI interaction and live hardware operation should be evaluated separately from unit-test success.')
para('Software tests and a successful build establish', 'The results establish executable software and a one-machine performance witness. Generalization is limited by the absence of an external reproduction, a completed multi-machine campaign, a user study and a validated reduction advantage on the real witness. These limits constrain the interpretation of the measured slowdown and the scope of future claims.')
para('Open Task Manager. Pause', 'Open Task Manager and pause the clock. Terminate any existing simulated processes to isolate the example. Select Round Robin, set quantum to two, and create A, B and C in that order, each with a burst of at least six ticks and Core 0 Only affinity. Set a slow clock speed, resume and inspect the first six new Gantt entries: A A B B C C. Existing Gantt entries precede this example. The interface has pause and resume controls; exact tick-by-tick sequences are also checked by the dispatcher tests. These actions affect simulated processes, not Windows processes.')
para('The reported ± values', 'The ± values are means and standard deviations retained from the earlier evaluation, not confidence intervals. The slow-block standard deviation rounds to 0.0 at the displayed precision. Mean absolute error (MAE) is the average absolute prediction difference; leave-one-out validation fits the estimator with each configuration omitted in turn. RSS is resident set size. The original 1 Hz agent overhead does not include every later experiment-orchestration cost. [8, 10, 11]')
para('The strongest next steps', 'Future work should first improve scheduler fidelity, frame ownership and persistent storage, then expand experimental coverage. Each enhancement below has a concrete validation criterion so that implemented functionality and demonstrated benefit remain distinguishable.')
para('Work on instruction emulation', 'The completed project connects OS algorithm inspection with native GPU-memory diagnosis and a reproducible local inference experiment. Further instruction emulation, WebAssembly execution or distributed scheduling would extend its scope. The immediate priorities are stronger simulator invariants and broader validation of the existing experimental workflow.')
s=s.replace("h('9.1 Verification performed on the current workspace')", "h('9.1 Software verification results')")
s=s.replace("('Original agent overhead, five runs'", "('Original agent overhead, five runs'")
s=s.replace("('[14]','Operating Systems Lab Project 40 Marks. Faculty guidelines supplied by the student in this conversation. Review requirements, deliverables, general instructions and four VTOP upload fields. Received 22 October 2026.'),\n",'')
s=s.replace("p('A simulated process records its PID", "p('A process control block (PCB) records each simulated process and its PID")
assert 'Appendix' not in s and 'Appendices' not in s
path.write_text(s,encoding='utf-8')
print('Updated cover, removed all appendices and embedded inventory, and clarified main-report content.')
