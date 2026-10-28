"""JSONL traces. Line 1 is a header {"type":"header", ...machine facts...};
every following line is one frame (the same JSON the WebSocket streams),
so Live and Replay share one code path in AetherOS."""
from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Iterator

TRACE_VERSION = 1


class TraceWriter:
    def __init__(self, path: str | Path, header: dict) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.f = open(self.path, "w", encoding="utf-8")
        self.f.write(json.dumps({"type": "header", "version": TRACE_VERSION,
                                 "started": time.time(), **header}) + "\n")
        self.f.flush()

    def write(self, frame: dict) -> None:
        self.f.write(json.dumps(frame, separators=(",", ":")) + "\n")
        self.f.flush()

    def close(self) -> None:
        self.f.close()


def read_trace(path: str | Path) -> tuple[dict, Iterator[dict]]:
    f = open(path, encoding="utf-8")
    first = json.loads(f.readline())
    header = first if first.get("type") == "header" else {}

    def frames() -> Iterator[dict]:
        if not header:
            yield first
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)
        f.close()

    return header, frames()
