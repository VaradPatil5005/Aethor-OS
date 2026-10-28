"""Owned lab subprocesses. JSON on stdin/stdout; never accepts executable commands.

Uses bench.spillstress.Cuda, keeping the existing allocation implementation.
Every subprocess has its own CUDA context and releases only its own allocations.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import queue
import sys
import threading
import time

from .spec import Recipe


def emit(event, **data):
    print(json.dumps({"event": event, "wall_time_ns": time.time_ns(),
                      "monotonic_ns": time.monotonic_ns(), "pid": os.getpid(), **data}), flush=True)


def _touch(cu, ptr, nbytes, value=0):
    cu._chk(cu.lib.cuMemsetD32_v2(ptr, value, nbytes // 4), "repro memset")
    cu._chk(cu.lib.cuCtxSynchronize(), "repro synchronize")


def await_go():
    command = sys.stdin.readline().strip()
    if command == "GO":
        return True
    if command in ("STOP", ""):
        emit("CANCELLED", reason="parent stopped before measured request")
        return False
    raise ValueError("GO phase marker missing")


def ollama_target(recipe, endpoint):
    from .ollama import OllamaClient
    import psutil
    client = OllamaClient(endpoint, recipe.protocol.timeout_s)
    try:
        client.check_model(recipe.workload)
        if recipe.protocol.preparation != "cold":
            client.generate(recipe.workload, emit, warmup=True)
            before = client.running_model(recipe.workload)
        else:
            if client.get("/api/ps").get("models"):
                raise ValueError("cold preparation requires an empty private model server")
            before = None
        if recipe.protocol.preparation == "idle_resume":
            emit("IDLE_START", duration_ms=recipe.protocol.idle_ms)
            time.sleep(recipe.protocol.idle_ms / 1000)
            emit("IDLE_END")
        emit("READY", process_start_time=psutil.Process().create_time(), model_state=before)
        if not await_go():
            return
        result = client.generate(recipe.workload, emit)
        after = client.running_model(recipe.workload)
        client.check_model(recipe.workload)
        emit("RESULT", **result, model_before=before, model_after=after)
    finally:
        client.close()


def main():
    cu, blocks = None, {}
    try:
        role = sys.argv[1]
        recipe = Recipe.from_dict(json.loads(sys.stdin.readline()))
        if role == "target" and recipe.workload.kind == "ollama":
            ollama_target(recipe, sys.argv[2])
            return 0
        # This module can be launched from agent/ or the repository root.
        sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
        from bench.spillstress import Cuda
        import psutil
        cu = Cuda()
        if role == "target":
            rc, ptr = cu.alloc(recipe.workload.allocated_bytes)
            cu._chk(rc, "target allocation")
            blocks["target"] = ptr
            if recipe.protocol.preparation != "cold":
                until = time.monotonic() + recipe.workload.warmup_ms / 1000
                _touch(cu, ptr, recipe.workload.allocated_bytes)
                while time.monotonic() < until:
                    _touch(cu, ptr, recipe.workload.allocated_bytes)
            if recipe.protocol.preparation == "idle_resume":
                emit("IDLE_START", duration_ms=recipe.protocol.idle_ms)
                time.sleep(recipe.protocol.idle_ms / 1000)
                emit("IDLE_END")
        elif role != "pressure":
            raise ValueError("unknown worker role")
        emit("READY", process_start_time=psutil.Process().create_time(), device=cu.name)
        if not await_go():
            return 0
        if role == "target":
            start = time.monotonic_ns()
            emit("PHASE_START", phase="measure")
            for i in range(recipe.workload.iterations):
                cu._chk(cu.lib.cuMemsetD32_v2(blocks["target"], i, recipe.workload.allocated_bytes // 4),
                        "target memset")
            cu._chk(cu.lib.cuCtxSynchronize(), "target synchronize")
            end = time.monotonic_ns()
            emit("RESULT", latency_ms=(end - start) / 1e6, work_units=recipe.workload.iterations,
                 measure_start_ns=start, measure_end_ns=end)
        else:
            stop = threading.Event()
            phases = queue.Queue()

            def listen():
                # EOF (parent gone) is also an immediate stop request.
                for command in sys.stdin:
                    if command.strip() == "STOP":
                        break
                    phases.put(command.strip())
                stop.set()

            threading.Thread(target=listen, daemon=True).start()
            start = time.monotonic()
            anchors = {"pressure": time.monotonic_ns()}
            emit("PHASE_START", phase="pressure")
            pending = set(a.id for a in recipe.actions)
            done, last_touch = set(), {}
            arithmetic = None
            if any(a.mode == "compute" for a in recipe.actions):
                from .arithmetic import ArithmeticControl
                arithmetic = ArithmeticControl(cu)
            while not stop.is_set() and time.monotonic() - start < recipe.protocol.timeout_s:
                while not phases.empty():
                    parts = phases.get_nowait().split()
                    if len(parts) != 3 or parts[0] != "PHASE" or parts[1] not in ("request", "decode"):
                        raise ValueError("invalid phase marker")
                    if parts[1] in anchors:
                        raise ValueError("duplicate phase marker")
                    anchor = int(parts[2])
                    if anchor <= 0 or anchor > time.monotonic_ns():
                        raise ValueError("invalid phase timestamp")
                    anchors[parts[1]] = anchor
                    emit("PHASE_SYNC", phase=parts[1], anchor_ns=anchor,
                         dispatch_lag_ms=(time.monotonic_ns() - anchor) / 1e6)
                for action in recipe.actions:
                    if action.id in done or action.phase not in anchors:
                        continue
                    elapsed_ms = (time.monotonic_ns() - anchors[action.phase]) / 1e6
                    if action.id in pending and elapsed_ms >= action.start_ms:
                        if elapsed_ms >= action.start_ms + action.duration_ms:
                            raise RuntimeError(f"action window missed: {action.id}")
                        if psutil.virtual_memory().available < recipe.protocol.min_available_host_bytes:
                            raise RuntimeError("host memory floor reached before allocation")
                        rc, ptr = cu.alloc(action.allocated_bytes)
                        cu._chk(rc, f"pressure allocation {action.id}")
                        blocks[action.id] = ptr
                        _touch(cu, ptr, action.allocated_bytes)
                        pending.remove(action.id)
                        last_touch[action.id] = elapsed_ms
                        emit("ALLOC", action_id=action.id, requested_bytes=action.allocated_bytes)
                    if action.id not in blocks:
                        continue
                    if elapsed_ms >= action.start_ms + action.duration_ms:
                        cu._chk(cu.lib.cuMemFree_v2(blocks.pop(action.id)), "pressure release")
                        done.add(action.id)
                        emit("RELEASE", action_id=action.id)
                    elif action.mode == "compute":
                        duration = arithmetic.run(blocks[action.id])
                        emit("COMPUTE", action_id=action.id, kernel_duration_ms=duration * 1000,
                             duty_requested_pct=action.compute_duty_pct)
                        stop.wait(min(.05, duration * (100 / action.compute_duty_pct - 1)))
                    elif action.touch_interval_ms and elapsed_ms - last_touch[action.id] >= action.touch_interval_ms:
                        _touch(cu, blocks[action.id], action.allocated_bytes)
                        last_touch[action.id] = elapsed_ms
                        emit("TOUCH", action_id=action.id)
                if psutil.virtual_memory().available < recipe.protocol.min_available_host_bytes:
                    raise RuntimeError("host memory floor reached")
                stop.wait(0.01)
        return 0
    except Exception as exc:
        emit("ERROR", detail=f"{type(exc).__name__}: {exc}")
        return 1
    finally:
        if cu:
            for action_id, ptr in blocks.items():
                rc = cu.lib.cuMemFree_v2(ptr)
                if rc:
                    emit("ERROR", detail=f"CUDA allocation release failed: {rc}")
                else:
                    emit("RELEASE", action_id=action_id, cleanup=True)
            cu.lib.cuCtxDestroy_v2.argtypes = [type(cu.ctx)]
            rc = cu.lib.cuCtxDestroy_v2(cu.ctx)
            if rc:
                emit("ERROR", detail=f"CUDA context release failed: {rc}")
        emit("CLOSED")


if __name__ == "__main__":
    sys.exit(main())
