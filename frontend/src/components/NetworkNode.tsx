import { memo, useMemo, useCallback, useRef, useLayoutEffect, useState } from 'react';
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
  const [nodeDimensions, setNodeDimensions] = useState({ width: 280, height: 140 });
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Memoize processed data for performance
  const processedData = useMemo(() => {
    const nodeData = data as NetworkNodeData;
    const allIPs = nodeData.ips || [nodeData.ip];
    const ipv4Addresses = allIPs.filter((ip: string) => !ip.includes(':'));
    const ipv6Addresses = allIPs.filter((ip: string) => ip.includes(':'));
    
    const deviceTags = (nodeData.tags || [])
      .filter((tag: string) => tag && tag.startsWith('tag:')) // Only show actual Tailscale tags
      .slice(0, 8); // Show up to 8 tags

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

  // Helper function to determine protocol for port
  const getPortProtocol = useCallback((port: number): string => {
    const protocols = processedData.protocolsList;
    if ([53, 67, 68, 69, 123, 161, 162].includes(port) || protocols.includes('UDP')) return 'UDP';
    if ([1, 8].includes(port) || protocols.includes('ICMP')) return 'ICMP';
    return 'TCP';
  }, [processedData.protocolsList]);
  
  // Measure content and calculate optimal dimensions
  const measureContent = useCallback(() => {
    if (!contentRef.current) return;
    
    const content = contentRef.current;
    const computedStyle = getComputedStyle(content);
    const padding = parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
    
    // Create temporary element for text measurement
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: nowrap;
      font-family: ${computedStyle.fontFamily};
      font-size: ${computedStyle.fontSize};
      font-weight: ${computedStyle.fontWeight};
      top: -9999px;
    `;
    document.body.appendChild(tempDiv);
    
    let maxWidth = 0;
    let totalHeight = 0;
    
    // Measure header text
    const headerText = (data as NetworkNodeData).displayName;
    tempDiv.textContent = headerText;
    const headerWidth = tempDiv.offsetWidth + 140; // Increased space for traffic info
    maxWidth = Math.max(maxWidth, headerWidth);
    totalHeight += 45; // Header height with margins
    
    // Measure IP addresses
    processedData.ipv4Addresses.forEach(ip => {
      tempDiv.textContent = `IPv4: ${ip}`;
      maxWidth = Math.max(maxWidth, tempDiv.offsetWidth + 20);
    });
    processedData.ipv6Addresses.forEach(ip => {
      const displayIp = ip.length > 25 ? `${ip.substring(0, 22)}...` : ip;
      tempDiv.textContent = `IPv6: ${displayIp}`;
      maxWidth = Math.max(maxWidth, tempDiv.offsetWidth + 20);
    });
    totalHeight += (processedData.ipv4Addresses.length + processedData.ipv6Addresses.length) * 18;
    
    // Measure protocols
    if (processedData.protocolsList.length > 0) {
      tempDiv.textContent = `📡 ${processedData.protocolsList.join(', ')}`;
      maxWidth = Math.max(maxWidth, tempDiv.offsetWidth + 20);
      totalHeight += 18; // Reduced from 20
    }
    
    // Calculate ports width (they wrap) - be more generous with spacing
    if (processedData.uniquePorts.length > 0) {
      const avgPortWidth = 80; // Increased width for port badges
      const estimatedWidth = Math.max(maxWidth, 350); // Ensure minimum width for ports
      const portsPerRow = Math.max(1, Math.floor(estimatedWidth / avgPortWidth));
      const portRows = Math.ceil(processedData.uniquePorts.length / portsPerRow);
      totalHeight += (portRows * 30) + 15; // Reduced height per row and margin
      
      // Update maxWidth if ports need more space
      const actualPortsWidth = Math.min(processedData.uniquePorts.length, portsPerRow) * avgPortWidth;
      maxWidth = Math.max(maxWidth, actualPortsWidth + 40);
    }
    
    // Calculate tags width (they wrap) - be more generous for full tag names
    if (processedData.deviceTags.length > 0) {
      let maxTagRowWidth = 0;
      processedData.deviceTags.forEach(tag => {
        tempDiv.textContent = tag; // Now measuring full tag:name
        const tagWidth = tempDiv.offsetWidth + 24; // Increased padding for tags
        maxTagRowWidth = Math.max(maxTagRowWidth, tagWidth);
      });
      
      const avgTagWidth = 120; // Increased for full tag names like "tag:k8s"
      const estimatedWidth = Math.max(maxWidth, 350);
      const tagsPerRow = Math.max(1, Math.floor(estimatedWidth / avgTagWidth));
      const tagRows = Math.ceil(processedData.deviceTags.length / tagsPerRow);
      totalHeight += (tagRows * 28) + 12; // Reduced height per row
      
      // Update maxWidth based on tag requirements
      const actualTagsWidth = Math.min(processedData.deviceTags.length, tagsPerRow) * avgTagWidth;
      maxWidth = Math.max(maxWidth, actualTagsWidth + 40);
    }
    
    // Add user section height
    if ((data as NetworkNodeData).user) {
      totalHeight += 22; // Reduced from 25
    }
    
    // Add footer height (includes Tailscale indicator)
    totalHeight += 25; // Reduced from 45
    
    // Add minimal base padding for proper layout
    totalHeight += 15; // Reduced from 30
    
    document.body.removeChild(tempDiv);
    
    // Apply minimum constraints only - no maximum limits
    const finalWidth = Math.max(320, maxWidth + padding + 60);
    const finalHeight = Math.max(140, totalHeight + 10); // Reduced buffer from 30 to 10
    
    // Node dimensions calculated successfully
    
    setNodeDimensions({ width: finalWidth, height: finalHeight });
  }, [data, processedData]);
  
  // Measure content when data changes
  useLayoutEffect(() => {
    const timer = setTimeout(measureContent, 0);
    return () => clearTimeout(timer);
  }, [measureContent]);

  // Get tag colors based on tag content with solid dark mode colors
  const getTagColors = useCallback((tag: string): string => {
    const tagContent = tag.toLowerCase();
    if (tagContent.includes('prod') || tagContent.includes('production')) {
      return 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100 border-red-300 dark:border-red-500';
    }
    if (tagContent.includes('dev') || tagContent.includes('development')) {
      return 'bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 border-yellow-300 dark:border-yellow-500';
    }
    if (tagContent.includes('staging') || tagContent.includes('stage')) {
      return 'bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-100 border-orange-300 dark:border-orange-500';
    }
    if (tagContent.includes('server')) {
      return 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 border-green-300 dark:border-green-500';
    }
    if (tagContent.includes('k8s') || tagContent.includes('kubernetes')) {
      return 'bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-100 border-purple-300 dark:border-purple-500';
    }
    return 'bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100 border-indigo-300 dark:border-indigo-500';
  }, []);

  // Get highlighting state from context
  const nodeData = data as NetworkNodeData;
  const { highlightedNodes, selectedNode, selectedLink } = useSelection();
  const isHighlighted = highlightedNodes.has(nodeData.id) || selected;
  const isSelected = selectedNode?.id === nodeData.id || selected;
  const hasSelection = selectedNode !== null || selectedLink !== null;
  const isDimmed = hasSelection && !isHighlighted;

  // Memoize color calculations with solid dark mode colors
  const colors = useMemo(() => {
    if (nodeData.tags.includes('derp')) return { 
      bg: isSelected ? 'bg-red-100 dark:bg-red-900' : 'bg-red-50 dark:bg-red-950', 
      border: 'border-red-500 dark:border-red-400', 
      ring: 'ring-red-500',
      accent: 'text-red-700 dark:text-red-100'
    };
    if (nodeData.tags.includes('tailscale')) return { 
      bg: isSelected ? 'bg-blue-100 dark:bg-blue-900' : 'bg-blue-50 dark:bg-blue-950', 
      border: 'border-blue-500 dark:border-blue-400', 
      ring: 'ring-blue-500',
      accent: 'text-blue-700 dark:text-blue-100'
    };
    if (nodeData.tags.includes('private')) return { 
      bg: isSelected ? 'bg-green-100 dark:bg-green-900' : 'bg-green-50 dark:bg-green-950', 
      border: 'border-green-500 dark:border-green-400', 
      ring: 'ring-green-500',
      accent: 'text-green-700 dark:text-green-100'
    };
    if (nodeData.tags.includes('ipv6')) return { 
      bg: isSelected ? 'bg-purple-100 dark:bg-purple-900' : 'bg-purple-50 dark:bg-purple-950', 
      border: 'border-purple-500 dark:border-purple-400', 
      ring: 'ring-purple-500',
      accent: 'text-purple-700 dark:text-purple-100'
    };
    return { 
      bg: isSelected ? 'bg-amber-100 dark:bg-amber-900' : 'bg-amber-50 dark:bg-amber-950', 
      border: 'border-amber-500 dark:border-amber-400', 
      ring: 'ring-amber-500',
      accent: 'text-amber-700 dark:text-amber-100'
    };
  }, [nodeData.tags, isSelected]);

  return (
    <div
      ref={contentRef}
      className={`
        network-device-node p-4 rounded-xl border-2
        shadow-lg
        ${colors.bg} ${colors.border}
        ${isSelected ? `ring-4 ${colors.ring} ring-opacity-50 scale-105 shadow-2xl` : 'hover:shadow-xl hover:scale-102'}
        ${isDimmed ? 'opacity-20' : 'opacity-100'}
        transition-all duration-150 ease-out
      `}
      style={{ 
        width: `${nodeDimensions.width}px`,
        height: `${nodeDimensions.height}px`,
        minWidth: '240px',
        minHeight: '120px',
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
      <header className="flex justify-between items-start mb-3 pb-2 border-b border-gray-200 dark:border-gray-600">
        <h3 className={`text-sm font-bold truncate flex-1 pr-3 ${colors.accent}`}>
          {(data as NetworkNodeData).displayName}
        </h3>
        <div className="flex flex-col items-end">
          <span className="text-xs font-bold text-green-600 dark:text-green-400 whitespace-nowrap">
            {processedData.formattedBytes}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-300">
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
      <section className="space-y-1 mb-2" aria-label="IP Addresses">
        {processedData.ipv4Addresses.map(ip => (
          <div key={ip} className="flex items-center gap-1 text-xs">
            <span className="text-blue-600 dark:text-blue-400 font-medium">IPv4:</span>
            <code className="font-mono text-blue-700 dark:text-blue-100 bg-blue-50 dark:bg-blue-800 px-1 rounded">{ip}</code>
          </div>
        ))}
        {processedData.ipv6Addresses.map(ip => (
          <div key={ip} className="flex items-center gap-1 text-xs">
            <span className="text-purple-600 dark:text-purple-400 font-medium">IPv6:</span>
            <code className="font-mono text-purple-700 dark:text-purple-100 bg-purple-50 dark:bg-purple-800 px-1 rounded truncate" title={ip}>
              {ip.length > 25 ? `${ip.substring(0, 22)}...` : ip}
            </code>
          </div>
        ))}
      </section>

      {/* Protocols section */}
      {processedData.protocolsList.length > 0 && (
        <section className="mb-2" aria-label="Protocols">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-600 dark:text-gray-400">📡</span>
            <span className="text-gray-700 dark:text-gray-200 font-medium">
              {processedData.protocolsList.join(', ')}
            </span>
          </div>
        </section>
      )}

      {/* Ports section */}
      {processedData.uniquePorts.length > 0 && (
        <section className="mb-2" aria-label="Network Ports">
          <div className="flex flex-wrap gap-1">
            {processedData.uniquePorts.map(port => (
              <span
                key={port}
                className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full border border-blue-300 dark:border-blue-500 font-mono hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
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
        <section className="flex flex-wrap gap-1 mb-2" aria-label="Device Tags">
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
      <footer className="flex justify-between items-center mt-2 pt-1 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-center gap-2 text-xs">
          {(data as NetworkNodeData).isTailscale && (
            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-300">
              <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
              Tailscale
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-300">
          {processedData.uniquePorts.length > 0 && `${processedData.uniquePorts.length} ports`}
        </div>
      </footer>
    </div>
  );
});

NetworkNode.displayName = 'NetworkNode';

export default NetworkNode;