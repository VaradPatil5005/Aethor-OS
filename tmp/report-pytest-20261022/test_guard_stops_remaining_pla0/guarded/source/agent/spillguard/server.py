"""Local HTTP + WebSocket server. Serves the AetherOS build itself, so the browser
talks same-origin to 127.0.0.1 and never makes a cross-site call to loopback.

Security model (see docs): bind 127.0.0.1 only; random per-session token required
for /ws and /api/*; Host and Origin checked against the loopback origin to stop
DNS rebinding and other sites; the API is read-only (launching processes is
CLI-only, behind an interactive confirm).
"""
from __future__ import annotations

import asyncio
import hmac
import json
import secrets
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import gguf_fit
from .advisor import advise
from .gguf_fit import FitConfig
from .runtime import PROTOCOL_VERSION, Runtime


def create_app(rt: Runtime, token: str, port: int, dist: Path | None, dev_origins: list[str] | None = None) -> FastAPI:
    app = FastAPI(title="SpillGuard", docs_url=None, redoc_url=None, openapi_url=None)
    allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
    allowed_origins = {f"http://{h}" for h in allowed_hosts} | set(dev_origins or [])
    queues: set[asyncio.Queue] = set()
    loop_holder: dict = {}

    def check(host: str | None, origin: str | None, given: str | None) -> None:
        if host not in allowed_hosts:
            raise HTTPException(403, "bad host")
        if origin is not None and origin not in allowed_origins:
            raise HTTPException(403, "bad origin")
        if not given or not hmac.compare_digest(given, token):
            raise HTTPException(401, "bad token")

    def guard(req: Request) -> None:
        auth = req.headers.get("authorization", "")
        check(req.headers.get("host"), req.headers.get("origin"), auth.removeprefix("Bearer ") or None)

    def on_frame(frame: dict) -> None:
        loop = loop_holder.get("loop")
        if not loop:
            return
        msg = json.dumps({"type": "frame", "frame": frame}, separators=(",", ":"))
        for q in list(queues):
            loop.call_soon_threadsafe(_offer, q, msg)

    def _offer(q: asyncio.Queue, msg: str) -> None:
        if q.full():  # slow client: drop the oldest frame rather than buffer without bound
            q.get_nowait()
        q.put_nowait(msg)

    @app.on_event("startup")
    async def _startup() -> None:
        loop_holder["loop"] = asyncio.get_running_loop()
        rt.subscribers.append(on_frame)

    @app.websocket("/ws")
    async def ws(sock: WebSocket) -> None:
        try:
            check(sock.headers.get("host"), sock.headers.get("origin"), sock.query_params.get("token"))
        except HTTPException as e:
            if e.status_code == 403:  # wrong Host/Origin: refuse the handshake outright
                await sock.close(code=1008)
                return
            # Bad token: accept only to deliver close code 4401 (a refused handshake reaches the
            # browser as a bare 1006, which would make the client retry forever). Nothing is sent.
            await sock.accept()
            await sock.close(code=4401)
            return
        await sock.accept()
        q: asyncio.Queue = asyncio.Queue(maxsize=30)
        queues.add(q)
        try:
            with rt.lock:
                hello = {"type": "hello", "protocol": PROTOCOL_VERSION, "machine": rt.facts,
                         "params": rt.analyzer.p.to_dict(), "history": list(rt.history)[-120:],
                         "events": list(rt.events)[-100:]}
            await sock.send_text(json.dumps(hello, separators=(",", ":")))
            while True:
                await sock.send_text(await q.get())
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            queues.discard(q)

    @app.get("/api/status")
    def status(req: Request):
        guard(req)
        with rt.lock:
            return {"frame": rt.latest, "events": list(rt.events)[-50:]}

    @app.get("/api/facts")
    def facts(req: Request):
        guard(req)
        return rt.facts

    @app.get("/api/models")
    def models(req: Request):
        guard(req)
        return {"ollama": gguf_fit.list_ollama_models()}

    @app.post("/api/advise")
    async def api_advise(req: Request):
        guard(req)
        body = await req.json()
        try:
            m = gguf_fit.load_model(str(body["model"]))
        except Exception as e:
            return JSONResponse({"error": f"cannot read model: {e}"}, status_code=400)
        kv = body.get("kv_type", "f16")
        cfg = FitConfig(n_ctx=int(body.get("n_ctx", 4096)), kv_type=kv, n_gpu_layers=int(body.get("n_gpu_layers", 999)),
                        flash_attn=bool(body.get("flash_attn", kv != "f16" or gguf_fit.load_calibration().get("runtime_flash_attn"))), n_parallel=int(body.get("n_parallel", 1)))
        with rt.lock:
            frame = rt.latest
        if frame is None:
            return JSONResponse({"error": "no telemetry yet"}, status_code=503)
        return advise(m, cfg, frame, rt.peaks, long_lived=bool(body.get("long_lived", True)))

    if dist and (dist / "index.html").exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}")
        def spa(path: str, req: Request):
            if req.headers.get("host") not in allowed_hosts:
                raise HTTPException(403, "bad host")
            f = (dist / path).resolve()
            if path and f.is_file() and dist.resolve() in f.parents:
                return FileResponse(f)
            return FileResponse(dist / "index.html")

    return app


def new_token() -> str:
    return secrets.token_urlsafe(24)
