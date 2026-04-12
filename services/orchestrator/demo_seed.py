from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx

BASE_URL = os.getenv("ORCHESTRATOR_BASE_URL", os.getenv("ORCHESTRATOR_DEMO_URL", "http://localhost:8001"))
SERVICES = {
    "a2a_hub": "http://localhost:8000/health",
    "orchestrator": f"{BASE_URL}/health",
    "content_agent": "http://localhost:8002/health",
    "ad_agent": "http://localhost:8003/health",
    "email_agent": "http://localhost:8004/health",
    "seo_agent": "http://localhost:8005/health",
    "analytics_agent": "http://localhost:8006/health",
}

CAMPAIGN_BRIEF = {
    "goal": "Launch a product campaign for our AI writing tool targeting startup founders",
    "target_audience": "SaaS startup founders aged 25-35, US market",
    "budget": 500,
    "timeline_days": 7,
    "channels": ["google_ads", "email", "seo"],
    "brand_guidelines": "Professional but approachable. Focus on time savings and ROI. Never use the word synergy.",
}


def green_check(msg: str) -> None:
    print(f"\033[92m✔\033[0m {msg}")


def red_x(msg: str) -> None:
    print(f"\033[91m✖\033[0m {msg}")


async def check_health(client: httpx.AsyncClient) -> None:
    print("Step 1: Health checks")
    for name, url in SERVICES.items():
        try:
            response = await client.get(url, timeout=3)
            if response.status_code == 200:
                green_check(f"{name} healthy")
            else:
                red_x(f"{name} unhealthy ({response.status_code})")
        except Exception as exc:  # noqa: BLE001
            red_x(f"{name} unreachable ({exc})")
    print("Warning: continuing even if services are still warming up.\n")


async def progress_sleep(seconds: int, label: str) -> None:
    print(label)
    for i in range(seconds):
        done = i + 1
        bar = "█" * done + "-" * (seconds - done)
        print(f"\r[{bar}] {done}/{seconds}s", end="", flush=True)
        await asyncio.sleep(1)
    print("\n")


def print_allocations(status_payload: dict[str, Any], title: str) -> None:
    print(title)
    print(f"Campaign: {status_payload.get('campaign_id')} | Round: {status_payload.get('round')} | Status: {status_payload.get('status')}")
    allocations = status_payload.get("current_allocations", {})
    if not allocations:
        print("No allocations available yet.\n")
        return
    for agent, budget in allocations.items():
        print(f"  - {agent}: ${float(budget):.2f}")
    print("")


def print_summary(status_payload: dict[str, Any]) -> None:
    history = status_payload.get("allocation_history", [])
    round0 = {}
    final_allocs = status_payload.get("current_allocations", {})
    for item in history:
        if int(item.get("round", -1)) == 0:
            round0 = item.get("allocations", {})
            break

    print("Step 7: Budget shift summary")
    print("Agent | Round 0 Budget | Final Budget | Change %")
    print("-" * 64)
    for agent in sorted(set(round0.keys()) | set(final_allocs.keys())):
        start = float(round0.get(agent, 0.0))
        end = float(final_allocs.get(agent, 0.0))
        change = 0.0 if start == 0 else ((end - start) / start) * 100
        print(f"{agent} | ${start:>7.2f} | ${end:>7.2f} | {change:>7.2f}%")
    print("")


async def main() -> None:
    async with httpx.AsyncClient() as client:
        await check_health(client)

        print("Step 2: Starting campaign with sample brief")
        start_response = await client.post(f"{BASE_URL}/campaign", json=CAMPAIGN_BRIEF, timeout=10)
        start_payload = start_response.json()
        campaign_id = start_payload.get("campaign_id")

        if not campaign_id:
            red_x(f"Campaign start failed: {start_payload}")
            print("Run complete. Open http://localhost:5173/results")
            return

        green_check(f"campaign_id: {campaign_id}")

        await progress_sleep(8, "Step 3: Waiting for first orchestration cycle")

        status_1 = (await client.get(f"{BASE_URL}/status/{campaign_id}", timeout=10)).json()
        print_allocations(status_1, "Step 4: First status snapshot")

        await progress_sleep(6, "Step 5: Waiting for analytics-triggered re-negotiation")

        status_2 = (await client.get(f"{BASE_URL}/status/{campaign_id}", timeout=10)).json()
        print_allocations(status_2, "Step 6: Second status snapshot")

        print_summary(status_2)
        print("Run complete. Open http://localhost:5173/results")


if __name__ == "__main__":
    asyncio.run(main())
