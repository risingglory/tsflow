import { useCallback } from 'react';
import { Node, Edge } from '@xyflow/react';
import * as d3 from 'd3';

interface ForceLayoutOptions {
  strength?: number;
  distance?: number;
  iterations?: number;
  centerForce?: number;
  collisionRadius?: number;
}

export const useForceLayout = () => {
  const getLayoutedElements = useCallback(
    (
      nodes: Node[],
      edges: Edge[],
      options: ForceLayoutOptions = {}
    ): { nodes: Node[]; edges: Edge[] } => {
      const {
        strength = -300,
        distance = 300,
        iterations = 50,
        centerForce = 0.05,
        collisionRadius = 150,
      } = options;

      // Create a copy of nodes with initial positions
      const simulationNodes = nodes.map((node, index) => ({
        ...node,
        x: node.position?.x || Math.random() * 800,
        y: node.position?.y || Math.random() * 600,
        index,
      }));

      // Create links for the simulation
      const simulationLinks = edges.map((edge) => ({
        source: simulationNodes.findIndex((n) => n.id === edge.source),
        target: simulationNodes.findIndex((n) => n.id === edge.target),
      }));

      // Create the force simulation
      const simulation = d3
        .forceSimulation(simulationNodes)
        .force(
          'link',
          d3
            .forceLink(simulationLinks)
            .distance(distance)
            .strength(0.5)
        )
        .force('charge', d3.forceManyBody().strength(strength))
        .force('center', d3.forceCenter(400, 300).strength(centerForce))
        .force(
          'collision',
          d3.forceCollide().radius(collisionRadius).strength(0.7)
        )
        .force('x', d3.forceX(400).strength(0.01))
        .force('y', d3.forceY(300).strength(0.01))
        .stop();

      // Run the simulation
      for (let i = 0; i < iterations; i++) {
        simulation.tick();
      }

      // Apply the calculated positions back to the nodes
      const layoutedNodes = nodes.map((node, index) => {
        const simNode = simulationNodes[index];
        return {
          ...node,
          position: {
            x: simNode.x || 0,
            y: simNode.y || 0,
          },
        };
      });

      return { nodes: layoutedNodes, edges };
    },
    []
  );

  return { getLayoutedElements };
};

export default useForceLayout;