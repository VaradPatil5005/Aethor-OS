"""1 Hz telemetry collector: PDH (per-process GPU memory + Windows memory),
NVML device totals, DXGI capacity/budget, psutil process names, Ollama /api/ps.

Every source is optional; a missing one degrades to None rather than crashing,
so the same code runs on machines without NVIDIA or without Ollama.
"""
from __future__ import annotations

import os
import platform
import re
import time
from dataclasses import dataclass, field

import psutil

from . import dxgi

MB = 2**20

# Counter paths are English names (AddEnglishCounter) so a non-English Windows works too.
GPU_PROC = {
    "dedicated": r"\GPU Process Memory(*)\Dedicated Usage",
    "shared": r"\GPU Process Memory(*)\Shared Usage",
    "committed": r"\GPU Process Memory(*)\Total Committed",
}
GPU_ADAPTER = {
    "dedicated": r"\GPU Adapter Memory(*)\Dedicated Usage",
    "shared": r"\GPU Adapter Memory(*)\Shared Usage",
}
SYSTEM = {
    "committed": r"\Memory\Committed Bytes",
    "commit_limit": r"\Memory\Commit Limit",
    "avail_mb": r"\Memory\Available MBytes",
    "pages_per_sec": r"\Memory\Pages/sec",
    "pagefile_pct": r"\Paging File(_Total)\% Usage",
}

PROC_INSTANCE = re.compile(r"^pid_(\d+)_(luid_0x[0-9a-f]+_0x[0-9a-f]+)_phys_(\d+)$", re.I)
ADAPTER_INSTANCE = re.compile(r"^(luid_0x[0-9a-f]+_0x[0-9a-f]+)_phys_(\d+)$", re.I)


def parse_proc_instance(name: str) -> tuple[int, str] | None:
    m = PROC_INSTANCE.match(name)
    return (int(m.group(1)), m.group(2).lower()) if m else None


def parse_adapter_instance(name: str) -> str | None:
    m = ADAPTER_INSTANCE.match(name)
    return m.group(1).lower() if m else None


