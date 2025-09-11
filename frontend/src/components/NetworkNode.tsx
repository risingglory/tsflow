import { memo, useMemo, useCallback, useState } from 'react';
import { Handle, NodeProps, Position } from '@xyflow/react';
import { useSelection } from './ReactFlowGraph';

export interface NetworkNodeData extends Record<string, unknown> {
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

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  // Use different precision based on size
  const precision = value < 10 ? 1 : 0;
  return `${value.toFixed(precision)} ${sizes[i]}`;
};

// Common port names for better UX
const WELL_KNOWN_PORTS: Record<number, string> = {
  22: 'SSH',
  53: 'DNS',
  80: 'HTTP',
  443: 'HTTPS',
  3389: 'RDP',
  5432: 'PostgreSQL',
  3306: 'MySQL',
  6379: 'Redis',
  8080: 'HTTP-Alt',
  8443: 'HTTPS-Alt',
  9090: 'Prometheus',
  27017: 'MongoDB',
};

const NetworkNode = memo<NodeProps>(({ data, selected }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const nodeData = data as NetworkNodeData;
  
  // Get selection state
  const { highlightedNodes, selectedNode, selectedLink } = useSelection();
  const isHighlighted = highlightedNodes.has(nodeData.id) || selected;
  const isSelected = selectedNode?.id === nodeData.id || selected;
  const hasSelection = selectedNode !== null || selectedLink !== null;
  const isDimmed = hasSelection && !isHighlighted;

  // Process and organize data
  const processedData = useMemo(() => {
    const allIPs = nodeData.ips || [nodeData.ip];
    const ipv4Addresses = allIPs.filter((ip: string) => !ip.includes(':'));
    const ipv6Addresses = allIPs.filter((ip: string) => ip.includes(':'));
    
    // Filter and clean up tags
    const deviceTags = (nodeData.tags || [])
      .filter((tag: string) => tag && tag.startsWith('tag:'))
      .map(tag => tag.replace('tag:', '')) // Remove prefix for cleaner display
      .slice(0, 6);

    // Process ports with better organization
    const allPorts = Array.from(new Set([...nodeData.incomingPorts, ...nodeData.outgoingPorts]))
      .sort((a, b) => a - b);
    
    // Separate well-known ports from high ports
    const wellKnownPorts = allPorts.filter(p => p < 1024 || WELL_KNOWN_PORTS[p]);
    const highPorts = allPorts.filter(p => p >= 1024 && !WELL_KNOWN_PORTS[p]);
    
    // Limit display but show count of hidden ports
    const displayPorts = isExpanded ? allPorts : [...wellKnownPorts.slice(0, 8), ...highPorts.slice(0, 4)];
    const hiddenPortCount = allPorts.length - displayPorts.length;

    // Clean up protocols
    const protocols = Array.from(nodeData.protocols).filter(p => p !== 'Proto-0');
    if (protocols.length === 0 && allPorts.length > 0) {
      protocols.push('TCP'); // Default assumption
    }

    return {
      ipv4Addresses,
      ipv6Addresses,
      deviceTags,
      displayPorts,
      hiddenPortCount,
      totalPortCount: allPorts.length,
      formattedBytes: formatBytes(nodeData.totalBytes),
      protocols
    };
  }, [nodeData, isExpanded]);

  // Get port label with protocol
  const getPortLabel = useCallback((port: number): string => {
    const name = WELL_KNOWN_PORTS[port];
    if (name) return name;
    
    // Determine protocol based on common patterns
    if ([53, 67, 68, 123, 161, 162, 514, 1900].includes(port)) return `${port}•UDP`;
    return `${port}•TCP`;
  }, []);

  // Dynamic color scheme based on node type
  const colorScheme = useMemo(() => {
    // Service nodes (📦 or 📍 prefix)
    if (nodeData.displayName.startsWith('📦') || nodeData.displayName.startsWith('📍')) {
      return {
        bg: 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950',
        border: isSelected ? 'border-violet-500 dark:border-violet-400' : 'border-violet-300 dark:border-violet-700',
        header: 'bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900 dark:to-purple-900',
        accent: 'text-violet-700 dark:text-violet-300',
        tag: 'bg-violet-100 dark:bg-violet-800',
        indicator: 'bg-violet-500'
      };
    }
    
    // Tailscale nodes
    if (nodeData.isTailscale) {
      return {
        bg: 'bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950',
        border: isSelected ? 'border-blue-500 dark:border-blue-400' : 'border-blue-300 dark:border-blue-700',
        header: 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900 dark:to-cyan-900',
        accent: 'text-blue-700 dark:text-blue-300',
        tag: 'bg-blue-100 dark:bg-blue-800',
        indicator: 'bg-blue-500'
      };
    }
    
    // External nodes
    return {
      bg: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950',
      border: isSelected ? 'border-amber-500 dark:border-amber-400' : 'border-amber-300 dark:border-amber-700',
      header: 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900 dark:to-orange-900',
      accent: 'text-amber-700 dark:text-amber-300',
      tag: 'bg-amber-100 dark:bg-amber-800',
      indicator: 'bg-amber-500'
    };
  }, [nodeData, isSelected]);

  // Get tag style based on content
  const getTagStyle = useCallback((tag: string) => {
    const lower = tag.toLowerCase();
    if (lower.includes('k8s')) return 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200';
    if (lower.includes('prod')) return 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200';
    if (lower.includes('dev')) return 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200';
    if (lower.includes('staging')) return 'bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-200';
    if (lower.includes('ottawa') || lower.includes('robbinsdale')) 
      return 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200';
    return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200';
  }, []);

  return (
    <div
      className={`
        relative rounded-lg border-2 shadow-lg
        ${colorScheme.bg} ${colorScheme.border}
        ${isSelected ? 'ring-2 ring-offset-2 ring-blue-400 dark:ring-offset-gray-900' : ''}
        ${isDimmed ? 'opacity-30' : ''}
        transition-all duration-200 hover:shadow-xl
        min-w-[280px]
      `}
      style={{
        filter: isDimmed ? 'grayscale(50%)' : undefined,
        transform: isSelected ? 'scale(1.02)' : undefined,
        zIndex: isHighlighted ? 10 : 1,
      }}
    >
      {/* Invisible handles for connections */}
      <Handle 
        type="source" 
        position={Position.Top}
        className="!opacity-0 !pointer-events-none !w-0 !h-0"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      />
      <Handle 
        type="target" 
        position={Position.Top}
        className="!opacity-0 !pointer-events-none !w-0 !h-0"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      />
      
      {/* Header Section */}
      <div className={`px-4 py-3 rounded-t-lg ${colorScheme.header} border-b border-gray-200 dark:border-gray-700`}>
        <div className="flex justify-between items-start gap-3">
          <h3 
            className={`font-bold text-base flex-1 ${colorScheme.accent} break-words leading-tight`}
            title={nodeData.displayName}
            style={{
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              hyphens: 'auto',
              lineHeight: '1.3'
            }}
          >
            {nodeData.displayName}
          </h3>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-sm font-bold text-green-600 dark:text-green-400">
              {processedData.formattedBytes}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {nodeData.connections} conn{nodeData.connections !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        
        {/* User info if present */}
        {nodeData.user && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
            <span className="opacity-70">User:</span> {nodeData.user}
          </div>
        )}
      </div>

      {/* Body Section */}
      <div className="px-4 py-3 space-y-3">
        {/* IP Addresses */}
        <div className="space-y-1">
          {processedData.ipv4Addresses.map(ip => (
            <div key={ip} className="flex items-center gap-2 text-sm">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10">IPv4:</span>
              <code className="font-mono text-blue-600 dark:text-blue-400">{ip}</code>
            </div>
          ))}
          {processedData.ipv6Addresses.slice(0, 1).map(ip => (
            <div key={ip} className="flex items-center gap-2 text-sm">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10">IPv6:</span>
              <code className="font-mono text-purple-600 dark:text-purple-400 truncate" title={ip}>
                {ip.length > 30 ? `${ip.substring(0, 27)}...` : ip}
              </code>
            </div>
          ))}
        </div>

        {/* Protocols */}
        {processedData.protocols.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">🔌</span>
            <span className="font-medium">{processedData.protocols.join(', ')}</span>
          </div>
        )}

        {/* Ports Section - Improved */}
        {processedData.displayPorts.length > 0 && (
          <div>
            <div className="flex flex-wrap gap-1.5">
              {processedData.displayPorts.map(port => {
                const label = getPortLabel(port);
                const isWellKnown = port < 1024 || WELL_KNOWN_PORTS[port];
                return (
                  <span
                    key={port}
                    className={`
                      inline-flex items-center px-2 py-1 text-xs rounded-full
                      font-mono transition-colors cursor-default
                      ${isWellKnown 
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 border border-blue-200 dark:border-blue-700' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                      }
                      hover:bg-opacity-70
                    `}
                    title={`Port ${port}`}
                  >
                    {label}
                  </span>
                );
              })}
              {processedData.hiddenPortCount > 0 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="inline-flex items-center px-2 py-1 text-xs rounded-full
                    bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300
                    hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {isExpanded ? '−' : '+'} {processedData.hiddenPortCount} more
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tags Section - Improved */}
        {processedData.deviceTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {processedData.deviceTags.map(tag => (
              <span
                key={tag}
                className={`
                  inline-flex items-center px-2 py-1 text-xs rounded-full
                  font-medium transition-transform hover:scale-105
                  ${getTagStyle(tag)}
                `}
              >
                tag:{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {nodeData.isTailscale && (
            <div className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 ${colorScheme.indicator} rounded-full animate-pulse`}></div>
              <span className={colorScheme.accent}>Tailscale</span>
            </div>
          )}
        </div>
        {processedData.totalPortCount > 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {processedData.totalPortCount} ports
          </span>
        )}
      </div>
    </div>
  );
});

NetworkNode.displayName = 'NetworkNode';

export default NetworkNode;