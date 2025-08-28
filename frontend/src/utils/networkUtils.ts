/**
 * Utility functions for network visualization components
 * These functions provide reusable logic for data processing and formatting
 */

import {
  BaseNetworkNode,
  BaseNetworkLink,
  ProcessedNodeData,
  ProcessedEdgeData,
  NodeCategory,
  TrafficType,
  NetworkProtocol,
  WELL_KNOWN_PORTS,
  TAG_STYLES,
  NODE_COLOR_SCHEMES,
  EDGE_COLOR_SCHEMES,
  TagStyle,
  TrafficStatistics,
} from './networkTypes';

// Byte formatting with better precision and units
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  if (i >= sizes.length) {
    return `${(bytes / Math.pow(k, sizes.length - 1)).toFixed(1)} ${sizes[sizes.length - 1]}`;
  }
  
  const value = bytes / Math.pow(k, i);
  const decimals = i === 0 ? 0 : value < 10 ? 1 : 0;
  
  return `${value.toFixed(decimals)} ${sizes[i]}`;
};

// Packet formatting for large numbers
export const formatPackets = (packets: number): string => {
  if (packets === 0) return '0';
  if (packets < 1000) return packets.toString();
  if (packets < 1000000) return `${(packets / 1000).toFixed(1)}K`;
  if (packets < 1000000000) return `${(packets / 1000000).toFixed(1)}M`;
  return `${(packets / 1000000000).toFixed(1)}B`;
};

