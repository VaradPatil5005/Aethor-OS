"""The 1 Hz loop: collector -> analyzer -> (trace, subscribers). Runs in a thread so the
server's event loop never blocks on PDH."""
from __future__ import annotations

import threading
import time
from collections import deque
from pathlib import Path
from typing import Callable

from .analyzer import Analyzer, Params
from .trace import TraceWriter

PROTOCOL_VERSION = 1


class Runtime:
    def __init__(self, collector, params: Params | None = None, trace_path: str | Path | None = None,
                 history: int = 600) -> None:
        self.collector = collector
        self.analyzer = Analyzer(params)
        self.facts = collector.machine_facts()
        self.trace = TraceWriter(trace_path, {"machine": self.facts, "params": self.analyzer.p.to_dict(),
                                              "protocol": PROTOCOL_VERSION}) if trace_path else None
        self.history: deque[dict] = deque(maxlen=history)
        self.events: deque[dict] = deque(maxlen=500)
        self.peaks: dict[int, tuple[float, float]] = {}
        self.latest: dict | None = None
        self.subscribers: list[Callable[[dict], None]] = []
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.lock = threading.Lock()

    def tick(self) -> dict:
        raw = self.collector.sample()
        frame = self.analyzer.step(raw)
        live = set()
        for p in frame["procs"]:
            live.add(p["pid"])
            d, c = self.peaks.get(p["pid"], (0.0, 0.0))
            self.peaks[p["pid"]] = (max(d, p["dedicated_mb"]), max(c, p.get("private_mb") or 0))
        for pid in list(self.peaks):
            if pid not in live:
                del self.peaks[pid]
        with self.lock:
            self.latest = frame
            self.history.append(frame)
            self.events.extend(frame["events"])
        if self.trace:
            # Analyzed frames are a superset of raw samples: AetherOS replays them as-is, and
            # the analyzer can re-run over them with different params (it reads only raw keys).
            self.trace.write(frame)
        for cb in list(self.subscribers):
            try:
                cb(frame)
            except Exception:
                pass
        return frame

    def run(self, interval: float = 1.0) -> None:
        nxt = time.monotonic()
        while not self._stop.is_set():
            try:
                self.tick()
            except Exception as e:  # never let one bad sample kill the agent
                print(f"[spillguard] sample failed: {e!r}")
            nxt += interval
            delay = nxt - time.monotonic()
            if delay < 0:
                nxt = time.monotonic()
                delay = 0
            self._stop.wait(delay)

    def start(self, interval: float = 1.0) -> None:
        self._thread = threading.Thread(target=self.run, args=(interval,), daemon=True, name="spillguard-loop")
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=3)
        if self.trace:
            self.trace.close()
        self.collector.close()
