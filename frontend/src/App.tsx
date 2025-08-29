import { SWRConfig } from 'swr'
import { ThemeProvider } from '@/contexts/ThemeContext'
import NetworkView from '@/pages/NetworkView'
import { fetcher } from '@/lib/api'

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
        <NetworkView />
      </SWRConfig>
    </ThemeProvider>
  )
}

export default App 