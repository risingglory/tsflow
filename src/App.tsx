import { Routes, Route } from 'react-router-dom'
import { SWRConfig } from 'swr'
import { ThemeProvider } from '@/contexts/ThemeContext'
import Dashboard from '@/pages/Dashboard'
import NetworkView from '@/pages/NetworkView'
import Settings from '@/pages/Settings'
import Logs from './pages/Logs'

// Proxy-based fetcher for Tailscale API
const fetcher = async (url: string) => {
  // Route through our Vite proxy instead of calling the API directly
  const proxyUrl = url.replace('/api/v2', '/api/tailscale')
  
  const response = await fetch(proxyUrl)

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

function App() {
  return (
    <ThemeProvider>
      <SWRConfig
        value={{
          fetcher,
          refreshInterval: 30000,
          revalidateOnFocus: false,
          errorRetryCount: 3,
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/network" element={<NetworkView />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </SWRConfig>
    </ThemeProvider>
  )
}

export default App 