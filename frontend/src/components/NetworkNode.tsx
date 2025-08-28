import { memo, useMemo, useCallback } from 'react';
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
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const NetworkNode = memo<NodeProps>(({ data, selected }) => {
  // Memoize processed data for performance
  const processedData = useMemo(() => {
    const nodeData = data as NetworkNodeData;
    const allIPs = nodeData.ips || [nodeData.ip];
    const ipv4Addresses = allIPs.filter((ip: string) => !ip.includes(':'));
    const ipv6Addresses = allIPs.filter((ip: string) => ip.includes(':'));
    
    const deviceTags = (nodeData.tags || [])
      .filter((tag: string) => tag && tag.startsWith('tag:'))
      .map((tag: string) => tag.substring(4))
      .slice(0, 5);

    const allPorts = new Set([...nodeData.incomingPorts, ...nodeData.outgoingPorts]);
    const uniquePorts = Array.from(allPorts).sort((a, b) => a - b).slice(0, 20);

    return {
      ipv4Addresses,
      ipv6Addresses,
      deviceTags,
      uniquePorts,
      formattedBytes: formatBytes(nodeData.totalBytes),
      protocolsList: Array.from(nodeData.protocols)
    };
  }, [data]);

  // Memoize color calculations
  const colors = useMemo(() => {
    const nodeData = data as NetworkNodeData;
    if (nodeData.tags.includes('derp')) return { 
      bg: 'bg-red-50', 
      border: 'border-red-500', 
      ring: 'ring-red-500',
      accent: 'text-red-700'
    };
    if (nodeData.tags.includes('tailscale')) return { 
      bg: 'bg-blue-50', 
      border: 'border-blue-500', 
      ring: 'ring-blue-500',
      accent: 'text-blue-700'
    };
    if (nodeData.tags.includes('private')) return { 
      bg: 'bg-green-50', 
      border: 'border-green-500', 
      ring: 'ring-green-500',
      accent: 'text-green-700'
    };
    if (nodeData.tags.includes('ipv6')) return { 
      bg: 'bg-purple-50', 
      border: 'border-purple-500', 
      ring: 'ring-purple-500',
      accent: 'text-purple-700'
    };
    return { 
      bg: 'bg-yellow-50', 
      border: 'border-yellow-500', 
      ring: 'ring-yellow-500',
      accent: 'text-yellow-700'
    };
  }, [data]);

  // Helper function to determine protocol for port
  const getPortProtocol = useCallback((port: number): string => {
    const protocols = processedData.protocolsList;
    if ([53, 67, 68, 69, 123, 161, 162].includes(port) || protocols.includes('UDP')) return 'UDP';
    if ([1, 8].includes(port) || protocols.includes('ICMP')) return 'ICMP';
    return 'TCP';
  }, [processedData.protocolsList]);

  // Get tag colors based on tag content
  const getTagColors = useCallback((tag: string): string => {
    if (tag.includes('prod') || tag.includes('production')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    if (tag.includes('dev') || tag.includes('development')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
    if (tag.includes('staging') || tag.includes('stage')) {
      return 'bg-orange-100 text-orange-800 border-orange-300';
    }
    if (tag.includes('server')) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    if (tag.includes('k8s') || tag.includes('kubernetes')) {
      return 'bg-purple-100 text-purple-800 border-purple-300';
    }
    return 'bg-indigo-100 text-indigo-800 border-indigo-300';
  }, []);

  // Get highlighting state from context
  const nodeData = data as NetworkNodeData;
  const { highlightedNodes, selectedNode, selectedLink } = useSelection();
  const isHighlighted = highlightedNodes.has(nodeData.id) || selected;
  const isSelected = selectedNode?.id === nodeData.id || selected;
  const hasSelection = selectedNode !== null || selectedLink !== null;
  const isDimmed = hasSelection && !isHighlighted;

  return (
    <div
      className={`
        network-device-node p-4 rounded-xl border-2 min-w-[280px] max-w-[400px] 
        shadow-lg backdrop-blur-sm
        ${colors.bg} ${colors.border}
        ${isSelected ? `ring-4 ${colors.ring} ring-opacity-50 scale-105 shadow-2xl` : 'hover:shadow-xl hover:scale-102'}
        ${isDimmed ? 'opacity-20' : 'opacity-100'}
        transition-opacity duration-150 ease-out
      `}
      style={{ 
        minHeight: '140px',
        background: isSelected ? 'rgba(255, 255, 255, 0.95)' : undefined,
        filter: isSelected ? 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))' : 
                isDimmed ? 'grayscale(80%) blur(0.5px)' : undefined,
        transform: isSelected ? 'scale(1.02)' : undefined,
        zIndex: isHighlighted ? 10 : 1,
      }}
      role="button"
      tabIndex={0}
      aria-label={`Network device: ${nodeData.displayName}`}
      aria-selected={isSelected}
    >
      {/* Single centered handle for true middle connections */}
      <Handle 
        type="source" 
        position={Position.Top}
        className="!opacity-0 !pointer-events-none !w-0 !h-0 !border-0"
        style={{ 
          background: 'transparent', 
          visibility: 'hidden',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      />
      <Handle 
        type="target" 
        position={Position.Top}
        className="!opacity-0 !pointer-events-none !w-0 !h-0 !border-0" 
        style={{ 
          background: 'transparent', 
          visibility: 'hidden',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)'
        }}
      />
      
      {/* Header with device name and traffic */}
      <header className="flex justify-between items-start mb-3 pb-2 border-b border-gray-200">
        <h3 className={`text-sm font-bold truncate flex-1 pr-3 ${colors.accent}`}>
          {(data as NetworkNodeData).displayName}
        </h3>
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-green-600 whitespace-nowrap">
            {processedData.formattedBytes}
          </span>
          <span className="text-xs text-gray-500">
            {(data as NetworkNodeData).connections} conn{(data as NetworkNodeData).connections !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* User/Identity section */}
      {(data as NetworkNodeData).user && (
        <div className="flex items-center gap-1 mb-3 text-xs">
          <span className="text-indigo-600">👤</span>
          <span className="font-medium text-indigo-600 truncate">{(data as NetworkNodeData).user}</span>
        </div>
      )}

      {/* IP Addresses section */}
      <section className="space-y-1 mb-3" aria-label="IP Addresses">
        {processedData.ipv4Addresses.map(ip => (
          <div key={ip} className="flex items-center gap-1 text-xs">
            <span className="text-blue-600 font-medium">IPv4:</span>
            <code className="font-mono text-blue-700 bg-blue-50 px-1 rounded">{ip}</code>
          </div>
        ))}
        {processedData.ipv6Addresses.map(ip => (
          <div key={ip} className="flex items-center gap-1 text-xs">
            <span className="text-purple-600 font-medium">IPv6:</span>
            <code className="font-mono text-purple-700 bg-purple-50 px-1 rounded truncate" title={ip}>
              {ip.length > 25 ? `${ip.substring(0, 22)}...` : ip}
            </code>
          </div>
        ))}
      </section>

      {/* Protocols section */}
      {processedData.protocolsList.length > 0 && (
        <section className="mb-3" aria-label="Protocols">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-600">📡</span>
            <span className="text-gray-700 font-medium">
              {processedData.protocolsList.join(', ')}
            </span>
          </div>
        </section>
      )}

      {/* Ports section */}
      {processedData.uniquePorts.length > 0 && (
        <section className="mb-3" aria-label="Network Ports">
          <div className="flex flex-wrap gap-1">
            {processedData.uniquePorts.map(port => (
              <span
                key={port}
                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full border border-blue-300 font-mono hover:bg-blue-200 transition-colors"
                title={`Port ${port} (${getPortProtocol(port)})`}
              >
                {port}•{getPortProtocol(port)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Tags section */}
      {processedData.deviceTags.length > 0 && (
        <section className="flex flex-wrap gap-1" aria-label="Device Tags">
          {processedData.deviceTags.map(tag => (
            <span
              key={tag}
              className={`
                inline-block px-2 py-1 text-xs rounded-full font-medium border
                transition-all duration-200 hover:scale-105
                ${getTagColors(tag)}
              `}
              title={`Tag: ${tag}`}
            >
              {tag}
            </span>
          ))}
        </section>
      )}

      {/* Status indicators */}
      <footer className="flex justify-between items-center mt-3 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-2 text-xs">
          {(data as NetworkNodeData).isTailscale && (
            <span className="inline-flex items-center gap-1 text-blue-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Tailscale
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {processedData.uniquePorts.length > 0 && `${processedData.uniquePorts.length} ports`}
        </div>
      </footer>
    </div>
  );
});

NetworkNode.displayName = 'NetworkNode';

export default NetworkNode;