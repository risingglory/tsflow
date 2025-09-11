/**
 * Comprehensive type definitions for network visualization components
 * These types ensure type safety and better developer experience
 */

// Core network data structures
export interface BaseNetworkNode {
  id: string;
  ip: string;
  displayName: string;
  nodeType: 'ip';
  totalBytes: number;
  txBytes: number;
  rxBytes: number;
  connections: number;
  tags: string[];
  user?: string;
  isTailscale: boolean;
  ips?: string[];
  incomingPorts: Set<number>;
  outgoingPorts: Set<number>;
  protocols: Set<string>;
}

export interface BaseNetworkLink {
  source: string | BaseNetworkNode;
  target: string | BaseNetworkNode;
  originalSource: string;
  originalTarget: string;
  totalBytes: number;
  txBytes: number;
  rxBytes: number;
  packets: number;
  txPackets: number;
  rxPackets: number;
  protocol: string;
  trafficType: 'virtual' | 'subnet' | 'physical';
}

// Extended types for React Flow components
export interface NetworkNodeData extends BaseNetworkNode, Record<string, unknown> {
  // Computed properties for enhanced rendering
  isHighTraffic?: boolean;
  connectionDensity?: number;
  formattedBytes?: string;
  protocolsList?: string[];
}

export interface NetworkLinkData extends Omit<BaseNetworkLink, 'source' | 'target'>, Record<string, unknown> {
  source: string;
  target: string;
  // Computed properties for enhanced rendering
  trafficRatio?: number;
  formattedBytes?: string;
  formattedPackets?: string;
  txPercentage?: number;
  rxPercentage?: number;
}

// Traffic statistics
export interface TrafficStatistics {
  totalBytes: number;
  virtualBytes: number;
  subnetBytes: number;
  physicalBytes: number;
  nodeCount: number;
  linkCount: number;
}

// Node categories based on tags and characteristics
export enum NodeCategory {
  DERP = 'derp',
  TAILSCALE = 'tailscale', 
  PRIVATE = 'private',
  PUBLIC = 'public',
  SERVER = 'server',
  CLIENT = 'client',
  UNKNOWN = 'unknown'
}

// Traffic type enumeration
export enum TrafficType {
  VIRTUAL = 'virtual',
  SUBNET = 'subnet',
  PHYSICAL = 'physical'
}

// Protocol types commonly seen in network traffic
export enum NetworkProtocol {
  TCP = 'TCP',
  UDP = 'UDP',
  ICMP = 'ICMP',
  HTTP = 'HTTP',
  HTTPS = 'HTTPS',
  SSH = 'SSH',
  DNS = 'DNS',
  DHCP = 'DHCP',
  NTP = 'NTP',
  SNMP = 'SNMP'
}

// Well-known ports mapping
export const WELL_KNOWN_PORTS: Record<number, { protocol: NetworkProtocol; service: string }> = {
  20: { protocol: NetworkProtocol.TCP, service: 'FTP Data' },
  21: { protocol: NetworkProtocol.TCP, service: 'FTP Control' },
  22: { protocol: NetworkProtocol.TCP, service: 'SSH' },
  23: { protocol: NetworkProtocol.TCP, service: 'Telnet' },
  25: { protocol: NetworkProtocol.TCP, service: 'SMTP' },
  53: { protocol: NetworkProtocol.UDP, service: 'DNS' },
  67: { protocol: NetworkProtocol.UDP, service: 'DHCP Server' },
  68: { protocol: NetworkProtocol.UDP, service: 'DHCP Client' },
  69: { protocol: NetworkProtocol.UDP, service: 'TFTP' },
  80: { protocol: NetworkProtocol.TCP, service: 'HTTP' },
  110: { protocol: NetworkProtocol.TCP, service: 'POP3' },
  123: { protocol: NetworkProtocol.UDP, service: 'NTP' },
  143: { protocol: NetworkProtocol.TCP, service: 'IMAP' },
  161: { protocol: NetworkProtocol.UDP, service: 'SNMP' },
  162: { protocol: NetworkProtocol.UDP, service: 'SNMP Trap' },
  389: { protocol: NetworkProtocol.TCP, service: 'LDAP' },
  443: { protocol: NetworkProtocol.TCP, service: 'HTTPS' },
  993: { protocol: NetworkProtocol.TCP, service: 'IMAPS' },
  995: { protocol: NetworkProtocol.TCP, service: 'POP3S' },
  3389: { protocol: NetworkProtocol.TCP, service: 'RDP' },
  5432: { protocol: NetworkProtocol.TCP, service: 'PostgreSQL' },
  3306: { protocol: NetworkProtocol.TCP, service: 'MySQL' },
  6379: { protocol: NetworkProtocol.TCP, service: 'Redis' },
  27017: { protocol: NetworkProtocol.TCP, service: 'MongoDB' },
};

