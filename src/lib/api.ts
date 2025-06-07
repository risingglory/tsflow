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
    // Use local proxy in development, full URL in production
    baseUrl: import.meta.env.DEV ? '/api/v2' : (envBaseUrl || 'https://api.tailscale.com/api/v2')
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

  private async request<T>(endpoint: string, options: Record<string, unknown> = {}): Promise<T> {
    // Always reload config to get latest credentials
    this.reloadConfig()
    
    if (!this.config.apiKey || !this.config.tailnet) {
      throw {
        message: 'API key and tailnet not configured. Please check your settings.',
        status: 0,
      } as ApiError
    }

    const url = `${this.config.baseUrl}${endpoint}`
    
    // Debug logging
    console.log('API Request Details:', {
      isDev: import.meta.env.DEV,
      baseUrl: this.config.baseUrl,
      endpoint,
      fullUrl: url,
      tailnet: this.config.tailnet
    })
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // Only add Authorization header if not using proxy (in production)
    if (!import.meta.env.DEV) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    } else {
      // In development, log that we're using proxy
      console.log('Using Vite proxy - Authorization will be added by proxy')
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        ...options,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw {
          message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          details: errorData
        } as ApiError
      }

      return await response.json()
    } catch (error) {
      // Handle CORS errors specifically
      if (error instanceof TypeError) {
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
          throw {
            message: !import.meta.env.DEV 
              ? 'CORS Error: Direct API calls to Tailscale are blocked by the browser. In production, you need to either: 1) Use a browser extension to disable CORS (for testing), 2) Set up a reverse proxy (nginx, Cloudflare, etc.), or 3) Use the development mode with "npm run dev" which includes a built-in proxy.'
              : 'CORS Error: The Vite proxy should handle this. Try restarting the dev server.',
            status: 0,
          } as ApiError
        }
        
        // Other network errors
        throw {
          message: 'Network error: Unable to connect to Tailscale API. Please check your internet connection.',
          status: 0,
        } as ApiError
      }
      
      // Re-throw API errors
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
  } catch (error: unknown) {
    // Re-throw with better context for credential issues
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const apiError = error as ApiError
      if (apiError.status === 401 || apiError.status === 403) {
        throw new Error('Invalid API credentials. Please check your settings.')
      } else if (apiError.status === 404) {
        throw new Error('Tailnet not found. Please check your tailnet name in settings.')
      }
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