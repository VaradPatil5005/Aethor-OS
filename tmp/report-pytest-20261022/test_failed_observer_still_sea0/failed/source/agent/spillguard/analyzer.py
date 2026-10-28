"""Spill detector (type B) with hysteresis, A/B/C cause classifier and culprit ranking.

Pure and deterministic: feed raw collector samples in order, get annotated frames
out. Replaying a recorded trace therefore reproduces live behaviour exactly,
which is how the unit tests and the threshold calibration work.

Calibration notes (pilot W1, RTX 3050 6 GB, driver 581.83):
  * Under pressure the driver fills *physical* VRAM (5954 of 6002 MB) and ignores
    the DXGI budget (5234 MB), so pressure is D_adapter / DedicatedVideoMemory.
  * A spilling process's Shared Usage rose 74 -> 266 MB in the first 1 s sample
    after onset, so Δ = 128 MB with k = 2 detects within ~2 s.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field, asdict


@dataclass
class Params:
    theta_hi: float = 0.92       # adapter pressure to arm the detector (fraction of physical VRAM)
    theta_lo: float = 0.85       # pressure below which SPILLING always ends
    delta_mb: int = 128          # shared-usage growth over baseline that counts as spill
    k: int = 2                   # consecutive samples required to enter SPILLING
    slope_window: int = 5        # samples used for the "still rising" test
    exit_k: int = 3              # consecutive clear samples required to leave SPILLING
    baseline_window: int = 60    # samples of unpressured history used for the baseline
    culprit_window_s: float = 30.0
    commit_hi: float = 90.0      # type C: commit charge %
    commit_lo: float = 85.0
    avail_lo_mb: int = 512       # type C: available RAM floor
    c_k: int = 3

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ProcTrack:
    pid: int
    name: str
    process_start_time: float | None = None
    shared_hist: deque = field(default_factory=lambda: deque(maxlen=60))  # unpressured shared samples
    recent_shared: deque = field(default_factory=lambda: deque(maxlen=8))
    ded_hist: deque = field(default_factory=lambda: deque(maxlen=120))   # (t, dedicated) for culprit ranking
    first_shared: int | None = None
    hits: int = 0
    clears: int = 0
    spilling: bool = False
    spill_start_t: float = 0.0
    peak_spill_mb: int = 0

    def baseline(self) -> int:
        if self.shared_hist:
            return min(self.shared_hist)
        return self.first_shared or 0


class Analyzer:
    def __init__(self, params: Params | None = None) -> None:
        self.p = params or Params()
        self.tracks: dict[int, ProcTrack] = {}
        self.pressure = False
        self.ram_pressure = False
        self.c_hits = 0
        self.c_clears = 0
        self.last_budget: int | None = None
        self.ollama_split: dict[str, tuple[int, int]] = {}
        self.event_count = 0
        self.spill_episodes = 0

    # ---- helpers -------------------------------------------------------------------------
    def _track(self, pid: int, name: str, process_start_time=None) -> ProcTrack:
        tr = self.tracks.get(pid)
        if tr is None or tr.name != name or (process_start_time is not None and tr.process_start_time != process_start_time):
            tr = ProcTrack(pid, name, process_start_time)
            tr.shared_hist = deque(maxlen=self.p.baseline_window)
            self.tracks[pid] = tr
        return tr

    def _culprit(self, t: float, victim: int) -> dict | None:
        """Process whose dedicated usage grew most in the window before onset."""
        best = None
        for tr in self.tracks.values():
            window = [d for (ts, d) in tr.ded_hist if t - ts <= self.p.culprit_window_s]
            if not window:
                continue
            growth = window[-1] - window[0]
            key = (growth, window[-1])
            if best is None or key > best[0]:
                best = (key, tr)
        if best is None:
            return None
        (growth, held), tr = best
        return {"pid": tr.pid, "name": tr.name, "growth_mb": growth, "held_mb": held,
                "self_inflicted": tr.pid == victim}

    # ---- main step -----------------------------------------------------------------------
    def step(self, s: dict) -> dict:
        p = self.p
        t = s["t"]
        ad = s["adapter"]
        V = ad.get("vram_total_mb") or 1
        D = ad.get("dedicated_mb") or 0
        load = D / V
        events: list[dict] = []

        def ev(kind: str, **kw) -> None:
            self.event_count += 1
            events.append({"type": kind, "t": t, **kw})

        # adapter pressure with hysteresis
        if not self.pressure and load >= p.theta_hi:
            self.pressure = True
            ev("PRESSURE_START", load=round(load, 3), dedicated_mb=D)
        elif self.pressure and load < p.theta_lo:
            self.pressure = False
            ev("PRESSURE_END", load=round(load, 3), dedicated_mb=D)

        budget = ad.get("budget_mb")
        if budget is not None and self.last_budget is not None and abs(budget - self.last_budget) >= 64:
            ev("BUDGET_CHANGE", old_mb=self.last_budget, new_mb=budget)
        if budget is not None:
            self.last_budget = budget

        seen: set[int] = set()
        out_procs = []
        for pr in s.get("procs", []):
            pid, name = pr["pid"], pr["name"]
            S, Dp = pr.get("shared_mb", 0), pr.get("dedicated_mb", 0)
            prior = self.tracks.get(pid)
            birth = pr.get("process_start_time")
            if prior and prior.spilling and (prior.name != name or (birth is not None and birth != prior.process_start_time)):
                ev("SPILL_END", pid=pid, name=prior.name, duration_s=round(t - prior.spill_start_t, 1),
                   peak_spill_mb=prior.peak_spill_mb, reason="process identity changed")
            tr = self._track(pid, name, pr.get("process_start_time"))
            seen.add(pid)
            if tr.first_shared is None:
                tr.first_shared = S
            tr.ded_hist.append((t, Dp))
            tr.recent_shared.append(S)
            if not self.pressure and not tr.spilling:
                tr.shared_hist.append(S)
            base = tr.baseline()
            excess = max(0, S - base)
            w = list(tr.recent_shared)[-p.slope_window:]
            rising = len(w) >= 2 and w[-1] > w[0]

            if not tr.spilling:
                if load >= p.theta_hi and excess > p.delta_mb and (rising or tr.hits > 0):
                    tr.hits += 1
                else:
                    tr.hits = 0
                if tr.hits >= p.k:
                    tr.spilling, tr.hits, tr.clears = True, 0, 0
                    tr.spill_start_t, tr.peak_spill_mb = t, excess
                    self.spill_episodes += 1
                    cause = "B+C" if self.ram_pressure else "B"
                    ev("SPILL_START", pid=pid, name=name, spill_mb=excess,
                       ratio=round(excess / max(1, Dp + excess), 3), cause=cause,
                       culprit=self._culprit(t, pid))
            else:
                tr.peak_spill_mb = max(tr.peak_spill_mb, excess)
                clear = load < p.theta_lo or excess <= p.delta_mb // 2
                tr.clears = tr.clears + 1 if clear else 0
                if tr.clears >= p.exit_k:
                    tr.spilling = False
                    tr.clears = 0
                    ev("SPILL_END", pid=pid, name=name, duration_s=round(t - tr.spill_start_t, 1),
                       peak_spill_mb=tr.peak_spill_mb)

            out_procs.append({**pr, "baseline_shared_mb": base, "spill_mb": excess,
                              "ratio": round(excess / max(1, Dp + excess), 3),
                              "state": "SPILLING" if tr.spilling else ("PRESSURED" if self.pressure else "OK")})

        # processes that vanished: close their episodes
        for pid in list(self.tracks):
            if pid not in seen:
                tr = self.tracks.pop(pid)
                if tr.spilling:
                    ev("SPILL_END", pid=pid, name=tr.name, duration_s=round(t - tr.spill_start_t, 1),
                       peak_spill_mb=tr.peak_spill_mb, exited=True)

        # type C: system RAM pressure
        sysm = s.get("system", {})
        commit = sysm.get("commit_pct") or 0
        avail = sysm.get("avail_mb")
        c_now = commit >= p.commit_hi or (avail is not None and avail < p.avail_lo_mb)
        c_clear = commit < p.commit_lo and (avail is None or avail >= p.avail_lo_mb * 1.5)
        if not self.ram_pressure:
            self.c_hits = self.c_hits + 1 if c_now else 0
            if self.c_hits >= p.c_k:
                self.ram_pressure, self.c_hits = True, 0
                ev("RAM_PRESSURE_START", cause="C", commit_pct=commit, avail_mb=avail)
        else:
            self.c_clears = self.c_clears + 1 if c_clear else 0
            if self.c_clears >= p.c_k:
                self.ram_pressure, self.c_clears = False, 0
                ev("RAM_PRESSURE_END", cause="C", commit_pct=commit, avail_mb=avail)

        # type A: framework offload reported by Ollama
        models = s.get("ollama")
        if models is not None:
            now = {}
            for m in models:
                size, vram = m.get("size_mb", 0), m.get("size_vram_mb", 0)
                now[m["name"]] = (size, vram)
                if size and vram < size and self.ollama_split.get(m["name"]) != (size, vram):
                    ev("OFFLOAD_SPLIT", cause="A", model=m["name"], size_mb=size, size_vram_mb=vram,
                       cpu_pct=round(100 * (size - vram) / size))
            self.ollama_split = now

        spilling = [x for x in out_procs if x["state"] == "SPILLING"]
        state = "SPILL" if spilling else ("PRESSURE" if self.pressure else "OK")
        return {
            **s,
            "procs": out_procs,
            "adapter": {**ad, "load": round(load, 3), "state": state},
            "system": {**sysm, "ram_pressure": self.ram_pressure},
            "events": events,
            "summary": {
                "state": state,
                "spilling": [{"pid": x["pid"], "name": x["name"], "spill_mb": x["spill_mb"], "ratio": x["ratio"]}
                             for x in spilling],
                "total_spill_mb": sum(x["spill_mb"] for x in spilling),
                "episodes": self.spill_episodes,
            },
        }


def analyze_frames(samples, params: Params | None = None) -> list[dict]:
    a = Analyzer(params)
    return [a.step(s) for s in samples]
