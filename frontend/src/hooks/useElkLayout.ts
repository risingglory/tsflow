import { useCallback, useMemo, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import ELK, { ElkNode, LayoutOptions, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';

export interface ElkLayoutOptions {
  nodeSpacing?: number;
  algorithm?: 'layered' | 'stress' | 'mrtree' | 'radial' | 'force' | 'disco';
  // Force algorithm options
  forceModel?: 'EADES' | 'FRUCHTERMAN_REINGOLD';
  iterations?: number;
  repulsivePower?: number;
  temperature?: number;
  randomSeed?: number;
  // Stress algorithm options
  desiredEdgeLength?: number;
  stressEpsilon?: number;
  // DisCo algorithm options
  componentsSpacing?: number;
  compactionStrategy?: 'POLYOMINO';
}

interface UseElkLayoutReturn {
  getLayoutedElements: (
    nodes: Node[],
    edges: Edge[],
    options?: ElkLayoutOptions
  ) => Promise<{ nodes: Node[]; edges: Edge[] }>;
}

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 140;
const MIN_NODE_WIDTH = 240;
const MIN_NODE_HEIGHT = 120;

export const useElkLayout = (): UseElkLayoutReturn => {
  const elkInstance = useRef(new ELK());
  
  // Memoize default options to prevent recreating on every call
  const defaultOptions = useMemo<ElkLayoutOptions>(() => ({
    nodeSpacing: 200, // Reasonable spacing between nodes
    algorithm: 'layered', // Back to layered with better clustering
  }), []);

  // Enhanced node dimension calculation with dynamic text measurement
  const calculateNodeDimensions = useCallback((node: Node) => {
    if (node.width && node.height) {
      // Use dimensions from React Flow if available (set by the component)
      return { width: node.width, height: node.height };
    }
    
    let width = DEFAULT_NODE_WIDTH;
    let height = DEFAULT_NODE_HEIGHT;

    if (node.data) {
      const data = node.data as any;
      
      // Create temporary canvas for text measurement
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
      
      ctx.font = '14px Inter, system-ui, sans-serif';
      
      // Base width calculation from display name
      const displayName = data.displayName || data.id || '';
      const nameWidth = ctx.measureText(displayName).width;
      const baseWidth = Math.max(MIN_NODE_WIDTH, nameWidth + 120); // Add space for traffic info
      
      let maxWidth = baseWidth;
      let contentHeight = 60; // Base header height with margins
      
      // Calculate IP addresses width and height
      const allIPs = data.ips || [data.ip];
      const ipv4Addresses = allIPs.filter((ip: string) => !ip.includes(':'));
      const ipv6Addresses = allIPs.filter((ip: string) => ip.includes(':'));
      
      ipv4Addresses.forEach((ip: string) => {
        const ipText = `IPv4: ${ip}`;
        maxWidth = Math.max(maxWidth, ctx.measureText(ipText).width + 40);
      });
      
      ipv6Addresses.forEach((ip: string) => {
        const displayIp = ip.length > 25 ? `${ip.substring(0, 22)}...` : ip;
        const ipText = `IPv6: ${displayIp}`;
        maxWidth = Math.max(maxWidth, ctx.measureText(ipText).width + 40);
      });
      
      contentHeight += (ipv4Addresses.length + ipv6Addresses.length) * 20;
      
      // Protocols contribution
      const protocolCount = data.protocols?.size || 0;
      if (protocolCount > 0) {
        const protocolText = Array.from(data.protocols || []).join(', ');
        maxWidth = Math.max(maxWidth, ctx.measureText(`📡 ${protocolText}`).width + 40);
        contentHeight += 20;
      }
      
      // Ports contribution - calculate based on wrapping
      const incomingPorts = data.incomingPorts?.size || 0;
      const outgoingPorts = data.outgoingPorts?.size || 0;
      const totalPorts = Math.min(incomingPorts + outgoingPorts, 20);
      if (totalPorts > 0) {
        const avgPortWidth = 75; // Average width of port badges
        const estimatedWidth = Math.max(maxWidth, 300);
        const portsPerRow = Math.max(1, Math.floor(estimatedWidth / avgPortWidth));
        const portRows = Math.ceil(totalPorts / portsPerRow);
        contentHeight += (portRows * 30) + 15;
      }
      
      // Tags contribution - calculate based on wrapping with full tag names
      const deviceTags = (data.tags || [])
        .filter((tag: string) => tag && tag.startsWith('tag:'))
        .slice(0, 8); // Keep full tag names
      
      if (deviceTags.length > 0) {
        let maxTagWidth = 0;
        deviceTags.forEach((tag: string) => {
          const tagWidth = ctx.measureText(tag).width + 20; // Full tag:name needs more padding
          maxTagWidth = Math.max(maxTagWidth, tagWidth);
        });
        const avgTagWidth = 120; // Increased for full tag names
        const estimatedWidth = Math.max(maxWidth, 350);
        const tagsPerRow = Math.max(1, Math.floor(estimatedWidth / avgTagWidth));
        const tagRows = Math.ceil(deviceTags.length / tagsPerRow);
        contentHeight += (tagRows * 32) + 15;
      }
      
      // User information
      if (data.user) {
        const userText = `👤 ${data.user}`;
        maxWidth = Math.max(maxWidth, ctx.measureText(userText).width + 40);
        contentHeight += 25;
      }
      
      // Footer
      contentHeight += 40;
      
      width = Math.max(maxWidth, MIN_NODE_WIDTH);
      height = Math.max(contentHeight, MIN_NODE_HEIGHT);
      
      // No maximum constraints - fully dynamic sizing
      
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

      // Convert layout options to ELK format - dynamic based on algorithm
      const elkOptions: LayoutOptions = {
        'elk.algorithm': layoutOptions.algorithm!,
        'elk.spacing.nodeNode': layoutOptions.nodeSpacing!.toString(),
        'elk.spacing.componentComponent': (layoutOptions.componentsSpacing || 300).toString(), // Configurable cluster separation
        'elk.separateConnectedComponents': 'true', // Ensure components are separated
        'elk.padding': '[top=50,left=50,bottom=50,right=50]', // Add padding around the graph
        'elk.edgeRouting': 'SPLINES', // Smooth curves for network connections
      };

      // Add algorithm-specific options
      if (layoutOptions.algorithm === 'stress') {
        elkOptions['elk.stress.desiredEdgeLength'] = layoutOptions.desiredEdgeLength!.toString();
        elkOptions['elk.stress.epsilon'] = layoutOptions.stressEpsilon!.toString();
        elkOptions['elk.stress.iterationLimit'] = layoutOptions.iterations!.toString();
      } else if (layoutOptions.algorithm === 'force') {
        elkOptions['elk.force.model'] = layoutOptions.forceModel!;
        elkOptions['elk.force.iterations'] = layoutOptions.iterations!.toString();
        elkOptions['elk.force.repulsivePower'] = layoutOptions.repulsivePower!.toString();
        elkOptions['elk.force.temperature'] = layoutOptions.temperature!.toString();
        elkOptions['elk.randomSeed'] = layoutOptions.randomSeed!.toString();
      } else if (layoutOptions.algorithm === 'disco') {
        elkOptions['elk.disco.componentsSpacing'] = layoutOptions.componentsSpacing!.toString();
        elkOptions['elk.disco.componentCompaction.strategy'] = layoutOptions.compactionStrategy!;
      } else if (layoutOptions.algorithm === 'layered') {
        // Layered with clustering-friendly settings
        elkOptions['elk.direction'] = 'DOWN';
        elkOptions['elk.layered.spacing.nodeNodeBetweenLayers'] = '350';
        elkOptions['elk.layered.crossingMinimization.strategy'] = 'LAYER_SWEEP';
        elkOptions['elk.layered.nodePlacement.strategy'] = 'NETWORK_SIMPLEX';
        elkOptions['elk.layered.cycleBreaking.strategy'] = 'GREEDY';
        elkOptions['elk.layered.considerModelOrder.strategy'] = 'NODES_AND_EDGES';
        elkOptions['elk.layered.thoroughness'] = '15';
        elkOptions['elk.layered.compaction.connectedComponents'] = 'true';
        elkOptions['elk.layered.compaction.postCompaction.strategy'] = 'NONE';
      }

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
            // Force algorithm doesn't need fixed ports - let it position naturally
          };
        }),
        edges: edges.map((edge): ElkExtendedEdge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
          // Force algorithm handles edge routing naturally
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
          const verticalSpacing = maxNodeHeight + (layoutOptions.nodeSpacing || 300);
          
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
        const horizontalSpacing = maxNodeWidth + (layoutOptions.nodeSpacing || 400);
        const verticalSpacing = maxNodeHeight + (layoutOptions.nodeSpacing || 450);
        
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