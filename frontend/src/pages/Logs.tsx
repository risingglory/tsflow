import { useState, useEffect, useMemo } from 'react'
import { Search, Download, Calendar, RefreshCw, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import useSWR from 'swr'
import Layout from '@/components/Layout'
import { fetcher, formatBytes } from '@/lib/api'
import { getTimeRange } from '@/lib/time'
import { TableRowSkeleton } from '@/components/LoadingSkeleton'
import EmptyState from '@/components/EmptyState'

interface TrafficEntry {
  proto: number
  src: string
  dst: string
  txPkts: number
  txBytes: number
  rxPkts: number
  rxBytes: number
}

interface LogEntry {
  logged: string
  nodeId: string
  start: string
  end: string
  virtualTraffic?: TrafficEntry[]
  subnetTraffic?: TrafficEntry[]
  exitTraffic?: TrafficEntry[]
  physicalTraffic?: TrafficEntry[]
}


const getProtocolName = (proto: number): string => {
  switch (proto) {
    case 1: return 'ICMP'
    case 6: return 'TCP'
    case 17: return 'UDP'
    case 255: return 'Reserved'
    default: return `Proto-${proto}`
  }
}

export default function Logs() {
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [protocolFilter, setProtocolFilter] = useState<string>('all')
  const [trafficTypeFilter, setTrafficTypeFilter] = useState<string>('all')
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null)
  
  // Pagination states
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  
  // Custom time range states
  const [customTime, setCustomTime] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [timeFilter, setTimeFilter] = useState<string>('5m')

  // Fetch Tailscale network logs
  const networkLogsApiUrl = useMemo(() => {
    const baseUrl = '/network-logs'
    const params = new URLSearchParams()
    
    if (customTime && start && end) {
      params.append('start', new Date(start).toISOString())
      params.append('end', new Date(end).toISOString())
    } else if (timeFilter !== 'all') {
      // Convert time range to timestamp
      const { start: sinceTime, end: nowTime } = getTimeRange(timeFilter)
      params.append('start', sinceTime.toISOString())
      params.append('end', nowTime.toISOString())
    }
    
    return `${baseUrl}?${params.toString()}`
  }, [timeFilter, customTime, start, end])

  const { data: networkLogsData, mutate: refetchNetworkLogs } = useSWR(networkLogsApiUrl, fetcher, {
    errorRetryCount: 2,
    revalidateOnFocus: false,
    refreshInterval: 120000
  })

  const networkLogs = Array.isArray(networkLogsData) ? networkLogsData : []

  // Set default date range to show most recent data (last 5 minutes)
  useEffect(() => {
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatForInput = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }
    
    setStart(formatForInput(fiveMinutesAgo))
    setEnd(formatForInput(now))
    setLoading(false)
  }, [])

  // Flatten all traffic entries for search and display with time filtering
  const flattenedEntries = useMemo(() => {
    const entries: Array<{
      logEntry: LogEntry
      traffic: TrafficEntry & { type: string }
      index: number
    }> = []

    // Use network logs directly (time filtering is handled by API)
    networkLogs.forEach((log: any, logIndex: number) => {
      const allTraffic = [
        ...(log.virtualTraffic || []).map((t: any) => ({ ...t, type: 'virtual' })),
        ...(log.subnetTraffic || []).map((t: any) => ({ ...t, type: 'subnet' })),
        ...(log.physicalTraffic || []).map((t: any) => ({ ...t, type: 'physical' })),
        ...(log.exitTraffic || []).map((t: any) => ({ ...t, type: 'exit' }))
      ]

      allTraffic.forEach((traffic, trafficIndex) => {
        entries.push({
          logEntry: log,
          traffic,
          index: logIndex * 1000 + trafficIndex
        })
      })
    })

    return entries
  }, [networkLogs, customTime, start, end])

  // Filter entries based on search and filters
  const filteredEntries = useMemo(() => {
    return flattenedEntries.filter(entry => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const srcMatch = entry.traffic.src?.toLowerCase().includes(q)
        const dstMatch = entry.traffic.dst?.toLowerCase().includes(q) 
        const nodeMatch = entry.logEntry.nodeId?.toLowerCase().includes(q)
        const protoMatch = getProtocolName(entry.traffic.proto).toLowerCase().includes(q)
        
        if (!srcMatch && !dstMatch && !nodeMatch && !protoMatch) {
          return false
        }
      }

      // Protocol filter
      if (protocolFilter !== 'all' && getProtocolName(entry.traffic.proto) !== protocolFilter) {
        return false
      }

      // Traffic type filter
      if (trafficTypeFilter !== 'all' && entry.traffic.type !== trafficTypeFilter) {
        return false
      }

      return true
    })
  }, [flattenedEntries, searchQuery, protocolFilter, trafficTypeFilter])

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1)
  }, [searchQuery, protocolFilter, trafficTypeFilter, timeFilter, customTime, start, end])

  const totalPages = Math.ceil(filteredEntries.length / perPage)
  const start_idx = (page - 1) * perPage
  const entries = filteredEntries.slice(start_idx, start_idx + perPage)

  const protocols = [...new Set(flattenedEntries.map(e => getProtocolName(e.traffic.proto)))]
  const trafficTypes = [...new Set(flattenedEntries.map(e => e.traffic.type))]

  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredEntries, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tsflow-logs-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Don't show full page loading state, handle it inline

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Stats Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <span>{filteredEntries.length} flows • {protocols.length} protocols • Page {page}/{totalPages} • {customTime && start && end ? 
                `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}` :
                timeFilter}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <Calendar className="w-4 h-4" />
              <span>Updated {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Filters Sidebar */}
          <aside 
            className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0"
            aria-label="Filters and search"
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Search & Filter</h3>
              
              {/* Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search IPs, protocols, nodes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Time Range */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Range</label>
                
                {/* Toggle for custom time range */}
                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="customTimeRangeLogs"
                    checked={customTime}
                    onChange={(e) => setCustomTime(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                  />
                  <label htmlFor="customTimeRangeLogs" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Custom Date Range
                  </label>
                </div>

                {customTime ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Date & Time</label>
                      <input
                        type="datetime-local"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Date & Time</label>
                      <input
                        type="datetime-local"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="5m">Last 5 Minutes</option>
                      <option value="15m">Last 15 Minutes</option>
                      <option value="30m">Last 30 Minutes</option>
                      <option value="1h">Last Hour</option>
                      <option value="6h">Last 6 Hours</option>
                      <option value="24h">Last 24 Hours</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                    </select>
                  </div>
                )}
                
                <button
                  onClick={async () => {
                    setLoading(true)
                    try {
                      await refetchNetworkLogs()
                    } finally {
                      setLoading(false)
                    }
                  }}
                  className="mt-2 w-full flex items-center justify-center px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 transition-colors"
                  title="Refresh data"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Data
                </button>
              </div>

              {/* Protocol Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Protocol</label>
                <select
                  value={protocolFilter}
                  onChange={(e) => setProtocolFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Protocols</option>
                  {protocols.map(protocol => (
                    <option key={protocol} value={protocol}>{protocol}</option>
                  ))}
                </select>
              </div>

              {/* Traffic Type Filter */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Traffic Type</label>
                <select
                  value={trafficTypeFilter}
                  onChange={(e) => setTrafficTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All Traffic Types</option>
                  {trafficTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Items per page */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Items per page</label>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value))
                    setPage(1) // Reset to first page
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>

              {/* Export */}
              <button
                onClick={exportLogs}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:ring-2 focus:ring-blue-500"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Filtered Logs
              </button>

              {/* Summary */}
              <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Summary</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                  <div>Total Flows: {flattenedEntries.length.toLocaleString()}</div>
                  <div>Filtered: {filteredEntries.length.toLocaleString()}</div>
                  <div>Showing: {Math.min(perPage, filteredEntries.length - start_idx)} of {filteredEntries.length.toLocaleString()}</div>
                  <div>Log Entries: {networkLogs.length.toLocaleString()}</div>
                  <div>Data Size: {formatBytes(JSON.stringify(networkLogs).length)}</div>
                  <div>Time Range: {customTime && start && end ? 
                    `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}` :
                    timeFilter}</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Pagination Controls - Top */}
            <nav 
              className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex-shrink-0"
              aria-label="Pagination controls top"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {start_idx + 1} to {Math.min(start_idx + perPage, filteredEntries.length)} of {filteredEntries.length.toLocaleString()} flows
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (page <= 3) {
                        pageNum = i + 1
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = page - 2 + i
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`px-3 py-1 rounded-md text-sm transition-colors ${
                            page === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </nav>

            {/* Logs Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Source</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Destination</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Protocol</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">TX Bytes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">RX Bytes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Packets</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    // Show skeleton rows while loading
                    Array.from({ length: 10 }).map((_, index) => (
                      <TableRowSkeleton key={index} />
                    ))
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12">
                        <EmptyState
                          icon={FileText}
                          title="No network logs found"
                          description="Network logging may need to be enabled in your Tailscale admin console or try a different time range."
                          action={{
                            label: "Enable Network Logging",
                            onClick: () => window.open('https://login.tailscale.com/admin/logs', '_blank')
                          }}
                        />
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                    <tr
                      key={entry.index}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => setSelectedEntry(entry.logEntry)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {new Date(entry.logEntry.logged).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                        {entry.traffic.src}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-gray-100">
                        {entry.traffic.dst}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {getProtocolName(entry.traffic.proto)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          entry.traffic.type === 'virtual' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                          entry.traffic.type === 'subnet' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                          entry.traffic.type === 'physical' ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          {entry.traffic.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatBytes(entry.traffic.txBytes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {formatBytes(entry.traffic.rxBytes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {(entry.traffic.txPkts + entry.traffic.rxPkts).toLocaleString()}
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls - Bottom */}
            <nav 
              className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex-shrink-0"
              aria-label="Pagination controls bottom"
            >
              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="px-3 py-1 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded-md text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Last
                  </button>
                </div>
              </div>
            </nav>
          </div>

          {/* Details Panel */}
          {selectedEntry && (
            <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Log Entry Details</h3>
                  <button
                    onClick={() => setSelectedEntry(null)}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    ×
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Node ID</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">{selectedEntry.nodeId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Logged</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{new Date(selectedEntry.logged).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Time Range</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {new Date(selectedEntry.start).toLocaleTimeString()} - {new Date(selectedEntry.end).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  {/* Traffic Summary */}
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Traffic Summary</label>
                    <div className="mt-2 space-y-2">
                      {selectedEntry.virtualTraffic && (
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Virtual:</span> {selectedEntry.virtualTraffic.length} flows
                        </div>
                      )}
                      {selectedEntry.subnetTraffic && (
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Subnet:</span> {selectedEntry.subnetTraffic.length} flows
                        </div>
                      )}
                      {selectedEntry.physicalTraffic && (
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Physical:</span> {selectedEntry.physicalTraffic.length} flows
                        </div>
                      )}
                      {selectedEntry.exitTraffic && (
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Exit:</span> {selectedEntry.exitTraffic.length} flows
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
} 