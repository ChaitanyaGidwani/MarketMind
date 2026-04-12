from __future__ import annotations

import os
import json
import uuid
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from groq import AsyncGroq
from pydantic import ValidationError

from shared.schemas import HealthResponse, JsonRpcError, JsonRpcRequest, JsonRpcResponse
from shared.output_store import read_json_output, save_json_output
from shared.validator import JsonRpcValidationException, invalid_params_error, validate_task_allocation

app = FastAPI(title="MarketMind Ad Agent", version="0.1.0")
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
SELF_URL = required_env("AD_AGENT_URL")
USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
SERVICE_VERSION = "1.0.0"

if not USE_MOCK and not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is required when USE_MOCK=false")


def _fallback_ads(goal: str, audience: str, company_name: str, product_description: str, usp: str) -> dict[str, Any]:
    return {
        "google_ads": {
            "headlines": [
                f"{company_name} for Growth"[:30],
                f"Launch {goal}"[:30],
                f"Built for {audience}"[:30],
                f"Scale with {company_name}"[:30],
                "Faster ROI, Clear Plan"[:30],
            ],
            "descriptions": [
                f"{product_description} helps teams ship campaigns quickly and measure ROI."[:90],
                f"Designed for {audience} with clear reporting and optimization loops."[:90],
                f"Switch to a faster workflow powered by {usp}."[:90],
                "Set goals, launch assets, and optimize spend from one flow."[:90],
            ],
        },
        "meta_ads": {
            "primary_texts": [
                f"{company_name} helps {audience} launch faster with a complete campaign system.",
                f"Need better marketing outcomes? {product_description}",
                f"Turn strategy into pipeline with {usp}.",
            ],
            "headlines": [
                f"Launch With {company_name}",
                "From Brief to ROI",
                "Campaigns That Convert",
            ],
            "descriptions": [
                "Create assets, launch channels, and monitor results in one place.",
                "Optimize spend with performance feedback each round.",
                "Built for lean teams that need speed and clarity.",
            ],
        },
        "audience_targeting": {
            "core": audience,
            "geo": "US",
            "age": "25-45",
            "interests": ["startup", "saas", "growth marketing", "automation"],
        },
    }


async def generate_ads(goal: str, audience: str, company_name: str, product_description: str, usp: str) -> dict[str, Any]:
    if USE_MOCK:
        return _fallback_ads(goal, audience, company_name, product_description, usp)

    client = AsyncGroq(api_key=GROQ_API_KEY)
    response = await client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a performance marketing specialist. Return valid JSON only with keys "
                    "google_ads, meta_ads, audience_targeting."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Create campaign assets. "
                    "google_ads must include headlines (5 max 30 chars each) and descriptions (4 max 90 chars each). "
                    "meta_ads must include primary_texts (3), headlines (3), descriptions (3). "
                    "audience_targeting must include core, geo, age, interests. "
                    f"Goal: {goal}. Audience: {audience}. Company: {company_name}. "
                    f"Product: {product_description}. USP: {usp}."
                ),
            },
        ],
        max_tokens=1200,
    )
    text = response.choices[0].message.content
    try:
        payload = json.loads(text or "{}")
    except Exception as exc:
        raise RuntimeError("Failed to parse Groq ad payload JSON") from exc

    if not isinstance(payload, dict):
        raise RuntimeError("Invalid Groq ad payload format")
    return payload


async def publish_event(campaign_id: str, event_type: str, payload: dict[str, Any]) -> None:
    req = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "agent.publish_event",
        "params": {
            "event": {
                "campaign_id": campaign_id,
                "event_type": event_type,
                "agent": "ad_agent",
                "payload": payload,
            }
        },
    }
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(f"{A2A_HUB_URL}/rpc", json=req)


@app.on_event("startup")
async def register_card() -> None:
    card = {
        "name": "ad_agent",
        "capabilities": ["google_ads_sandbox", "meta_ads_sandbox", "ad_variants"],
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


@app.get("/health")
async def health() -> dict[str, str]:
    from datetime import datetime, timezone

    return HealthResponse(
        service="ad_agent",
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
            result={"agent": "ad_agent", "capability": "paid_ads", "score": 0.89, "estimated_cost": 120, "eta_minutes": 10},
        ).model_dump()

    if req.method == "task.execute":
        try:
            validated = validate_task_allocation(req.params)
        except JsonRpcValidationException as exc:
            return JsonRpcResponse(id=req.id, error=JsonRpcError(**exc.to_error())).model_dump()

        campaign_id = validated.campaign_id
        goal = validated.goal
        audience = validated.audience
        company_name = validated.company_name or "Your Company"
        product_description = validated.product_description or goal
        usp = validated.usp or "fast measurable ROI"
        budget_allocation = validated.budget_allocation
        await publish_event(campaign_id, "agent.progress", {"stage": "building Google/Meta sandbox ad sets"})

        result = await generate_ads(goal, audience, company_name, product_description, usp)
        save_json_output(campaign_id, "ads.json", result)

        spend = min(budget_allocation, budget_allocation * 0.85)

        return JsonRpcResponse(
            id=req.id,
            result={"agent": "ad_agent", "status": "completed", "spend": spend, "assets": result},
        ).model_dump()

    return JsonRpcResponse(id=req.id, error=JsonRpcError(code=-32601, message=f"Method not found: {req.method}")).model_dump()


@app.get("/outputs/{campaign_id}")
async def outputs(campaign_id: str) -> dict[str, Any]:
    data = read_json_output(campaign_id, "ads.json")
    if data is None:
        return {"error": {"code": 404, "message": "ads output not found"}}
    return {"campaign_id": campaign_id, "ads": data}
