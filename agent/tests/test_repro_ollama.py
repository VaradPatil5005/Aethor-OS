"""Ollama adapter and evidence contracts using local HTTP fixtures, without models/GPU."""
from dataclasses import asdict, replace
import hashlib
import json

import httpx
import pytest

from spillguard.repro.evidence import classify, seal_bundle
from spillguard.repro.ollama import OllamaClient, _endpoint, local_model, verify_model
from spillguard.repro.spec import Action, MIB, OllamaWorkload, Protocol, Recipe
from spillguard.repro.runner import relay_target_phases


def workload():
    prompt = "Count from 1 to 200 with descriptive phrases."
    return OllamaWorkload("test:local", "a" * 64, "b" * 64, prompt,
                          hashlib.sha256(prompt.encode()).hexdigest(), num_predict=32)


def recipe():
    return Recipe("ollama-test", (Action("holder", 128 * MIB, phase="decode"),), workload=workload(),
                  protocol=Protocol(repeats=1))


def records():
    return [{"model": "test:local", "response": "Hello", "done": False},
            {"model": "test:local", "response": " world", "done": False},
            {"model": "test:local", "response": "", "done": True, "done_reason": "length",
             "load_duration": 1000000, "prompt_eval_duration": 2000000, "prompt_eval_count": 20,
             "eval_count": 32, "eval_duration": 320000000, "total_duration": 323000000}]


def client_with(lines, requests=None):
    client = OllamaClient("http://127.0.0.1:12345")
    client.client.close()
    def respond(request):
        if requests is not None:
            requests.append(json.loads(request.content))
        return httpx.Response(200, content="\n".join(json.dumps(r) for r in lines).encode())
    client.client = httpx.Client(base_url=client.base, transport=httpx.MockTransport(respond))
    return client


def test_workload_round_trip_and_cuda_phase_guard():
    value = recipe()
    assert Recipe.from_dict(json.loads(json.dumps(value.to_dict()))) == value
    with pytest.raises(ValueError, match="CUDA probe"):
        Recipe("cuda", (Action("a", MIB, phase="decode"),))


@pytest.mark.parametrize("field,value", [("model", "../bad:local"), ("model", "no-tag"),
                                        ("model_digest", "short"), ("prompt_sha256", "0" * 64),
                                        ("num_predict", -1), ("num_ctx", 131072),
                                        ("num_gpu", 0), ("temperature", float("nan")),
                                        ("prompt", "z" * 3000)])
def test_invalid_frozen_workloads_rejected(field, value):
    data = asdict(workload())
    data[field] = value
    with pytest.raises(ValueError):
        OllamaWorkload(**data)


@pytest.mark.parametrize("url", ["https://127.0.0.1:12", "http://localhost:12", "http://example.com:12",
                                 "http://127.0.0.1:12/api", "http://user@127.0.0.1:12", "http://127.0.0.1:12?q=1"])
def test_adapter_refuses_remote_or_ambiguous_endpoints(url):
    with pytest.raises(ValueError):
        _endpoint(url)


def test_streamed_timing_options_and_no_output_text_persistence():
    requests, events = [], []
    client = client_with(records(), requests)
    try:
        result = client.generate(workload(), lambda event, **kw: events.append({"event": event, **kw}))
    finally:
        client.close()
    assert result["metric_value"] == 10  # 320 ms / 32 output tokens
    assert result["work_units"] == 32
    assert result["output_sha256"] == hashlib.sha256(b"Hello world").hexdigest()
    assert "Hello" not in json.dumps(result)
    assert [e["event"] for e in events] == ["REQUEST_START", "FIRST_OUTPUT", "SERVER_PHASE_DURATIONS"]
    assert result["request_start_ns"] <= result["measure_start_ns"] <= result["measure_end_ns"]
    assert requests[0]["options"] == {"num_ctx": 2048, "num_predict": 32, "seed": 0,
                                        "temperature": 0, "num_gpu": 999}
    assert requests[0]["prompt"] == workload().prompt


@pytest.mark.parametrize("change", ["missing_final", "missing_stats", "negative_time", "bool_count",
                                   "error", "model_changed", "empty_output", "after_final"])
def test_invalid_streams_are_not_measurements(change):
    lines = records()
    if change == "missing_final":
        lines.pop()
    elif change == "missing_stats":
        lines[-1].pop("eval_duration")
    elif change == "negative_time":
        lines[-1]["load_duration"] = -1
    elif change == "bool_count":
        lines[-1]["eval_count"] = True
    elif change == "error":
        lines = [{"error": "fixture failure"}]
    elif change == "model_changed":
        lines[0]["model"] = "another:local"
    elif change == "empty_output":
        for line in lines:
            line["response"] = ""
    elif change == "after_final":
        lines.append(lines[0])
    client = client_with(lines)
    try:
        with pytest.raises((ValueError, RuntimeError)):
            client.generate(workload(), lambda *a, **kw: None)
    finally:
        client.close()


