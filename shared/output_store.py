from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = REPO_ROOT / "data" / "outputs"


def _campaign_dir(campaign_id: str) -> Path:
    directory = OUTPUT_ROOT / campaign_id
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def save_json_output(campaign_id: str, filename: str, payload: dict[str, Any]) -> str:
    destination = _campaign_dir(campaign_id) / filename
    destination.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return str(destination)


def read_json_output(campaign_id: str, filename: str) -> dict[str, Any] | None:
    target = OUTPUT_ROOT / campaign_id / filename
    if not target.exists():
        return None
    return json.loads(target.read_text(encoding="utf-8"))


def list_output_files(campaign_id: str) -> list[str]:
    directory = OUTPUT_ROOT / campaign_id
    if not directory.exists():
        return []
    return sorted([item.name for item in directory.iterdir() if item.is_file()])


def campaign_output_dir(campaign_id: str) -> Path:
    return _campaign_dir(campaign_id)
