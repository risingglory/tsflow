import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import type { NetworkFlowLog } from '@/types/tailscale'
import { formatBytes } from '@/lib/api'

interface TrafficChartProps {
  data?: NetworkFlowLog[]
  loading?: boolean
}

interface ChartDataPoint {
  time: string
  timestamp: number
  rxBytes: number
  txBytes: number
  totalBytes: number
}

export default function TrafficChart({ data, loading = false }: TrafficChartProps) {
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!data || data.length === 0) return []

    // Group data by time intervals (e.g., 5-minute intervals)
    const intervalMs = 5 * 60 * 1000 // 5 minutes
    const dataMap = new Map<number, { rxBytes: number; txBytes: number }>()

    data.forEach((log) => {
      log.virtualTraffic.forEach((flow) => {
        const startTime = new Date(log.start).getTime()
        const interval = Math.floor(startTime / intervalMs) * intervalMs

        const existing = dataMap.get(interval) || { rxBytes: 0, txBytes: 0 }
        dataMap.set(interval, {
          rxBytes: existing.rxBytes + flow.rxBytes,
          txBytes: existing.txBytes + flow.txBytes,
        })
      })
    })

    // Convert to chart data format
    return Array.from(dataMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([timestamp, { rxBytes, txBytes }]) => ({
        time: format(new Date(timestamp), 'HH:mm'),
        timestamp,
        rxBytes,
        txBytes,
        totalBytes: rxBytes + txBytes,
      }))
  }, [data])

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse w-full h-full bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-2xl mb-2">📊</div>
          <p>No traffic data available</p>
          <p className="text-sm">Select a different time range to see data</p>
        </div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-medium text-gray-900 mb-2">{`Time: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${formatBytes(entry.value)}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="time" 
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            tickFormatter={(value) => formatBytes(value)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="rxBytes"
            stroke="#10b981"
            strokeWidth={2}
            name="Received"
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="txBytes"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Transmitted"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
} 