def matched():
    w = workload()
    state = {"digest": w.model_digest, "context_length": w.num_ctx, "size": 1000, "size_vram": 1000}
    return [{"stage": stage, "completed": True, "errors": [], "latency_ms": 1000,
             "work_units": 32, "workload_signature": "work", "environment_signature": "env",
             "pressure_observed": True, "host_pressure": False, "metric": w.primary_metric,
             "metric_value": value, "server_statistics": {"prompt_eval_count": 20},
             "output_sha256": "output", "thinking_sha256": "thought", "prompt_sha256": w.prompt_sha256,
             "model_before": dict(state), "model_after": dict(state)}
            for stage, value in (("baseline", 10), ("pressure", 30), ("recovery", 11))]


def test_primary_metric_uses_decode_not_wall_time():
    stages = matched()
    assert classify(recipe(), stages).outcome == "FAIL"
    stages[1]["metric_value"] = 10
    stages[1]["latency_ms"] = 999999
    assert classify(recipe(), stages).outcome == "PASS"


def test_warmup_never_triggers_pressure_and_measured_markers_relay_once():
    from types import SimpleNamespace
    sent, relayed = [], set()
    holder = SimpleNamespace(send=sent.append)
    events = [{"event": "REQUEST_START", "at_ns": 1}, {"event": "FIRST_OUTPUT", "at_ns": 2},
              {"event": "READY"}, {"event": "REQUEST_START", "at_ns": 10},
              {"event": "FIRST_OUTPUT", "at_ns": 20}]
    relay_target_phases(events[:2], holder, relayed)
    assert sent == []
    relay_target_phases(events, holder, relayed)
    relay_target_phases(events, holder, relayed)
    assert sent == ["PHASE request 10", "PHASE decode 20"]


@pytest.mark.parametrize("change", ["token_count", "prompt_tokens", "prompt", "output", "context", "offload", "model", "metric"])
def test_changed_task_offload_or_model_is_inconclusive(change):
    stages = matched()
    stage = stages[1]
    if change == "token_count":
        stage["work_units"] = 31
    elif change == "prompt_tokens":
        stage["server_statistics"]["prompt_eval_count"] = 21
    elif change == "prompt":
        stage["prompt_sha256"] = "changed"
    elif change == "output":
        stage["output_sha256"] = "changed"
    elif change == "context":
        stage["model_after"]["context_length"] = 1024
    elif change == "offload":
        stage["model_before"]["size_vram"] = 500
    elif change == "model":
        stage["model_after"]["digest"] = "c" * 64
    elif change == "metric":
        stage["metric_value"] = None
    assert classify(recipe(), stages).outcome == "INCONCLUSIVE"


def test_real_workload_report_is_not_labelled_synthetic(tmp_path):
    stages = matched()
    report = seal_bundle(tmp_path, recipe(), [{"verdict": asdict(classify(recipe(), stages)), "stages": stages}],
                         {"data_origin": "HTTP fixture; not a measurement"})
    assert report["synthetic_workload"] is False
    assert report["primary_metric"] == "decode_ms_per_token"
    assert "frozen local Ollama" in (tmp_path / "report.md").read_text()


def test_local_store_layers_and_manifest_changes_are_checked(tmp_path, monkeypatch):
    monkeypatch.setenv("OLLAMA_MODELS", str(tmp_path))
    blobs = tmp_path / "blobs"
    blobs.mkdir()
    def layer(data, media):
        digest = hashlib.sha256(data).hexdigest()
        (blobs / f"sha256-{digest}").write_bytes(data)
        return {"digest": f"sha256:{digest}", "mediaType": media}
    model = layer(b"tiny fixture model", "application/vnd.ollama.image.model")
    config = layer(b"{}", "config")
    path = tmp_path / "manifests/registry.ollama.ai/library/test/local"
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"layers": [model], "config": config}))
    frozen = local_model("test:local")
    w = replace(workload(), model_digest=frozen["model_digest"], model_blob_digest=frozen["model_blob_digest"])
    assert verify_model(w)["model"] == "test:local"
    path.write_text(path.read_text() + " ")
    with pytest.raises(ValueError, match="frozen"):
        verify_model(w)
    path.write_text(path.read_text().rstrip())
    (blobs / model["digest"].replace(":", "-")).write_bytes(b"corrupt")
    with pytest.raises(ValueError, match="modified"):
        local_model("test:local")


def test_prompt_context_guard_uses_the_actual_hashed_prompt():
    prompt = "a" * 300
    with pytest.raises(ValueError, match="byte bound"):
        replace(workload(), prompt=prompt, prompt_sha256=hashlib.sha256(prompt.encode()).hexdigest(), num_ctx=512)


