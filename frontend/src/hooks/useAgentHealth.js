import { useEffect, useState } from 'react'
import { AGENT_HEALTH_ENDPOINTS } from '../constants/agents'

async function checkHealth(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return false
    const data = await response.json()
    return data?.status === 'ok'
  } catch {
    return false
  }
}

export default function useAgentHealth() {
  const [healthByAgent, setHealthByAgent] = useState(() =>
    Object.fromEntries(AGENT_HEALTH_ENDPOINTS.map((agent) => [agent.key, false])),
  )

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      const results = await Promise.all(
        AGENT_HEALTH_ENDPOINTS.map(async (agent) => [agent.key, await checkHealth(agent.url)]),
      )
      if (!cancelled) {
        setHealthByAgent(Object.fromEntries(results))
      }
    }

    poll()
    const interval = setInterval(poll, 10000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return healthByAgent
}
