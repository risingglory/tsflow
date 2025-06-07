import { Filter, X } from 'lucide-react'
import { useFilter } from '@/lib/store'
import { PROTOCOL_NAMES, COMMON_PORTS } from '@/types/tailscale'

export default function FilterPanel() {
  const { filter, setFilter, resetFilter } = useFilter()

  const protocols = Object.entries(PROTOCOL_NAMES).map(([proto, name]) => ({
    value: proto,
    label: `${name} (${proto})`
  }))

  const ports = Object.entries(COMMON_PORTS).map(([port, name]) => ({
    value: parseInt(port),
    label: `${name} (${port})`
  }))

  const handleProtocolToggle = (protocol: string) => {
    const protocols = filter.protocols.includes(protocol)
      ? filter.protocols.filter(p => p !== protocol)
      : [...filter.protocols, protocol]
    setFilter({ protocols })
  }

  const handlePortToggle = (port: number) => {
    const ports = filter.ports.includes(port)
      ? filter.ports.filter(p => p !== port)
      : [...filter.ports, port]
    setFilter({ ports })
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <h3 className="font-medium text-gray-900">Filters</h3>
        </div>
        <button
          onClick={resetFilter}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
        >
          <X className="h-3 w-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Traffic Threshold */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Traffic Threshold
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="number"
            placeholder="Min"
            value={filter.trafficThreshold.min || ''}
            onChange={(e) => setFilter({
              trafficThreshold: {
                ...filter.trafficThreshold,
                min: parseInt(e.target.value) || 0
              }
            })}
            className="input text-xs w-16"
          />
          <span className="text-xs text-gray-500">-</span>
          <input
            type="number"
            placeholder="Max"
            value={filter.trafficThreshold.max === Number.MAX_SAFE_INTEGER ? '' : filter.trafficThreshold.max}
            onChange={(e) => setFilter({
              trafficThreshold: {
                ...filter.trafficThreshold,
                max: parseInt(e.target.value) || Number.MAX_SAFE_INTEGER
              }
            })}
            className="input text-xs w-16"
          />
          <select
            value={filter.trafficThreshold.unit}
            onChange={(e) => setFilter({
              trafficThreshold: {
                ...filter.trafficThreshold,
                unit: e.target.value as 'B' | 'KB' | 'MB' | 'GB'
              }
            })}
            className="input text-xs w-16"
          >
            <option value="B">B</option>
            <option value="KB">KB</option>
            <option value="MB">MB</option>
            <option value="GB">GB</option>
          </select>
        </div>
      </div>

      {/* Protocols */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Protocols
        </label>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {protocols.map((protocol) => (
            <label key={protocol.value} className="flex items-center text-xs">
              <input
                type="checkbox"
                checked={filter.protocols.includes(protocol.value)}
                onChange={() => handleProtocolToggle(protocol.value)}
                className="rounded border-gray-300 text-primary-600 text-xs"
              />
              <span className="ml-2 text-gray-700">{protocol.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Common Ports */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Common Ports
        </label>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {ports.map((port) => (
            <label key={port.value} className="flex items-center text-xs">
              <input
                type="checkbox"
                checked={filter.ports.includes(port.value)}
                onChange={() => handlePortToggle(port.value)}
                className="rounded border-gray-300 text-primary-600 text-xs"
              />
              <span className="ml-2 text-gray-700">{port.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Custom Search */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Search
        </label>
        <input
          type="text"
          placeholder="device:laptop protocol:tcp port:22"
          value={filter.search}
          onChange={(e) => setFilter({ search: e.target.value })}
          className="input text-xs w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          Use filters like device:name, protocol:tcp, port:22
        </p>
      </div>

      {/* Active Filters Summary */}
      {(filter.protocols.length > 0 || filter.ports.length > 0 || filter.search) && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Active Filters</h4>
          <div className="space-y-1">
            {filter.protocols.length > 0 && (
              <div className="text-xs text-gray-600">
                Protocols: {filter.protocols.map(p => PROTOCOL_NAMES[parseInt(p)]).join(', ')}
              </div>
            )}
            {filter.ports.length > 0 && (
              <div className="text-xs text-gray-600">
                Ports: {filter.ports.join(', ')}
              </div>
            )}
            {filter.search && (
              <div className="text-xs text-gray-600">
                Search: "{filter.search}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 