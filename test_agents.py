#!/usr/bin/env python3
"""
Test script to diagnose agent health and identify 500 errors
"""
import asyncio
import json
import httpx
import sys
from datetime import datetime

AGENTS = {
    "ad_agent": "http://localhost:8002",
    "content_agent": "http://localhost:8003",
    "email_agent": "http://localhost:8004",
    "seo_agent": "http://localhost:8005",
    "analytics_agent": "http://localhost:8006",
}

TEST_PAYLOAD = {
    "jsonrpc": "2.0",
    "id": "test-1",
    "method": "capability.bid",
    "params": {}
}

async def test_agent_health(agent_name: str, url: str) -> dict:
    """Test agent /health endpoint"""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            response = await client.get(f"{url}/health")
            return {
                "agent": agent_name,
                "endpoint": "health",
                "status": response.status_code,
                "ok": response.status_code == 200,
                "data": response.json() if response.status_code == 200 else None,
                "error": None,
                "time_ms": response.elapsed.total_seconds() * 1000
            }
    except Exception as e:
        return {
            "agent": agent_name,
            "endpoint": "health",
            "status": None,
            "ok": False,
            "data": None,
            "error": f"{type(e).__name__}: {str(e)}",
            "time_ms": None
        }

async def test_agent_rpc(agent_name: str, url: str) -> dict:
    """Test agent /rpc endpoint with capability.bid"""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            start = datetime.now()
            response = await client.post(f"{url}/rpc", json=TEST_PAYLOAD)
            elapsed_ms = (datetime.now() - start).total_seconds() * 1000
            
            return {
                "agent": agent_name,
                "endpoint": "rpc",
                "status": response.status_code,
                "ok": response.status_code == 200,
                "data": response.json() if response.status_code == 200 else response.text[:200],
                "error": None,
                "time_ms": elapsed_ms
            }
    except Exception as e:
        return {
            "agent": agent_name,
            "endpoint": "rpc",
            "status": None,
            "ok": False,
            "data": None,
            "error": f"{type(e).__name__}: {str(e)}",
            "time_ms": None
        }

async def main():
    print("=" * 80)
    print("Agent Health Diagnostic Test")
    print("=" * 80)
    print(f"Started at: {datetime.now().isoformat()}\n")
    
    all_results = []
    
    # Test health endpoints
    print("Testing /health endpoints...")
    print("-" * 80)
    health_tasks = [test_agent_health(name, url) for name, url in AGENTS.items()]
    health_results = await asyncio.gather(*health_tasks)
    
    for result in health_results:
        status_icon = "✓" if result["ok"] else "✗"
        print(f"{status_icon} {result['agent']:20} {result['status']:4} {result['time_ms'] or 'timeout':>7.1f}ms")
        if not result["ok"]:
            print(f"  └─ Error: {result['error']}")
        all_results.append(result)
    
    # Test RPC endpoints
    print("\nTesting /rpc endpoints (capability.bid)...")
    print("-" * 80)
    rpc_tasks = [test_agent_rpc(name, url) for name, url in AGENTS.items()]
    rpc_results = await asyncio.gather(*rpc_tasks)
    
    for result in rpc_results:
        status_icon = "✓" if result["ok"] else "✗"
        print(f"{status_icon} {result['agent']:20} {result['status']:4} {result['time_ms'] or 'timeout':>7.1f}ms")
        if not result["ok"]:
            print(f"  └─ Error: {result['error']}")
        else:
            if isinstance(result["data"], dict) and "result" in result["data"]:
                print(f"  └─ Bid: {json.dumps(result['data']['result'], indent=2)[:100]}...")
        all_results.append(result)
    
    # Summary
    print("\n" + "=" * 80)
    print("Summary")
    print("=" * 80)
    
    working = [r for r in all_results if r["ok"]]
    failing = [r for r in all_results if not r["ok"]]
    
    print(f"✓ Working: {len(working)}/{len(all_results)}")
    for r in working:
        print(f"  - {r['agent']} ({r['endpoint']})")
    
    if failing:
        print(f"\n✗ Failing: {len(failing)}/{len(all_results)}")
        for r in failing:
            print(f"  - {r['agent']} ({r['endpoint']}): {r['error']}")
    
    # Check connectivity
    print("\n" + "=" * 80)
    print("Connectivity Check")
    print("=" * 80)
    print("If agents show 'Connection refused' or 'timeout':")
    print("1. Ensure all services are running:")
    print("   - orchestrator: http://localhost:8001")
    print("   - ad_agent: http://localhost:8002")
    print("   - content_agent: http://localhost:8003")
    print("   - email_agent: http://localhost:8004")
    print("   - seo_agent: http://localhost:8005")
    print("   - analytics_agent: http://localhost:8006")
    print("   - a2a_hub: http://localhost:8000")
    print("\n2. Check environment variables:")
    print("   - GROQ_API_KEY (required for ad/content/seo agents if USE_MOCK=false)")
    print("   - USE_MOCK=true (to use fallback responses)")

if __name__ == "__main__":
    asyncio.run(main())
