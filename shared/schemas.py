from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


class CampaignBrief(BaseModel):
    campaign_id: str
    goal: str
    audience: str = "startup founders"
    company_name: str = ""
    product_description: str = ""
    usp: str = ""
    tone_of_voice: str = "professional"
    timeline_days: int = 7
    brand_guidelines: str = ""
    budget: float = Field(gt=0)
    channels: list[str] = Field(default_factory=lambda: ["content", "ads", "email", "seo"])


class CapabilityBid(BaseModel):
    agent: str
    capability: str
    score: float = Field(ge=0, le=1)
    estimated_cost: float = Field(ge=0)
    eta_minutes: int = Field(ge=1)


class ProgressEvent(BaseModel):
    event_id: str
    campaign_id: str
    event_type: Literal[
        "campaign.started",
        "campaign.round.started",
        "agent.started",
        "agent.progress",
        "agent.completed",
        "agent.failed",
        "campaign.renegotiation",
        "campaign.completed",
        "campaign.failed",
        "heartbeat",
    ]
    sequence: int
    agent: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class JsonRpcRequest(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    id: str | int | None = None
    method: str
    params: dict[str, Any] = Field(default_factory=dict)


class JsonRpcError(BaseModel):
    code: int
    message: str
    data: dict[str, Any] | None = None


class JsonRpcResponse(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    id: str | int | None = None
    result: dict[str, Any] | None = None
    error: JsonRpcError | None = None


class HealthResponse(BaseModel):
    service: str
    status: Literal["ok"]
    version: str
    timestamp: str
