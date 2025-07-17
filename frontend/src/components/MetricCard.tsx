import React, { ReactNode } from 'react'
import { clsx } from 'clsx'

interface MetricCardProps {
  title: string
  value: string | number
  icon: ReactNode
  loading?: boolean
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  className?: string
}

const MetricCard = React.memo(function MetricCard({
  title,
  value,
  icon,
  loading = false,
  change,
  changeType = 'neutral',
  className
}: MetricCardProps) {
  return (
    <div className={clsx('card p-6', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary-50 rounded-lg">
            <div className="text-primary-600">{icon}</div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {loading ? (
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-16 mt-1"></div>
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            )}
          </div>
        </div>
      </div>
      
      {change && !loading && (
        <div className="mt-4">
          <span
            className={clsx(
              'inline-flex items-center text-xs font-medium',
              {
                'text-green-600': changeType === 'positive',
                'text-red-600': changeType === 'negative',
                'text-gray-600': changeType === 'neutral',
              }
            )}
          >
            {change}
          </span>
        </div>
      )}
    </div>
  )
})

export default MetricCard 