// Duration formatting for time-based data
export const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1000) return `${milliseconds}ms`;
  if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`;
  if (milliseconds < 3600000) return `${(milliseconds / 60000).toFixed(1)}m`;
  return `${(milliseconds / 3600000).toFixed(1)}h`;
};

// Determine protocol for a given port
export const getPortProtocol = (port: number, availableProtocols: string[] = []): NetworkProtocol => {
  // Check well-known ports first
  if (WELL_KNOWN_PORTS[port]) {
    return WELL_KNOWN_PORTS[port].protocol;
  }
  
  // Check available protocols from traffic data
  if (availableProtocols.includes('UDP')) return NetworkProtocol.UDP;
  if (availableProtocols.includes('ICMP')) return NetworkProtocol.ICMP;
  
  // Default to TCP for most services
  return NetworkProtocol.TCP;
};

// Get service name for a port
export const getPortService = (port: number): string => {
  return WELL_KNOWN_PORTS[port]?.service || 'Unknown';
};

// Determine node category based on tags and characteristics
export const categorizeNode = (node: BaseNetworkNode): NodeCategory => {
  const tags = node.tags.map(tag => tag.toLowerCase());
  
  if (tags.some(tag => tag.includes('derp'))) return NodeCategory.DERP;
  if (tags.some(tag => tag.includes('tailscale')) || node.isTailscale) return NodeCategory.TAILSCALE;
  if (tags.some(tag => tag.includes('private'))) return NodeCategory.PRIVATE;
  if (tags.some(tag => tag.includes('ipv6')) || node.ips?.some(ip => ip.includes(':'))) return NodeCategory.IPV6;
  if (tags.some(tag => tag.includes('server')) || node.incomingPorts.size > 3) return NodeCategory.SERVER;
  if (node.outgoingPorts.size > node.incomingPorts.size) return NodeCategory.CLIENT;
  
  return NodeCategory.UNKNOWN;
};

// Get tag styling
export const getTagStyle = (tag: string): TagStyle => {
  const normalizedTag = tag.toLowerCase();
  
  for (const [key, style] of Object.entries(TAG_STYLES)) {
    if (normalizedTag.includes(key)) {
      return style;
    }
  }
  
  return TAG_STYLES.default;
};

// Process node data for enhanced rendering
export const processNodeData = (node: BaseNetworkNode): ProcessedNodeData => {
  // Process IP addresses
  const allIPs = node.ips || [node.ip];
  const ipv4Addresses = allIPs.filter(ip => !ip.includes(':'));
  const ipv6Addresses = allIPs.filter(ip => ip.includes(':'));
  
  // Process tags
  const deviceTags = node.tags
    .filter(tag => tag && tag.startsWith('tag:'))
    .map(tag => tag.substring(4))
    .slice(0, 5);
  
  // Process ports
  const allPorts = new Set([...node.incomingPorts, ...node.outgoingPorts]);
  const uniquePorts = Array.from(allPorts).sort((a, b) => a - b).slice(0, 20);
  
  // Process protocols
  const protocolsList = Array.from(node.protocols);
  
  // Determine category and color scheme
  const category = categorizeNode(node);
  const colorScheme = NODE_COLOR_SCHEMES[category];
  
  return {
    ipv4Addresses,
    ipv6Addresses,
    deviceTags,
    uniquePorts,
    formattedBytes: formatBytes(node.totalBytes),
    protocolsList,
    category,
    colorScheme,
  };
};

// Process edge data for enhanced rendering
export const processEdgeData = (link: BaseNetworkLink, totalTraffic: number = 0): ProcessedEdgeData => {
  const trafficRatio = totalTraffic > 0 ? link.totalBytes / totalTraffic : 0;
  const txPercentage = link.totalBytes > 0 ? (link.txBytes / link.totalBytes) * 100 : 0;
  const rxPercentage = link.totalBytes > 0 ? (link.rxBytes / link.totalBytes) * 100 : 0;
  
  const trafficType = link.trafficType as TrafficType;
  const colorScheme = EDGE_COLOR_SCHEMES[trafficType] || EDGE_COLOR_SCHEMES[TrafficType.VIRTUAL];
  
  return {
    formattedBytes: formatBytes(link.totalBytes),
    formattedPackets: formatPackets(link.packets),
    trafficRatio,
    txPercentage,
    rxPercentage,
    colorScheme,
  };
};

// Calculate traffic statistics
export const calculateTrafficStatistics = (
  nodes: BaseNetworkNode[],
  links: BaseNetworkLink[]
): TrafficStatistics => {
  const totalBytes = links.reduce((sum, link) => sum + link.totalBytes, 0);
  
  const virtualBytes = links
    .filter(link => link.trafficType === 'virtual')
    .reduce((sum, link) => sum + link.totalBytes, 0);
    
  const subnetBytes = links
    .filter(link => link.trafficType === 'subnet')
    .reduce((sum, link) => sum + link.totalBytes, 0);
    
  const physicalBytes = links
    .filter(link => link.trafficType === 'physical')
    .reduce((sum, link) => sum + link.totalBytes, 0);

  return {
    totalBytes,
    virtualBytes,
    subnetBytes,
    physicalBytes,
    nodeCount: nodes.length,
    linkCount: links.length,
  };
};

// Filter nodes by various criteria
export const filterNodes = {
  byTag: (nodes: BaseNetworkNode[], tag: string): BaseNetworkNode[] =>
    nodes.filter(node => node.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))),
    
  byTrafficThreshold: (nodes: BaseNetworkNode[], threshold: number): BaseNetworkNode[] =>
    nodes.filter(node => node.totalBytes >= threshold),
    
  byConnectionCount: (nodes: BaseNetworkNode[], minConnections: number): BaseNetworkNode[] =>
    nodes.filter(node => node.connections >= minConnections),
    
  byCategory: (nodes: BaseNetworkNode[], category: NodeCategory): BaseNetworkNode[] =>
    nodes.filter(node => categorizeNode(node) === category),
    
  byProtocol: (nodes: BaseNetworkNode[], protocol: string): BaseNetworkNode[] =>
    nodes.filter(node => node.protocols.has(protocol)),
};

// Filter edges by various criteria
export const filterEdges = {
  byTrafficType: (links: BaseNetworkLink[], trafficType: TrafficType): BaseNetworkLink[] =>
    links.filter(link => link.trafficType === trafficType),
    
  byProtocol: (links: BaseNetworkLink[], protocol: string): BaseNetworkLink[] =>
    links.filter(link => link.protocol.toLowerCase() === protocol.toLowerCase()),
    
  byTrafficThreshold: (links: BaseNetworkLink[], threshold: number): BaseNetworkLink[] =>
    links.filter(link => link.totalBytes >= threshold),
    
  byPacketCount: (links: BaseNetworkLink[], minPackets: number): BaseNetworkLink[] =>
    links.filter(link => link.packets >= minPackets),
};

// Sort functions
export const sortNodes = {
  byTraffic: (nodes: BaseNetworkNode[], descending = true): BaseNetworkNode[] =>
    [...nodes].sort((a, b) => descending ? b.totalBytes - a.totalBytes : a.totalBytes - b.totalBytes),
    
  byConnections: (nodes: BaseNetworkNode[], descending = true): BaseNetworkNode[] =>
    [...nodes].sort((a, b) => descending ? b.connections - a.connections : a.connections - b.connections),
    
  byName: (nodes: BaseNetworkNode[], ascending = true): BaseNetworkNode[] =>
    [...nodes].sort((a, b) => ascending ? 
      a.displayName.localeCompare(b.displayName) : 
      b.displayName.localeCompare(a.displayName)
    ),
};

export const sortEdges = {
  byTraffic: (links: BaseNetworkLink[], descending = true): BaseNetworkLink[] =>
    [...links].sort((a, b) => descending ? b.totalBytes - a.totalBytes : a.totalBytes - b.totalBytes),
    
  byPackets: (links: BaseNetworkLink[], descending = true): BaseNetworkLink[] =>
    [...links].sort((a, b) => descending ? b.packets - a.packets : a.packets - b.packets),
};

// Network analysis functions
export const analyzeNetwork = {
  // Find the most connected nodes
  getHubs: (nodes: BaseNetworkNode[], topN = 5): BaseNetworkNode[] =>
    sortNodes.byConnections(nodes, true).slice(0, topN),
    
  // Find nodes with highest traffic
  getHighTrafficNodes: (nodes: BaseNetworkNode[], topN = 5): BaseNetworkNode[] =>
    sortNodes.byTraffic(nodes, true).slice(0, topN),
    
  // Find bottleneck edges (highest traffic)
  getBottlenecks: (links: BaseNetworkLink[], topN = 5): BaseNetworkLink[] =>
    sortEdges.byTraffic(links, true).slice(0, topN),
    
  // Calculate network density
  getDensity: (nodeCount: number, edgeCount: number): number => {
    if (nodeCount <= 1) return 0;
    const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2;
    return edgeCount / maxPossibleEdges;
  },
  
  // Find isolated nodes (no connections)
  getIsolatedNodes: (nodes: BaseNetworkNode[]): BaseNetworkNode[] =>
    nodes.filter(node => node.connections === 0),
    
  // Calculate clustering coefficient (approximate)
  getClusteringCoefficient: (nodes: BaseNetworkNode[], _links: BaseNetworkLink[]): number => {
    // Simplified calculation - in real implementation would need proper graph analysis
    const avgConnections = nodes.reduce((sum, node) => sum + node.connections, 0) / nodes.length;
    const maxConnections = Math.max(...nodes.map(node => node.connections), 1);
    return avgConnections / maxConnections;
  },
};

// Performance optimization helpers
export const performanceHelpers = {
  // Check if graph is complex enough to warrant optimization
  isComplexGraph: (nodeCount: number, edgeCount: number): boolean => {
    return nodeCount > 50 || edgeCount > 100;
  },
  
  // Determine if virtual rendering should be used
  shouldUseVirtualization: (nodeCount: number): boolean => {
    return nodeCount > 100;
  },
  
  // Calculate optimal update debounce time based on graph size
  getOptimalDebounceTime: (nodeCount: number, edgeCount: number): number => {
    const baseTime = 100;
    const complexityFactor = Math.log10(nodeCount + edgeCount + 1);
    return Math.min(baseTime * complexityFactor, 1000);
  },
};

// Validation helpers
export const validateNetwork = {
  // Validate node data structure
  isValidNode: (node: any): node is BaseNetworkNode => {
    return node &&
      typeof node.id === 'string' &&
      typeof node.ip === 'string' &&
      typeof node.displayName === 'string' &&
      typeof node.totalBytes === 'number' &&
      typeof node.connections === 'number' &&
      Array.isArray(node.tags) &&
      node.incomingPorts instanceof Set &&
      node.outgoingPorts instanceof Set &&
      node.protocols instanceof Set;
  },
  
  // Validate edge data structure
  isValidEdge: (link: any): link is BaseNetworkLink => {
    return link &&
      (typeof link.source === 'string' || validateNetwork.isValidNode(link.source)) &&
      (typeof link.target === 'string' || validateNetwork.isValidNode(link.target)) &&
      typeof link.totalBytes === 'number' &&
      typeof link.packets === 'number' &&
      typeof link.protocol === 'string' &&
      ['virtual', 'subnet', 'physical'].includes(link.trafficType);
  },
  
  // Validate entire network dataset
  isValidNetworkData: (nodes: any[], links: any[]): boolean => {
    return Array.isArray(nodes) &&
      Array.isArray(links) &&
      nodes.every(validateNetwork.isValidNode) &&
      links.every(validateNetwork.isValidEdge);
  },
};

// Accessibility helpers
export const accessibilityHelpers = {
  // Generate accessible label for node
  getNodeAriaLabel: (node: BaseNetworkNode): string => {
    const processedData = processNodeData(node);
    const parts = [
      `Network device: ${node.displayName}`,
      `Traffic: ${processedData.formattedBytes}`,
      `Connections: ${node.connections}`,
      `IP addresses: ${processedData.ipv4Addresses.length + processedData.ipv6Addresses.length}`,
    ];
    
    if (processedData.uniquePorts.length > 0) {
      parts.push(`Open ports: ${processedData.uniquePorts.length}`);
    }
    
    if (node.user) {
      parts.push(`User: ${node.user}`);
    }
    
    return parts.join(', ');
  },
  
  // Generate accessible label for edge
  getEdgeAriaLabel: (link: BaseNetworkLink): string => {
    const processedData = processEdgeData(link);
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
    
    return `Network connection from ${sourceId} to ${targetId}, ` +
           `Traffic: ${processedData.formattedBytes}, ` +
           `Protocol: ${link.protocol}, ` +
           `Type: ${processedData.colorScheme.label}`;
  },
  
  // Generate keyboard navigation hints
  getKeyboardHints: (): string[] => [
    'Tab: Navigate between nodes',
    'Enter/Space: Select node or edge',
    'Escape: Clear selection',
    'Arrow keys: Pan view when focused on background',
    '+/-: Zoom in/out',
    'Home: Fit view to show all nodes',
  ],
};