"""Bounded baseline/pressure/recovery blocks using only owned child processes."""
from __future__ import annotations

from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import queue
import random
import shutil
import subprocess
import sys
import threading
import time
import traceback

from .evidence import classify, seal_bundle
from .observer import Observer
from .spec import Recipe

AGENT = Path(__file__).resolve().parents[2]


class Worker:
    """A direct Popen handle is the authority to terminate; never discover PIDs by name."""
    def __init__(self, role: str, recipe: Recipe, directory: Path, endpoint: str | None = None,
                 agent_dir: Path | None = None):
        self.events = []
        self.messages = queue.Queue()
        self.event_file = (directory / f"{role}.jsonl").open("x", encoding="utf-8")
        self.error_file = (directory / f"{role}.stderr.txt").open("x", encoding="utf-8")
        try:
            command = [sys.executable, "-m", "spillguard.repro.worker", role]
            if endpoint:
                command.append(endpoint)
            self.process = subprocess.Popen(
                command, cwd=agent_dir or AGENT,
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self.error_file,
                text=True, encoding="utf-8", creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except BaseException:
            self.event_file.close()
            self.error_file.close()
            raise
        self.thread = threading.Thread(target=self._read, daemon=True)
        self.thread.start()
        import psutil
        try:
            self.process_start_time = psutil.Process(self.process.pid).create_time()
        except psutil.Error:
            self.process_start_time = None
        try:
            self.send(json.dumps(recipe.to_dict()))
        except BaseException:
            self.close()
            raise

    def _read(self):
        try:
            for line in self.process.stdout:
                self.event_file.write(line)
                self.event_file.flush()
                try:
                    event = json.loads(line)
                except ValueError:
                    event = {"event": "ERROR", "detail": "non-JSON helper output"}
                self.events.append(event)
                self.messages.put(event)
        finally:
            self.messages.put({"event": "EOF"})

    def send(self, message):
        self.process.stdin.write(message + "\n")
        self.process.stdin.flush()

    def ready(self, deadline, heartbeat=None):
        while time.monotonic() < deadline:
            if heartbeat:
                heartbeat()
            try:
                event = self.messages.get(timeout=min(0.1, max(0.01, deadline - time.monotonic())))
            except queue.Empty:
                continue
            if event["event"] == "READY":
                return event
            if event["event"] in ("EOF", "ERROR"):
                raise RuntimeError(f"helper not ready: {event}")
        raise TimeoutError("helper startup timeout")

    def close(self):
        forced = False
        if self.process.poll() is None:
            try:
                self.send("STOP")
            except (BrokenPipeError, OSError):
                pass
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                forced = True
                self.process.terminate()
                try:
                    self.process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait(timeout=3)
        self.thread.join(timeout=3)
        self.process.stdin.close()
        self.process.stdout.close()
        self.event_file.close()
        self.error_file.close()
        return forced


def _active_bytes(events, when):
    active = {}
    for e in events:
        if e.get("monotonic_ns", 0) > when:
            continue
        if e["event"] == "ALLOC":
            active[e["action_id"]] = e["requested_bytes"]
        elif e["event"] == "RELEASE":
            active.pop(e["action_id"], None)
    return sum(active.values())


def _active_action_ids(events, when):
    active = set()
    for event in events:
        if event.get("monotonic_ns", 0) > when:
            continue
        if event["event"] == "ALLOC":
            active.add(event["action_id"])
        elif event["event"] == "RELEASE":
            active.discard(event["action_id"])
    return active


def relay_target_phases(events, holder, relayed):
    """Warmup events are before READY; only measured request/output markers trigger actions."""
    ready = False
    for event in events:
        if event["event"] == "READY":
            ready = True
            continue
        phase = {"REQUEST_START": "request", "FIRST_OUTPUT": "decode"}.get(event["event"])
        if ready and phase and phase not in relayed:
            holder.send(f"PHASE {phase} {event['at_ns']}")
            relayed.add(phase)


def observed_pressure(recipe, observations, pressure_events, pressure_pid, baseline_bytes, result):
    """Require multiple overlapping samples of *additional* dedicated observations.

    First-touch/hold verifies one manipulation. This is not proof of paging, and
    samples with only shared growth do not meet this deliberately narrow predicate.
    """
    hits = 0
    per_action = {action.id: 0 for action in recipe.actions}
    for obs in observations:
        when = obs["monotonic_ns"]
        if not result["measure_start_ns"] <= when <= result["measure_end_ns"] or obs["errors"]:
            continue
        requested = _active_bytes(pressure_events, when)
        proc = next((p for p in obs["processes"] if p["pid"] == pressure_pid), None)
        dedicated = proc.get("dedicated_observed_bytes") if proc else None
        if requested > 0 and dedicated is not None and baseline_bytes is not None:
            if dedicated - baseline_bytes >= requested * recipe.protocol.min_pressure_fraction:
                hits += 1
                for action_id in _active_action_ids(pressure_events, when):
                    if action_id in per_action:
                        per_action[action_id] += 1
    return (hits >= recipe.protocol.min_overlap_samples and
            all(count >= recipe.protocol.min_overlap_samples for count in per_action.values())), hits


def run_stage(recipe, stage, directory, observer, source_agent=None):
    directory.mkdir()
    children, observations, errors, result = [], [], [], None
    server = None
    stage_result = {"stage": stage, "completed": False, "errors": errors,
                    "work_units": None, "latency_ms": None, "pressure_observed": None,
                    "workload_signature": hashlib.sha256(json.dumps(asdict(recipe.workload), sort_keys=True).encode()).hexdigest(),
                    "environment_signature": observer.signature, "host_pressure": None}
    stage_result["metric"] = recipe.workload.primary_metric
    deadline = time.monotonic() + recipe.protocol.timeout_s
    identities = {}
    baseline_bytes = None
    from ..trace import TraceWriter
    trace = TraceWriter(directory / "trace.jsonl", {"machine": observer.facts, "protocol": 1,
                       "repro": {"stage": stage, "recipe_signature": recipe.signature}})
    raw = (directory / "observations.jsonl").open("x", encoding="utf-8")

    def sample():
        if server:
            identities.update(server.identities())
        frame, observation = observer.sample(identities)
        trace.write(frame)  # same analyzed frames accepted by AetherOS replay
        raw.write(json.dumps(observation, allow_nan=False) + "\n")
        raw.flush()
        observations.append(observation)
        errors.extend(observation["errors"])
        available = observation["available_host_bytes"]
        if available is None or available < recipe.protocol.min_available_host_bytes:
            raise RuntimeError("host memory floor reached or unavailable")
        if observation["host_commit_pct"] is None or observation["host_commit_pct"] >= 90:
            raise RuntimeError("host commit pressure reached or unavailable")
        return observation

    try:
        is_ollama = recipe.workload.kind == "ollama"
        if is_ollama:
            from .ollama import PrivateServer
            sample()  # Check host headroom before starting a model server.
            server = PrivateServer(recipe.workload, directory)
            stage_result["ollama_runtime"] = server.runtime
            stage_result["environment_signature"] = hashlib.sha256(
                (observer.signature + server.signature).encode()).hexdigest()
        # A no-allocation context is present in controls as well as pressure runs.
        pressure_recipe = recipe if stage == "pressure" else recipe.with_actions(())
        worker_options = {"agent_dir": source_agent} if source_agent else {}
        target = (Worker("target", recipe, directory, endpoint=server.endpoint, **worker_options) if server
                  else Worker("target", recipe, directory, **worker_options))
        children.append(target)
        target_ready = target.ready(deadline, heartbeat=sample) if server else target.ready(deadline)
        holder = Worker("pressure", pressure_recipe, directory, **worker_options)
        children.append(holder)
        holder_ready = holder.ready(deadline)
        if holder_ready["device"] != observer.runtime.collector.primary.name or (
                not is_ollama and target_ready["device"] != holder_ready["device"]):
            raise RuntimeError("CUDA and observed adapter names differ; adapter mapping unverified")
        identities = {target_ready["pid"]: target_ready["process_start_time"],
                      holder_ready["pid"]: holder_ready["process_start_time"]}
        idle = sample()
        hp = next((p for p in idle["processes"] if p["pid"] == holder_ready["pid"]), None)
        baseline_bytes = hp["dedicated_observed_bytes"] if hp else None
        holder.send("GO")
        lead_end = time.monotonic() + recipe.protocol.lead_in_ms / 1000
        while time.monotonic() < lead_end:
            sample()
            time.sleep(min(recipe.protocol.sample_interval_ms / 1000, max(0, lead_end - time.monotonic())))
        target.send("GO")
        relayed = set()
        while time.monotonic() < deadline:
            if is_ollama:
                relay_target_phases(list(target.events), holder, relayed)
            result = next((e for e in target.events if e["event"] == "RESULT"), None)
            if result:
                break
            if any(e["event"] == "ERROR" for w in children for e in w.events):
                raise RuntimeError("helper reported a failure")
            if target.process.poll() is not None and not target.thread.is_alive():
                raise RuntimeError("target exited without a timing result")
            sample()
            time.sleep(recipe.protocol.sample_interval_ms / 1000)
        if result is None:
            raise TimeoutError("target exceeded trial timeout")
        stage_result.update({k: result[k] for k in ("latency_ms", "work_units", "measure_start_ns", "measure_end_ns")})
        if is_ollama:
            for key in ("metric_value", "request_start_ns", "time_to_first_output_ms", "output_sha256",
                        "thinking_sha256", "prompt_sha256", "done_reason", "server_statistics", "model_before", "model_after"):
                stage_result[key] = result[key]
        observed, hits = observed_pressure(recipe, observations, holder.events, holder_ready["pid"], baseline_bytes, result)
        stage_result.update(completed=True, pressure_observed=observed, overlap_samples=hits,
                            host_pressure=False, process_identities=identities)
    except Exception as exc:
        errors.append(f"{type(exc).__name__}: {exc}")
        (directory / "failure.txt").write_text(traceback.format_exc(), encoding="utf-8")
    finally:
        # Stop only processes created by this stage, using their original handles.
        try:
            for child in reversed(children):
                try:
                    if child.close():
                        errors.append("owned helper required forced termination")
                    errors.extend(e.get("detail", "helper failure") for e in child.events if e["event"] == "ERROR")
                    if child.process.returncode != 0:
                        errors.append(f"helper exit code {child.process.returncode}")
                except Exception as exc:
                    errors.append(f"owned helper cleanup: {type(exc).__name__}: {exc}")
                    # The original Popen handle still confines termination to our child.
                    if child.process.poll() is None:
                        try:
                            child.process.kill()
                            child.process.wait(timeout=3)
                        except Exception as kill_error:
                            errors.append(f"owned helper emergency cleanup: {type(kill_error).__name__}: {kill_error}")
                finally:
                    stage_result.setdefault("owned_helper_cleanup", []).append({
                        "pid": getattr(child.process, "pid", None),
                        "process_start_time": getattr(child, "process_start_time", None),
                        "returncode": child.process.returncode})
        finally:
            try:
                if server:
                    try:
                        stage_result["server_cleanup"] = server.close()
                        if stage_result["server_cleanup"]["remaining_owned_pids"]:
                            errors.append("private inference descendants did not exit")
                    except Exception as exc:
                        errors.append(f"private server cleanup: {type(exc).__name__}: {exc}")
            finally:
                raw.close()
                trace.close()
    return stage_result


def run_experiment(recipe: Recipe, directory: Path, purpose: str = "standalone") -> dict:
    """Never overwrite evidence. Interrupted runs are sealed as inconclusive."""
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=False)
    trials, observer, complete, guarded = [], None, False, False
    metadata = {"backend": "live-ollama" if recipe.workload.kind == "ollama" else "live-cuda", "purpose": purpose,
                "data_origin": "live measurement", "started_wall_time_ns": time.time_ns(),
                "started_monotonic_ns": time.monotonic_ns(), "seed": recipe.seed,
                "seed_usage": "reserved; the fixed-work probe and action schedule are deterministic",
                "control_order": ["baseline", "pressure", "recovery"],
                "unmeasured": ["power_mode", "direct residency events", "exact engine phase timestamps"],
                "optional_observations": ["gpu_temperature", "gpu_clocks", "AC/battery", "gpu_utilization", "gpu_power"]}
    try:
        sources = list((AGENT / "spillguard").rglob("*.py"))
        sources.extend([AGENT / "requirements.txt", AGENT.parent / "bench" / "spillstress.py"])
        metadata["source_sha256"] = {p.relative_to(AGENT.parent).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                                     for p in sources}
        for source in sources:
            destination = directory / "source" / source.relative_to(AGENT.parent)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
            expected = metadata["source_sha256"][source.relative_to(AGENT.parent).as_posix()]
            if hashlib.sha256(destination.read_bytes()).hexdigest() != expected:
                raise RuntimeError("implementation changed while taking the experiment snapshot")
        source_agent = (directory / "source" / "agent").resolve()
        observer = Observer()
        metadata["environment_signature"] = observer.signature
        metadata["machine"] = observer.facts
        print(f"SpillGuard Repro: {recipe.name} -> {directory}", flush=True)
        for index in range(recipe.protocol.repeats):
            stages = []
            order = ["baseline", "pressure"]
            if recipe.protocol.treatment_order == "paired_randomized":
                random.Random(recipe.seed + index).shuffle(order)
            order.append("recovery")
            for stage in order:
                stages.append(run_stage(recipe, stage, directory / f"trial-{index + 1:03d}-{stage}", observer,
                                        source_agent=source_agent))
                print(f"  trial {index + 1}/{recipe.protocol.repeats} {stage}: "
                      f"{stages[-1]['latency_ms']} ms ({len(stages[-1]['errors'])} errors)", flush=True)
                time.sleep(recipe.protocol.cooldown_ms / 1000)
            stages.sort(key=lambda s: ("baseline", "pressure", "recovery").index(s["stage"]))
            trials.append({"trial": index + 1, "execution_order": order, "stages": stages,
                           "verdict": asdict(classify(recipe, stages))})
            signatures = sorted({s["environment_signature"] for trial in trials for s in trial["stages"]})
            metadata["environment_signature"] = hashlib.sha256(json.dumps(signatures).encode()).hexdigest()
            # Checkpoint every completed block, preserving invalid trials in the denominator.
            seal_bundle(directory, recipe, trials, metadata, complete=False)
            guarded = any("host memory floor" in error or "host commit pressure" in error
                          for result in stages for error in result["errors"])
            if guarded:
                metadata["stopped_reason"] = "host resource guard; remaining planned blocks unexecuted"
                break
        complete = not guarded
    except BaseException as exc:
        metadata["run_error"] = f"{type(exc).__name__}: {exc}"
        raise
    finally:
        try:
            if observer:
                observer.close()
        finally:
            metadata["finished_wall_time_ns"] = time.time_ns()
            report = seal_bundle(directory, recipe, trials, metadata, complete)
    return report
