from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, cast

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import DateTime, Float, Integer, String, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from shared.schemas import CampaignBrief, HealthResponse, JsonRpcError, JsonRpcRequest, JsonRpcResponse
from shared.output_store import list_output_files, read_json_output
from shared.validator import invalid_params_error
from .output_bundle import create_campaign_zip

app = FastAPI(title="MarketMind Orchestrator", version="0.1.0")
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


DATABASE_URL = required_env("DATABASE_URL")
A2A_HUB_URL = required_env("A2A_HUB_URL")
CONTENT_AGENT_URL = required_env("CONTENT_AGENT_URL")
AD_AGENT_URL = required_env("AD_AGENT_URL")
EMAIL_AGENT_URL = required_env("EMAIL_AGENT_URL")
SEO_AGENT_URL = required_env("SEO_AGENT_URL")
ANALYTICS_AGENT_URL = required_env("ANALYTICS_AGENT_URL")
SERVICE_VERSION = "1.0.0"

AGENTS = {
    "content_agent": CONTENT_AGENT_URL,
    "ad_agent": AD_AGENT_URL,
    "email_agent": EMAIL_AGENT_URL,
    "seo_agent": SEO_AGENT_URL,
}


class Base(DeclarativeBase):
    pass


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    goal: Mapped[str] = mapped_column(String)
    audience: Mapped[str] = mapped_column(String)
    budget: Mapped[float] = mapped_column(Float)
    spent: Mapped[float] = mapped_column(Float, default=0.0)
    round: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="running")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
campaign_lock = asyncio.Lock()
active_campaign_id: str | None = None
allocation_history_by_campaign: dict[str, list[dict[str, Any]]] = {}
latest_allocations_by_campaign: dict[str, dict[str, float]] = {}
agent_states_by_campaign: dict[str, dict[str, dict[str, Any]]] = {}


def initialize_agent_states() -> dict[str, dict[str, Any]]:
    return {
        name: {"name": name.replace("_", " ").title(), "status": "idle", "task": "Waiting for run", "error": "", "budget": 0.0}
        for name in AGENTS.keys()
    }


def record_agent_state(campaign_id: str, event_type: str, agent: str | None, payload: dict[str, Any]) -> None:
    if not agent or agent not in AGENTS:
        return

    campaign_states = agent_states_by_campaign.setdefault(campaign_id, initialize_agent_states())
    current = campaign_states.get(agent, {"name": agent.replace("_", " ").title(), "status": "idle", "task": "Waiting for run", "error": "", "budget": 0.0})

    status = current.get("status", "idle")
    if event_type in {"agent.started", "agent.progress"}:
        status = "running"
    elif event_type == "agent.completed":
        status = "completed"
    elif event_type == "agent.failed":
        status = "failed"

    campaign_states[agent] = {
        **current,
        "status": status,
        "task": payload.get("stage") or payload.get("message") or payload.get("type") or current.get("task", "Waiting for run"),
        "error": payload.get("error") or payload.get("reason") or current.get("error", ""),
    }


async def send_event(campaign_id: str, event_type: str, payload: dict[str, Any], agent: str | None = None) -> None:
    record_agent_state(campaign_id, event_type, agent, payload)
    req = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "agent.publish_event",
        "params": {
            "event": {
                "campaign_id": campaign_id,
                "event_type": event_type,
                "agent": agent,
                "payload": payload,
            }
        },
    }
    async with httpx.AsyncClient(timeout=20) as client:
        await client.post(f"{A2A_HUB_URL}/rpc", json=req)


async def call_rpc(url: str, method: str, params: dict[str, Any]) -> dict[str, Any]:
    request = JsonRpcRequest(id=str(uuid.uuid4()), method=method, params=params)
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(f"{url}/rpc", json=request.model_dump())
        response.raise_for_status()
        data = JsonRpcResponse.model_validate(response.json())
        if data.error:
            raise RuntimeError(data.error.message)
        return data.result or {}


