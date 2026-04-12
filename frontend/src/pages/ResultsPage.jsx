import OutputPreviews from '../components/OutputPreviews'

function HeroCard({ title, value, sub }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <p className="text-[58px] font-semibold leading-none text-text-primary">{value}</p>
      <p className="mt-2 text-[20px] text-text-secondary">{title}</p>
      {sub ? <p className="mt-1 text-[16px] text-text-secondary">{sub}</p> : null}
    </div>
  )
}

function ResultsPage({ session }) {
  const { outputs, campaignId, currentAllocations, fields } = session
  const budgetUsed = Object.values(currentAllocations).reduce((sum, value) => sum + Number(value || 0), 0)
  const totalBudget = Number(fields.budget || 0)

  return (
    <div className="space-y-5">
      <div className="border-b border-border pb-2">
        <p className="text-xs text-text-secondary">Analytics / Results</p>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-[38px] font-semibold leading-tight text-text-primary">Campaign Results</h1>
          <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-medium text-success">Completed</span>
        </div>
      </div>

      <section className="grid grid-cols-4 gap-4">
        <HeroCard title="Total Reach" value="48,200" />
        <HeroCard title="Final ROI" value="2.4x" />
        <HeroCard title="Budget Used" value={`$${budgetUsed.toFixed(2)}`} sub={`of $${totalBudget.toFixed(0)}`} />
        <HeroCard title="Tokens Saved" value="64%" />
      </section>

      <OutputPreviews outputs={outputs} campaignId={campaignId} />
    </div>
  )
}

export default ResultsPage
