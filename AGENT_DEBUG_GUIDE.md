# Agent Debugging Guide

## Quick Fixes Applied

### ✓ Fixed in this session:
1. **content_agent** - Wrapped entire Groq API call in try/except with logging
2. **ad_agent** - Added error logging to Groq API calls
3. **seo_agent** - Added error logging to Groq API calls
4. **email_agent** - Added error logging to Resend API calls
5. **analytics_agent** - Added error logging to event publishing
6. **All agents** - Enhanced publish_event() with error handling and logging

### Why 500 errors occurred:

**CRITICAL Issue in content_agent** (FIXED):
```python
# BEFORE (Would crash on any API error):
client = AsyncGroq(...)  # ← No try/except
response = await client.chat.completions.create(...)  # ← Could fail
text = response.choices[0].message.content  # ← Could fail
try:
    return json.loads(text)  # ← Only THIS was caught
except:
    return fallback()

# AFTER (Properly handles all errors):
try:
    client = AsyncGroq(...)
    response = await client.chat.completions.create(...)
    text = response.choices[0].message.content
    return json.loads(text)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)  # ← Logs error for debugging
    return fallback()
```

---

## Environment Setup

### Required Environment Variables

```bash
# Groq API (Required for ad, content, seo agents if USE_MOCK=false)
export GROQ_API_KEY="your-groq-api-key"
export GROQ_MODEL="llama-3.3-70b-versatile"

# Email (Optional - email agent uses mock by default)
export RESEND_API_KEY="your-resend-api-key"
export RESEND_FROM_EMAIL="noreply@yourdomain.com"
export RESEND_TO_EMAIL="marketing@yourdomain.com"

# Orchestrator & Hub URLs
export ORCHESTRATOR_URL="http://localhost:8001"
export A2A_HUB_URL="http://localhost:8000"

# Agent Self URLs (needed for registration)
export CONTENT_AGENT_URL="http://localhost:8003"
export AD_AGENT_URL="http://localhost:8002"
export EMAIL_AGENT_URL="http://localhost:8004"
export SEO_AGENT_URL="http://localhost:8005"
export ANALYTICS_AGENT_URL="http://localhost:8006"

# Database
export DATABASE_URL="sqlite+aiosqlite:///./data/campaigns.db"

# Use mock responses (for testing without API keys)
export USE_MOCK="false"  # Set to "true" to use fallback responses
```

### Setup Steps

```bash
# 1. Activate virtual environment
cd /Users/chaitanyagidwani/Market-Mind
source .venv/bin/activate

# 2. Install dependencies (already done)
pip install -r requirements.txt

# 3. Create .env file with above variables
cat > .env << 'EOF'
GROQ_API_KEY=your-key-here
DATABASE_URL=sqlite+aiosqlite:///./data/campaigns.db
ORCHESTRATOR_URL=http://localhost:8001
A2A_HUB_URL=http://localhost:8000
CONTENT_AGENT_URL=http://localhost:8003
AD_AGENT_URL=http://localhost:8002
EMAIL_AGENT_URL=http://localhost:8004
SEO_AGENT_URL=http://localhost:8005
ANALYTICS_AGENT_URL=http://localhost:8006
USE_MOCK=true
EOF

# 4. Start services (in separate terminals)
# Terminal 1: A2A Hub
python services/a2a_hub/app/main.py  # port 8000

# Terminal 2: Orchestrator
python services/orchestrator/app/main.py  # port 8001

# Terminal 3: Ad Agent
python -m uvicorn services.ad_agent.app.main:app --host 0.0.0.0 --port 8002

# Terminal 4: Content Agent
python -m uvicorn services.content_agent.app.main:app --host 0.0.0.0 --port 8003

# Terminal 5: Email Agent
python -m uvicorn services.email_agent.app.main:app --host 0.0.0.0 --port 8004

# Terminal 6: SEO Agent
python -m uvicorn services.seo_agent.app.main:app --host 0.0.0.0 --port 8005

# Terminal 7: Analytics Agent
python -m uvicorn services.analytics_agent.app.main:app --host 0.0.0.0 --port 8006

# 5. Test agents
python test_agents.py
```