// Tag categories for styling
export interface TagStyle {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  icon?: string;
}

export const TAG_STYLES: Record<string, TagStyle> = {
  prod: {
    backgroundColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-300',
    icon: '🔴'
  },
  production: {
    backgroundColor: 'bg-red-100',
    textColor: 'text-red-800',
    borderColor: 'border-red-300',
    icon: '🔴'
  },
  dev: {
    backgroundColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    icon: '🟡'
  },
  development: {
    backgroundColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-300',
    icon: '🟡'
  },
  staging: {
    backgroundColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-300',
    icon: '🟠'
  },
  stage: {
    backgroundColor: 'bg-orange-100',
    textColor: 'text-orange-800',
    borderColor: 'border-orange-300',
    icon: '🟠'
  },
  server: {
    backgroundColor: 'bg-green-100',
    textColor: 'text-green-800',
    borderColor: 'border-green-300',
    icon: '🖥️'
  },
  k8s: {
    backgroundColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-300',
    icon: '☸️'
  },
  kubernetes: {
    backgroundColor: 'bg-purple-100',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-300',
    icon: '☸️'
  },
  database: {
    backgroundColor: 'bg-blue-100',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-300',
    icon: '🗄️'
  },
  web: {
    backgroundColor: 'bg-teal-100',
    textColor: 'text-teal-800',
    borderColor: 'border-teal-300',
    icon: '🌐'
  },
  api: {
    backgroundColor: 'bg-indigo-100',
    textColor: 'text-indigo-800',
    borderColor: 'border-indigo-300',
    icon: '🔗'
  },
  default: {
    backgroundColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    borderColor: 'border-gray-300',
    icon: '🏷️'
  }
};

// Color schemes for different node types
export interface NodeColorScheme {
  background: string;
  border: string;
  ring: string;
  accent: string;
  icon?: string;
}

export const NODE_COLOR_SCHEMES: Record<NodeCategory, NodeColorScheme> = {
  [NodeCategory.DERP]: {
    background: 'bg-red-50',
    border: 'border-red-500',
    ring: 'ring-red-500',
    accent: 'text-red-700',
    icon: '🔴'
  },
  [NodeCategory.TAILSCALE]: {
    background: 'bg-blue-50',
    border: 'border-blue-500',
    ring: 'ring-blue-500',
    accent: 'text-blue-700',
    icon: '🔵'
  },
  [NodeCategory.PRIVATE]: {
    background: 'bg-green-50',
    border: 'border-green-500',
    ring: 'ring-green-500',
    accent: 'text-green-700',
    icon: '🟢'
  },
  [NodeCategory.PUBLIC]: {
    background: 'bg-orange-50',
    border: 'border-orange-500',
    ring: 'ring-orange-500',
    accent: 'text-orange-700',
    icon: '🟠'
  },
  [NodeCategory.SERVER]: {
    background: 'bg-emerald-50',
    border: 'border-emerald-500',
    ring: 'ring-emerald-500',
    accent: 'text-emerald-700',
    icon: '🖥️'
  },
  [NodeCategory.CLIENT]: {
    background: 'bg-cyan-50',
    border: 'border-cyan-500',
    ring: 'ring-cyan-500',
    accent: 'text-cyan-700',
    icon: '💻'
  },
  [NodeCategory.UNKNOWN]: {
    background: 'bg-yellow-50',
    border: 'border-yellow-500',
    ring: 'ring-yellow-500',
    accent: 'text-yellow-700',
    icon: '❓'
  }
};