async def run_round(
    campaign: Campaign,
    brief: CampaignBrief,
    round_number: int,
    previous_allocations: dict[str, float],
) -> dict[str, Any]:
    bid_calls = [
        call_rpc(url, "capability.bid", {"campaign_id": campaign.id, "goal": brief.goal, "audience": brief.audience})
        for _, url in AGENTS.items()
    ]
    bid_results = await asyncio.gather(*bid_calls, return_exceptions=True)

    scores: dict[str, float] = {}
    for name, bid in zip(AGENTS.keys(), bid_results):
        if isinstance(bid, Exception) or not isinstance(bid, dict):
            scores[name] = 0.25
        else:
            scores[name] = max(0.05, min(float(bid.get("score", 0.25)), 1.0))

    score_total = sum(scores.values()) or 1.0
    allocations = {
        name: round((scores[name] / score_total) * brief.budget, 2)
        for name in AGENTS.keys()
    }

    renegotiation_payload = {
        "type": "renegotiation",
        "round": round_number,
        "before": previous_allocations,
        "after": allocations,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await send_event(campaign.id, "campaign.renegotiation", renegotiation_payload)

    async def run_agent(agent_name: str, url: str) -> dict[str, Any]:
        await send_event(campaign.id, "agent.started", {"round": round_number}, agent_name)
        return await call_rpc(
            url,
            "task.execute",
            {
                "campaign_id": campaign.id,
                "round": round_number,
                "goal": brief.goal,
                "audience": brief.audience,
                "company_name": brief.company_name,
                "product_description": brief.product_description,
                "usp": brief.usp,
                "tone_of_voice": brief.tone_of_voice,
                "timeline_days": brief.timeline_days,
                "brand_guidelines": brief.brand_guidelines,
                "channels": brief.channels,
                "budget_allocation": allocations[agent_name],
            },
        )

    tasks = [run_agent(name, url) for name, url in AGENTS.items()]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    normalized: dict[str, Any] = {}
    spent = 0.0
    for name, result in zip(AGENTS.keys(), results):
        if isinstance(result, Exception) or not isinstance(result, dict):
            normalized[name] = {"status": "failed", "error": str(result), "spend": 0.0}
            await send_event(campaign.id, "agent.failed", {"round": round_number, "error": str(result)}, name)
        else:
            normalized[name] = result
            spent += float(result.get("spend", 0.0))
            await send_event(campaign.id, "agent.completed", {"round": round_number, "result": result}, name)

    analytics = await call_rpc(
        ANALYTICS_AGENT_URL,
        "task.execute",
        {
            "campaign_id": campaign.id,
            "round": round_number,
            "goal": brief.goal,
            "audience": brief.audience,
            "budget": campaign.budget,
            "budget_allocation": 0,
            "spent_so_far": campaign.spent + spent,
            "agent_results": normalized,
        },
    )

    return {
        "results": normalized,
        "analytics": analytics,
        "spent_this_round": spent,
        "allocations": allocations,
    }


async def execute_campaign(campaign_id: str, brief: CampaignBrief) -> None:
    try:
        async with SessionLocal() as db:
            campaign = await db.get(Campaign, campaign_id)
            if not campaign:
                return

            await send_event(campaign.id, "campaign.started", {"goal": brief.goal, "budget": brief.budget})
            rounds = 0
            previous_allocations = {
                name: round(brief.budget / len(AGENTS), 2)
                for name in AGENTS.keys()
            }
            allocation_history_by_campaign[campaign.id] = [{"round": 0, "allocations": previous_allocations.copy()}]
            latest_allocations_by_campaign[campaign.id] = previous_allocations.copy()

            while rounds < 3:
                rounds += 1
                campaign.round = rounds
                await db.commit()
                await send_event(campaign.id, "campaign.round.started", {"round": rounds})

                outcome = await run_round(campaign, brief, rounds, previous_allocations)
                campaign.spent += outcome["spent_this_round"]
                current_allocations = outcome["allocations"]
                allocation_history_by_campaign[campaign.id].append({"round": rounds, "allocations": current_allocations.copy()})
                latest_allocations_by_campaign[campaign.id] = current_allocations.copy()
                previous_allocations = current_allocations.copy()

                if campaign.spent > campaign.budget * 1.1:
                    campaign.status = "failed"
                    await db.commit()
                    await send_event(
                        campaign.id,
                        "campaign.failed",
                        {"reason": "global budget guard triggered", "spent": campaign.spent, "budget": campaign.budget},
                    )
                    return

                analytics = outcome["analytics"]
                should_renegotiate = bool(analytics.get("should_renegotiate", False))
                await send_event(campaign.id, "agent.progress", {"agent": "analytics_agent", "round": rounds, "analytics": analytics})

                await db.commit()
                if not should_renegotiate:
                    break

            campaign.status = "complete"
            await db.commit()
            await send_event(
                campaign.id,
                "campaign.completed",
                {"rounds": rounds, "spent": campaign.spent, "budget": campaign.budget},
            )
    except Exception:
        async with SessionLocal() as db:
            campaign = await db.get(Campaign, campaign_id)
            if campaign and campaign.status == "running":
                campaign.status = "failed"
                await db.commit()
        raise
    finally:
        global active_campaign_id
        async with campaign_lock:
            if active_campaign_id == campaign_id:
                active_campaign_id = None


@app.on_event("startup")
async def startup() -> None:
    global active_campaign_id
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        await db.execute(update(Campaign).where(Campaign.status == "running").values(status="failed"))
        await db.commit()
    active_campaign_id = None


@app.get("/health")
async def health() -> dict[str, str]:
    return HealthResponse(
        service="orchestrator",
        status="ok",
        version=SERVICE_VERSION,
        timestamp=datetime.now(timezone.utc).isoformat(),
    ).model_dump()


def build_status_result(campaign: Campaign) -> dict[str, Any]:
    allocation_history = allocation_history_by_campaign.get(campaign.id, [])
    current_allocations = latest_allocations_by_campaign.get(campaign.id, {})
    return {
        "campaign_id": campaign.id,
        "status": campaign.status,
        "spent": campaign.spent,
        "budget": campaign.budget,
        "round": campaign.round,
        "current_allocations": current_allocations,
        "allocation_history": allocation_history,
        "agent_states": agent_states_by_campaign.get(campaign.id, initialize_agent_states()),
    }


async def start_campaign_from_params(params: dict[str, Any]) -> tuple[bool, dict[str, Any]]:
    global active_campaign_id
    campaign_id = params.get("campaign_id") or str(uuid.uuid4())

    try:
        brief = CampaignBrief(
            campaign_id=campaign_id,
            goal=cast(str, params.get("goal")),
            audience=params.get("audience", "startup founders"),
            company_name=params.get("company_name", ""),
            product_description=params.get("product_description", ""),
            usp=params.get("usp", ""),
            tone_of_voice=params.get("tone_of_voice", "professional"),
            timeline_days=int(params.get("timeline_days", 7)),
            brand_guidelines=params.get("brand_guidelines", ""),
            budget=cast(float, params.get("budget")),
            channels=params.get("channels", ["content", "ads", "email", "seo"]),
        )
    except ValidationError as exc:
        return False, invalid_params_error(exc.errors())

    async with campaign_lock:
        if active_campaign_id is not None:
            return False, {"code": 40901, "message": "CAMPAIGN_ACTIVE"}

        async with SessionLocal() as db:
            active = await db.execute(select(Campaign).where(Campaign.status == "running"))
            if active.scalar_one_or_none() is not None:
                return False, {"code": 40901, "message": "CAMPAIGN_ACTIVE"}

            campaign = Campaign(
                id=campaign_id,
                goal=brief.goal,
                audience=brief.audience,
                budget=brief.budget,
                spent=0.0,
                round=0,
                status="running",
            )
            db.add(campaign)
            await db.commit()
            active_campaign_id = campaign_id
            agent_states_by_campaign[campaign_id] = initialize_agent_states()

    asyncio.create_task(execute_campaign(campaign_id, brief))
    return True, {"campaign_id": campaign_id, "status": "running"}


@app.post("/rpc")
async def rpc(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        req = JsonRpcRequest.model_validate(payload)
    except ValidationError as exc:
        return JsonRpcResponse(id=payload.get("id"), error=JsonRpcError(**invalid_params_error(exc.errors()))).model_dump()

    if req.method == "campaign.status":
        campaign_id = req.params["campaign_id"]
        async with SessionLocal() as db:
            campaign = await db.get(Campaign, campaign_id)
            if not campaign:
                return JsonRpcResponse(id=req.id, error=JsonRpcError(code=404, message="campaign not found")).model_dump()
            return JsonRpcResponse(id=req.id, result=build_status_result(campaign)).model_dump()

    if req.method == "campaign.start":
        ok, result = await start_campaign_from_params(req.params)
        if not ok:
            return JsonRpcResponse(id=req.id, error=JsonRpcError(**result)).model_dump()
        return JsonRpcResponse(id=req.id, result=result).model_dump()

    return JsonRpcResponse(id=req.id, error=JsonRpcError(code=-32601, message=f"Method not found: {req.method}")).model_dump()


@app.post("/campaign")
async def campaign_start(payload: dict[str, Any]) -> dict[str, Any]:
    params = {
        "goal": payload.get("goal"),
        "audience": payload.get("target_audience", "startup founders"),
        "company_name": payload.get("company_name", ""),
        "product_description": payload.get("product_description", ""),
        "usp": payload.get("usp", ""),
        "tone_of_voice": payload.get("tone_of_voice", "professional"),
        "timeline_days": payload.get("timeline_days", 7),
        "brand_guidelines": payload.get("brand_guidelines", ""),
        "budget": payload.get("budget"),
        "channels": payload.get("channels", ["google_ads", "email", "seo"]),
    }
    ok, result = await start_campaign_from_params(params)
    if not ok:
        return {"error": result}
    return result


@app.get("/status/{campaign_id}")
async def campaign_status(campaign_id: str) -> dict[str, Any]:
    async with SessionLocal() as db:
        campaign = await db.get(Campaign, campaign_id)
        if not campaign:
            return {"error": {"code": 404, "message": "campaign not found"}}
        return build_status_result(campaign)


@app.post("/campaign/reset")
async def campaign_reset() -> dict[str, str]:
    global active_campaign_id
    async with campaign_lock:
        active_campaign_id = None
        async with SessionLocal() as db:
            await db.execute(update(Campaign).where(Campaign.status == "running").values(status="failed"))
            await db.commit()
    return {"status": "reset", "message": "ready for new campaign"}


@app.get("/outputs/{campaign_id}")
async def campaign_outputs(campaign_id: str) -> dict[str, Any]:
    files = list_output_files(campaign_id)
    payload: dict[str, Any] = {"campaign_id": campaign_id, "files": files}
    for filename in files:
        if filename.endswith(".json"):
            payload[filename] = read_json_output(campaign_id, filename)
    return payload


def _read_named_output(campaign_id: str, filename: str, key: str) -> dict[str, Any]:
    data = read_json_output(campaign_id, filename)
    if data is None:
        return {"error": {"code": 404, "message": f"{filename} not found"}}
    return {"campaign_id": campaign_id, key: data}


@app.get("/outputs/{campaign_id}/content.json")
async def campaign_content_output(campaign_id: str) -> dict[str, Any]:
    return _read_named_output(campaign_id, "content.json", "content")


@app.get("/outputs/{campaign_id}/emails.json")
async def campaign_emails_output(campaign_id: str) -> dict[str, Any]:
    return _read_named_output(campaign_id, "emails.json", "emails")


@app.get("/outputs/{campaign_id}/seo_brief.json")
async def campaign_seo_output(campaign_id: str) -> dict[str, Any]:
    return _read_named_output(campaign_id, "seo_brief.json", "seo_brief")


@app.get("/outputs/{campaign_id}/ads.json")
async def campaign_ads_output(campaign_id: str) -> dict[str, Any]:
    return _read_named_output(campaign_id, "ads.json", "ads")


@app.get("/outputs/{campaign_id}/strategy.json")
async def campaign_strategy_output(campaign_id: str) -> dict[str, Any]:
    return _read_named_output(campaign_id, "strategy.json", "strategy")


@app.get("/outputs/{campaign_id}/download")
async def campaign_outputs_download(campaign_id: str):
    archive_path = create_campaign_zip(campaign_id)
    if not archive_path:
        return {"error": {"code": 404, "message": "campaign outputs not found"}}
    return FileResponse(
        archive_path,
        media_type="application/zip",
        filename=f"{campaign_id}-outputs.zip",
    )
