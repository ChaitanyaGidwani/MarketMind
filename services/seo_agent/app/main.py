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

app = FastAPI(title="MarketMind SEO Agent", version="0.1.0")
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
SELF_URL = required_env("SEO_AGENT_URL")
USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
SERVICE_VERSION = "1.0.0"

if not USE_MOCK and not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is required when USE_MOCK=false")


def _fallback_seo_brief(goal: str, audience: str, product_description: str, company_name: str) -> dict[str, Any]:
    base_terms = [goal, audience, product_description, company_name, "growth", "marketing", "automation", "ROI", "campaign", "startup"]
    keywords: list[dict[str, Any]] = []
    for idx in range(20):
        term = f"{base_terms[idx % len(base_terms)]} {['strategy', 'tool', 'platform', 'playbook', 'guide'][idx % 5]}".strip()
        keywords.append({"keyword": term, "difficulty": float(30 + idx), "volume": int(500 + idx * 120)})

    return {
        "target_keywords": keywords,
        "blog_titles": [
            f"{goal}: The Complete Guide for {audience}",
            f"How {company_name} Helps {audience} Grow Faster",
            f"{product_description} Tactics That Improve ROI",
            f"{audience.title()} Campaign Checklist for 2026",
            f"From Strategy to Results: {goal}",
        ],
        "meta": {
            "title": f"{company_name} | {goal}",
            "description": f"Discover how {product_description} helps {audience} hit measurable growth goals.",
        },
        "internal_links": [
            "Link landing page to pricing and case studies",
            "Link each blog post to primary product feature page",
            "Use keyword-rich anchors for campaign templates",
            "Add CTA links from educational content to consultation booking",
        ],
    }


async def generate_seo_brief(goal: str, audience: str, product_description: str, company_name: str) -> dict[str, Any]:
    if USE_MOCK:
        return _fallback_seo_brief(goal, audience, product_description, company_name)

    try:
        client = AsyncGroq(api_key=GROQ_API_KEY)
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an SEO strategist. Return JSON only with keys target_keywords, blog_titles, meta, internal_links."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "Generate a production-ready SEO brief. target_keywords must have 20 items with keyword/difficulty/volume. "
                        "blog_titles must have 5 titles. meta must include title and description. internal_links must include 4 actions. "
                        f"Goal: {goal}. Audience: {audience}. Product: {product_description}. Company: {company_name}."
                    ),
                },
            ],
            max_tokens=1500,
        )
        text = response.choices[0].message.content
        payload = json.loads(text or "{}")
    except Exception as e:
        import sys
        print(f"[seo_agent] Error generating SEO brief: {type(e).__name__}: {str(e)}", file=sys.stderr)
        return _fallback_seo_brief(goal, audience, product_description, company_name)

    if not isinstance(payload, dict):
        return _fallback_seo_brief(goal, audience, product_description, company_name)
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
                "agent": "seo_agent",
                "payload": payload,
            }
        },
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{A2A_HUB_URL}/rpc", json=req)
            response.raise_for_status()
    except Exception as e:
        import sys
        print(f"[seo_agent] Warning: Failed to publish event: {type(e).__name__}: {str(e)}", file=sys.stderr)


@app.on_event("startup")
async def register_card() -> None:
    card = {
        "name": "seo_agent",
        "capabilities": ["keyword_research", "meta_tags"],
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
        service="seo_agent",
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
            result={"agent": "seo_agent", "capability": "seo_research", "score": 0.84, "estimated_cost": 25, "eta_minutes": 7},
        ).model_dump()

    if req.method == "task.execute":
        try:
            validated = validate_task_allocation(req.params)
        except JsonRpcValidationException as exc:
            return JsonRpcResponse(id=req.id, error=JsonRpcError(**exc.to_error())).model_dump()

        campaign_id = validated.campaign_id
        goal = validated.goal
        audience = validated.audience
        product_description = validated.product_description or goal
        company_name = validated.company_name or "Your Company"
        budget_allocation = validated.budget_allocation

        await publish_event(campaign_id, "agent.progress", {"stage": "keyword clustering"})
        seo_brief = await generate_seo_brief(goal, audience, product_description, company_name)
        save_json_output(campaign_id, "seo_brief.json", seo_brief)

        spend = min(12.0, budget_allocation * 0.15)
        return JsonRpcResponse(
            id=req.id,
            result={"agent": "seo_agent", "status": "completed", "spend": spend, "assets": seo_brief},
        ).model_dump()

    return JsonRpcResponse(id=req.id, error=JsonRpcError(code=-32601, message=f"Method not found: {req.method}")).model_dump()


@app.get("/outputs/{campaign_id}")
async def outputs(campaign_id: str) -> dict[str, Any]:
    data = read_json_output(campaign_id, "seo_brief.json")
    if data is None:
        return {"error": {"code": 404, "message": "seo brief not found"}}
    return {"campaign_id": campaign_id, "seo_brief": data}
