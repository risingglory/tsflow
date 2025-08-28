import { memo, useMemo } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react';
import { useSelection } from './ReactFlowGraph';

export interface NetworkLinkData extends Record<string, unknown> {
  source: string;
  target: string;
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

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatPackets = (packets: number): string => {
  if (packets < 1000) return packets.toString();
  if (packets < 1000000) return `${(packets / 1000).toFixed(1)}K`;
  return `${(packets / 1000000).toFixed(1)}M`;
};

const NetworkEdge = memo<EdgeProps>(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Get highlighting state from context
  const linkData = data as NetworkLinkData;
  const { highlightedEdges, selectedNode, selectedLink } = useSelection();
  const isHighlighted = highlightedEdges.has(id) || selected;
  const isSelectedLink = selectedLink && 
    (typeof selectedLink.source === 'string' ? selectedLink.source : selectedLink.source.id) === linkData.source &&
    (typeof selectedLink.target === 'string' ? selectedLink.target : selectedLink.target.id) === linkData.target;
  const isSelected = isSelectedLink || selected;
  const hasSelection = selectedNode !== null || selectedLink !== null;
  const isDimmed = hasSelection && !isHighlighted;

  // Memoize edge styling calculations
  const edgeStyle = useMemo(() => {
    if (!data) return { color: '#6b7280', width: 2, opacity: 0.6 };
    
    const linkData = data as NetworkLinkData;

    // Get edge color based on traffic type
    const getEdgeColor = () => {
      switch (linkData.trafficType) {
        case 'virtual': return '#3b82f6'; // Blue for Tailscale virtual traffic
        case 'subnet': return '#10b981';  // Green for subnet traffic  
        case 'physical': return '#f59e0b'; // Amber for physical traffic
        default: return '#6b7280';        // Gray for unknown
      }
    };

    // Calculate stroke width based on traffic volume with better scaling
    const getStrokeWidth = () => {
      if (!linkData.totalBytes) return 2;
      const baseWidth = Math.max(2, Math.min(Math.log10(linkData.totalBytes + 1) * 1.5, 12));
      return isSelected ? baseWidth * 1.5 : isHighlighted ? baseWidth * 1.2 : baseWidth;
    };

    // Calculate opacity based on selection state
    const getOpacity = () => {
      if (isSelected) return 1;
      if (isHighlighted) return 0.9;
      if (isDimmed) return 0.1;
      return 0.6;
    };

    return {
      color: getEdgeColor(),
      width: getStrokeWidth(),
      opacity: getOpacity(),
    };
  }, [data, selected, isHighlighted, isSelected, isDimmed]);

  // Memoize formatted data for labels
  const formattedData = useMemo(() => {
    if (!data) return null;
    
    const linkData = data as NetworkLinkData;
    
    return {
      bytes: formatBytes(linkData.totalBytes),
      packets: formatPackets(linkData.packets),
      protocol: linkData.protocol,
      trafficType: linkData.trafficType,
      // Calculate traffic direction indicators
      txPercentage: linkData.totalBytes > 0 ? (linkData.txBytes / linkData.totalBytes) * 100 : 0,
      rxPercentage: linkData.totalBytes > 0 ? (linkData.rxBytes / linkData.totalBytes) * 100 : 0,
    };
  }, [data]);

  // Get traffic type display properties
  const trafficTypeProps = useMemo(() => {
    if (!data) return { icon: '📡', label: 'Unknown' };
    
    const linkData = data as NetworkLinkData;
    
    switch (linkData.trafficType) {
      case 'virtual': return { icon: '🔗', label: 'Virtual' };
      case 'subnet': return { icon: '🌐', label: 'Subnet' };
      case 'physical': return { icon: '📡', label: 'Physical' };
      default: return { icon: '📡', label: 'Unknown' };
    }
  }, [data]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: isSelected ? '#3b82f6' : edgeStyle.color,
          strokeWidth: edgeStyle.width,
          strokeOpacity: edgeStyle.opacity,
          strokeDasharray: (data as NetworkLinkData)?.trafficType === 'physical' ? '8,4' : undefined,
          filter: isSelected ? 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))' : 
                  isDimmed ? 'grayscale(80%)' : undefined,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          transition: 'stroke-opacity 0.15s ease-out, filter 0.15s ease-out',
        }}
      />
      
      {/* Enhanced edge label with traffic information */}
      {data && selected && formattedData && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelX}px,${labelY - 15}px)`,
              pointerEvents: 'none',
              zIndex: 1000,
            }}
            className="nodrag nopan"
          >
            <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-3 min-w-[120px]">
              {/* Main traffic info */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm" style={{ color: edgeStyle.color }}>
                  {formattedData.bytes}
                </span>
                <span className="text-xs text-gray-500">
                  {trafficTypeProps.icon}
                </span>
              </div>
              
              {/* Traffic type and protocol */}
              <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                <span className="font-medium">{formattedData.protocol}</span>
                <span>{trafficTypeProps.label}</span>
              </div>
              
              {/* Packet count */}
              {formattedData.packets !== '0' && (
                <div className="text-xs text-gray-500 mb-2">
                  📦 {formattedData.packets} packets
                </div>
              )}
              
              {/* Traffic direction indicator */}
              {(data as NetworkLinkData).txBytes > 0 || (data as NetworkLinkData).rxBytes > 0 ? (
                <div className="space-y-1">
                  <div className="text-xs text-gray-500">Traffic Flow:</div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-blue-600">
                      ↑ {formatBytes((data as NetworkLinkData).txBytes)}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-green-600">
                      ↓ {formatBytes((data as NetworkLinkData).rxBytes)}
                    </span>
                  </div>
                  
                  {/* Visual traffic ratio bar */}
                  <div className="flex h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-500"
                      style={{ width: `${formattedData.txPercentage}%` }}
                      title={`TX: ${formattedData.txPercentage.toFixed(1)}%`}
                    />
                    <div 
                      className="bg-green-500"
                      style={{ width: `${formattedData.rxPercentage}%` }}
                      title={`RX: ${formattedData.rxPercentage.toFixed(1)}%`}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
      
    </>
  );
});

NetworkEdge.displayName = 'NetworkEdge';

export default NetworkEdge;