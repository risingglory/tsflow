import { useCallback, useMemo, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import ELK, { ElkNode, LayoutOptions, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';

export interface ElkLayoutOptions {
  direction?: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';
  nodeSpacing?: number;
  layerSpacing?: number;
  algorithm?: 'layered' | 'stress' | 'mrtree' | 'radial' | 'force' | 'disco';
  aspectRatio?: number;
  considerModelOrder?: boolean;
  cycleBreaking?: 'GREEDY' | 'INTERACTIVE' | 'MODEL_ORDER';
  crossingMinimization?: 'LAYER_SWEEP' | 'INTERACTIVE' | 'GREEDY_SWITCH';
  nodePlacement?: 'BRANDES_KOEPF' | 'NETWORK_SIMPLEX' | 'LINEAR_SEGMENTS';
}

interface UseElkLayoutReturn {
  getLayoutedElements: (
    nodes: Node[],
    edges: Edge[],
    options?: ElkLayoutOptions
  ) => Promise<{ nodes: Node[]; edges: Edge[] }>;
}

const DEFAULT_NODE_WIDTH = 200;
const DEFAULT_NODE_HEIGHT = 120;
const MIN_NODE_WIDTH = 150;
const MIN_NODE_HEIGHT = 80;
const MAX_NODE_WIDTH = 400;
const MAX_NODE_HEIGHT = 300;

export const useElkLayout = (): UseElkLayoutReturn => {
  const elkInstance = useRef(new ELK());
  
  // Memoize default options to prevent recreating on every call
  const defaultOptions = useMemo<ElkLayoutOptions>(() => ({
    direction: 'DOWN',
    nodeSpacing: 250, // Further increased to prevent any overlap
    layerSpacing: 300, // Further increased for better vertical spacing
    algorithm: 'layered',
    aspectRatio: 1.6, // Slightly more compact aspect ratio
    considerModelOrder: true,
    cycleBreaking: 'GREEDY',
    crossingMinimization: 'LAYER_SWEEP',
    nodePlacement: 'NETWORK_SIMPLEX',
  }), []);

  // Enhanced node dimension calculation with better heuristics
  const calculateNodeDimensions = useCallback((node: Node) => {
    let width = DEFAULT_NODE_WIDTH;
    let height = DEFAULT_NODE_HEIGHT;

    if (node.data) {
      const data = node.data as any;
      
      // Base width calculation from display name
      const displayName = data.displayName || data.id || '';
      const baseWidth = Math.max(MIN_NODE_WIDTH, displayName.length * 8 + 40);
      
      // Calculate height based on content density
      let contentHeight = 60; // Base header height
      
      // IP addresses contribution
      const ipv4Count = data.ipv4Addresses?.length || (data.ips ? data.ips.filter((ip: string) => !ip.includes(':')).length : 1);
      const ipv6Count = data.ipv6Addresses?.length || (data.ips ? data.ips.filter((ip: string) => ip.includes(':')).length : 0);
      contentHeight += (ipv4Count + ipv6Count) * 16;
      
      // Ports contribution (grid layout)
      const incomingPorts = data.incomingPorts?.size || 0;
      const outgoingPorts = data.outgoingPorts?.size || 0;
      const totalPorts = Math.min(incomingPorts + outgoingPorts, 20); // Limit display
      if (totalPorts > 0) {
        const portsPerRow = Math.min(8, Math.ceil(Math.sqrt(totalPorts) * 1.4));
        const portRows = Math.ceil(totalPorts / portsPerRow);
        contentHeight += portRows * 18 + 10;
      }
      
      // Protocols contribution
      const protocolCount = data.protocols?.size || 0;
      if (protocolCount > 0) {
        contentHeight += 16;
      }
      
      // Tags contribution
      const tagCount = (data.tags || []).filter((tag: string) => tag?.startsWith('tag:')).length;
      if (tagCount > 0) {
        const tagsPerRow = Math.min(3, tagCount);
        const tagRows = Math.ceil(tagCount / tagsPerRow);
        contentHeight += tagRows * 22 + 8;
      }
      
      // User information
      if (data.user) {
        contentHeight += 20;
      }
      
      // Footer
      contentHeight += 25;
      
      width = Math.max(baseWidth, MIN_NODE_WIDTH);
      height = Math.max(contentHeight, MIN_NODE_HEIGHT);
      
      // Apply constraints
      width = Math.min(width, MAX_NODE_WIDTH);
      height = Math.min(height, MAX_NODE_HEIGHT);
      
      // Adjust for high-traffic or high-connection nodes
      if (data.totalBytes > 1000000) { // 1MB+
        width *= 1.1;
        height *= 1.05;
      }
      
      if (data.connections > 10) {
        width *= 1.05;
        height *= 1.1;
      }
    }

    return { width: Math.ceil(width), height: Math.ceil(height) };
  }, []);

  // Enhanced layout algorithm with better error handling and options
  const getLayoutedElements = useCallback(
    async (
      nodes: Node[],
      edges: Edge[],
      options: ElkLayoutOptions = {}
    ): Promise<{ nodes: Node[]; edges: Edge[] }> => {
      if (nodes.length === 0) {
        return { nodes: [], edges: [] };
      }

      // Merge options with defaults
      const layoutOptions: ElkLayoutOptions = { ...defaultOptions, ...options };

      // Convert layout options to ELK format with enhanced spacing
      const elkOptions: LayoutOptions = {
        'elk.algorithm': layoutOptions.algorithm!,
        'elk.direction': layoutOptions.direction!,
        'elk.spacing.nodeNode': layoutOptions.nodeSpacing!.toString(),
        'elk.layered.spacing.nodeNodeBetweenLayers': layoutOptions.layerSpacing!.toString(),
        'elk.layered.crossingMinimization.strategy': layoutOptions.crossingMinimization!,
        'elk.layered.nodePlacement.strategy': layoutOptions.nodePlacement!,
        'elk.layered.cycleBreaking.strategy': layoutOptions.cycleBreaking!,
        'elk.aspectRatio': layoutOptions.aspectRatio!.toString(),
        'elk.layered.considerModelOrder.strategy': layoutOptions.considerModelOrder! ? 'NODES_AND_EDGES' : 'NONE',
        'elk.layered.thoroughness': '10', // Increased from 7 to 10 for better quality
        'elk.layered.unnecessaryBendpoints': 'false',
        'elk.layered.nodePlacement.favorStraightEdges': 'false', // Allow curves for better flow
        'elk.layered.spacing.edgeNodeBetweenLayers': '75', // Further increased to prevent overlap
        'elk.layered.spacing.edgeEdgeBetweenLayers': '50', // Further increased
        'elk.spacing.edgeNode': '80', // Further increased
        'elk.spacing.edgeEdge': '60', // Further increased
        'elk.spacing.componentComponent': '100', // Add spacing between disconnected components
        'elk.portConstraints': 'FIXED_SIDE', // Use FIXED_SIDE for more predictable routing
        'elk.edgeRouting': 'SPLINES', // Changed from ORTHOGONAL to SPLINES for curves
        'elk.layered.compaction.connectedComponents': 'true',
        'elk.layered.compaction.postCompaction.strategy': 'NONE', // Disable post-compaction to maintain spacing
        'elk.layered.spacing.baseValue': '75', // Increased base spacing
        'elk.separateConnectedComponents': 'true', // Ensure components are separated
        'elk.padding': '[top=50,left=50,bottom=50,right=50]', // Add padding around the graph
      };

      // Create ELK graph with enhanced node data
      const elkGraph: ElkNode = {
        id: 'root',
        layoutOptions: elkOptions,
        children: nodes.map((node) => {
          const dimensions = calculateNodeDimensions(node);
          return {
            id: node.id,
            width: dimensions.width,
            height: dimensions.height,
            // Add ports for better edge routing
            ports: [
              {
                id: `${node.id}-port-north`,
                layoutOptions: {
                  'elk.port.side': 'NORTH',
                },
              },
              {
                id: `${node.id}-port-south`,
                layoutOptions: {
                  'elk.port.side': 'SOUTH',
                },
              },
              {
                id: `${node.id}-port-west`,
                layoutOptions: {
                  'elk.port.side': 'WEST',
                },
              },
              {
                id: `${node.id}-port-east`,
                layoutOptions: {
                  'elk.port.side': 'EAST',
                },
              },
            ],
          };
        }),
        edges: edges.map((edge): ElkExtendedEdge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
          // Add edge properties for better routing
          layoutOptions: {
            'elk.layered.priority.direction': 
              edge.data && (edge.data as any).trafficType === 'virtual' ? '10' : '5',
          },
        })),
      };

      try {
        // Apply layout with timeout
        const layoutPromise = elkInstance.current.layout(elkGraph);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Layout timeout after 10 seconds')), 10000);
        });

        const layoutedGraph = await Promise.race([layoutPromise, timeoutPromise]);

        // Apply layout results to nodes
        const layoutedNodes = nodes.map((node) => {
          const layoutedNode = layoutedGraph.children?.find((n: any) => n.id === node.id);
          
          if (!layoutedNode) {
            console.warn(`Layout result not found for node ${node.id}`);
            return {
              ...node,
              position: node.position || { x: 0, y: 0 },
            };
          }

          return {
            ...node,
            position: {
              x: layoutedNode.x ?? 0,
              y: layoutedNode.y ?? 0,
            },
            // Store calculated dimensions for React Flow
            width: layoutedNode.width,
            height: layoutedNode.height,
          };
        });

        // Apply any edge enhancements if needed
        const layoutedEdges = edges.map((edge) => {
          // Add any edge-specific layout results here
          return {
            ...edge,
            // Enhanced edge styling based on layout
            style: {
              ...edge.style,
            },
          };
        });

        return { nodes: layoutedNodes, edges: layoutedEdges };

      } catch (error) {
        console.error('ELK layout failed:', error);
        
        // Enhanced fallback layout strategies
        if (nodes.length <= 3) {
          // Linear layout for small graphs
          const layoutedNodes = nodes.map((node, index) => ({
            ...node,
            position: {
              x: index * (DEFAULT_NODE_WIDTH + layoutOptions.nodeSpacing!),
              y: 0,
            },
          }));
          return { nodes: layoutedNodes, edges };
        }
        
        if (nodes.length <= 9) {
          // 3x3 grid for medium graphs with proper spacing
          const gridSize = Math.ceil(Math.sqrt(nodes.length));
          const maxNodeWidth = Math.max(...nodes.map(n => calculateNodeDimensions(n).width));
          const maxNodeHeight = Math.max(...nodes.map(n => calculateNodeDimensions(n).height));
          const horizontalSpacing = maxNodeWidth + (layoutOptions.nodeSpacing || 250);
          const verticalSpacing = maxNodeHeight + (layoutOptions.layerSpacing || 300);
          
          const layoutedNodes = nodes.map((node, index) => {
            return {
              ...node,
              position: {
                x: (index % gridSize) * horizontalSpacing,
                y: Math.floor(index / gridSize) * verticalSpacing,
              },
            };
          });
          return { nodes: layoutedNodes, edges };
        }
        
        // Force-directed layout fallback for larger graphs
        const rows = Math.ceil(Math.sqrt(nodes.length * 1.5));
        const cols = Math.ceil(nodes.length / rows);
        const maxNodeWidth = Math.max(...nodes.map(n => calculateNodeDimensions(n).width));
        const maxNodeHeight = Math.max(...nodes.map(n => calculateNodeDimensions(n).height));
        const horizontalSpacing = maxNodeWidth + (layoutOptions.nodeSpacing || 250);
        const verticalSpacing = maxNodeHeight + (layoutOptions.layerSpacing || 300);
        
        const layoutedNodes = nodes.map((node, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          // Add some jitter to prevent exact overlap
          const jitterX = (Math.random() - 0.5) * 20;
          const jitterY = (Math.random() - 0.5) * 20;
          return {
            ...node,
            position: {
              x: col * horizontalSpacing + jitterX,
              y: row * verticalSpacing + jitterY,
            },
          };
        });
        
        return { nodes: layoutedNodes, edges };
      }
    },
    [defaultOptions, calculateNodeDimensions]
  );

  return { getLayoutedElements };
};

export default useElkLayout;