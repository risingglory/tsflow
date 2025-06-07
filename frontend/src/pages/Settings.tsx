import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Key, Database, Palette, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useAppStore } from '../lib/store'
import { tailscaleAPI } from '../lib/api'
import { useTheme } from '@/contexts/ThemeContext'
import Layout from '@/components/Layout'

export default function Settings() {
  // State from store
  const tailscaleConfig = useAppStore((state) => state.tailscaleConfig)
  const setTailscaleConfig = useAppStore((state) => state.setTailscaleConfig)
  
  // Theme context
  const { theme, setTheme } = useTheme()
  
  // Local form state
  const [apiKey, setApiKey] = useState('')
  const [tailnet, setTailnet] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [cacheData, setCacheData] = useState(true)
  
  // Validation state
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle')
  const [validationMessage, setValidationMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Load configuration on mount - prioritize localStorage, then env vars
  useEffect(() => {
    const savedApiKey = localStorage.getItem('tsflow-api-key')
    const savedTailnet = localStorage.getItem('tsflow-tailnet')
    
    // Load from environment variables as fallback
    const envApiKey = import.meta.env.VITE_TAILSCALE_API_KEY
    const envTailnet = import.meta.env.VITE_TAILSCALE_TAILNET
    
    // Set API key (localStorage first, then env)
    const finalApiKey = savedApiKey || envApiKey || ''
    if (finalApiKey) {
      setApiKey(finalApiKey)
      if (!tailscaleConfig?.apiKey) {
        setTailscaleConfig({ apiKey: finalApiKey })
      }
    }
    
    // Set tailnet (localStorage first, then env)
    const finalTailnet = savedTailnet || envTailnet || ''
    if (finalTailnet) {
      setTailnet(finalTailnet)
      if (!tailscaleConfig?.tailnet) {
        setTailscaleConfig({ tailnet: finalTailnet })
      }
    }
    
    // Auto-validate if both are available
    if (finalApiKey && finalTailnet && !savedApiKey && !savedTailnet) {
      // Only auto-validate if using env vars (not saved config)
      setTimeout(() => {
        validateCredentials()
      }, 500)
    }
  }, [])

  // Validate credentials
  const validateCredentials = async () => {
    if (!apiKey.trim() || !tailnet.trim()) {
      setValidationStatus('error')
      setValidationMessage('API key and tailnet are required')
      return false
    }

    setValidationStatus('validating')
    setValidationMessage('Testing connection...')

    try {
      // Update API client temporarily to test
      tailscaleAPI.updateConfig({ apiKey: apiKey.trim(), tailnet: tailnet.trim() })
      
      // Try to fetch devices to validate credentials
      await tailscaleAPI.getDevices()
      
      setValidationStatus('success')
      setValidationMessage('Connection successful!')
      return true
    } catch (error: any) {
      setValidationStatus('error')
      if (error.status === 401 || error.status === 403) {
        setValidationMessage('Invalid API key or insufficient permissions')
      } else if (error.status === 404) {
        setValidationMessage('Tailnet not found')
      } else {
        setValidationMessage(error.message || 'Connection failed')
      }
      return false
    }
  }

  // Save configuration
  const saveConfiguration = async () => {
    setIsSaving(true)
    
    try {
      const isValid = await validateCredentials()
      if (!isValid) {
        setIsSaving(false)
        return
      }

      // Save to store
      setTailscaleConfig({
        apiKey: apiKey.trim(),
        tailnet: tailnet.trim()
      })

      // Save to localStorage for persistence
      localStorage.setItem('tsflow-api-key', apiKey.trim())
      localStorage.setItem('tsflow-tailnet', tailnet.trim())

      setValidationMessage('Configuration saved successfully!')
      
      // Trigger a refresh of network data
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
    } catch (error) {
      setValidationStatus('error')
      setValidationMessage('Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const getValidationIcon = () => {
    switch (validationStatus) {
      case 'validating':
        return <AlertCircle className="h-4 w-4 text-yellow-500 animate-pulse" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const getValidationColor = () => {
    switch (validationStatus) {
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      case 'validating':
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center space-x-3 mb-6">
          <SettingsIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        </div>
      
      <div className="space-y-6">
        {/* API Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Key className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Tailscale API Configuration</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                placeholder="tskey-api-..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setValidationStatus('idle')
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Generate an API key from your Tailscale admin console with device read access
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tailnet
              </label>
              <input
                type="text"
                placeholder="example.com or organization-name"
                value={tailnet}
                onChange={(e) => {
                  setTailnet(e.target.value)
                  setValidationStatus('idle')
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your tailnet domain or organization name
              </p>
            </div>
            
            {/* Validation Status */}
            {validationStatus !== 'idle' && (
              <div className={`flex items-center space-x-2 text-sm ${getValidationColor()}`}>
                {getValidationIcon()}
                <span>{validationMessage}</span>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button 
                onClick={validateCredentials}
                disabled={validationStatus === 'validating' || !apiKey.trim() || !tailnet.trim()}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {validationStatus === 'validating' ? 'Testing...' : 'Test Connection'}
              </button>
              <button 
                onClick={saveConfiguration}
                disabled={isSaving || validationStatus === 'validating' || !apiKey.trim() || !tailnet.trim()}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
            
            {/* Current Status */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <div className="flex justify-between">
                  <span>Current API Key:</span>
                  <span className="font-mono">
                    {apiKey ? `${apiKey.substring(0, 12)}...` : 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Current Tailnet:</span>
                  <span className="font-mono">{tailnet || 'Not set'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Database className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Data Preferences</h2>
          </div>
          <div className="space-y-4">
            <label className="flex items-center">
              <input 
                type="checkbox" 
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700" 
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Auto-refresh data every 30 seconds</span>
            </label>
            <label className="flex items-center">
              <input 
                type="checkbox" 
                checked={cacheData}
                onChange={(e) => setCacheData(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700" 
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Cache network topology data</span>
            </label>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Palette className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Appearance</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Theme
              </label>
              <select 
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'auto')}
                className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="card p-6 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">Need Help?</h3>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <p>• <strong>API Key:</strong> Generate from Tailscale Admin Console → Settings → Keys</p>
            <p>• <strong>Permissions:</strong> API key needs "Devices" read access at minimum</p>
            <p>• <strong>Tailnet:</strong> Found in your Tailscale admin console URL or settings</p>
            <p>• <strong>Environment Variables:</strong> Set VITE_TAILSCALE_API_KEY and VITE_TAILSCALE_TAILNET</p>
            <p>• <strong>Auto-loading:</strong> App loads env vars on startup if no saved config exists</p>
            <p>• <strong>Issues:</strong> Check your API key permissions and tailnet name</p>
          </div>
        </div>
      </div>
      </div>
    </Layout>
  )
} 