---

## Testing Agent Responses

### Test Individual Agent

```bash
# Health check
curl http://localhost:8002/health

# RPC capability.bid
curl -X POST http://localhost:8002/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "capability.bid",
    "params": {}
  }'

# Full task execution (from orchestrator)
curl -X POST http://localhost:8002/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "test-task",
    "method": "task.execute",
    "params": {
      "campaign_id": "test-campaign-1",
      "goal": "Launch SaaS product",
      "audience": "DevOps engineers",
      "company_name": "TechStartup",
      "product_description": "Platform for infrastructure automation",
      "usp": "2x faster deployment",
      "budget_allocation": 500.0,
      "round": 1,
      "tone_of_voice": "professional",
      "performance_score": 0.75
    }
  }'
```

### Run Automated Tests

```bash
# Comprehensive agent diagnostic
python test_agents.py

# Check for syntax errors
python -m py_compile services/*/app/main.py

# View agent logs
tail -f /tmp/agent-logs/*.log  # if logging to files
```

---

## Understanding Agent Response Times

### Expected Latencies:

| Operation | Min | Typical | Max |
|-----------|-----|---------|-----|
| Health check | 5ms | 10ms | 50ms |
| capability.bid (mock) | 2ms | 5ms | 20ms |
| task.execute (mock) | 5ms | 20ms | 100ms |
| task.execute (Groq API) | 1s | 3-5s | 15s |

**Note:** Groq API calls depend on:
- Network latency to Groq servers (~100-500ms)
- LLM inference time (~2-4 seconds for llama-3.3-70b)
- Queue wait time (if rate limited)

### Why Requests Fail:

1. **Connection refused** → Service not running on port
2. **Timeout** → Service running but no response (check logs)
3. **500 Internal Error** → Exception in agent code (now logged to stderr)
4. **400 Bad Request** → Invalid JSON-RPC payload format
5. **Missing environment variable** → GROQ_API_KEY not set (when USE_MOCK=false)

---

## Viewing Agent Logs

Each agent logs to **stderr**. To see errors:

```bash
# If running in foreground, errors appear in terminal
# If running with uvicorn, use:
python -m uvicorn services.ad_agent.app.main:app --host 0.0.0.0 --port 8002 2>&1 | tee ad_agent.log

# Filter for errors:
grep -E "\[ad_agent\]" ad_agent.log
```

### Sample Error Logs (After Fixes):
```
[ad_agent] Error generating ads: AuthenticationError: Invalid API key provided
[content_agent] Error generating content pack: TimeoutError: Request timed out
[seo_agent] Error generating SEO brief: APIConnectionError: Connection refused
[email_agent] Warning: Failed to publish event: HTTPError: 500 Internal Server Error
```

---

## Troubleshooting Checklist

- [ ] All 7 services running (test with `curl http://localhost:800X/health`)
- [ ] GROQ_API_KEY set correctly (test with `echo $GROQ_API_KEY`)
- [ ] Database file accessible (check `data/campaigns.db` exists)
- [ ] No port conflicts (use `lsof -i :8000-8006` to check)
- [ ] Python venv activated (check with `which python`)
- [ ] All dependencies installed (check with `pip list | grep groq`)
- [ ] Firewall not blocking local ports
- [ ] Groq API is accessible (test with `curl https://api.groq.com`)

---

## Next Steps

1. **Start services** with `USE_MOCK=true` to test without API keys
2. **Run test_agents.py** to verify connectivity
3. **Check logs** for any error messages
4. **Set GROQ_API_KEY** once tests pass
5. **Monitor performance** using response time metrics

All agents now have proper error handling and will gracefully fall back to mock responses or error responses instead of crashing with 500 errors.
