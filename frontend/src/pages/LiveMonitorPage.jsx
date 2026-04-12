import AgentMonitor from '../components/AgentMonitor'

function StatusDot({ status }) {
  const color = status === 'completed' ? 'bg-success' : status === 'running' ? 'bg-amber-500' : status === 'failed' ? 'bg-red-500' : 'bg-text-secondary'
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />
}

function LiveMonitorPage({ session }) {
  const { agentStates, events, status, campaignId, fields, currentAllocations, budgetHistory } = session

  const round = Math.max(1, budgetHistory.length)
  const totalBudget = Number(fields.budget || 0)
  const entries = Object.entries(agentStates)

  return (
    <div className="space-y-5">
      <div className="border-b border-border pb-2">
        <p className="text-xs text-text-secondary">Monitor / Live</p>
        <h1 className="text-[38px] font-semibold leading-tight text-text-primary">Live Monitor</h1>
        <div className="mt-2 flex items-center gap-6 text-[16px] text-text-secondary">
          <span>Campaign ID: {campaignId || '—'}</span>
          <span className="text-success">● Running</span>
          <span>Round {Math.min(round, 3)} of 3</span>
          <span>Budget ${totalBudget}</span>
        </div>
      </div>

      <section className="grid grid-cols-[1fr_1.8fr_1.1fr] gap-4">
        <div className="space-y-3">
          {entries.map(([key, agent]) => {
            const amount = Number(currentAllocations[key] || 0)
            const width = totalBudget > 0 ? Math.max(0, Math.min(100, (amount / totalBudget) * 100)) : 0
            return (
              <div key={key} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[24px] font-medium text-text-primary">{agent.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                      agent.status === 'completed'
                        ? 'bg-success/20 text-success'
                        : agent.status === 'running'
                          ? 'bg-amber-500/20 text-amber-400'
                          : agent.status === 'failed'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-border text-text-secondary'
                    }`}
                  >
                    {agent.status}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-2 text-[15px] text-text-secondary"><StatusDot status={agent.status} /> {agent.status === 'running' ? 'Active' : 'Idle'}</p>
                <p className="mt-2 text-[16px] text-text-secondary">Task: {agent.task}</p>
                <p className="mt-2 text-[16px] text-text-secondary">Budget: ${amount.toFixed(2)}</p>
                <div className="mt-2 h-1.5 rounded-full bg-canvas">
                  <div className="h-1.5 rounded-full bg-accent" style={{ width: `${width}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        <AgentMonitor events={events} status={status} />

        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <h2 className="text-[36px] font-semibold text-text-primary">Budget Allocation</h2>
          <div className="mt-4 space-y-4">
            {entries.map(([key]) => {
              const amount = Number(currentAllocations[key] || 0)
              const width = totalBudget > 0 ? Math.max(0, Math.min(100, (amount / totalBudget) * 100)) : 0
              return (
                <div key={`${key}-allocation`}>
                  <div className="mb-1 flex justify-between text-[15px]">
                    <span className="text-text-secondary">{key}</span>
                    <span className="text-text-primary">${amount.toFixed(2)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-canvas">
                    <div className="h-2 rounded-full bg-accent" style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-[15px] text-accent">⟳ Re-negotiation triggered</div>
        </div>
      </section>
    </div>
  )
}

export default LiveMonitorPage
