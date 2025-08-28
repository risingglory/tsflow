import React, { 
  useCallback, 
  useEffect, 
  useMemo, 
  useState, 
  useRef,
  Suspense,
  createContext,
  useContext
} from 'react';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ConnectionMode,
  NodeMouseHandler,
  EdgeMouseHandler,
  OnConnect,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import NetworkNode, { NetworkNodeData } from './NetworkNode';
import NetworkEdge, { NetworkLinkData } from './NetworkEdge';
import { useElkLayout } from '../hooks/useElkLayout';
import { useForceLayout } from '../hooks/useForceLayout';
import { useTheme } from '../contexts/ThemeContext';

// Original interfaces from the D3 version
interface OriginalNetworkNode {
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

interface NetworkLink {
  source: string | OriginalNetworkNode;
  target: string | OriginalNetworkNode;
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

interface ReactFlowGraphProps {
  nodes: OriginalNetworkNode[];
  links: NetworkLink[];
  devices: unknown[];
  onNodeClick: (node: OriginalNetworkNode) => void;
  onLinkClick: (link: NetworkLink) => void;
  onBackgroundClick: () => void;
  selectedNode?: OriginalNetworkNode | null;
  selectedLink?: NetworkLink | null;
}

// Selection context for highlighting state
interface SelectionContextType {
  highlightedNodes: Set<string>;
  highlightedEdges: Set<string>;
  selectedNode?: OriginalNetworkNode | null;
  selectedLink?: NetworkLink | null;
}

const SelectionContext = createContext<SelectionContextType>({
  highlightedNodes: new Set(),
  highlightedEdges: new Set(),
  selectedNode: null,
  selectedLink: null,
});

export const useSelection = () => useContext(SelectionContext);

// Enhanced node and edge types with proper typing
const nodeTypes = {
  networkDevice: NetworkNode,
} as any;

const edgeTypes = {
  networkConnection: NetworkEdge,
} as any;

// Loading spinner component
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center w-full h-full bg-gray-50 dark:bg-gray-900">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p className="text-sm text-gray-600 dark:text-gray-400">Calculating layout...</p>
    </div>
  </div>
);

// Error boundary component
const ErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({ error, resetError }) => (
  <div className="flex items-center justify-center w-full h-full bg-red-50 dark:bg-red-900/20">
    <div className="text-center p-6">
      <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
        Network Visualization Error
      </h3>
      <p className="text-sm text-red-600 dark:text-red-300 mb-4">
        {error.message || 'Something went wrong while rendering the network graph.'}
      </p>
      <button
        onClick={resetError}
        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  </div>
);

const ReactFlowGraphInner: React.FC<ReactFlowGraphProps> = ({
  nodes: inputNodes,
  links: inputLinks,
  devices: _devices,
  onNodeClick,
  onLinkClick,
  onBackgroundClick,
  selectedNode,
  selectedLink,
}) => {
  const { effectiveTheme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [_isLayouting, setIsLayouting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  
  const { getLayoutedElements } = useElkLayout();
  const { getLayoutedElements: getForceLayoutedElements } = useForceLayout();
  const reactFlowInstance = useReactFlow();
  const fitViewTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Simplified selection highlighting using className instead of style updates
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());

  // Memoize traffic statistics
  const trafficStats = useMemo(() => {
    const totalBytes = inputLinks.reduce((sum, link) => sum + link.totalBytes, 0);
    const virtualBytes = inputLinks
      .filter(link => link.trafficType === 'virtual')
      .reduce((sum, link) => sum + link.totalBytes, 0);
    const subnetBytes = inputLinks
      .filter(link => link.trafficType === 'subnet')
      .reduce((sum, link) => sum + link.totalBytes, 0);
    const physicalBytes = inputLinks
      .filter(link => link.trafficType === 'physical')
      .reduce((sum, link) => sum + link.totalBytes, 0);

    return {
      totalBytes,
      virtualBytes,
      subnetBytes,
      physicalBytes,
      nodeCount: inputNodes.length,
      linkCount: inputLinks.length,
    };
  }, [inputNodes, inputLinks]);

  // Track if this is initial load vs selection change
  const isInitialLoadRef = useRef(true);

  // Convert input data to React Flow format with error handling
  const convertToReactFlowFormat = useCallback(async (shouldFitView = false) => {
    if (inputNodes.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    setIsLayouting(true);
    setError(null);

    try {
      // Convert nodes with enhanced data
      // @ts-ignore - Suppress React Flow typing issues temporarily
      const reactFlowNodes = inputNodes.map((node) => ({
        id: node.id,
        type: 'networkDevice',
        position: { x: 0, y: 0 }, // Will be set by layout
        data: {
          ...node,
          // Add computed properties for better rendering
          isHighTraffic: node.totalBytes > trafficStats.totalBytes / inputNodes.length,
          connectionDensity: node.connections / Math.max(inputNodes.length - 1, 1),
        } as NetworkNodeData,
        selected: selectedNode?.id === node.id,
        draggable: true,
        selectable: true,
      }));

      // Convert edges with enhanced data
      // @ts-ignore - Suppress React Flow typing issues temporarily
      const reactFlowEdges = inputLinks.map((link, index) => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        
        return {
          id: `edge-${sourceId}-${targetId}-${index}`,
          source: sourceId,
          target: targetId,
          type: 'networkConnection',
          animated: false, // Disable animation on edges
          data: {
            ...link,
            source: sourceId,
            target: targetId,
            // Add relative traffic importance
            trafficRatio: trafficStats.totalBytes > 0 ? link.totalBytes / trafficStats.totalBytes : 0,
          } as NetworkLinkData,
          selected: !!(selectedLink && 
            (typeof selectedLink.source === 'string' ? selectedLink.source : selectedLink.source.id) === sourceId &&
            (typeof selectedLink.target === 'string' ? selectedLink.target : selectedLink.target.id) === targetId),
        };
      });

      // Apply ELK layout with retry mechanism
      let layoutAttempts = 0;
      const maxAttempts = 3;
      
      while (layoutAttempts < maxAttempts) {
        try {
          const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
            reactFlowNodes,
            reactFlowEdges,
            {
              nodeSpacing: 200, // Reasonable spacing
              algorithm: 'layered', // Back to layered with clustering optimizations
            }
          );

          // Use floating connection points - React Flow will calculate optimal positions
          setNodes(layoutedNodes);
          setEdges(layoutedEdges);
          setLastUpdateTime(Date.now());
          
          // Only fit view on initial load or when explicitly requested
          if (shouldFitView) {
            if (fitViewTimeoutRef.current) {
              clearTimeout(fitViewTimeoutRef.current);
            }
            fitViewTimeoutRef.current = setTimeout(() => {
              reactFlowInstance.fitView({ 
                padding: 0.15, 
                duration: 800,
                maxZoom: 0.8 // Don't zoom in too much initially
              });
            }, 100);
          }
          
          break;
        } catch (layoutError) {
          layoutAttempts++;
          console.warn(`Layout attempt ${layoutAttempts} failed:`, layoutError);
          
          if (layoutAttempts >= maxAttempts) {
            // Try force-directed layout as primary fallback
            console.log('ELK layout failed, trying force-directed layout');
            try {
              const { nodes: forceNodes, edges: forceEdges } = getForceLayoutedElements(
                reactFlowNodes,
                reactFlowEdges,
                {
                  strength: -400,
                  distance: 350,
                  iterations: 100,
                  collisionRadius: 200,
                }
              );
              setNodes(forceNodes);
              setEdges(forceEdges);
              setLastUpdateTime(Date.now());
              console.log('Force-directed layout applied successfully');
            } catch (forceError) {
              // Final fallback to grid layout
              console.log('Force layout failed, using grid layout fallback');
              const gridSize = Math.ceil(Math.sqrt(reactFlowNodes.length));
              const nodeSpacing = 450;
              const layerSpacing = 350;
              const fallbackNodes = reactFlowNodes.map((node, index) => ({
                ...node,
                position: {
                  x: (index % gridSize) * nodeSpacing + (Math.random() - 0.5) * 30,
                  y: Math.floor(index / gridSize) * layerSpacing + (Math.random() - 0.5) * 30,
                },
              }));
              
              setNodes(fallbackNodes);
              setEdges(reactFlowEdges);
              setLastUpdateTime(Date.now());
            }
          }
        }
      }
    } catch (conversionError) {
      console.error('Error converting data to React Flow format:', conversionError);
      setError(conversionError as Error);
    } finally {
      setIsLayouting(false);
    }
  }, [inputNodes, inputLinks, selectedNode, selectedLink, getLayoutedElements, getForceLayoutedElements, setNodes, setEdges, trafficStats, reactFlowInstance]);

  // Update React Flow data when input data changes with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const shouldFitView = isInitialLoadRef.current;
      convertToReactFlowFormat(shouldFitView);
      isInitialLoadRef.current = false;
    }, 100); // Debounce updates

    return () => clearTimeout(timeoutId);
  }, [convertToReactFlowFormat]);

  // Reset initial load flag when input nodes/links change (new data loaded)
  useEffect(() => {
    isInitialLoadRef.current = true;
  }, [inputNodes.length, inputLinks.length]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fitViewTimeoutRef.current) {
        clearTimeout(fitViewTimeoutRef.current);
      }
    };
  }, []);

  // Enhanced node click handler with error boundary
  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    try {
      const originalNode = inputNodes.find(n => n.id === node.id);
      if (originalNode) {
        onNodeClick(originalNode);
      }
    } catch (error) {
      console.error('Error handling node click:', error);
    }
  }, [inputNodes, onNodeClick]);

  // Enhanced edge click handler with error boundary  
  const handleEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    try {
      const originalLink = inputLinks.find(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return edge.source === sourceId && edge.target === targetId;
      });
      if (originalLink) {
        onLinkClick(originalLink);
      }
    } catch (error) {
      console.error('Error handling edge click:', error);
    }
  }, [inputLinks, onLinkClick]);

  // Handle background clicks
  const handlePaneClick = useCallback(() => {
    try {
      onBackgroundClick();
    } catch (error) {
      console.error('Error handling background click:', error);
    }
  }, [onBackgroundClick]);

  // Handle connections (for future features)
  const onConnect: OnConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );


  // Focus zoom on selected nodes and their connections
  const focusOnSelection = useCallback((nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    
    const nodesToFit = nodes.filter(node => nodeIds.includes(node.id));
    if (nodesToFit.length === 0) return;

    // Calculate bounding box of selected nodes with padding
    const padding = 200; // Extra space around selection
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    nodesToFit.forEach(node => {
      const nodeWidth = (node.width || 280);
      const nodeHeight = (node.height || 140);
      
      minX = Math.min(minX, node.position.x - nodeWidth / 2);
      minY = Math.min(minY, node.position.y - nodeHeight / 2);
      maxX = Math.max(maxX, node.position.x + nodeWidth / 2);
      maxY = Math.max(maxY, node.position.y + nodeHeight / 2);
    });
    
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;
    
    // Focus on the selection with smooth animation
    reactFlowInstance.fitBounds(
      {
        x: minX - padding,
        y: minY - padding,
        width,
        height,
      },
      {
        duration: 600,
        padding: 0.1,
      }
    );
  }, [nodes, reactFlowInstance]);

  // Update highlighting when selection changes
  useEffect(() => {
    if (selectedNode) {
      const connectedNodeIds = new Set<string>([selectedNode.id]);
      const connectedEdgeIds = new Set<string>();
      
      edges.forEach(edge => {
        if (edge.source === selectedNode.id || edge.target === selectedNode.id) {
          connectedEdgeIds.add(edge.id);
          connectedNodeIds.add(edge.source);
          connectedNodeIds.add(edge.target);
        }
      });
      
      setHighlightedNodes(connectedNodeIds);
      setHighlightedEdges(connectedEdgeIds);
      
      // Focus on selected node and its connections
      focusOnSelection(Array.from(connectedNodeIds));
    } else if (selectedLink) {
      const sourceId = typeof selectedLink.source === 'string' ? selectedLink.source : selectedLink.source.id;
      const targetId = typeof selectedLink.target === 'string' ? selectedLink.target : selectedLink.target.id;
      
      const selectedEdgeId = edges.find(edge => 
        edge.source === sourceId && edge.target === targetId
      )?.id;
      
      setHighlightedNodes(new Set([sourceId, targetId]));
      setHighlightedEdges(selectedEdgeId ? new Set([selectedEdgeId]) : new Set());
      
      // Focus on linked nodes
      focusOnSelection([sourceId, targetId]);
    } else {
      setHighlightedNodes(new Set());
      setHighlightedEdges(new Set());
    }
  }, [selectedNode, selectedLink, edges, focusOnSelection]);

  // Removed custom arrow markers - using clean lines without arrows

  // Format bytes for display
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Show error state
  if (error) {
    return <ErrorFallback error={error} resetError={() => setError(null)} />;
  }


  // Show empty state
  if (inputNodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-6xl mb-4">🌐</div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Network Data
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Connect to your Tailscale network to view the visualization
          </p>
        </div>
      </div>
    );
  }

  return (
    <SelectionContext.Provider value={{
      highlightedNodes,
      highlightedEdges,
      selectedNode,
      selectedLink,
    }}>
      <div className="w-full h-full relative">
        <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{
          padding: 0.15, // Increased padding for better view
          includeHiddenNodes: false,
          maxZoom: 1, // Prevent initial zoom from being too close
        }}
        minZoom={0.02} // Allow zooming out more to see large graphs
        maxZoom={3}
        preventScrolling={false} // Allow scroll for better navigation
        zoomOnScroll={true}
        panOnScroll={false}
        panOnDrag={true}
        zoomOnDoubleClick={true}
        defaultEdgeOptions={{
          style: { 
            strokeWidth: 2,
            strokeLinecap: 'round' as const,
            strokeLinejoin: 'round' as const,
          },
        }}
        connectionLineStyle={{
          strokeWidth: 3,
          stroke: '#3b82f6',
          strokeDasharray: '8,4',
          strokeLinecap: 'round' as const,
        }}
        snapToGrid={false}
        snapGrid={[15, 15]}
        proOptions={{
          hideAttribution: true,
        }}
        className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800"
      >
        <Background 
          color={effectiveTheme === 'dark' ? '#374151' : '#e5e7eb'} 
          gap={20}
          size={1}
          variant={BackgroundVariant.Dots}
        />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            const data = node.data as NetworkNodeData;
            if (data?.tags?.includes('derp')) return '#dc2626';
            if (data?.tags?.includes('tailscale')) return '#3b82f6';
            if (data?.tags?.includes('private')) return '#10b981';
            return '#f59e0b';
          }}
          maskColor={effectiveTheme === 'dark' ? 'rgba(17, 24, 39, 0.8)' : 'rgba(255, 255, 255, 0.2)'}
          style={{
            backgroundColor: effectiveTheme === 'dark' ? '#1f2937' : '#f9fafb',
          }}
          position="bottom-right"
          pannable
          zoomable
        />

        {/* Enhanced Statistics Panel */}
        <Panel position="top-left" className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Network Overview</h4>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Nodes:</span>
              <span className="font-medium">{trafficStats.nodeCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Connections:</span>
              <span className="font-medium">{trafficStats.linkCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Traffic:</span>
              <span className="font-medium">{formatBytes(trafficStats.totalBytes)}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Last updated: {new Date(lastUpdateTime).toLocaleTimeString()}
            </div>
          </div>
        </Panel>

        {/* Enhanced Legend Panel */}
        <Panel position="bottom-left" className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Traffic Types</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-0.5 bg-blue-500 rounded"></div>
                <span>Virtual</span>
              </div>
              <span className="text-gray-500 dark:text-gray-400">{formatBytes(trafficStats.virtualBytes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-0.5 bg-green-500 rounded"></div>
                <span>Subnet</span>
              </div>
              <span className="text-gray-500 dark:text-gray-400">{formatBytes(trafficStats.subnetBytes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-0.5 bg-yellow-500 rounded" style={{borderStyle: 'dashed'}}></div>
                <span>Physical</span>
              </div>
              <span className="text-gray-500 dark:text-gray-400">{formatBytes(trafficStats.physicalBytes)}</span>
            </div>
          </div>
        </Panel>

        </ReactFlow>
      </div>
    </SelectionContext.Provider>
  );
};

// Main component with React Flow Provider and error boundary
const ReactFlowGraph: React.FC<ReactFlowGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <Suspense fallback={<LoadingSpinner />}>
        <ReactFlowGraphInner {...props} />
      </Suspense>
    </ReactFlowProvider>
  );
};

export default ReactFlowGraph;