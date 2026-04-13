# Agent Analysis Report - 500 Internal Server Error Issues

## Executive Summary
Found **CRITICAL BUGS** causing 500 errors in multiple agents. Issues stem from:
1. **Unhandled Groq API exceptions** - content_agent doesn't wrap entire API call in try/except
2. **JSON parsing outside try block** - content_agent tries to parse JSON outside exception handler
3. **Inconsistent error handling** - Some agents handle errors, others don't
4. **Missing GROQ_API_KEY environment variable** - Causes agents to fail at startup if not set properly

## Detailed Issues by Agent

### 1. **content_agent** ⚠️ CRITICAL
**File:** `services/content_agent/app/main.py` (Lines 136-180)

**Problem:**
```python
async def generate_content_pack(...):
    if USE_MOCK:
        return _fallback_content_pack(...)
    
    client = AsyncGroq(api_key=GROQ_API_KEY)  # ← No try/except wraps this
    system_prompt = (...)
    response = await client.chat.completions.create(...)  # ← THIS CAN THROW
    text = response.choices[0].message.content  # ← THIS CAN THROW
    try:
        return json.loads(text or "{}")  # ← Only THIS is caught
    except Exception:
        return _fallback_content_pack(...)
```

**Why it fails:**
- If `client.chat.completions.create()` fails → **Unhandled exception → 500 error**
- If response is malformed → accessing `response.choices[0]` throws **IndexError → 500 error**
- If content is None → **Can cause issues**

**Impact:** The most used agent (content creation) crashes on any API error.

---

### 2. **ad_agent** ⚠️ MINOR
**File:** `services/ad_agent/app/main.py` (Lines 65-82)

**Status:** ✓ Has try/except but could be improved
```python
async def generate_ads(...):
    if USE_MOCK:
        return _fallback_ads(...)
    
    try:
        client = AsyncGroq(api_key=GROQ_API_KEY)
        response = await client.chat.completions.create(...)  # ✓ Wrapped
        text = response.choices[0].message.content
        payload = json.loads(text or "{}")
    except Exception:  # ✓ Catches everything
        return _fallback_ads(...)
    
    if not isinstance(payload, dict):
        return _fallback_ads(...)
    return payload
```

**Issue:** Catches all exceptions but doesn't log them, making debugging hard.

---

### 3. **seo_agent** ⚠️ MINOR
**File:** `services/seo_agent/app/main.py` (Lines 60-77)

**Status:** ✓ Has try/except (same pattern as ad_agent)

**Issue:** Same as ad_agent - no logging of actual errors.

---

### 4. **email_agent** ✓ OK
**File:** `services/email_agent/app/main.py`

**Status:** ✓ No Groq API - uses hardcoded templates or RESEND_API_KEY
- Doesn't depend on Groq API
- Has proper error handling with `response.raise_for_status()`
- Uses `DELIVERY_MODE` to fallback to mock if config is missing

---

### 5. **analytics_agent** ✓ OK
**File:** `services/analytics_agent/app/main.py`

**Status:** ✓ No API calls - pure computation
- Generates synthetic metrics
- No network errors possible
- Only fails if database is down (not in this code)

---

## Root Cause Summary

| Agent | Issue | Severity | Cause |
|-------|-------|----------|-------|
| content_agent | Unhandled Groq exceptions | **CRITICAL** | Try/except only wraps JSON parse, not API call |
| ad_agent | No error logging | Minor | Hard to debug production issues |
| seo_agent | No error logging | Minor | Hard to debug production issues |
| email_agent | — | — | ✓ Properly implemented |
| analytics_agent | — | — | ✓ Properly implemented |

---

## Environment Variable Issues

**Missing GROQ_API_KEY:**
- Test output shows: `API Key Present: False`
- Code checks: `if not USE_MOCK and not GROQ_API_KEY: raise RuntimeError(...)`
- This causes agents to fail at **startup** (before any request)

**However:** If `USE_MOCK=true`, agents don't need GROQ_API_KEY

---

## API Call Performance Analysis

### Expected Response Times:
- **Groq API call:** 2-5 seconds (network + inference)
- **Fallback (mock):** <10ms
- **Total endpoint latency:** Should return within 6-10 seconds

### Timeout Settings:
- HTTPx client timeout: `timeout=10` in all agents ✓ Reasonable

---

## Fixes Required

### Priority 1 (CRITICAL - Fix content_agent)
Wrap entire Groq API call in try/except, add logging

### Priority 2 (HIGH - Improve error handling)
Add logging to ad_agent and seo_agent, improve error messages

### Priority 3 (MEDIUM - Environment setup)
Document GROQ_API_KEY requirement, add startup validation

---

## Testing Checklist
- [ ] Test each agent endpoint with `/rpc` POST request
- [ ] Test with `USE_MOCK=true` (should always work)
- [ ] Test with `USE_MOCK=false` + valid GROQ_API_KEY
- [ ] Measure API response latency
- [ ] Check error handling when API key is invalid
- [ ] Check error handling when API times out
