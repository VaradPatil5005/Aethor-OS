"""Bounded paired workload/monitor overhead experiment; whole pairs are the unit."""
import ctypes
from dataclasses import replace
import json
from pathlib import Path
import random
import sys
import time

import psutil

from .evidence import write_json
from .observer import Observer
from .runner import Worker


def host_status():
    """Same safety sampling in both arms, outside the optional GPU observer."""
    if sys.platform != "win32":
        raise RuntimeError("Windows GlobalMemoryStatusEx is required for this experiment")
    class MemoryStatus(ctypes.Structure):
        _fields_ = [("length", ctypes.c_ulong), ("load", ctypes.c_ulong),
                    *[(name, ctypes.c_ulonglong) for name in (
                        "total_phys", "avail_phys", "total_pagefile", "avail_pagefile",
                        "total_virtual", "avail_virtual", "avail_extended")]]
    status = MemoryStatus()
    status.length = ctypes.sizeof(status)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        raise OSError("GlobalMemoryStatusEx failed")
    return status.avail_phys, 100 * (status.total_pagefile - status.avail_pagefile) / max(1, status.total_pagefile)


def measure_overhead(recipe, out, pairs=3, seed=0):
    if recipe.workload.kind != "cuda_probe" or not 2 <= pairs <= 20:
        raise ValueError("overhead validation currently uses CUDA probe and 2..20 fixed pairs")
    out = Path(out)
    out.mkdir(parents=True, exist_ok=False)
    recipe = recipe.with_actions(())
    plan = {"pairs": pairs, "seed": seed, "unit": "whole randomized pair", "recipe": recipe.to_dict(),
            "control": "minimal shared host safety sampler; GPU observer disabled",
            "treatment": "same sampler plus GPU observer at the declared interval"}
    write_json(out / "plan.json", plan)
    results = []
    for pair in range(pairs):
        order = [False, True]
        random.Random(seed + pair).shuffle(order)
        for observed in order:
            directory = out / f"pair-{pair + 1:02d}-{'observed' if observed else 'safety-only'}"
            directory.mkdir()
            observer = worker = None
            timings, errors, samples = [], [], []
            proc = psutil.Process()
            cpu0, wall0 = proc.cpu_times(), time.monotonic()
            result = None
            def sample():
                available, commit = host_status()
                if available < recipe.protocol.min_available_host_bytes or commit >= 90:
                    raise RuntimeError("host resource guard")
                if observer:
                    _, data = observer.sample({})
                    samples.append(data)
                    errors.extend(data["errors"])
            try:
                sample()
                observer = Observer() if observed else None
                deadline = time.monotonic() + recipe.protocol.timeout_s
                worker = Worker("target", recipe, directory)
                worker.ready(deadline, heartbeat=sample)
                worker.send("GO")
                while time.monotonic() < deadline:
                    result = next((e for e in worker.events if e["event"] == "RESULT"), None)
                    if result:
                        break
                    sample()
                    if any(e["event"] == "ERROR" for e in worker.events):
                        raise RuntimeError("target helper failed")
                    time.sleep(recipe.protocol.sample_interval_ms / 1000)
                if result is None:
                    raise TimeoutError("workload timeout")
                if result["work_units"] != recipe.workload.expected_work_units:
                    raise RuntimeError("target work changed")
            except Exception as exc:
                errors.append(f"{type(exc).__name__}: {exc}")
            finally:
                try:
                    if worker:
                        if worker.close() or worker.process.returncode != 0:
                            errors.append("owned target did not close normally")
                        errors.extend(e.get("detail", "helper failure") for e in worker.events if e["event"] == "ERROR")
                except Exception as exc:
                    errors.append(f"cleanup: {type(exc).__name__}: {exc}")
                finally:
                    if observer:
                        observer.close()
                elapsed = time.monotonic() - wall0
                cpu1 = proc.cpu_times()
                row = {"pair": pair + 1, "observed": observed, "errors": errors,
                       "latency_ms": result["latency_ms"] if result else None,
                       "work_units": result["work_units"] if result else None,
                       "one_core_cpu_pct": 100 * ((cpu1.user + cpu1.system) - (cpu0.user + cpu0.system)) / max(.001, elapsed),
                       "rss_bytes": proc.memory_info().rss,
                       "collection_duration_ms": [s["collection_duration_ms"] for s in samples]}
                results.append(row)
                write_json(out / "observations.json", results)
            if errors:
                write_json(out / "stopped.json", {"reason": "invalid pair/guard", "unexecuted_pairs": pairs - pair - 1})
                result = {"status": "inconclusive", "pairs": results}
                write_json(out / "overhead.json", result)
                return result
    ratios = []
    for index in range(pairs):
        rows = [r for r in results if r["pair"] == index + 1]
        ratios.append(next(r["latency_ms"] for r in rows if r["observed"]) /
                      next(r["latency_ms"] for r in rows if not r["observed"]))
    result = {"status": "measured", "pairs": results, "paired_workload_ratios": ratios,
              "limits": "single-device synthetic workload, fixed whole pairs; minimal host-sampler cost shared by both arms; no tail-latency or universal overhead claim"}
    write_json(out / "overhead.json", result)
    return result
