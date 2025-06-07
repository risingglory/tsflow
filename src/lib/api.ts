import type { 
  TailscaleDevice, 
  NetworkFlowLog, 
  TailscaleConfig,
  ApiError 
} from '@/types/tailscale'

// Load configuration from multiple sources
const loadConfig = (): TailscaleConfig => {
  // Try localStorage first (user settings)
  const savedApiKey = localStorage.getItem('tsflow-api-key')
  const savedTailnet = localStorage.getItem('tsflow-tailnet')
  
  // Fallback to environment variables
  const envApiKey = import.meta.env.VITE_TAILSCALE_API_KEY
  const envTailnet = import.meta.env.VITE_TAILSCALE_TAILNET
  const envBaseUrl = import.meta.env.VITE_TAILSCALE_BASE_URL
  
  return {
    apiKey: savedApiKey || envApiKey || '',
    tailnet: savedTailnet || envTailnet || '',
    baseUrl: envBaseUrl || 'http://localhost:3001/api/v2'
  }
}

class TailscaleAPI {
  private config: TailscaleConfig

  constructor() {
    this.config = loadConfig()
  }

  // Reload configuration from all sources
  reloadConfig() {
    this.config = loadConfig()
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Always reload config to get latest credentials
    this.reloadConfig()
    
    if (!this.config.apiKey || !this.config.tailnet) {
      throw {
        message: 'API key and tailnet not configured. Please check your settings.',
        status: 0,
      } as ApiError
    }

    const url = `${this.config.baseUrl}${endpoint}`
    
    const headers = {
      'Authorization': `Basic ${btoa(`${this.config.apiKey}:`)}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const error: ApiError = {
          message: `API request failed: ${response.statusText}`,
          status: response.status,
        }
        throw error
      }

      return await response.json()
    } catch (error) {
      if (error instanceof Error) {
        throw {
          message: error.message,
          status: 0,
        } as ApiError
      }
      throw error
    }
  }

  // Get all devices in the tailnet
  async getDevices(): Promise<TailscaleDevice[]> {
    const response = await this.request<{ devices: TailscaleDevice[] }>(
      `/tailnet/${this.config.tailnet}/devices`
    )
    return response.devices
  }

  // Get network flow logs for a specific time range  
  async getNetworkLogs(start: string, end: string): Promise<NetworkFlowLog[]> {
    const params = new URLSearchParams({
      start,
      end,
    })
    
    const response = await this.request<{logs: NetworkFlowLog[]}>(
      `/tailnet/${this.config.tailnet}/logging/network?${params}`
    )
    return response.logs || []
  }

  // Update configuration
  updateConfig(newConfig: Partial<TailscaleConfig>) {
    this.config = { ...this.config, ...newConfig }
  }

  // Get current configuration (excluding API key for security)
  getConfig(): Omit<TailscaleConfig, 'apiKey'> {
    const { apiKey, ...config } = this.config
    return config
  }

  // Check if credentials are configured
  isConfigured(): boolean {
    this.reloadConfig()
    return !!(this.config.apiKey && this.config.tailnet)
  }

  // Get masked API key for display
  getMaskedApiKey(): string {
    if (!this.config.apiKey) return 'Not configured'
    return `${this.config.apiKey.substring(0, 12)}...`
  }
}

// Create singleton instance
export const tailscaleAPI = new TailscaleAPI()

// SWR fetcher function with better error handling
export const fetcher = async (url: string) => {
  try {
    // Handle different types of requests based on URL pattern
    if (url.startsWith('/devices')) {
      return await tailscaleAPI.getDevices()
    }
    
    if (url.startsWith('/network-logs')) {
      // Parse query parameters from URL for network logs
      const urlObj = new URL(url, 'http://localhost')
      const start = urlObj.searchParams.get('start') || ''
      const end = urlObj.searchParams.get('end') || ''
      
      if (!start || !end) {
        throw new Error('Start and end times are required for network logs')
      }
      
      return await tailscaleAPI.getNetworkLogs(start, end)
    }
    
    throw new Error(`Unknown API endpoint: ${url}`)
  } catch (error: any) {
    // Re-throw with better context for credential issues
    if (error.status === 401 || error.status === 403) {
      throw new Error('Invalid API credentials. Please check your settings.')
    } else if (error.status === 404) {
      throw new Error('Tailnet not found. Please check your tailnet name in settings.')
    }
    throw error
  }
}

// Utility function to format RFC3339 timestamp
export const toRFC3339 = (date: Date): string => {
  return date.toISOString()
}

// Utility function to parse search queries
export const parseSearchQuery = (query: string) => {
  const parts = query.toLowerCase().split(/\s+/)
  const parsed: Record<string, string> = {}
  
  for (const part of parts) {
    if (part.includes(':')) {
      const [key, value] = part.split(':', 2)
      parsed[key] = value
    } else {
      parsed.text = part
    }
  }
  
  return parsed
}

// Utility function to format bytes
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

// Utility function to format duration
export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export default tailscaleAPI 