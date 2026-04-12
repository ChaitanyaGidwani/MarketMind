from __future__ import annotations

import os
import json
import uuid
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from shared.schemas import HealthResponse, JsonRpcError, JsonRpcRequest, JsonRpcResponse
from shared.output_store import read_json_output, save_json_output
from shared.validator import JsonRpcValidationException, invalid_params_error, validate_task_allocation

app = FastAPI(title="MarketMind Email Agent", version="0.1.0")
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


A2A_HUB_URL = required_env("A2A_HUB_URL")
SELF_URL = required_env("EMAIL_AGENT_URL")
USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")
RESEND_TO_EMAIL = os.getenv("RESEND_TO_EMAIL", "demo@example.com")
SERVICE_VERSION = "1.0.0"


async def publish_event(campaign_id: str, event_type: str, payload: dict[str, Any]) -> None:
    req = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "agent.publish_event",
        "params": {
            "event": {
                "campaign_id": campaign_id,
                "event_type": event_type,
                "agent": "email_agent",
                "payload": payload,
            }
        },
    }
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(f"{A2A_HUB_URL}/rpc", json=req)


@app.on_event("startup")
async def register_card() -> None:
    card = {
        "name": "email_agent",
        "capabilities": ["drip_sequence", "resend_delivery"],
        "url": SELF_URL,
    }
    req = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "agent.register_card",
        "params": {"card": card},
    }
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(f"{A2A_HUB_URL}/rpc", json=req)


async def send_resend_email(subject: str, body: str) -> dict[str, Any]:
    if not RESEND_API_KEY:
        return {"mocked": True, "id": "resend-mock-001"}

    payload = {
        "from": RESEND_FROM_EMAIL,
        "to": [RESEND_TO_EMAIL],
        "subject": subject,
        "html": f"<p>{body}</p>",
    }
    headers = {"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post("https://api.resend.com/emails", headers=headers, json=payload)
        return response.json()


@app.get("/health")
async def health() -> dict[str, str]:
    from datetime import datetime, timezone

    return HealthResponse(
        service="email_agent",
        status="ok",
        version=SERVICE_VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
    ).model_dump()


@app.post("/a2a")
async def a2a(payload: dict[str, Any]) -> dict[str, Any]:
    target = payload.get("params", payload)
    try:
        validated = validate_task_allocation(target)
        return {"ok": True, "validated": validated.model_dump()}
    except JsonRpcValidationException as exc:
        return {"ok": False, "error": exc.to_error()}


@app.post("/rpc")
async def rpc(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        req = JsonRpcRequest.model_validate(payload)
    except ValidationError as exc:
        return JsonRpcResponse(id=payload.get("id"), error=JsonRpcError(**invalid_params_error(exc.errors()))).model_dump()

    if req.method == "capability.bid":
        return JsonRpcResponse(
            id=req.id,
            result={"agent": "email_agent", "capability": "drip_email", "score": 0.87, "estimated_cost": 40, "eta_minutes": 8},
        ).model_dump()

    if req.method == "task.execute":
        try:
            validated = validate_task_allocation(req.params)
        except JsonRpcValidationException as exc:
            return JsonRpcResponse(id=req.id, error=JsonRpcError(**exc.to_error())).model_dump()

        campaign_id = validated.campaign_id
        round_number = validated.round
        goal = validated.goal
        audience = validated.audience
        company_name = validated.company_name or "Your Company"
        product_description = validated.product_description or goal
        usp = validated.usp or "faster time-to-value"
        budget_allocation = validated.budget_allocation

        await publish_event(campaign_id, "agent.progress", {"round": round_number, "stage": "building drip sequence"})
        sequence = [
            {
                "day": 0,
                "subject": f"Welcome to {company_name}",
                "preview_text": f"How {product_description} helps {audience}",
                "html_body": f"<h2>Welcome</h2><p>Thanks for checking out {company_name}. We built this for {audience}.</p><p>{product_description}</p>",
            },
            {
                "day": 3,
                "subject": f"How to get value from {company_name}",
                "preview_text": "A short playbook to move from setup to results",
                "html_body": f"<h2>Value Guide</h2><p>Start with one measurable goal: {goal}.</p><p>Our key differentiator is {usp}.</p>",
            },
            {
                "day": 7,
                "subject": f"Ready to launch your campaign?",
                "preview_text": "Activate your plan and track ROI this week",
                "html_body": "<h2>Launch Offer</h2><p>Your campaign kit is ready.</p><p><a href='https://example.com'>Launch now</a></p>",
            },
        ]
        save_json_output(campaign_id, "emails.json", {"sequence": sequence})

        email_result = await send_resend_email(
            subject=f"MarketMind sequence ready ({campaign_id})",
            body=json.dumps(sequence, ensure_ascii=False),
        )

        spend = min(18.0, budget_allocation * 0.3)
        return JsonRpcResponse(
            id=req.id,
            result={"agent": "email_agent", "status": "completed", "spend": spend, "assets": {"sequence": sequence, "delivery": email_result}},
        ).model_dump()

    return JsonRpcResponse(id=req.id, error=JsonRpcError(code=-32601, message=f"Method not found: {req.method}")).model_dump()


@app.get("/outputs/{campaign_id}")
async def outputs(campaign_id: str) -> dict[str, Any]:
    data = read_json_output(campaign_id, "emails.json")
    if data is None:
        return {"error": {"code": 404, "message": "email output not found"}}
    return {"campaign_id": campaign_id, "emails": data}
