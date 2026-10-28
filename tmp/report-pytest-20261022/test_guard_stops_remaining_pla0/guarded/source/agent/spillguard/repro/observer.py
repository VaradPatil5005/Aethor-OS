"""Research observations alongside the original replay-compatible detector frames."""
from __future__ import annotations

import hashlib
import json
import platform
import time

from .spec import MIB


class Observer:
    def __init__(self):
        from ..collector import Collector
        from ..runtime import Runtime
        self.runtime = Runtime(Collector(use_ollama=False))
        self.facts = self.runtime.facts
        nvidia = [a for a in self.facts["adapters"] if a["vendor"] == "NVIDIA" and not a["software"]]
        if len(nvidia) != 1 or self.runtime.collector.primary.vendor != "NVIDIA":
            self.runtime.stop()
            raise RuntimeError("live Repro currently requires exactly one NVIDIA adapter; CUDA/LUID mapping is unverified otherwise")
        # Hash only stable environment fields, never a PID, sample or current budget.
        self.signature = hashlib.sha256(json.dumps({
            "os": self.facts["os"], "python": platform.python_version(),
            "driver": self.facts.get("nvidia_driver"), "adapters": [
                {k: a.get(k) for k in ("name", "luid", "vendor", "dedicated_vram_mb")}
                for a in self.facts["adapters"]],
            "pdh_counters": self.facts["pdh_counters"],
        }, sort_keys=True).encode()).hexdigest()

    def sample(self, identities: dict[int, float]) -> tuple[dict, dict]:
        import psutil
        frame = self.runtime.tick()
        quality = frame["telemetry_quality"]
        errors = list(quality["errors"])
        for key in ("dedicated", "shared"):
            if key not in quality["proc_metrics"] or key not in quality["adapter_metrics"]:
                errors.append(f"missing PDH {key} counters")
        for key in ("avail_mb", "committed", "commit_limit"):
            if key not in quality["system_metrics"]:
                errors.append(f"missing host-memory counter: {key}")
        if frame["adapter"]["luid"] not in quality["adapter_luids"]:
            errors.append("selected adapter has no observed PDH instance")
        processes = []
        for pid, start in identities.items():
            try:
                if psutil.Process(pid).create_time() != start:
                    errors.append(f"PID {pid} identity changed")
                    continue
            except psutil.Error:
                # Process completion between workload result and sample is normal;
                # no resident pressure can be credited to the vanished identity.
                continue
            proc = next((p for p in frame["procs"] if p["pid"] == pid), None)
            processes.append({"pid": pid, "process_start_time": start,
                              "dedicated_observed_bytes": proc["dedicated_mb"] * MIB if proc and not errors else None,
                              "shared_observed_bytes": proc["shared_mb"] * MIB if proc and not errors else None,
                              "committed_observed_bytes": proc.get("committed_mb", 0) * MIB
                              if proc and "committed" in quality["proc_metrics"] and not errors else None})
        nvml = frame["adapter"].get("nvml")
        ad = frame["adapter"]
        difference = abs(ad["dedicated_mb"] - nvml["used_mb"]) * MIB if nvml and not errors else None
        available = frame["system"].get("avail_mb")
        try:
            battery = psutil.sensors_battery()
            ac_power = battery.power_plugged if battery else None
        except Exception:
            ac_power = None
        return frame, {"monotonic_ns": frame["monotonic_ns"], "wall_time_ns": time.time_ns(),
                       "collection_duration_ms": frame["collection_duration_ms"],
                       "processes": processes, "errors": errors,
                       "available_host_bytes": available * MIB if available is not None else None,
                       "host_commit_pct": frame["system"].get("commit_pct"),
                       "gpu_sensors": {key: nvml.get(key) if nvml else None for key in (
                           "temperature_c", "graphics_clock_mhz", "memory_clock_mhz", "power_mw",
                           "gpu_utilization_pct", "memory_utilization_pct")},
                       "ac_power": ac_power,
                       "adapter_pdh_nvml_difference_bytes": difference,
                       "counter_disagreement": difference > 256 * MIB if difference is not None else None,
                       "counter_disagreement_threshold_bytes": 256 * MIB,
                       "budget_scope": "calling_observer_process",
                       "residency_mechanism": "unverified",
                       "notes": "PDH observations; allocation/commit/residency are not interchangeable"}

    def close(self):
        self.runtime.stop()
