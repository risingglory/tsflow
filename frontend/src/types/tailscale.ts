// Tailscale Device Types
export interface TailscaleDevice {
  addresses: string[]
  id: string
  user: string
  name: string
  hostname: string
  clientVersion: string
  updateAvailable: boolean
  os: string
  created: string
  lastSeen: string
  keyExpiryDisabled: boolean
  expires: string
  authorized: boolean
  isExternal: boolean
  machineKey: string
  nodeKey: string
  blocksIncomingConnections: boolean
  enabledRoutes: string[]
  advertisedRoutes: string[]
  clientConnectivity: {
    endpoints: string[]
    derp: string
    mappingVariesByDestIP: boolean
    latency: Record<string, number>
    clientSupports: {
      hairPinning: boolean
      ipv6: boolean
      pcp: boolean
      pmp: boolean
      udp: boolean
      upnp: boolean
    }
  }
  tags: string[]
  tailnetLockError?: string
  tailnetLockKey?: string
}

// Network Flow Log Types
export interface NetworkFlowLog {
  logged: string
  nodeId: string
  start: string
  end: string
  virtualTraffic: TrafficFlow[]
  physicalTraffic: TrafficFlow[]
  subnetTraffic: TrafficFlow[]
}

export interface TrafficFlow {
  src: string
  dst: string
  proto: number
  srcPort: number
  dstPort: number
  rxBytes: number
  txBytes: number
  rxPackets: number
  txPackets: number
}

// UI State Types
export interface NetworkTopology {
  nodes: TailscaleDevice[]
  links: TrafficFlow[]
}

// Filter and Search Types
export interface NetworkFilter {
  timeRange: {
    start: Date
    end: Date
    preset?: 'last-hour' | 'last-day' | 'last-week' | 'custom'
  }
  devices: string[]
  protocols: string[]
  ports: number[]
  tags: string[]
  trafficThreshold: {
    min: number
    max: number
    unit: 'B' | 'KB' | 'MB' | 'GB'
  }
  search: string
}

// API Configuration
export interface TailscaleConfig {
  apiKey: string
  tailnet: string
  baseUrl: string
}

// Error Types
export interface ApiError {
  message: string
  status: number
  code?: string
}

// Protocol mapping
export const PROTOCOL_NAMES: Record<number, string> = {
  1: 'ICMP',
  6: 'TCP',
  17: 'UDP',
  58: 'ICMPv6'
}

// Common ports
export const COMMON_PORTS: Record<number, string> = {
  22: 'SSH',
  53: 'DNS',
  80: 'HTTP',
  443: 'HTTPS',
  993: 'IMAPS',
  995: 'POP3S',
  587: 'SMTP',
  25: 'SMTP',
  110: 'POP3',
  143: 'IMAP',
  21: 'FTP',
  23: 'Telnet',
  3389: 'RDP',
  5432: 'PostgreSQL',
  3306: 'MySQL',
  6379: 'Redis',
  27017: 'MongoDB'
}