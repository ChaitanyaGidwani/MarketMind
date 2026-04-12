const AGENT_BADGE = {
  content_agent: 'bg-accent/20 text-accent',
  ad_agent: 'bg-success/20 text-success',
  email_agent: 'bg-red-500/20 text-red-300',
  seo_agent: 'bg-blue-500/20 text-blue-300',
  analytics_agent: 'bg-accent/20 text-accent',
}

const EVENT_BADGE = {
  'campaign.renegotiation': 'text-accent',
  'agent.completed': 'text-success',
  'agent.progress': 'text-red-400',
  'agent.started': 'text-blue-300',
  'campaign.round.started': 'text-accent',
}

function formatAge(timestamp) {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  if (Number.isNaN(then)) return 'just now'
  const diff = Math.max(0, Math.floor((now - then) / 1000))
  if (diff < 5) return 'just now'
  return `${diff}s ago`
}

function AgentMonitor({ events, status }) {
  return (
    <section className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-[36px] font-semibold text-text-primary">Agent Activity Feed</h2>
        <span className="text-xs capitalize text-text-secondary">{status}</span>
      </div>
      <div className="mt-3 max-h-[620px] space-y-2 overflow-auto">
        {events.length === 0 && <p className="text-sm text-text-secondary">No events yet. Start a campaign to view live updates.</p>}
        {events.map((evt, idx) => (
          <div key={`${evt.event_id || 'evt'}-${idx}`} className="rounded-lg border border-border bg-canvas px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[15px]">
                <span className={`${EVENT_BADGE[evt.event_type] || 'text-text-secondary'} font-semibold`}>[{(evt.event_type || 'event').toUpperCase()}]</span>
                <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${AGENT_BADGE[evt.agent] || 'bg-border text-text-secondary'}`}>
                  {evt.agent || 'orchestrator'}
                </span>
              </div>
              <span className="text-[13px] text-text-secondary">{formatAge(evt.timestamp)}</span>
            </div>
            <p className="mt-2 text-[20px] text-text-primary">{evt.payload?.stage || evt.payload?.message || evt.payload?.type || evt.event_type}</p>
            <p className="mt-1 text-sm text-text-secondary">View payload ›</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default AgentMonitor