// Edge color schemes for different traffic types
export interface EdgeColorScheme {
  color: string;
  icon: string;
  label: string;
  strokeDash?: string;
}

export const EDGE_COLOR_SCHEMES: Record<TrafficType, EdgeColorScheme> = {
  [TrafficType.VIRTUAL]: {
    color: '#3b82f6',
    icon: '🔗',
    label: 'Virtual',
  },
  [TrafficType.SUBNET]: {
    color: '#10b981',
    icon: '🌐',
    label: 'Subnet',
  },
  [TrafficType.PHYSICAL]: {
    color: '#f59e0b',
    icon: '📡',
    label: 'Physical',
    strokeDash: '5,5'
  }
};

// Performance thresholds
export interface PerformanceThresholds {
  highTrafficBytes: number;
  highConnectionCount: number;
  largeNodeCount: number;
  complexGraphEdgeCount: number;
}

export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  highTrafficBytes: 1024 * 1024, // 1MB
  highConnectionCount: 10,
  largeNodeCount: 50,
  complexGraphEdgeCount: 100
};

// Layout configuration options
export interface LayoutConfiguration {
  algorithm: 'layered' | 'stress' | 'mrtree' | 'radial' | 'force' | 'disco';
  direction: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';
  nodeSpacing: number;
  layerSpacing: number;
  aspectRatio: number;
  animated: boolean;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfiguration = {
  algorithm: 'layered',
  direction: 'DOWN',
  nodeSpacing: 100,
  layerSpacing: 120,
  aspectRatio: 1.6,
  animated: true
};

// Event handler types
export type NodeClickHandler = (node: BaseNetworkNode) => void;
export type EdgeClickHandler = (link: BaseNetworkLink) => void;
export type BackgroundClickHandler = () => void;

// Component prop interfaces
export interface NetworkVisualizationProps {
  nodes: BaseNetworkNode[];
  links: BaseNetworkLink[];
  devices?: any[];
  onNodeClick: NodeClickHandler;
  onLinkClick: EdgeClickHandler;
  onBackgroundClick: BackgroundClickHandler;
  selectedNode?: BaseNetworkNode | null;
  selectedLink?: BaseNetworkLink | null;
  layoutConfig?: Partial<LayoutConfiguration>;
  performanceThresholds?: Partial<PerformanceThresholds>;
}

// Utility function return types
export interface ProcessedNodeData {
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  deviceTags: string[];
  uniquePorts: number[];
  formattedBytes: string;
  protocolsList: string[];
  category: NodeCategory;
  colorScheme: NodeColorScheme;
}

export interface ProcessedEdgeData {
  formattedBytes: string;
  formattedPackets: string;
  trafficRatio: number;
  txPercentage: number;
  rxPercentage: number;
  colorScheme: EdgeColorScheme;
}

// Error types
export class NetworkVisualizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'NetworkVisualizationError';
  }
}

export class LayoutError extends NetworkVisualizationError {
  constructor(message: string, details?: any) {
    super(message, 'LAYOUT_ERROR', details);
  }
}

export class DataProcessingError extends NetworkVisualizationError {
  constructor(message: string, details?: any) {
    super(message, 'DATA_PROCESSING_ERROR', details);
  }
}

export class RenderError extends NetworkVisualizationError {
  constructor(message: string, details?: any) {
    super(message, 'RENDER_ERROR', details);
  }
}