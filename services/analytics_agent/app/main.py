from __future__ import annotations

import os
import json
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from shared.output_store import read_json_output, save_json_output
from shared.schemas import HealthResponse, JsonRpcError, JsonRpcRequest, JsonRpcResponse
from shared.rag_store import store_campaign_result
from shared.validator import JsonRpcValidationException, invalid_params_error, validate_task_allocation

app = FastAPI(title="MarketMind Analytics Agent", version="0.1.0")
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
SELF_URL = required_env("ANALYTICS_AGENT_URL")
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
                "agent": "analytics_agent",
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
        print(f"[analytics_agent] Warning: Failed to publish event: {type(e).__name__}: {str(e)}", file=sys.stderr)


@app.on_event("startup")
async def register_card() -> None:
    card = {
        "name": "analytics_agent",
        "capabilities": ["roi_analysis", "budget_reallocation"],
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
    return HealthResponse(
        service="analytics_agent",
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
            result={"agent": "analytics_agent", "capability": "roi_analysis", "score": 0.95, "estimated_cost": 10, "eta_minutes": 4},
        ).model_dump()

    if req.method == "task.execute":
        try:
            validated = validate_task_allocation(req.params)
        except JsonRpcValidationException as exc:
            return JsonRpcResponse(id=req.id, error=JsonRpcError(**exc.to_error())).model_dump()

        campaign_id = validated.campaign_id
        await publish_event(campaign_id, "agent.progress", {"stage": "calculating ROI"})
        round_number = validated.round
        budget = float(req.params.get("budget", 0))
        spent_so_far = float(req.params.get("spent_so_far", 0))
        agent_results = req.params.get("agent_results", {})

        synthetic_revenue = round(spent_so_far * (1.2 if round_number == 1 else 1.35), 2)
        roi = 0.0 if spent_so_far == 0 else round((synthetic_revenue - spent_so_far) / spent_so_far, 3)
        should_renegotiate = round_number < 3 and roi < 0.3

        strategy_report = {
            "recommended_budget_split": {
                "content_agent": 0.22,
                "ad_agent": 0.43,
                "email_agent": 0.20,
                "seo_agent": 0.15,
            },
            "reasoning": [
                "Paid ads are prioritized for immediate impressions and clicks.",
                "Content and email support conversion and nurture depth.",
                "SEO compounds over longer timeline horizons.",
            ],
            "expected_kpis": {
                "google_ads": {"ctr": 0.028, "impressions": 32000},
                "email": {"open_rate": 0.37, "ctr": 0.08},
                "seo": {"impressions": 14000, "ctr": 0.021},
            },
            "timeline_recommendations": [
                "Day 0-1: Launch paid + welcome email",
                "Day 2-4: Publish SEO blog and test ad variants",
                "Day 5-7: Shift budget to best-performing creatives",
            ],
            "roi": roi,
        }
        save_json_output(campaign_id, "strategy.json", strategy_report)

        if not should_renegotiate or round_number >= 3:
            for agent_id, agent_result in agent_results.items():
                store_campaign_result(
                    campaign_id,
                    agent_id,
                    json.dumps(agent_result, ensure_ascii=False, sort_keys=True, default=str),
                    roi,
                )

        return JsonRpcResponse(
            id=req.id,
            result={
                "agent": "analytics_agent",
                "status": "completed",
                "spent": 0.0,
                "metrics": {
                    "budget": budget,
                    "spent_so_far": spent_so_far,
                    "synthetic_revenue": synthetic_revenue,
                    "roi": roi,
                    "agent_count": len(agent_results),
                },
                "strategy": strategy_report,
                "should_renegotiate": should_renegotiate,
            },
        ).model_dump()

    return JsonRpcResponse(id=req.id, error=JsonRpcError(code=-32601, message=f"Method not found: {req.method}")).model_dump()


@app.get("/outputs/{campaign_id}")
async def outputs(campaign_id: str) -> dict[str, Any]:
    data = read_json_output(campaign_id, "strategy.json")
    if data is None:
        return {"error": {"code": 404, "message": "strategy output not found"}}
    return {"campaign_id": campaign_id, "strategy": data}
