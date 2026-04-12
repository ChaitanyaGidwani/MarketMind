import { useEffect, useMemo, useRef, useState } from 'react'

const HUB_URL = import.meta.env.VITE_A2A_HUB_URL || 'http://localhost:8000'
const ORCHESTRATOR_URL = 'http://localhost:8001'
const STORAGE_CAMPAIGN_KEY = 'marketmind-active-campaign-id'
const AGENT_ORDER = ['content_agent', 'ad_agent', 'email_agent', 'seo_agent', 'analytics_agent']
const SSE_EVENTS = [
  'campaign.started',
  'campaign.round.started',
  'agent.started',
  'agent.progress',
  'agent.completed',
  'agent.failed',
  'campaign.renegotiation',
  'campaign.completed',
  'campaign.failed',
]

const INITIAL_AGENT_STATE = {
  content_agent: { name: 'Content Agent', status: 'idle', task: 'Waiting for run', budget: 0 },
  ad_agent: { name: 'Ad Agent', status: 'idle', task: 'Waiting for run', budget: 0 },
  email_agent: { name: 'Email Agent', status: 'idle', task: 'Waiting for run', budget: 0 },
  seo_agent: { name: 'SEO Agent', status: 'idle', task: 'Waiting for run', budget: 0 },
  analytics_agent: { name: 'Analytics Agent', status: 'idle', task: 'Waiting for run', budget: 0 },
}

function enrichEvent(evt) {
  return {
    ...evt,
    timestamp: evt?.timestamp || new Date().toISOString(),
  }
}

