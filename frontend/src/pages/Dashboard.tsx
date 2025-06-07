import React from 'react'
import { Activity, Users, Globe, TrendingUp, AlertCircle } from 'lucide-react'
import useSWR from 'swr'
import Layout from '@/components/Layout'
import { fetcher } from '@/lib/api'

export default function Dashboard() {
  // Real API call - no more mock data needed!
  const { data: devices, error, isLoading } = useSWR('/devices', fetcher, {
    errorRetryCount: 2,
    revalidateOnFocus: false
  })

  // Calculate metrics from the real data
  const metrics = React.useMemo(() => {
    if (!devices) {
      return {
        totalDevices: 0,
        onlineDevices: 0,
        updateAvailable: 0,
        routeAdvertisers: 0
      }
    }

    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    
    const onlineDevices = devices.filter((device: any) => {
      const lastSeen = new Date(device.lastSeen)
      return lastSeen > fiveMinutesAgo
    }).length

    const updateAvailable = devices.filter((device: any) => device.updateAvailable).length
    const routeAdvertisers = devices.filter((device: any) => device.advertisedRoutes && device.advertisedRoutes.length > 0).length

    return {
      totalDevices: devices.length,
      onlineDevices,
      updateAvailable,
      routeAdvertisers
    }
  }, [devices])

  const connectionStatus = error ? 'Error' : isLoading ? 'Connecting...' : 'Connected'

  return (
    <Layout>
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Network Overview</h1>
        <div className="mt-2 sm:mt-0">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            Live Data - Tailscale API
          </span>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-2" />
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Devices</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {isLoading ? '...' : metrics.totalDevices}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {metrics.onlineDevices} online
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center">
            <Activity className="h-5 w-5 text-green-500 dark:text-green-400 mr-2" />
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {connectionStatus}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              API Connection
            </p>
            <a
              href="https://status.tailscale.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors hover:underline"
            >
              Service Status ↗
            </a>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center">
            <Globe className="h-5 w-5 text-purple-500 dark:text-purple-400 mr-2" />
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Routes</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {metrics.routeAdvertisers}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Route advertisers
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center">
            <TrendingUp className="h-5 w-5 text-orange-500 dark:text-orange-400 mr-2" />
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Updates</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {metrics.updateAvailable}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Updates available
          </p>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 dark:text-red-500 mr-2" />
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">API Error</h3>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300 mt-2">
            {error.message || 'Failed to load Tailscale data'}
          </p>
        </div>
      )}

      {/* Device List */}
      {devices && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Devices</h3>
          <div className="space-y-4">
            {devices.map((device: any) => {
              const lastSeen = new Date(device.lastSeen)
              const now = new Date()
              const timeDiff = Math.floor((now.getTime() - lastSeen.getTime()) / 1000)
              const isOnline = timeDiff < 300 // 5 minutes
              
              return (
                <div key={device.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400 dark:bg-gray-500'}`}></div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{device.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{device.addresses[0]} • {device.os}</p>
                      {device.tags && device.tags.length > 0 && (
                        <div className="flex space-x-1 mt-1">
                          {device.tags.map((tag: string) => (
                            <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {timeDiff < 60 ? 'Just now' : 
                       timeDiff < 3600 ? `${Math.floor(timeDiff / 60)}m ago` :
                       `${Math.floor(timeDiff / 3600)}h ago`}
                    </p>
                    {device.updateAvailable && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 mt-1">
                        Update Available
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      </div>
    </Layout>
  )
} 