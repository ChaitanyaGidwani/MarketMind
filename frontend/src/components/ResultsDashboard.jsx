import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import CampaignWizard from './CampaignWizard'
import AgentMonitor from './AgentMonitor'
import OutputPreviews from './OutputPreviews'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const HUB_URL = import.meta.env.VITE_A2A_HUB_URL || 'http://localhost:8000'
const ORCHESTRATOR_URL = 'http://localhost:8001'
const AGENT_ORDER = ['content_agent', 'ad_agent', 'email_agent', 'seo_agent']
const AGENT_COLORS = {
  content_agent: '#22d3ee',
  ad_agent: '#a78bfa',
  email_agent: '#34d399',
  seo_agent: '#f59e0b',
}

function ResultsDashboard() {
  const [goal, setGoal] = useState('Launch a product campaign for startup founders')
  const [budget, setBudget] = useState(500)
  const [audience, setAudience] = useState('startup founders')
  const [companyName, setCompanyName] = useState('MarketMind')
  const [productDescription, setProductDescription] = useState('AI-powered marketing campaign planner and execution workspace')
  const [usp, setUsp] = useState('Automates execution and optimization across channels in one workflow')
  const [toneOfVoice, setToneOfVoice] = useState('professional')
  const [timelineDays, setTimelineDays] = useState(7)
  const [campaignId, setCampaignId] = useState('')
  const [status, setStatus] = useState('idle')
  const [events, setEvents] = useState([])
  const [budgetHistory, setBudgetHistory] = useState([])
  const [currentAllocations, setCurrentAllocations] = useState({})
  const [ghostAllocations, setGhostAllocations] = useState({})
  const [ghostVisible, setGhostVisible] = useState(true)
  const [allocationDelta, setAllocationDelta] = useState({})
  const [outputs, setOutputs] = useState({})

  const eventSourceRef = useRef(null)
  const ghostTimeoutRef = useRef(null)
  const ghostCleanupRef = useRef(null)

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      if (ghostTimeoutRef.current) {
        clearTimeout(ghostTimeoutRef.current)
      }
      if (ghostCleanupRef.current) {
        clearTimeout(ghostCleanupRef.current)
      }
    }
  }, [])

  const pushRenegotiation = (payload) => {
    const round = Number(payload?.round)
    const before = payload?.before || {}
    const after = payload?.after || {}
    if (!Number.isFinite(round)) return

    setBudgetHistory((prev) => {
      const next = [...prev]
      if (!next.some((item) => item.round === 0)) {
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

    const baseline = Object.keys(before).length > 0 ? before : currentAllocations
    const delta = {}
    for (const agent of new Set([...Object.keys(baseline), ...Object.keys(after)])) {
      const oldValue = Number(baseline[agent] || 0)
      const newValue = Number(after[agent] || 0)
      if (newValue > oldValue) delta[agent] = 'up'
      else if (newValue < oldValue) delta[agent] = 'down'
      else delta[agent] = 'same'
    }

    setGhostAllocations(baseline)
    setGhostVisible(true)
    setCurrentAllocations(after)
    setAllocationDelta(delta)

    if (ghostTimeoutRef.current) {
      clearTimeout(ghostTimeoutRef.current)
    }
    if (ghostCleanupRef.current) {
      clearTimeout(ghostCleanupRef.current)
    }
    ghostTimeoutRef.current = setTimeout(() => {
      setGhostVisible(false)
    }, 900)
    ghostCleanupRef.current = setTimeout(() => {
      setGhostAllocations({})
      setGhostVisible(true)
    }, 1220)
  }

  const addEvent = (evt) => {
    setEvents((prev) => [evt, ...prev].slice(0, 80))

    if (evt.event_type === 'campaign.renegotiation' && evt.payload?.type === 'renegotiation') {
      pushRenegotiation(evt.payload)
    }

    if (evt.event_type === 'campaign.completed' || evt.event_type === 'campaign.failed') {
      setStatus(evt.event_type === 'campaign.completed' ? 'completed' : 'failed')
      eventSourceRef.current?.close()
    }
  }

  const startCampaign = async () => {
    setStatus('starting')
    setEvents([])
    setBudgetHistory([])
    setCurrentAllocations({})
    setGhostAllocations({})
    setAllocationDelta({})
    setOutputs({})

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
      channels: ['google_ads', 'email', 'seo'],
      brand_guidelines: `${toneOfVoice} tone. Focus on differentiation and measurable ROI.`,
    }

    const res = await fetch(`${ORCHESTRATOR_URL}/campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaignPayload),
    })
    const data = await res.json()

    if (data.error || !data.campaign_id) {
      setStatus(`error: ${data?.error?.message || 'failed to start campaign'}`)
      return
    }

    const id = data.campaign_id
    setCampaignId(id)
    setStatus('running')

    const fetchOutputs = async () => {
      try {
        const response = await fetch(`${ORCHESTRATOR_URL}/outputs/${id}`)
        const result = await response.json()
        setOutputs(result)
      } catch {
        // no-op
      }
    }

    const source = new EventSource(`${HUB_URL}/events/${id}`)
    eventSourceRef.current = source

    source.onmessage = (raw) => {
      try {
        addEvent(JSON.parse(raw.data))
      } catch {
        // no-op
      }
    }

    const typed = [
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
    typed.forEach((name) => {
      source.addEventListener(name, (raw) => {
        try {
          const event = JSON.parse(raw.data)
          addEvent(event)
          if (event.event_type === 'agent.completed' || event.event_type === 'campaign.completed') {
            fetchOutputs()
          }
        } catch {
          // no-op
        }
      })
    })
  }

  const totalBudget = Number(budget) || 1
  const displayedAgents = AGENT_ORDER.filter((agent) => currentAllocations[agent] !== undefined || ghostAllocations[agent] !== undefined)

  const historyByRound = useMemo(() => {
    const out = {}
    budgetHistory.forEach((item) => {
      out[item.round] = item.allocations || {}
    })
    return out
  }, [budgetHistory])

  const lineData = useMemo(() => {
    const rounds = [0, 1, 2, 3]
    return {
      labels: rounds,
      datasets: AGENT_ORDER.map((agent) => ({
        label: agent,
        data: rounds.map((round) => {
          const allocations = historyByRound[round]
          if (!allocations) return null
          const value = allocations[agent]
          return typeof value === 'number' ? value : null
        }),
        borderColor: AGENT_COLORS[agent] || '#94a3b8',
        backgroundColor: AGENT_COLORS[agent] || '#94a3b8',
        tension: 0.25,
        spanGaps: true,
      })),
    }
  }, [historyByRound])

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
        <CampaignWizard
          goal={goal}
          audience={audience}
          budget={budget}
          companyName={companyName}
          productDescription={productDescription}
          usp={usp}
          toneOfVoice={toneOfVoice}
          timelineDays={timelineDays}
          onGoalChange={setGoal}
          onAudienceChange={setAudience}
          onBudgetChange={setBudget}
          onCompanyNameChange={setCompanyName}
          onProductDescriptionChange={setProductDescription}
          onUspChange={setUsp}
          onToneOfVoiceChange={setToneOfVoice}
          onTimelineDaysChange={setTimelineDays}
          onStart={startCampaign}
        />

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">Budget Re-negotiation</h2>
          <div className="mt-2 text-sm text-slate-300">Status: {status}</div>
          <div className="text-sm text-slate-300">Campaign ID: {campaignId || '—'}</div>

          <div className="mt-4 space-y-3">
            {displayedAgents.length === 0 && <p className="text-sm text-slate-400">Waiting for renegotiation events...</p>}
            {displayedAgents.map((agent) => {
              const current = Number(currentAllocations[agent] || 0)
              const ghost = Number(ghostAllocations[agent] || 0)
              const currentWidth = Math.max(0, Math.min(100, (current / totalBudget) * 100))
              const ghostWidth = Math.max(0, Math.min(100, (ghost / totalBudget) * 100))
              const tone = allocationDelta[agent] || 'same'
              const toneClass = tone === 'up' ? 'bg-emerald-500' : tone === 'down' ? 'bg-rose-500' : 'bg-slate-500'

              return (
                <div key={agent}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                    <span>{agent}</span>
                    <span>${current.toFixed(2)}</span>
                  </div>
                  <div className="relative h-5 overflow-hidden rounded bg-slate-800">
                    {ghost > 0 && (
                      <div
                        className="absolute left-0 top-0 h-full bg-slate-300 transition-opacity duration-300"
                        style={{ width: `${ghostWidth}%`, opacity: ghostVisible ? 0.3 : 0 }}
                      />
                    )}
                    <div
                      className={`absolute left-0 top-0 h-full ${toneClass}`}
                      style={{ width: `${currentWidth}%`, transition: 'width 800ms ease-in-out' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6">
            <Line data={lineData} />
          </div>
        </section>

        <AgentMonitor events={events} />
        <OutputPreviews outputs={outputs} campaignId={campaignId} />
      </div>
    </div>
  )
}

export default ResultsDashboard
