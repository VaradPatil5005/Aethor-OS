"""Pinned local Ollama workloads and disposable Windows job-owned inference servers.

Only a private loopback server is used. No pulls, normal-session unloads or changes
to installed manifests are performed. The HTTP adapter is independent of CUDA.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import time
from urllib.parse import urlsplit

import httpx

from .spec import OllamaWorkload


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def local_model(model: str, verify: bool = True):
    from ..gguf_fit import ollama_models_dir
    if not re.fullmatch(r"[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+", model):
        raise ValueError("use an explicit installed library model:tag")
    name, tag = model.split(":")
    root = ollama_models_dir().resolve()
    manifest = root / "manifests" / "registry.ollama.ai" / "library" / name / tag
    raw = manifest.read_bytes()
    data = json.loads(raw)
    layers = data.get("layers", [])
    model_layer = next((layer for layer in layers if layer.get("mediaType") == "application/vnd.ollama.image.model"), None)
    if not model_layer:
        raise ValueError("model has no local weights layer; cloud/remote models are unsupported")
    for layer in [data["config"], *layers]:
        digest = layer.get("digest", "")
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
            raise ValueError("unsupported local layer digest")
        blob = root / "blobs" / digest.replace(":", "-")
        if not blob.is_file() or (verify and sha256_file(blob) != digest[7:]):
            raise ValueError("missing or modified installed model layer")
    return {"model": model, "model_digest": hashlib.sha256(raw).hexdigest(),
            "model_blob_digest": model_layer["digest"][7:], "models_dir": str(root)}


def verify_model(workload: OllamaWorkload):
    installed = local_model(workload.model)
    if any(installed[key] != getattr(workload, key) for key in ("model_digest", "model_blob_digest")):
        raise ValueError("installed model no longer matches the frozen recipe")
    return installed


def _endpoint(url):
    parts = urlsplit(url)
    if (parts.scheme != "http" or parts.hostname != "127.0.0.1" or not parts.port
            or parts.username or parts.password or parts.path not in ("", "/") or parts.query or parts.fragment):
        raise ValueError("Ollama experiment endpoint must be a literal IPv4 loopback origin")
    return url.rstrip("/")


class OllamaClient:
    def __init__(self, endpoint: str, timeout_s: float = 60):
        self.base = _endpoint(endpoint)
        self.client = httpx.Client(base_url=self.base, timeout=timeout_s, trust_env=False,
                                   follow_redirects=False)

    def get(self, path):
        response = self.client.get(path)
        response.raise_for_status()
        return response.json()

    def check_model(self, workload):
        models = self.get("/api/tags").get("models", [])
        model = next((m for m in models if m.get("name") == workload.model), None)
        if not model or model.get("digest", "").removeprefix("sha256:") != workload.model_digest:
            raise ValueError("server model digest differs from frozen recipe")

    def running_model(self, workload):
        model = next((m for m in self.get("/api/ps").get("models", [])
                      if m.get("name") == workload.model), None)
        if not model or model.get("digest", "").removeprefix("sha256:") != workload.model_digest:
            raise ValueError("target model is not resident in the private server")
        return {k: model.get(k) for k in ("name", "digest", "size", "size_vram", "context_length")}

    def generate(self, workload: OllamaWorkload, emit, warmup=False):
        prompt = workload.warmup_prompt if warmup else workload.prompt
        request = {"model": workload.model, "prompt": prompt, "stream": True, "raw": False,
                   "keep_alive": "2m", "options": {
                       "num_ctx": workload.num_ctx, "num_predict": 8 if warmup else workload.num_predict,
                       "seed": workload.generation_seed, "temperature": workload.temperature,
                       "num_gpu": workload.num_gpu}}
        started = time.monotonic_ns()
        emit("REQUEST_START", phase="warmup" if warmup else "request", at_ns=started)
        first_output, final, output, thinking, chunks = None, None, hashlib.sha256(), hashlib.sha256(), 0
        with self.client.stream("POST", "/api/generate", json=request) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                if final is not None:
                    raise ValueError("extra response after final generation record")
                if len(line) > 1024 * 1024 or chunks >= 100000:
                    raise ValueError("generation stream exceeded the bounded protocol")
                record = json.loads(line)
                chunks += 1
                if record.get("error"):
                    raise RuntimeError(f"Ollama generation failed: {record['error']}")
                if record.get("model") != workload.model:
                    raise ValueError("stream model changed")
                text, thought = record.get("response", ""), record.get("thinking", "")
                if not isinstance(text, str) or not isinstance(thought, str):
                    raise ValueError("malformed generation output")
                output.update(text.encode("utf-8"))
                thinking.update(thought.encode("utf-8"))
                if first_output is None and (text or thought):
                    first_output = time.monotonic_ns()
                    emit("FIRST_OUTPUT", phase="decode", at_ns=first_output,
                         marker_source="client-observed first nonempty output; not exact engine phase boundary")
                if record.get("done") is True:
                    final = record
        ended = time.monotonic_ns()
        if not final or first_output is None:
            raise ValueError("generation lacks final timings or visible output")
        fields = ("load_duration", "prompt_eval_duration", "prompt_eval_count", "eval_duration", "eval_count", "total_duration")
        for key in fields:
            value = final.get(key)
            if type(value) is not int or value < 0:
                raise ValueError(f"missing or invalid server statistic: {key}")
        if final["eval_count"] < 1 or final["eval_duration"] < 1 or final["prompt_eval_count"] < 1:
            raise ValueError("empty or untimed generation")
        result = {"latency_ms": (ended - started) / 1e6,
                  "metric_value": final["eval_duration"] / final["eval_count"] / 1e6,
                  "metric": workload.primary_metric, "work_units": final["eval_count"],
                  "measure_start_ns": first_output, "measure_end_ns": ended,
                  "request_start_ns": started, "time_to_first_output_ms": (first_output - started) / 1e6,
                  "output_sha256": output.hexdigest(), "thinking_sha256": thinking.hexdigest(),
                  "prompt_sha256": workload.prompt_sha256 if not warmup else hashlib.sha256(prompt.encode()).hexdigest(),
                  "done_reason": final.get("done_reason"), "server_statistics": {k: final[k] for k in fields}}
        emit("SERVER_PHASE_DURATIONS", load_ns=final["load_duration"], prefill_ns=final["prompt_eval_duration"],
             decode_ns=final["eval_duration"], source="server-reported aggregate durations; not timestamped phase boundaries")
        return result

    def close(self):
        self.client.close()


class PrivateServer:
    """Windows job object owns the server and all inference descendants, even on crash."""
    def __init__(self, workload, directory):
        self.process = self.job = None
        self.log = None
        self.closed = False
        if sys.platform != "win32":
            raise RuntimeError("owned Ollama experiments currently require Windows job objects")
        installed = verify_model(workload)
        executable = shutil.which("ollama")
        if not executable:
            raise RuntimeError("Ollama executable is not installed")
        import win32job
        import win32api
        import psutil
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        self.endpoint = f"http://127.0.0.1:{port}"
        self.env_settings = {"OLLAMA_HOST": f"127.0.0.1:{port}", "OLLAMA_MODELS": installed["models_dir"],
                             "OLLAMA_NUM_PARALLEL": "1", "OLLAMA_MAX_LOADED_MODELS": "1",
                             "OLLAMA_CONTEXT_LENGTH": str(workload.num_ctx), "OLLAMA_FLASH_ATTENTION": "1",
                             "OLLAMA_KV_CACHE_TYPE": "f16", "OLLAMA_NO_CLOUD": "1", "OLLAMA_NOPRUNE": "1"}
        env = dict(os.environ)
        # Do not inherit experimental runtime overrides or device masks from unrelated sessions.
        for key in list(env):
            if key.startswith("OLLAMA_") or key in ("CUDA_VISIBLE_DEVICES", "GGML_CUDA_ENABLE_UNIFIED_MEMORY"):
                env.pop(key)
        env.update(self.env_settings)
        self.log = (directory / "ollama-server.log").open("x", encoding="utf-8")
        try:
            self.job = win32job.CreateJobObject(None, "")
            limits = win32job.QueryInformationJobObject(self.job, win32job.JobObjectExtendedLimitInformation)
            limits["BasicLimitInformation"]["LimitFlags"] |= win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            win32job.SetInformationJobObject(self.job, win32job.JobObjectExtendedLimitInformation, limits)
            self.process = subprocess.Popen([executable, "serve"], env=env, stdin=subprocess.DEVNULL,
                                            stdout=self.log, stderr=subprocess.STDOUT,
                                            creationflags=subprocess.CREATE_NO_WINDOW)
            win32job.AssignProcessToJobObject(self.job, int(self.process._handle))
            self.start_time = psutil.Process(self.process.pid).create_time()
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                if self.process.poll() is not None:
                    raise RuntimeError("private Ollama server failed to start; inspect its local log")
                # Attest the port owner before any HTTP request, avoiding a port-selection race.
                if any(c.status == psutil.CONN_LISTEN and c.laddr.ip == "127.0.0.1" and c.laddr.port == port
                       for c in psutil.Process(self.process.pid).net_connections(kind="tcp")):
                    break
                time.sleep(0.05)
            else:
                raise TimeoutError("private Ollama server startup timeout")
            client = OllamaClient(self.endpoint, 1)
            try:
                # A listening socket can precede GPU discovery/HTTP readiness.
                while time.monotonic() < deadline:
                    if self.process.poll() is not None:
                        raise RuntimeError("private server exited while initializing")
                    try:
                        version = client.get("/api/version")["version"]
                        break
                    except (httpx.TimeoutException, httpx.ConnectError):
                        time.sleep(0.1)
                else:
                    raise TimeoutError("private Ollama HTTP initialization timeout")
                client.check_model(workload)
            finally:
                client.close()
            self.runtime = {"version": version, "executable_sha256": sha256_file(executable),
                            "settings": {k: v for k, v in self.env_settings.items()
                                         if k not in ("OLLAMA_HOST", "OLLAMA_MODELS")}}
            self.signature = hashlib.sha256(json.dumps(self.runtime, sort_keys=True).encode()).hexdigest()
        except BaseException:
            if self.job is not None:
                win32api.CloseHandle(self.job)
                self.job = None
            if self.process and self.process.poll() is None:
                self.process.terminate()
                self.process.wait(timeout=5)
            self.log.close()
            raise

    def identities(self):
        import psutil
        try:
            root = psutil.Process(self.process.pid)
            if root.create_time() != self.start_time:
                return {}
            result = {}
            for proc in [root, *root.children(recursive=True)]:
                try:
                    result[proc.pid] = proc.create_time()
                except psutil.NoSuchProcess:
                    pass
            return result
        except psutil.NoSuchProcess:
            return {}

    def close(self):
        import psutil
        import win32api
        identities = self.identities()
        if not self.closed:
            self.closed = True
            win32api.CloseHandle(self.job)
            self.job = None
            try:
                self.process.wait(timeout=5)
            finally:
                self.log.close()
        remaining = []
        for pid, started in identities.items():
            try:
                proc = psutil.Process(pid)
                if proc.create_time() == started:
                    proc.wait(timeout=3)
            except psutil.NoSuchProcess:
                pass
            except psutil.TimeoutExpired:
                remaining.append(pid)
        return {"job_owned_identities": identities, "remaining_owned_pids": remaining,
                "kill_on_job_close": True}
