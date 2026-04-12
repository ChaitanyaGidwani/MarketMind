const THEME_OPTIONS = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
]

function TopBar({ campaignId, status, themeMode, resolvedTheme, onThemeModeChange }) {
  const tone = status === 'completed' ? 'text-success' : status === 'running' ? 'text-accent' : 'text-text-secondary'

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-[1440px] max-w-[1440px] items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">Design MarketMind SaaS Dashboard</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1" aria-label="Theme selector">
            {THEME_OPTIONS.map((option) => {
              const isActive = option.key === themeMode
              return (
                <button
                  key={option.key}
                  onClick={() => onThemeModeChange(option.key)}
                  className={`rounded px-2.5 py-1 text-xs transition ${
                    isActive ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="rounded-md border border-success/40 bg-success/15 px-3 py-1 text-sm text-success">● A2A Hub: Connected</div>
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-text-secondary">◌</div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">P</div>
          <span className="hidden rounded-md border border-border bg-card px-3 py-1 text-text-primary xl:inline">{campaignId || 'No active campaign'}</span>
          <span className={`hidden text-xs capitalize xl:inline ${tone}`}>{resolvedTheme} • {status}</span>
        </div>
      </div>
    </header>
  )
}

export default TopBar
