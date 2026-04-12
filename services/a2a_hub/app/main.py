from __future__ import annotations

import asyncio
import json
import os
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError

from shared.schemas import HealthResponse, JsonRpcError, JsonRpcRequest, JsonRpcResponse, ProgressEvent
from shared.validator import invalid_params_error

app = FastAPI(title="MarketMind A2A Hub", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


ORCHESTRATOR_URL = required_env("ORCHESTRATOR_URL")
SERVICE_VERSION = "1.0.0"

agent_cards: dict[str, dict[str, Any]] = {}
subscribers: dict[str, list[asyncio.Queue[str]]] = defaultdict(list)
event_history: dict[str, list[ProgressEvent]] = defaultdict(list)
sequence_by_campaign: dict[str, int] = defaultdict(int)


def _next_sequence(campaign_id: str) -> int:
    sequence_by_campaign[campaign_id] += 1
    return sequence_by_campaign[campaign_id]


def _to_sse(event: ProgressEvent) -> str:
    return f"id: {event.event_id}\nevent: {event.event_type}\ndata: {event.model_dump_json()}\n\n"


async def publish_event(event: ProgressEvent) -> None:
    event_history[event.campaign_id].append(event)
    payload = _to_sse(event)
    for q in subscribers[event.campaign_id]:
        if q.full():
            _ = q.get_nowait()
        q.put_nowait(payload)


async def forward_orchestrator(req: JsonRpcRequest) -> JsonRpcResponse:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(f"{ORCHESTRATOR_URL}/rpc", json=req.model_dump())
        response.raise_for_status()
        return JsonRpcResponse.model_validate(response.json())


@app.get("/health")
async def health() -> dict[str, str]:
    return HealthResponse(
        service="a2a_hub",
        status="ok",
        version=SERVICE_VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
    ).model_dump()


@app.post("/rpc")
async def rpc(payload: dict[str, Any]) -> JSONResponse:
    try:
        req = JsonRpcRequest.model_validate(payload)
    except ValidationError as exc:
        return JSONResponse(
            JsonRpcResponse(id=payload.get("id"), error=JsonRpcError(**invalid_params_error(exc.errors()))).model_dump()
        )

    if req.method == "agent.register_card":
        card = req.params.get("card", {})
        name = card.get("name")
        if name:
            agent_cards[name] = card
        return JSONResponse(JsonRpcResponse(id=req.id, result={"registered": bool(name)}).model_dump())

    if req.method == "agent.list_cards":
        return JSONResponse(JsonRpcResponse(id=req.id, result={"cards": list(agent_cards.values())}).model_dump())

    if req.method == "agent.publish_event":
        data = dict(req.params.get("event", {}))
        campaign_id = data.get("campaign_id", "unknown")
        data.setdefault("event_id", str(uuid.uuid4()))
        data.setdefault("sequence", _next_sequence(campaign_id))
        data.setdefault("ts", datetime.now(timezone.utc).isoformat())
        try:
            event = ProgressEvent.model_validate(data)
        except ValidationError as exc:
            return JSONResponse(JsonRpcResponse(id=req.id, error=JsonRpcError(**invalid_params_error(exc.errors()))).model_dump())
        await publish_event(event)
        return JSONResponse(JsonRpcResponse(id=req.id, result={"published": True, "sequence": event.sequence}).model_dump())

    if req.method in {"campaign.start", "campaign.status"}:
        out = await forward_orchestrator(req)
        return JSONResponse(out.model_dump())

    return JSONResponse(
        JsonRpcResponse(
            id=req.id,
            error=JsonRpcError(code=-32601, message=f"Method not found: {req.method}"),
        ).model_dump()
    )


@app.get("/events/{campaign_id}")
async def events(campaign_id: str, request: Request) -> StreamingResponse:
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=200)
    subscribers[campaign_id].append(queue)

    for e in event_history.get(campaign_id, []):
        await queue.put(_to_sse(e))

    async def generator():
        heartbeat = 0
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=5)
                    yield payload
                except asyncio.TimeoutError:
                    heartbeat += 1
                    hb_event = {
                        "event_id": f"heartbeat-{heartbeat}",
                        "campaign_id": campaign_id,
                        "event_type": "heartbeat",
                        "sequence": _next_sequence(campaign_id),
                        "payload": {"alive": True},
                        "ts": datetime.now(timezone.utc).isoformat(),
                    }
                    yield f"event: heartbeat\ndata: {json.dumps(hb_event)}\n\n"
        finally:
            subscribers[campaign_id].remove(queue)

    return StreamingResponse(generator(), media_type="text/event-stream")
