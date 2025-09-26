import React from 'react'
import { Monitor, Smartphone, Server, Laptop } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { TailscaleDevice } from '@/types/tailscale'
import { clsx } from 'clsx'

interface DeviceListProps {
  devices?: TailscaleDevice[]
  loading?: boolean
  limit?: number
}

const DeviceList = React.memo(function DeviceList({ devices, loading = false, limit }: DeviceListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              </div>
              <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!devices || devices.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Monitor className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <p>No devices found</p>
      </div>
    )
  }

  const displayDevices = limit ? devices.slice(0, limit) : devices

  const getDeviceIcon = (os: string) => {
    const osLower = os.toLowerCase()
    if (osLower.includes('ios') || osLower.includes('android')) {
      return <Smartphone className="h-5 w-5" />
    }
    if (osLower.includes('linux') || osLower.includes('ubuntu')) {
      return <Server className="h-5 w-5" />
    }
    if (osLower.includes('mac') || osLower.includes('windows')) {
      return <Laptop className="h-5 w-5" />
    }
    return <Monitor className="h-5 w-5" />
  }

  const isDeviceOnline = (device: TailscaleDevice) => {
    const lastSeen = new Date(device.lastSeen)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    return lastSeen > fiveMinutesAgo
  }

  return (
    <div className="space-y-2">
      {displayDevices.map((device) => {
        const online = isDeviceOnline(device)
        const lastSeenText = formatDistanceToNow(new Date(device.lastSeen), { addSuffix: true })

        return (
          <div
            key={device.id}
            className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <div className={clsx(
              'p-2 rounded-full',
              online ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
            )}>
              {getDeviceIcon(device.os)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {device.name || device.hostname}
                </p>
                {device.tags && device.tags.length > 0 && (
                  <div className="flex space-x-1">
                    {device.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                      >
                        {tag.replace('tag:', '')}
                      </span>
                    ))}
                    {device.tags.length > 2 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">+{device.tags.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{device.addresses[0]}</span>
                <span>•</span>
                <span>{device.os}</span>
                <span>•</span>
                <span>Last seen {lastSeenText}</span>
              </div>
            </div>
            
            <div className="flex items-center">
              <span className={clsx(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                online
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
              )}>
                {online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        )
      })}
      
      {limit && devices.length > limit && (
        <div className="text-center pt-4">
          <button className="text-sm text-primary-600 hover:text-primary-700">
            View all {devices.length} devices
          </button>
        </div>
      )}
    </div>
  )
})

export default DeviceList 