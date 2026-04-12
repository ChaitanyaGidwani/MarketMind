# MarketMind

Multi-agent AI marketing platform for orchestrated campaign planning and execution.

## Stack
- Python 3.12 + FastAPI + Pydantic v2 + SQLAlchemy + httpx
- React + Vite + Tailwind + Chart.js
- A2A-style JSON-RPC over HTTP + SSE stream
- SQLite + Docker Compose

## Quickstart
1. Copy `.env.example` to `.env`
2. Build and start:
   - `docker compose up --build`
3. Open dashboard at `http://localhost:5173`

## Services
- `a2a_hub` (8000): JSON-RPC gateway, agent card registry, SSE broadcaster
- `orchestrator` (8001): bid scoring, task dispatch, re-negotiation loop (max 3 rounds)
- `content_agent` (8002): copy and email draft generation (Groq Llama 3.3 or fallback)
- `ad_agent` (8003): Google/Meta sandbox ad outputs (mock)
- `email_agent` (8004): drip sequence + Resend dispatch (or mock)
- `seo_agent` (8005): keyword and metadata generation
- `analytics_agent` (8006): ROI metrics and renegotiation signal
- `frontend` (5173): campaign wizard, SSE monitor, ROI chart

## Current Flow
1. Frontend sends `campaign.start` to `a2a_hub` (`/rpc`).
2. Hub forwards to `orchestrator`.
3. Orchestrator requests `capability.bid` from each execution agent.
4. Orchestrator scores bids, allocates budget, runs agents in parallel.
5. Every agent publishes SSE progress via `agent.publish_event` through hub.
6. Analytics computes ROI and requests renegotiation when needed.
7. Orchestrator enforces max 3 rounds and budget guard at 110%.
8. Frontend streams updates from `/events/{campaign_id}`.

## Constraints Implemented
- `USE_MOCK=true` short-circuits external APIs.
- Inter-service URLs are read from environment variables.
- Open CORS enabled on all APIs.
- Single running campaign at a time.

## Notes
- `USE_MOCK=true` bypasses external APIs with hardcoded responses.
- Authentication is currently disabled in local development mode.
- Single active campaign at a time.
