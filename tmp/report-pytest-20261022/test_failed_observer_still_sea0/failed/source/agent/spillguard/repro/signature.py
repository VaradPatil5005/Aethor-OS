"""Observed counter/phase signatures, explicitly not independently proven residency."""
from dataclasses import asdict, dataclass
import json
from pathlib import Path
from statistics import median

from .spec import MIB, Recipe


@dataclass(frozen=True)
class WitnessSignature:
    kind: str
    workload_signature: str
    environment_signature: str
    phases: tuple[str, ...]
    shared_growth_bytes: float
    dedicated_loss_fraction: float
    overlap_fraction: float
    counter_disagreement: bool
    coverage_samples: int
    evidence_type: str = "PDH counter proxy; not direct residency ground truth"

    def to_dict(self):
        return asdict(self)


def extract_signature(bundle: Path) -> WitnessSignature | None:
    bundle = Path(bundle)
    report = json.loads((bundle / "report.json").read_text(encoding="utf-8"))
    recipe = Recipe.load(bundle / "recipe.json")
    witnesses = []
    for trial in report["trials"]:
        if trial["verdict"]["outcome"] != "FAIL":
            continue
        stage = next(s for s in trial["stages"] if s["stage"] == "pressure")
        directory = bundle / f"trial-{trial['trial']:03d}-pressure"
        identities = {int(pid) for pid in stage.get("server_cleanup", {}).get("job_owned_identities", {})}
        if not identities:
            # CUDA target is a direct owned worker.
            events = [json.loads(line) for line in (directory / "target.jsonl").read_text().splitlines()]
            identities = {e["pid"] for e in events if e["event"] == "READY"}
        observations = [json.loads(line) for line in (directory / "observations.jsonl").read_text().splitlines()]
        valid = [o for o in observations if not o["errors"]]
        before = [o for o in valid if o["monotonic_ns"] < stage["measure_start_ns"]]
        window = [o for o in valid if stage["measure_start_ns"] <= o["monotonic_ns"] <= stage["measure_end_ns"]]
        # Private server roots/HTTP clients have no GPU counter instance. Fix the
        # target GPU group from observed pre-measurement identities; do not turn
        # missing measurements for that GPU group into zero later in the window.
        identities &= {p["pid"] for o in before[-3:] for p in o["processes"]
                       if (p.get("dedicated_observed_bytes") or 0) > 0 or (p.get("shared_observed_bytes") or 0) > 0}
        def total(obs, key):
            procs = [p for p in obs["processes"] if p["pid"] in identities]
            if len(procs) != len(identities) or not procs or any(p.get(key) is None for p in procs):
                return None
            return sum(p[key] for p in procs)
        before_d = [v for o in before if (v := total(o, "dedicated_observed_bytes")) is not None]
        before_s = [v for o in before if (v := total(o, "shared_observed_bytes")) is not None]
        during_d = [v for o in window if (v := total(o, "dedicated_observed_bytes")) is not None]
        during_s = [v for o in window if (v := total(o, "shared_observed_bytes")) is not None]
        if not all((before_d, before_s, during_d, during_s)) or len(window) < recipe.protocol.min_overlap_samples:
            return None
        base_d, base_s = median(before_d[-3:]), median(before_s[-3:])
        growth = max(0, max(during_s) - base_s)
        loss = max(0, base_d - min(during_d)) / max(1, base_d)
        disagreement = any(o.get("counter_disagreement") is True for o in window)
        kind = ("counter-disagreement" if disagreement else "local-loss-and-shared-growth"
                if loss >= .05 and growth >= 64 * MIB else "shared-growth"
                if growth >= 64 * MIB else "no-shared-growth")
        witnesses.append(WitnessSignature(kind, stage["workload_signature"], stage["environment_signature"],
                         tuple(sorted({a.phase for a in recipe.actions})), growth, loss,
                         min(1, stage.get("overlap_samples", 0) / len(window)), disagreement, len(window)))
    if not witnesses or len({s.kind for s in witnesses}) != 1:
        return None
    first = witnesses[0]
    return WitnessSignature(first.kind, first.workload_signature, first.environment_signature, first.phases,
                            median(s.shared_growth_bytes for s in witnesses),
                            median(s.dedicated_loss_fraction for s in witnesses),
                            median(s.overlap_fraction for s in witnesses), first.counter_disagreement,
                            min(s.coverage_samples for s in witnesses))


def compare_signatures(reference: WitnessSignature, candidate: WitnessSignature | None):
    if candidate is None:
        return False, "missing/ambiguous counter signature"
    for field in ("kind", "workload_signature", "environment_signature", "phases", "counter_disagreement"):
        if getattr(reference, field) != getattr(candidate, field):
            return False, f"signature changed: {field}"
    tolerance = max(64 * MIB, reference.shared_growth_bytes * .5)
    if abs(reference.shared_growth_bytes - candidate.shared_growth_bytes) > tolerance:
        return False, "shared-growth proxy outside declared tolerance"
    if abs(reference.dedicated_loss_fraction - candidate.dedicated_loss_fraction) > .15:
        return False, "dedicated-loss proxy outside declared tolerance"
    if candidate.overlap_fraction < max(.25, reference.overlap_fraction - .25):
        return False, "phase overlap was lost"
    return True, "observed phase/counter signature retained; residency mechanism remains unverified"
