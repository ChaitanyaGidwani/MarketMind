from __future__ import annotations

from typing import Any, Sequence

from pydantic import BaseModel, Field, ValidationError


class JsonRpcValidationException(Exception):
    def __init__(self, errors: list[dict[str, Any]]) -> None:
        self.errors = errors
        super().__init__("Invalid params")

    def to_error(self) -> dict[str, Any]:
        return {
            "code": -32602,
            "message": "Invalid params",
            "data": self.errors,
        }


class TaskAllocationPayload(BaseModel):
    campaign_id: str
    round: int = Field(ge=0, le=3)
    goal: str
    audience: str
    budget_allocation: float = Field(ge=0)
    company_name: str = ""
    product_description: str = ""
    usp: str = ""
    tone_of_voice: str = "professional"
    timeline_days: int = 7
    brand_guidelines: str = ""
    channels: list[str] = Field(default_factory=list)


def invalid_params_error(errors: Sequence[Any]) -> dict[str, Any]:
    return {
        "code": -32602,
        "message": "Invalid params",
        "data": errors,
    }


def validate_task_allocation(payload: dict[str, Any]) -> TaskAllocationPayload:
    try:
        return TaskAllocationPayload.model_validate(payload)
    except ValidationError as exc:
        raise JsonRpcValidationException(exc.errors()) from exc
