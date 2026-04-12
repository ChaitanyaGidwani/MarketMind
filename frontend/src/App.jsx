import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import NewCampaignPage from './pages/NewCampaignPage'
import LiveMonitorPage from './pages/LiveMonitorPage'
import ResultsPage from './pages/ResultsPage'
import Step1GoalAudienceTimelinePage from './pages/new-campaign/Step1GoalAudienceTimelinePage'
import Step2BudgetChannelsPage from './pages/new-campaign/Step2BudgetChannelsPage'
import Step3BrandVoiceLaunchPage from './pages/new-campaign/Step3BrandVoiceLaunchPage'
import TopBar from './components/layout/TopBar'
import SidebarNav from './components/layout/SidebarNav'
import AppShell from './components/layout/AppShell'
import useCampaignSession from './hooks/useCampaignSession'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', to: '/' },
  { key: 'new-campaign', label: 'New Campaign', to: '/new-campaign/step-1' },
  { key: 'live-monitor', label: 'Live Monitor', to: '/live-monitor' },
  { key: 'results', label: 'Results', to: '/results' },
  { key: 'rag-memory', label: 'RAG Memory', to: '/rag-memory' },
  { key: 'settings', label: 'Settings', to: '/settings' },
]

function App() {
  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem('marketmind-theme-mode')
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
    return 'system'
  })
  const [systemTheme, setSystemTheme] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const session = useCampaignSession()

  const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const isDark = resolvedTheme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('marketmind-theme-mode', themeMode)
  }, [resolvedTheme, themeMode])

  const navigate = useNavigate()

  const topBar = useMemo(
    () => (
      <TopBar
        campaignId={session.campaignId}
        status={session.status}
        themeMode={themeMode}
        resolvedTheme={resolvedTheme}
        onThemeModeChange={setThemeMode}
      />
    ),
    [resolvedTheme, session.campaignId, session.status, themeMode],
  )

  return (
    <AppShell topBar={topBar} sidebar={<SidebarNav items={NAV_ITEMS} />}>
      <Routes>
        <Route path="/" element={<DashboardPage session={session} onCreateCampaign={() => navigate('/new-campaign/step-1')} />} />
        <Route path="/new-campaign" element={<NewCampaignPage />}>
          <Route index element={<Navigate to="step-1" replace />} />
          <Route path="step-1" element={<Step1GoalAudienceTimelinePage session={session} />} />
          <Route path="step-2" element={<Step2BudgetChannelsPage session={session} />} />
          <Route path="step-3" element={<Step3BrandVoiceLaunchPage session={session} />} />
        </Route>
        <Route path="/live-monitor" element={<LiveMonitorPage session={session} />} />
        <Route path="/results" element={<ResultsPage session={session} theme={resolvedTheme} />} />
        <Route path="/rag-memory" element={<DashboardPage session={session} onCreateCampaign={() => navigate('/new-campaign/step-1')} />} />
        <Route path="/settings" element={<DashboardPage session={session} onCreateCampaign={() => navigate('/new-campaign/step-1')} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
