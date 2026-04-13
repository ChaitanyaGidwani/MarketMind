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
from shared.rag_store import retrieve_relevant, store_campaign_result
from shared.validator import JsonRpcValidationException, invalid_params_error, validate_task_allocation

app = FastAPI(title="MarketMind Content Agent", version="0.1.0")
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
SELF_URL = required_env("CONTENT_AGENT_URL")
USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.3-70b-versatile"
SERVICE_VERSION = "1.0.0"

if not USE_MOCK and not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is required when USE_MOCK=false")


async def publish_event(campaign_id: str, event_type: str, payload: dict[str, Any]) -> None:
    req = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "agent.publish_event",
        "params": {
            "event": {
                "campaign_id": campaign_id,
                "event_type": event_type,
                "agent": "content_agent",
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
        print(f"[content_agent] Warning: Failed to publish event: {type(e).__name__}: {str(e)}", file=sys.stderr)


@app.on_event("startup")
async def register_card() -> None:
    card = {
        "name": "content_agent",
        "capabilities": ["copywriting", "ad_copy", "email_copy"],
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


def _fallback_content_pack(goal: str, audience: str, company_name: str, product_description: str, usp: str, tone: str) -> dict[str, Any]:
    brand = company_name or "Your Company"
    product = product_description or goal
    selling_point = usp or "faster outcomes with less effort"
    ad_variants = [
        {
            "headline": f"{brand}: Launch Smarter",
            "body": f"Built for {audience}, {product} helps teams move from idea to pipeline quickly.",
            "cta": "Start Your Campaign",
        },
        {
            "headline": f"Stop Guessing, Start Scaling",
            "body": f"Use {brand} to execute focused campaigns with clear ROI and {selling_point}.",
            "cta": "See It In Action",
        },
        {
            "headline": f"Marketing Built For {audience.title()}",
            "body": f"{brand} delivers a {tone} go-to-market playbook tuned for conversion.",
            "cta": "Get The Playbook",
        },
    ]
    return {
        "ad_variants": ad_variants,
        "blog_outline": {
            "title": f"How {audience.title()} Can Launch {goal} Quickly and Predictably",
            "sections": [
                {"heading": "Define Campaign Outcome", "key_points": ["North-star metric", "Offer", "Success threshold"]},
                {"heading": "Craft the Message", "key_points": ["USP-first positioning", "Pain-point hooks", "Proof points"]},
                {"heading": "Channel Plan", "key_points": ["Paid", "Email", "SEO"]},
                {"heading": "Execution Timeline", "key_points": ["Day-by-day sprint", "Dependencies", "Owners"]},
                {"heading": "Optimization Loop", "key_points": ["KPI review", "Budget shifts", "Iteration cadence"]},
            ],
        },
        "social_posts": [
            {"channel": "twitter", "text": f"{brand} helps {audience} launch faster with a measurable campaign loop. #{goal.replace(' ', '')}"},
            {"channel": "twitter", "text": f"Most teams overcomplicate launch marketing. Focus on one audience, one offer, one KPI."},
            {"channel": "linkedin", "text": f"We designed a practical launch framework for {audience}. It prioritizes velocity + ROI."},
            {"channel": "linkedin", "text": f"{brand} differentiates with {selling_point}. That single point should anchor every channel."},
            {"channel": "linkedin", "text": f"Want the exact checklist we use to ship launch campaigns? Start with goals, then map assets by channel."},
        ],
    }


async def generate_content_pack(
    goal: str,
    audience: str,
    company_name: str,
    product_description: str,
    usp: str,
    tone_of_voice: str,
    retrieved_results: list[dict[str, Any]],
) -> dict[str, Any]:
    if USE_MOCK:
        return _fallback_content_pack(goal, audience, company_name, product_description, usp, tone_of_voice)

    try:
        client = AsyncGroq(api_key=GROQ_API_KEY)
        system_prompt = (
            "Here are the top performing past campaigns for similar goals: "
            f"{json.dumps(retrieved_results, ensure_ascii=False, default=str)}. Use these as reference."
        )
        response = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        "Create JSON only with keys ad_variants, blog_outline, social_posts. "
                        "ad_variants must include 3 objects with headline/body/cta. "
                        "blog_outline must include title and exactly 5 sections with heading and key_points list. "
                        "social_posts must include exactly 5 posts for twitter/linkedin. "
                        f"Goal: {goal}. Audience: {audience}. Company: {company_name}. "
                        f"Product: {product_description}. USP: {usp}. Tone: {tone_of_voice}."
                    ),
                },
            ],
            max_tokens=1500,
        )
        text = response.choices[0].message.content
        return json.loads(text or "{}")
    except Exception as e:
        import sys
        print(f"[content_agent] Error generating content pack: {type(e).__name__}: {str(e)}", file=sys.stderr)
        return _fallback_content_pack(goal, audience, company_name, product_description, usp, tone_of_voice)


@app.get("/health")
async def health() -> dict[str, str]:
    from datetime import datetime, timezone

    return HealthResponse(
        service="content_agent",
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
            result={"agent": "content_agent", "capability": "copywriting", "score": 0.92, "estimated_cost": 30, "eta_minutes": 6},
        ).model_dump()

    if req.method == "task.execute":
        try:
            validated = validate_task_allocation(req.params)
        except JsonRpcValidationException as exc:
            return JsonRpcResponse(id=req.id, error=JsonRpcError(**exc.to_error())).model_dump()

        campaign_id = req.params["campaign_id"]
        round_number = validated.round
        goal = validated.goal
        audience = validated.audience
        company_name = validated.company_name
        product_description = validated.product_description
        usp = validated.usp
        tone_of_voice = validated.tone_of_voice
        budget_allocation = validated.budget_allocation
        retrieved_results = retrieve_relevant("content_agent", goal, top_k=3)

        await publish_event(campaign_id, "agent.progress", {"round": round_number, "stage": "drafting content"})
        content_pack = await generate_content_pack(
            goal,
            audience,
            company_name,
            product_description,
            usp,
            tone_of_voice,
            retrieved_results,
        )
        output_path = save_json_output(campaign_id, "content.json", content_pack)
        spend = min(25.0, budget_allocation * 0.2)
        performance_score = float(req.params.get("performance_score", 0.0) or 0.0)
        store_campaign_result(campaign_id, "content_agent", content_pack, performance_score)

        return JsonRpcResponse(
            id=req.id,
            result={
                "agent": "content_agent",
                "status": "completed",
                "spend": spend,
                "assets": content_pack,
                "output_file": output_path,
            },
        ).model_dump()

    return JsonRpcResponse(id=req.id, error=JsonRpcError(code=-32601, message=f"Method not found: {req.method}")).model_dump()


@app.get("/outputs/{campaign_id}")
async def outputs(campaign_id: str) -> dict[str, Any]:
    data = read_json_output(campaign_id, "content.json")
    if data is None:
        return {"error": {"code": 404, "message": "content output not found"}}
    return {"campaign_id": campaign_id, "content": data}
