import { NavLink, useLocation } from 'react-router-dom'
import { AGENT_HEALTH_ENDPOINTS } from '../../constants/agents'
import useAgentHealth from '../../hooks/useAgentHealth'

const ICON_BY_KEY = {
  dashboard: '◻',
  'new-campaign': '⊕',
  'live-monitor': '⌁',
  results: '╎',
  'rag-memory': '◍',
  settings: '⚙',
}

function SidebarNav({ items }) {
  const location = useLocation()
  const healthByAgent = useAgentHealth()

  const isActiveRoute = (target) => {
    if (target === '/') return location.pathname === '/'
    if (target.startsWith('/new-campaign')) return location.pathname.startsWith('/new-campaign')
    return location.pathname === target
  }

  return (
    <aside className="flex min-h-[calc(100vh-64px)] w-[245px] flex-col border-r border-border bg-card">
      <div className="px-4 pb-6 pt-5">
        <div className="mb-8 mt-1 flex items-center gap-3 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">✦</div>
          <span className="text-[30px] font-semibold leading-none text-text-primary">MarketMind</span>
        </div>

        <nav className="space-y-2 px-1">
          {items.map((item) => {
            const selected = isActiveRoute(item.to)
            return (
              <NavLink
                key={item.key}
                to={item.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[18px] transition ${
                  selected ? 'bg-accent/25 text-text-primary' : 'text-text-secondary hover:bg-canvas hover:text-text-primary'
                }`}
              >
                <span className="w-4 text-center text-[14px]">{ICON_BY_KEY[item.key] || '•'}</span>
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-border px-4 pb-6 pt-4">
        <p className="text-xs uppercase tracking-wide text-text-secondary">Agents Online</p>
        <div className="mt-3 space-y-1.5 text-xs text-text-secondary">
          {AGENT_HEALTH_ENDPOINTS.map((agent) => {
            const healthy = Boolean(healthByAgent[agent.key])
            return (
              <div key={agent.key} className="flex items-center justify-between">
                <span>{agent.label}</span>
                <span className="flex items-center gap-1">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${healthy ? 'bg-success' : 'bg-red-500'}`} />
                  <span>{agent.port}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export default SidebarNav
