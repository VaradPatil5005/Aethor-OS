"""Execute only an owned pressure recipe, for serialized-work and helper validation."""
from dataclasses import replace
import json
from pathlib import Path
import time

from .evidence import write_json
from .observer import Observer
from .runner import Worker


def run_background(recipe, directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=False)
    observer, worker, errors, completed = None, None, [], False
    started = time.monotonic()
    identities = {}
    normalized = recipe.with_actions(replace(a, phase="pressure") for a in recipe.actions)
    observations = (directory / "observations.jsonl").open("x", encoding="utf-8")
    result = {"requested_recipe": recipe.to_dict(), "executed_recipe": normalized.to_dict(),
              "phase_policy": "target already completed; all original phase offsets applied to background start"}
    try:
        observer = Observer()
        def sample():
            _, data = observer.sample(identities)
            observations.write(json.dumps(data) + "\n")
            errors.extend(data["errors"])
            if data["available_host_bytes"] is None or data["available_host_bytes"] < recipe.protocol.min_available_host_bytes:
                raise RuntimeError("host memory floor reached")
            if data["host_commit_pct"] is None or data["host_commit_pct"] >= 90:
                raise RuntimeError("host commit pressure reached")
        sample()
        deadline = time.monotonic() + recipe.protocol.timeout_s
        worker = Worker("pressure", normalized, directory)
        ready = worker.ready(deadline, heartbeat=sample)
        identities[ready["pid"]] = ready["process_start_time"]
        worker.send("GO")
        expected = {a.id for a in recipe.actions}
        while time.monotonic() < deadline:
            sample()
            released = {e["action_id"] for e in worker.events if e["event"] == "RELEASE"}
            if expected <= released:
                completed = True
                break
            if any(e["event"] == "ERROR" for e in worker.events):
                raise RuntimeError("background helper failed")
            time.sleep(recipe.protocol.sample_interval_ms / 1000)
        if not completed:
            raise TimeoutError("owned background schedule did not complete")
    except Exception as exc:
        errors.append(f"{type(exc).__name__}: {exc}")
    finally:
        try:
            if worker:
                if worker.close():
                    errors.append("forced termination of owned background helper")
                errors.extend(e.get("detail", "helper failure") for e in worker.events if e["event"] == "ERROR")
                if worker.process.returncode != 0:
                    errors.append(f"helper exit {worker.process.returncode}")
        finally:
            if observer:
                observer.close()
            observations.close()
            result.update(completed=completed and not errors, errors=errors, identities=identities,
                          elapsed_s=time.monotonic() - started)
            write_json(directory / "background.json", result)
    return result
