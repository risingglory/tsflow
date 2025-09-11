import React from 'react'
import ReactFlowGraph from './ReactFlowGraph'

// Re-export the interfaces to maintain compatibility
export interface NetworkNode {
  id: string
  ip: string
  displayName: string
  nodeType: 'ip'
  totalBytes: number
  txBytes: number
  rxBytes: number
  connections: number
  tags: string[]
  user?: string
  isTailscale: boolean
  ips?: string[]
  incomingPorts: Set<number>
  outgoingPorts: Set<number>
  protocols: Set<string>
}

export interface NetworkLink {
  source: string | NetworkNode
  target: string | NetworkNode
  originalSource: string
  originalTarget: string
  totalBytes: number
  txBytes: number
  rxBytes: number
  packets: number
  txPackets: number
  rxPackets: number
  protocol: string
  trafficType: 'virtual' | 'subnet' | 'physical'
}

interface NetworkGraphProps {
  nodes: NetworkNode[]
  links: NetworkLink[]
  devices: unknown[]
  onNodeClick: (node: NetworkNode) => void
  onLinkClick: (link: NetworkLink) => void
  onBackgroundClick: () => void
  selectedNode?: NetworkNode | null
  selectedLink?: NetworkLink | null
}

const NetworkGraph: React.FC<NetworkGraphProps> = (props) => {
  return <ReactFlowGraph {...props} />
}

export default NetworkGraph