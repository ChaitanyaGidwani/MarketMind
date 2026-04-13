from __future__ import annotations

import os
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

A2A_HUB_URL = os.getenv("A2A_HUB_URL")
SELF_URL = os.getenv("EMAIL_AGENT_URL")
USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "chaitanya13197@gmail.com")
RESEND_TO_EMAIL = os.getenv("RESEND_TO_EMAIL", "marketing@yourcompany.com")
SERVICE_VERSION = "1.0.0"
DELIVERY_MODE = "mock"


def is_placeholder_email(value: str | None) -> bool:
    return not value or value in {"chaitanya13197@gmail.com", "marketing@yourcompany.com"}


def resolve_delivery_mode() -> str:
    if USE_MOCK:
        return "mock"
    if not RESEND_API_KEY:
        return "mock"
    if is_placeholder_email(RESEND_FROM_EMAIL) or is_placeholder_email(RESEND_TO_EMAIL):
        return "mock"
    return "resend"


def get_a2a_hub_url() -> str:
    if not A2A_HUB_URL:
        raise RuntimeError("Missing required environment variable: A2A_HUB_URL")
    return A2A_HUB_URL


def get_self_url() -> str:
    if not SELF_URL:
        raise RuntimeError("Missing required environment variable: EMAIL_AGENT_URL")
    return SELF_URL


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
        response = await client.post(f"{get_a2a_hub_url()}/rpc", json=req)
        response.raise_for_status()


@app.on_event("startup")
async def startup() -> None:
    # Check for required env vars on startup
    a2a_hub_url = get_a2a_hub_url()
    self_url = get_self_url()

    global DELIVERY_MODE
    DELIVERY_MODE = resolve_delivery_mode()

    # Register card with the hub
    card = {
        "name": "email_agent",
        "capabilities": ["drip_sequence", "resend_delivery"],
        "url": self_url,
    }
    req = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "agent.register_card",
        "params": {"card": card},
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{a2a_hub_url}/rpc", json=req)
        response.raise_for_status()


def render_drip_sequence_html(sequence: list[dict[str, Any]]) -> str:
    sections = []
    for item in sequence:
        day = item.get("day", "")
        subject = item.get("subject", "")
        preview_text = item.get("preview_text", "")
        html_body = item.get("html_body", "")
        sections.append(
            f"""
            <div style=\"margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;\">
              <p style=\"margin: 0 0 8px; font-weight: 600;\">Day {day}</p>
              <h3 style=\"margin: 0 0 8px;\">{subject}</h3>
              <p style=\"margin: 0 0 12px; color: #4b5563;\">{preview_text}</p>
              <div>{html_body}</div>
            </div>
            """
        )
    return "<html><body>" + "".join(sections) + "</body></html>"


async def send_resend_email(subject: str, html_body: str) -> dict[str, Any]:
    if DELIVERY_MODE == "mock":
        return {"mocked": True, "id": "resend-mock-001"}

    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not set")

    try:
        payload = {
            "from": RESEND_FROM_EMAIL,
            "to": [RESEND_TO_EMAIL],
            "subject": subject,
            "html": html_body,
        }
        headers = {"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post("https://api.resend.com/emails", headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        import sys
        print(f"[email_agent] Error sending email via Resend: {type(e).__name__}: {str(e)}", file=sys.stderr)
        raise


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
            result={"agent": "email_agent", "capability": "drip_sequence", "score": 0.87, "estimated_cost": 40, "eta_minutes": 8},
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
                "html_body": "<h2>Launch Offer</h2><p>Your campaign kit is ready.</p><p><a href='https://yourdomain.com/get-started'>Launch now</a></p>",
            },
        ]
        save_json_output(campaign_id, "emails.json", {"sequence": sequence})

        email_result = await send_resend_email(
            subject=f"MarketMind sequence ready ({campaign_id})",
            html_body=render_drip_sequence_html(sequence),
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
