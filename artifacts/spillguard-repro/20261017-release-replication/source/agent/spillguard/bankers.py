"""Banker's-style admission control over GPU memory resources.

Same safety algorithm as AetherOS's src/kernel/BankersAlgorithm.ts (Dijkstra 1965),
plus the one change real GPU workloads need: *long-lived* processes (a game, a
chat server) never finish, so they never release what they hold. They cannot
appear in a safe sequence; instead their remaining claim (Max - Allocation) is
reserved up front, and the classic search runs over the finite jobs only. With
no finite jobs this reduces to sum(Max) <= capacity.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Job:
    name: str
    allocation: list[float]
    maximum: list[float]
    long_lived: bool = True
    pid: int | None = None

    @property
    def need(self) -> list[float]:
        return [max(0.0, mx - a) for mx, a in zip(self.maximum, self.allocation)]


@dataclass
class SafetyResult:
    safe: bool
    sequence: list[str]
    available_after_reserve: list[float]
    steps: list[dict] = field(default_factory=list)
    blocking: list[str] = field(default_factory=list)


def safety_check(available: list[float], jobs: list[Job]) -> SafetyResult:
    m = len(available)
    work = list(available)
    for j in jobs:
        if j.long_lived:
            work = [w - n for w, n in zip(work, j.need)]
    reserved = list(work)
    if any(w < 0 for w in work):
        return SafetyResult(False, [], reserved, blocking=[j.name for j in jobs if j.long_lived and any(j.need)])

    finite = [j for j in jobs if not j.long_lived]
    done = [False] * len(finite)
    seq, steps = [], []
    progressed = True
    while progressed:
        progressed = False
        for i, j in enumerate(finite):
            if done[i]:
                continue
            if all(j.need[r] <= work[r] for r in range(m)):
                before = list(work)
                work = [work[r] + j.allocation[r] for r in range(m)]
                steps.append({"job": j.name, "work_before": before, "work_after": list(work)})
                done[i] = True
                seq.append(j.name)
                progressed = True
    safe = all(done)
    return SafetyResult(safe, seq if safe else [], reserved, steps if safe else [],
                        [] if safe else [j.name for i, j in enumerate(finite) if not done[i]])


@dataclass
class Admission:
    verdict: str                 # SAFE | UNSAFE
    reason: str
    resources: list[str]
    available: list[float]
    request: list[float]
    result: SafetyResult
    holders: list[dict]


def admit(resources: list[str], capacity: list[float], margin: list[float], running: list[Job],
          new: Job) -> Admission:
    """Would granting `new` its full claim leave the system in a safe state?
    available = capacity - margin - sum(allocation of running jobs)."""
    held = [sum(j.allocation[r] for j in running) for r in range(len(resources))]
    available = [capacity[r] - margin[r] - held[r] for r in range(len(resources))]
    res = safety_check(available, running + [new])
    holders = sorted(({"name": j.name, "pid": j.pid, "mb": round(j.allocation[0])} for j in running),
                     key=lambda h: -h["mb"])[:5]
    if res.safe:
        return Admission("SAFE", "a safe sequence exists", resources, available, new.maximum, res, holders)
    # Explain the most-constrained resource in plain words: largest shortfall of the new claim
    # against what is free after the running long-lived jobs' reserves.
    free_after = [available[i] - sum(j.need[i] for j in running if j.long_lived) for i in range(len(resources))]
    r = max(range(len(resources)), key=lambda i: new.need[i] - free_after[i])
    free = free_after[r]
    top = holders[0] if holders else None
    reason = (f"needs {new.need[r] / 1024:.1f} GB {resources[r]}, {max(0.0, free) / 1024:.1f} GB free"
              + (f"; {top['name']} holds {top['mb'] / 1024:.1f} GB" if top and r == 0 else ""))
    return Admission("UNSAFE", reason, resources, available, new.maximum, res, holders)
