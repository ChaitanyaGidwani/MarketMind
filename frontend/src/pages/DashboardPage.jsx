const METRIC_CARDS = [
  { title: 'Total Campaigns', value: '12', hint: '+3 this week' },
  { title: 'Average ROI', value: '2.4x', hint: '+0.3x vs last week' },
  { title: 'Budget Deployed', value: '$4,280', hint: 'Across all active campaigns' },
  { title: 'Tokens Saved by RAG', value: '64%', hint: '847 cache hits' },
]

const CAMPAIGN_ROWS = [
  { goal: 'Launch AI writing tool campaign', status: 'Running', budget: '$500', roi: '2.1x', date: 'Today' },
  { goal: 'SaaS onboarding campaign', status: 'Complete', budget: '$800', roi: '3.4x', date: 'Yesterday' },
  { goal: 'Product Hunt launch', status: 'Complete', budget: '$1200', roi: '1.8x', date: '2 days ago' },
]

const PERFORMANCE = [
  { agent: 'content_agent', score: 82 },
  { agent: 'ad_agent', score: 61 },
  { agent: 'email_agent', score: 91 },
  { agent: 'seo_agent', score: 74 },
  { agent: 'analytics_agent', score: 99 },
]

function DashboardPage() {
  return (
    <div className="space-y-5">
      <div className="border-b border-border pb-2">
        <p className="text-xs text-text-secondary">Overview</p>
        <h1 className="text-[38px] font-semibold leading-tight text-text-primary">Dashboard</h1>
      </div>

      <section className="grid grid-cols-4 gap-4">
        {METRIC_CARDS.map((card) => (
          <div key={card.title} className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-[54px] font-semibold leading-none text-text-primary">{card.value}</p>
            <p className="mt-2 text-[20px] text-text-secondary">{card.title}</p>
            <p className="mt-1 text-[16px] text-success">{card.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-[1.6fr_1fr] gap-4">
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <h2 className="text-[36px] font-semibold text-text-primary">Recent Campaigns</h2>
          <div className="mt-3 text-[17px]">
            <div className="grid grid-cols-[2fr_0.8fr_0.6fr_0.5fr_0.7fr] border-b border-border pb-2 text-text-secondary">
              <span>Goal</span>
              <span>Status</span>
              <span>Budget</span>
              <span>ROI</span>
              <span>Date</span>
            </div>
            {CAMPAIGN_ROWS.map((row) => (
              <div key={row.goal} className="grid grid-cols-[2fr_0.8fr_0.6fr_0.5fr_0.7fr] border-b border-border py-3 text-text-primary last:border-b-0">
                <span>{row.goal}</span>
                <span>
                  <span className={`rounded px-2 py-1 text-xs ${row.status === 'Running' ? 'bg-success/20 text-success' : 'bg-border text-text-primary'}`}>
                    ● {row.status}
                  </span>
                </span>
                <span>{row.budget}</span>
                <span>{row.roi}</span>
                <span className="text-text-secondary">{row.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <h2 className="text-[36px] font-semibold text-text-primary">Agent Performance</h2>
          <div className="mt-4 space-y-5">
            {PERFORMANCE.map((row) => (
              <div key={row.agent}>
                <div className="mb-1 flex items-center justify-between text-[15px]">
                  <span className="text-text-secondary">{row.agent}</span>
                  <span className="text-text-primary">{row.score}%</span>
                </div>
                <div className="h-2 rounded-full bg-canvas">
                  <div className="h-2 rounded-full bg-accent" style={{ width: `${row.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default DashboardPage
