import { useEffect, useRef } from 'react'
import type { TailscaleDevice, NetworkFlowLog } from '@/types/tailscale'
import { formatBytes } from '@/lib/api'

interface NetworkVisualizationProps {
  devices?: TailscaleDevice[]
  logs?: NetworkFlowLog[]
  isPlaying: boolean
  zoom: number
  onZoomChange?: (zoom: number) => void
}

export default function NetworkVisualization({
  devices,
  logs,
  isPlaying,
  zoom,
  onZoomChange: _onZoomChange
}: NetworkVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    // TODO: Implement D3.js force-directed graph
    // This is a placeholder for the network visualization
    if (!svgRef.current || !devices) return

    // Clear previous content
    const svg = svgRef.current
    svg.innerHTML = ''

    // Add sample visualization elements
    // Note: width and height are not used in current implementation

    // Add a sample node for each device
    devices.slice(0, 10).forEach((device, i) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', String(100 + (i % 5) * 100))
      circle.setAttribute('cy', String(100 + Math.floor(i / 5) * 100))
      circle.setAttribute('r', '20')
      circle.setAttribute('fill', '#3b82f6')
      circle.setAttribute('class', 'network-node')
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', String(100 + (i % 5) * 100))
      text.setAttribute('y', String(110 + Math.floor(i / 5) * 100))
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('class', 'network-text')
      text.textContent = device.name || device.hostname

      svg.appendChild(circle)
      svg.appendChild(text)
    })

  }, [devices, logs, zoom])

  const dataSizeBytes = logs ? JSON.stringify(logs).length : 0

  return (
    <div className="h-full w-full bg-gray-50 relative">
      {!devices || devices.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-4">🌐</div>
            <h3 className="text-lg font-medium mb-2">No Network Data</h3>
            <p className="text-sm">Configure your Tailscale API credentials to view network topology</p>
          </div>
        </div>
      ) : (
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* D3.js will render content here */}
        </svg>
      )}

      {/* Controls overlay */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-2 text-xs text-gray-600">
        <div>Devices: {devices?.length || 0}</div>
        <div>Connections: {logs?.length || 0}</div>
        <div>Data Size: {formatBytes(dataSizeBytes)}</div>
        <div>Zoom: {Math.round(zoom * 100)}%</div>
        {isPlaying && <div className="text-green-600">Playing</div>}
      </div>
    </div>
  )
} 