def aggregate_procs(raw: dict[str, dict[str, float]], luid: str) -> dict[int, dict[str, int]]:
    """raw: metric -> {instance_name: bytes}. Returns pid -> {metric: MB} for one adapter LUID,
    summing over physical-adapter indices (phys_N) of that LUID."""
    out: dict[int, dict[str, int]] = {}
    for metric, inst in raw.items():
        for name, value in inst.items():
            parsed = parse_proc_instance(name)
            if not parsed or parsed[1] != luid:
                continue
            pid = parsed[0]
            slot = out.setdefault(pid, {"dedicated_mb": 0, "shared_mb": 0, "committed_mb": 0})
            slot[f"{metric}_mb"] += int(value // MB)
    return out


def aggregate_adapters(raw: dict[str, dict[str, float]]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for metric, inst in raw.items():
        for name, value in inst.items():
            luid = parse_adapter_instance(name)
            if not luid:
                continue
            slot = out.setdefault(luid, {"dedicated_mb": 0, "shared_mb": 0})
            slot[f"{metric}_mb"] += int(value // MB)
    return out


class PdhSource:
    def __init__(self) -> None:
        import win32pdh  # noqa: deferred so non-Windows imports of this module still work
        self.pdh = win32pdh
        self.query = win32pdh.OpenQuery()
        self.handles: dict[tuple[str, str], int] = {}
        for group, table in (("proc", GPU_PROC), ("adapter", GPU_ADAPTER), ("system", SYSTEM)):
            for key, path in table.items():
                try:
                    self.handles[(group, key)] = win32pdh.AddEnglishCounter(self.query, path)
                except Exception:
                    pass  # counter missing on this OS build; recorded as absent in the trace header
        win32pdh.CollectQueryData(self.query)  # prime rate counters (Pages/sec)

    @property
    def available_counters(self) -> list[str]:
        tables = {"proc": GPU_PROC, "adapter": GPU_ADAPTER, "system": SYSTEM}
        return [tables[g][k] for (g, k) in self.handles]

    def collect(self) -> tuple[dict, dict, dict]:
        pdh = self.pdh
        self.last_errors = []
        pdh.CollectQueryData(self.query)
        proc: dict[str, dict[str, float]] = {}
        adapter: dict[str, dict[str, float]] = {}
        system: dict[str, float] = {}
        for (group, key), h in self.handles.items():
            try:
                if group == "system":
                    _, v = pdh.GetFormattedCounterValue(h, pdh.PDH_FMT_DOUBLE)
                    system[key] = v
                else:
                    arr = pdh.GetFormattedCounterArray(h, pdh.PDH_FMT_LARGE)
                    (proc if group == "proc" else adapter)[key] = arr
            except Exception as exc:
                # PDH_INVALID_DATA etc. while an instance is appearing/vanishing: skip this sample
                self.last_errors.append(f"{group}.{key}: {type(exc).__name__}")
                continue
        return proc, adapter, system

    def close(self) -> None:
        try:
            self.pdh.CloseQuery(self.query)
        except Exception:
            pass


class NvmlSource:
    def __init__(self) -> None:
        self.ok = False
        self.handle = None
        self.driver = None
        try:
            import pynvml
            pynvml.nvmlInit()
            self.nv = pynvml
            self.handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            d = pynvml.nvmlSystemGetDriverVersion()
            self.driver = d.decode() if isinstance(d, bytes) else d
            self.ok = True
        except Exception:
            pass

    def sample(self) -> dict | None:
        if not self.ok:
            return None
        try:
            m = self.nv.nvmlDeviceGetMemoryInfo(self.handle)
            data = {"used_mb": m.used // MB, "total_mb": m.total // MB}
            sensors = {
                "temperature_c": lambda: self.nv.nvmlDeviceGetTemperature(self.handle, self.nv.NVML_TEMPERATURE_GPU),
                "graphics_clock_mhz": lambda: self.nv.nvmlDeviceGetClockInfo(self.handle, self.nv.NVML_CLOCK_GRAPHICS),
                "memory_clock_mhz": lambda: self.nv.nvmlDeviceGetClockInfo(self.handle, self.nv.NVML_CLOCK_MEM),
                "power_mw": lambda: self.nv.nvmlDeviceGetPowerUsage(self.handle),
                "gpu_utilization_pct": lambda: self.nv.nvmlDeviceGetUtilizationRates(self.handle).gpu,
                "memory_utilization_pct": lambda: self.nv.nvmlDeviceGetUtilizationRates(self.handle).memory,
            }
            for name, read in sensors.items():
                try:
                    data[name] = read()
                except Exception:
                    data[name] = None
            return data
        except Exception:
            return None


class OllamaSource:
    """Polls Ollama's /api/ps. Backs off to every 5 s while Ollama is not running."""

    def __init__(self, base: str | None = None) -> None:
        import httpx
        host = base or os.environ.get("OLLAMA_HOST", "127.0.0.1:11434")
        if not host.startswith("http"):
            host = "http://" + host
        self.url = host.rstrip("/") + "/api/ps"
        self.client = httpx.Client(timeout=0.4)
        self.next_try = 0.0

    def sample(self) -> list[dict] | None:
        now = time.monotonic()
        if now < self.next_try:
            return None
        try:
            r = self.client.get(self.url)
            r.raise_for_status()
            models = r.json().get("models", [])
            return [{"name": m.get("name"), "size_mb": int(m.get("size", 0)) // MB,
                     "size_vram_mb": int(m.get("size_vram", 0)) // MB,
                     "context_length": m.get("context_length")} for m in models]
        except Exception:
            self.next_try = now + 5.0
            return None


@dataclass
class ProcNameCache:
    names: dict[int, str] = field(default_factory=dict)
    handles: dict[int, psutil.Process | None] = field(default_factory=dict)
    starts: dict[int, float | None] = field(default_factory=dict)

    def get(self, pid: int) -> str:
        handle = self.handles.get(pid)
        if handle is None:
            # A denied/vanished process may become readable, or its PID be reused.
            self.names.pop(pid, None)
            self.starts.pop(pid, None)
        if handle is not None:
            try:
                if not handle.is_running():
                    self.names.pop(pid, None)
                    self.handles.pop(pid, None)
                    self.starts.pop(pid, None)
            except psutil.Error:
                self.names.pop(pid, None)
                self.handles.pop(pid, None)
                self.starts.pop(pid, None)
        if pid not in self.names:
            try:
                proc = psutil.Process(pid)
                self.names[pid] = proc.name()
                self.handles[pid] = proc
                self.starts[pid] = proc.create_time()
            except Exception:
                self.names[pid] = f"pid{pid}"
                self.handles[pid] = None
                self.starts[pid] = None
        return self.names[pid]

    def private_mb(self, pid: int) -> int | None:
        """Private bytes (= this process's commit charge). None if access is denied."""
        proc = self.handles.get(pid)
        if proc is None:
            return None
        try:
            return proc.memory_info().private // MB
        except Exception:
            self.handles[pid] = None
            return None

    def prune(self, live: set[int]) -> None:
        for pid in list(self.names):
            if pid not in live:
                del self.names[pid]
                self.handles.pop(pid, None)
                self.starts.pop(pid, None)


class Collector:
    """Produces one raw sample dict per call to sample(). The Analyzer adds states/events."""

    def __init__(self, luid: str | None = None, use_ollama: bool = True) -> None:
        self.adapters = dxgi.enumerate_adapters()
        primary = next((a for a in self.adapters if a.luid == luid), None) if luid else dxgi.pick_primary(self.adapters)
        if primary is None:
            raise RuntimeError("No hardware GPU adapter found via DXGI")
        self.primary = primary
        self.pdh = PdhSource()
        self.nvml = NvmlSource() if primary.vendor == "NVIDIA" else None
        self.ollama = OllamaSource() if use_ollama else None
        self.names = ProcNameCache()
        self.me = psutil.Process()
        self.me.cpu_percent(None)
        self.last_budget_refresh = 0.0

    def machine_facts(self) -> dict:
        vm = psutil.virtual_memory()
        return {
            "hostname": platform.node(),
            "os": f"{platform.system()} {platform.release()} build {platform.version()}",
            "cpu": platform.processor(),
            "ram_mb": vm.total // MB,
            "logical_cpus": psutil.cpu_count(),
            "nvidia_driver": self.nvml.driver if self.nvml else None,
            "adapters": [a.to_dict() for a in self.adapters],
            "primary_luid": self.primary.luid,
            "pdh_counters": self.pdh.available_counters,
            "python": platform.python_version(),
        }

    def _refresh_budget(self) -> None:
        # The OS budget can change (other apps, power state). Cheap enough to re-read every 5 s.
        if time.monotonic() - self.last_budget_refresh < 5:
            return
        self.last_budget_refresh = time.monotonic()
        try:
            for a in dxgi.enumerate_adapters():
                if a.luid == self.primary.luid:
                    self.primary.budget_local_mb = a.budget_local_mb
        except Exception:
            pass

    def sample(self) -> dict:
        t = time.time()
        started_ns = time.monotonic_ns()
        proc_raw, adapter_raw, system = self.pdh.collect()
        self._refresh_budget()
        luid = self.primary.luid
        procs = aggregate_procs(proc_raw, luid)
        adapters = aggregate_adapters(adapter_raw)
        ad = adapters.get(luid, {"dedicated_mb": 0, "shared_mb": 0})
        self.names.prune(set(procs))
        proc_list = [
            {"pid": pid, "name": self.names.get(pid), "process_start_time": self.names.starts.get(pid),
             **v, "private_mb": self.names.private_mb(pid)}
            for pid, v in procs.items()
            if v["dedicated_mb"] or v["shared_mb"]
        ]
        proc_list.sort(key=lambda p: -(p["dedicated_mb"] + p["shared_mb"]))
        commit = system.get("committed")
        limit = system.get("commit_limit")
        frame = {
            "t": round(t, 3),
            "monotonic_ns": started_ns,
            "collection_duration_ms": (time.monotonic_ns() - started_ns) / 1e6,
            "telemetry_quality": {
                "errors": list(getattr(self.pdh, "last_errors", [])),
                "proc_metrics": sorted(proc_raw),
                "adapter_metrics": sorted(adapter_raw),
                "adapter_luids": sorted(adapters),
                "system_metrics": sorted(system),
            },
            "adapter": {
                "luid": luid,
                "name": self.primary.name,
                "vram_total_mb": self.primary.dedicated_vram_mb,
                "budget_mb": self.primary.budget_local_mb,
                "budget_scope": "calling_observer_process",
                "shared_cap_mb": self.primary.shared_system_mb,
                "dedicated_mb": ad["dedicated_mb"],
                "shared_mb": ad["shared_mb"],
                "nvml": self.nvml.sample() if self.nvml else None,
            },
            "other_adapters": {k: v for k, v in adapters.items() if k != luid and (v["dedicated_mb"] or v["shared_mb"])},
            "procs": proc_list,
            "system": {
                "commit_mb": int(commit // MB) if commit else None,
                "commit_limit_mb": int(limit // MB) if limit else None,
                "commit_pct": round(100 * commit / limit, 1) if commit and limit else None,
                "avail_mb": int(system["avail_mb"]) if "avail_mb" in system else None,
                "pages_per_sec": round(system.get("pages_per_sec", 0.0), 1),
                "pagefile_pct": round(system.get("pagefile_pct", 0.0), 1),
            },
            "ollama": self.ollama.sample() if self.ollama else None,
            "agent": {"cpu_pct": self.me.cpu_percent(None), "rss_mb": self.me.memory_info().rss // MB},
        }
        frame["collection_duration_ms"] = (time.monotonic_ns() - started_ns) / 1e6
        return frame

    def close(self) -> None:
        self.pdh.close()