export default function useCampaignSession() {
  const [goal, setGoal] = useState('Launch a product campaign for startup founders')
  const [budget, setBudget] = useState(500)
  const [audience, setAudience] = useState('startup founders')
  const [companyName, setCompanyName] = useState('MarketMind')
  const [productDescription, setProductDescription] = useState('AI-powered marketing campaign planner and execution workspace')
  const [usp, setUsp] = useState('Automates execution and optimization across channels in one workflow')
  const [toneOfVoice, setToneOfVoice] = useState('professional')
  const [timelineDays, setTimelineDays] = useState(7)
  const [channels, setChannels] = useState(['google_ads', 'email', 'seo'])
  const [brandGuidelines, setBrandGuidelines] = useState('Professional but approachable. Focus on measurable outcomes.')

  const [campaignId, setCampaignId] = useState(() => localStorage.getItem(STORAGE_CAMPAIGN_KEY) || '')
  const [status, setStatus] = useState('idle')
  const [events, setEvents] = useState([])
  const [budgetHistory, setBudgetHistory] = useState([])
  const [currentAllocations, setCurrentAllocations] = useState({})
  const [outputs, setOutputs] = useState({})
  const [agentStates, setAgentStates] = useState(INITIAL_AGENT_STATE)

  const eventSourceRef = useRef(null)
  const statusPollRef = useRef(null)

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current)
      }
    }
  }, [])

  const normalizeStatus = (value) => {
    const raw = String(value || '').toLowerCase()
    if (raw === 'complete') return 'completed'
    if (raw === 'running') return 'running'
    if (raw === 'failed') return 'failed'
    if (raw === 'completed') return 'completed'
    if (raw === 'starting') return 'starting'
    return value || 'idle'
  }

  const fetchOutputs = async (id) => {
    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/outputs/${id}`)
      const result = await response.json()
      setOutputs(result)
    } catch {
      // no-op
    }
  }

  const closeEventStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }

  const updateAgentState = (event) => {
    const agent = event?.agent
    if (!agent || !INITIAL_AGENT_STATE[agent]) return

    setAgentStates((prev) => {
      const next = { ...prev }
      const current = next[agent]
      const payload = event.payload || {}

      let nextStatus = current.status
      if (event.event_type === 'agent.started' || event.event_type === 'agent.progress') nextStatus = 'running'
      if (event.event_type === 'agent.completed') nextStatus = 'completed'
      if (event.event_type === 'agent.failed') nextStatus = 'failed'

      next[agent] = {
        ...current,
        status: nextStatus,
        task: payload.stage || payload.message || payload.type || current.task,
      }
      return next
    })
  }

  const pushRenegotiation = (payload) => {
    const round = Number(payload?.round)
    const before = payload?.before || {}
    const after = payload?.after || {}
    if (!Number.isFinite(round)) return

    setBudgetHistory((prev) => {
      const next = [...prev]
      if (!next.some((item) => item.round === 0) && Object.keys(before).length > 0) {
        next.push({ round: 0, allocations: before })
      }
      const existingIdx = next.findIndex((item) => item.round === round)
      if (existingIdx >= 0) {
        next[existingIdx] = { round, allocations: after }
      } else {
        next.push({ round, allocations: after })
      }
      next.sort((a, b) => a.round - b.round)
      return next
    })

    setCurrentAllocations(after)
    setAgentStates((prev) => {
      const next = { ...prev }
      for (const [agent, amount] of Object.entries(after)) {
        if (!next[agent]) continue
        next[agent] = { ...next[agent], budget: Number(amount || 0) }
      }
      return next
    })
  }

  const addEvent = (evt) => {
    const event = enrichEvent(evt)
    setEvents((prev) => [event, ...prev].slice(0, 120))
    updateAgentState(event)

    if (event.event_type === 'campaign.renegotiation' && event.payload?.type === 'renegotiation') {
      pushRenegotiation(event.payload)
    }

    if (event.event_type === 'campaign.completed' || event.event_type === 'campaign.failed') {
      setStatus(event.event_type === 'campaign.completed' ? 'completed' : 'failed')
      closeEventStream()
      localStorage.removeItem(STORAGE_CAMPAIGN_KEY)
    }
  }

  const connectEventStream = (id) => {
    closeEventStream()

    const source = new EventSource(`${HUB_URL}/events/${id}`)
    eventSourceRef.current = source

    source.onmessage = (raw) => {
      try {
        addEvent(JSON.parse(raw.data))
      } catch {
        // no-op
      }
    }

    SSE_EVENTS.forEach((name) => {
      source.addEventListener(name, (raw) => {
        try {
          const event = JSON.parse(raw.data)
          addEvent(event)
          if (event.event_type === 'agent.completed' || event.event_type === 'campaign.completed') {
            fetchOutputs(id)
          }
        } catch {
          // no-op
        }
      })
    })
  }

  const hydrateStatus = async (id) => {
    if (!id) return

    try {
      const response = await fetch(`${ORCHESTRATOR_URL}/status/${id}`)
      if (!response.ok) return
      const data = await response.json()

      const normalized = normalizeStatus(data?.status)
      setCampaignId(data?.campaign_id || id)
      setStatus(normalized)

      if (data?.current_allocations && typeof data.current_allocations === 'object') {
        setCurrentAllocations(data.current_allocations)
        setAgentStates((prev) => {
          const next = { ...prev }
          for (const [agent, amount] of Object.entries(data.current_allocations)) {
            if (!next[agent]) continue
            next[agent] = {
              ...next[agent],
              budget: Number(amount || 0),
              status: normalized === 'running' ? 'running' : next[agent].status,
            }
          }
          return next
        })
      }

      if (Array.isArray(data?.allocation_history)) {
        setBudgetHistory(data.allocation_history)
      }

      await fetchOutputs(id)

      if (normalized === 'running') {
        localStorage.setItem(STORAGE_CAMPAIGN_KEY, id)
        if (!eventSourceRef.current) {
          connectEventStream(id)
        }
      }

      if (normalized === 'completed' || normalized === 'failed') {
        closeEventStream()
        localStorage.removeItem(STORAGE_CAMPAIGN_KEY)
      }
    } catch {
      // no-op
    }
  }

  useEffect(() => {
    if (!campaignId) return
    hydrateStatus(campaignId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  useEffect(() => {
    const shouldPoll = status === 'running'
    if (!shouldPoll || !campaignId) {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current)
        statusPollRef.current = null
      }
      return
    }

    if (statusPollRef.current) {
      clearInterval(statusPollRef.current)
    }
    statusPollRef.current = setInterval(() => {
      hydrateStatus(campaignId)
    }, 5000)

    return () => {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current)
        statusPollRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, campaignId])

  const startCampaign = async () => {
    setStatus('starting')
    setEvents([])
    setBudgetHistory([])
    setCurrentAllocations({})
    setOutputs({})
    setAgentStates(INITIAL_AGENT_STATE)

    await fetch(`${ORCHESTRATOR_URL}/campaign/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const campaignPayload = {
      goal,
      company_name: companyName,
      product_description: productDescription,
      target_audience: audience,
      usp,
      tone_of_voice: toneOfVoice,
      budget: Number(budget),
      timeline_days: Number(timelineDays),
      channels,
      brand_guidelines: brandGuidelines || `${toneOfVoice} tone. Focus on differentiation and measurable ROI.`,
    }

    const res = await fetch(`${ORCHESTRATOR_URL}/campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignPayload),
    })
    const data = await res.json()

    if (data.error || !data.campaign_id) {
      setStatus(`error: ${data?.error?.message || 'failed to start campaign'}`)
      return { ok: false, error: data?.error?.message || 'failed to start campaign' }
    }

    const id = data.campaign_id
    setCampaignId(id)
    localStorage.setItem(STORAGE_CAMPAIGN_KEY, id)
    setStatus('running')

    connectEventStream(id)

    return { ok: true, campaignId: id }
  }

  const stats = useMemo(() => {
    const spend = Object.values(currentAllocations).reduce((sum, item) => sum + Number(item || 0), 0)
    const completedAgents = Object.values(agentStates).filter((a) => a.status === 'completed').length
    const strategy = outputs['strategy.json'] || outputs.strategy_json || {}
    const totalReach = Number(strategy.reach || strategy.total_reach || 0) || Math.round(spend * 120)
    const roi = Number(strategy.roi || strategy.projected_roi || 0) || Number(((completedAgents / 5) * 2.4).toFixed(2))

    return {
      budgetUsed: spend,
      campaignsRun: campaignId ? 1 : 0,
      totalReach,
      roi,
      completedAgents,
    }
  }, [agentStates, campaignId, currentAllocations, outputs])

  const historyByRound = useMemo(() => {
    const out = {}
    budgetHistory.forEach((item) => {
      out[item.round] = item.allocations || {}
    })
    return out
  }, [budgetHistory])

  return {
    fields: {
      goal,
      budget,
      audience,
      companyName,
      productDescription,
      usp,
      toneOfVoice,
      timelineDays,
      channels,
      brandGuidelines,
    },
    setField: {
      setGoal,
      setBudget,
      setAudience,
      setCompanyName,
      setProductDescription,
      setUsp,
      setToneOfVoice,
      setTimelineDays,
      setChannels,
      setBrandGuidelines,
    },
    campaignId,
    status,
    events,
    budgetHistory,
    historyByRound,
    currentAllocations,
    outputs,
    agentStates,
    stats,
    startCampaign,
    agentOrder: AGENT_ORDER,
  }
}