def test_optional_sensor_failure_does_not_erase_valid_memory_or_become_zero():
    from types import SimpleNamespace
    from spillguard.collector import NvmlSource
    source = NvmlSource.__new__(NvmlSource)
    source.ok, source.handle = True, "owned-test-device"
    source.nv = SimpleNamespace(nvmlDeviceGetMemoryInfo=lambda handle: SimpleNamespace(used=12 * MIB, total=100 * MIB))
    data = source.sample()
    assert data["used_mb"] == 12 and data["total_mb"] == 100
    assert data["temperature_c"] is None
    assert data["power_mw"] is None


def test_collection_lag_includes_later_sources(monkeypatch):
    from types import SimpleNamespace
    from spillguard.collector import Collector
    clock = {"ns": 100}
    monkeypatch.setattr("spillguard.collector.time.monotonic_ns", lambda: clock["ns"])
    col = Collector.__new__(Collector)
    col.primary = SimpleNamespace(luid="luid_0x00000000_0x00000001", name="test", dedicated_vram_mb=100,
                                  budget_local_mb=90, shared_system_mb=200)
    col.pdh = SimpleNamespace(collect=lambda: ({}, {}, {"avail_mb": 4096}), last_errors=[])
    col._refresh_budget = lambda: None
    col.names = SimpleNamespace(prune=lambda live: None)
    col.me = SimpleNamespace(cpu_percent=lambda interval: 0, memory_info=lambda: SimpleNamespace(rss=MIB))
    col.nvml = None
    def delayed_ollama():
        clock["ns"] += 50_000_000
        return []
    col.ollama = SimpleNamespace(sample=delayed_ollama)
    assert col.sample()["collection_duration_ms"] == 50


@pytest.mark.parametrize("command,expected", [("GO\n", True), ("STOP\n", False), ("", False)])
def test_parent_cancellation_before_measurement_is_not_helper_failure(monkeypatch, capsys, command, expected):
    import io
    from spillguard.repro.worker import await_go
    monkeypatch.setattr("sys.stdin", io.StringIO(command))
    assert await_go() is expected
    if not expected:
        assert json.loads(capsys.readouterr().out)["event"] == "CANCELLED"


def test_helper_cleanup_error_still_closes_the_private_server(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from spillguard.repro.runner import run_stage
    actions = []
    class Server:
        endpoint, runtime, signature = "http://127.0.0.1:12345", {}, "runtime"
        def __init__(self, *args):
            pass
        def identities(self):
            return {}
        def close(self):
            actions.append("server-closed")
            return {"remaining_owned_pids": []}
    class BrokenWorker:
        def __init__(self, *args, **kw):
            self.events = []
            self.process = SimpleNamespace(poll=lambda: None, kill=lambda: actions.append("owned-worker-killed"),
                                           wait=lambda timeout: None)
        def ready(self, *args, **kw):
            raise RuntimeError("fixture startup failure")
        def close(self):
            raise RuntimeError("fixture cleanup failure")
    observer = SimpleNamespace(signature="env", facts={}, sample=lambda identities: ({}, {
        "errors": [], "available_host_bytes": 4096 * MIB, "host_commit_pct": 50}))
    monkeypatch.setattr("spillguard.repro.ollama.PrivateServer", Server)
    monkeypatch.setattr("spillguard.repro.runner.Worker", BrokenWorker)
    stage = run_stage(recipe(), "baseline", tmp_path / "stage", observer)
    assert actions == ["owned-worker-killed", "server-closed"]
    assert stage["completed"] is False
    assert any("cleanup failure" in e for e in stage["errors"])


@pytest.mark.parametrize("explicit_floor,expected_mib", [(None, 2048), (1536, 1536)])
def test_freeze_cli_preserves_default_and_records_explicit_host_floor(tmp_path, monkeypatch, explicit_floor, expected_mib):
    from spillguard.repro.cli import main
    monkeypatch.setattr("spillguard.repro.ollama.local_model", lambda model: {
        "model_digest": "a" * 64, "model_blob_digest": "b" * 64})
    prompt = tmp_path / "prompt.txt"
    prompt.write_text("Continue counting to 200.", encoding="utf-8")
    output = tmp_path / "recipe.json"
    argv = ["freeze-ollama", "--model", "test:local", "--prompt-file", str(prompt), "--out", str(output)]
    if explicit_floor:
        argv.extend(["--min-host-mib", str(explicit_floor)])
    assert main(argv) == 0
    frozen = Recipe.load(output)
    assert frozen.protocol.min_available_host_bytes == expected_mib * MIB
    assert frozen.workload.prompt == prompt.read_text()
    assert frozen.workload.num_predict == 128
