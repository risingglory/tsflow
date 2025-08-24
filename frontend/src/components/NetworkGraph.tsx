import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface NetworkNode {
  id: string
  ip: string
  displayName: string
  nodeType: 'ip'
  totalBytes: number
  txBytes: number
  rxBytes: number
  connections: number
  tags: string[]
  isTailscale: boolean
  ips?: string[]
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface NetworkLink {
  source: string | NetworkNode
  target: string | NetworkNode
  originalSource: string
  originalTarget: string
  totalBytes: number
  txBytes: number
  rxBytes: number
  packets: number
  txPackets: number
  rxPackets: number
  protocol: string
  trafficType: 'virtual' | 'subnet' | 'physical'
}

interface NetworkGraphProps {
  nodes: NetworkNode[]
  links: NetworkLink[]
  devices: any[]
  onNodeClick: (node: NetworkNode) => void
  onLinkClick: (link: NetworkLink) => void
  onBackgroundClick: () => void
  selectedNode?: NetworkNode | null
  selectedLink?: NetworkLink | null
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({
  nodes,
  links,
  devices,
  onNodeClick,
  onLinkClick,
  onBackgroundClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text
  }

  const getBoxDimensions = (d: NetworkNode) => {
    const displayName = truncateText(d.displayName, 20)
    const ip = d.displayName !== d.ip ? truncateText(d.ip, 20) : ''
    const maxTextLength = Math.max(displayName.length, ip.length, 12)
    const width = Math.max(120, Math.min(maxTextLength * 8 + 20, 200))
    const height = 80
    return { width, height, displayName, ip }
  }


  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 1200
    const height = 800
    
    svg.attr('width', width).attr('height', height)

    const g = svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: d3.SimulationNodeDatum) => (d as NetworkNode).id).distance(200).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-800).distanceMin(120).distanceMax(600))
      .force('collision', d3.forceCollide().radius((d: d3.SimulationNodeDatum) => {
        const node = d as NetworkNode
        const maxTextLength = Math.max(node.displayName.length, node.ip.length, 12)
        const nodeWidth = Math.max(120, Math.min(maxTextLength * 8 + 20, 200))
        return nodeWidth / 2 + 35
      }).strength(1.0).iterations(3))
      .alphaDecay(0.01)
      .velocityDecay(0.85)

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', (d: NetworkLink) => {
        switch (d.trafficType) {
          case 'virtual': return '#3b82f6'
          case 'subnet': return '#10b981'
          case 'physical': return '#f59e0b'
          default: return '#6b7280'
        }
      })
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: NetworkLink) => Math.min(Math.max(Math.log(d.totalBytes + 1) / 2, 1), 8))

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .call(d3.drag<SVGGElement, NetworkNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
          
          const connectedNodes = new Set<string>()
          links.forEach(l => {
            const sourceId = typeof l.source === 'string' ? l.source : l.source.id
            const targetId = typeof l.target === 'string' ? l.target : l.target.id
            if (sourceId === d.id) connectedNodes.add(targetId)
            if (targetId === d.id) connectedNodes.add(sourceId)
          })
          
          nodes.forEach(node => {
            if (connectedNodes.has(node.id)) {
              node.fx = node.x
              node.fy = node.y
            }
          })
        })
        .on('drag', (event, d) => {
          const dx = event.x - d.x!
          const dy = event.y - d.y!
          
          d.fx = event.x
          d.fy = event.y
          
          const connectedNodes = new Set<string>()
          links.forEach(l => {
            const sourceId = typeof l.source === 'string' ? l.source : l.source.id
            const targetId = typeof l.target === 'string' ? l.target : l.target.id
            if (sourceId === d.id) connectedNodes.add(targetId)
            if (targetId === d.id) connectedNodes.add(sourceId)
          })
          
          nodes.forEach(node => {
            if (connectedNodes.has(node.id) && node.fx !== null && node.fy !== null && node.fx !== undefined && node.fy !== undefined) {
              node.fx = node.fx + dx * 0.3
              node.fy = node.fy + dy * 0.3
            }
          })
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
          
          nodes.forEach(node => {
            if (node.id !== d.id) {
              node.fx = null
              node.fy = null
            }
          })
        }))

    node.append('rect')
      .attr('width', (d: NetworkNode) => getBoxDimensions(d).width)
      .attr('height', (d: NetworkNode) => getBoxDimensions(d).height)
      .attr('x', (d: NetworkNode) => -getBoxDimensions(d).width / 2)
      .attr('y', (d: NetworkNode) => -getBoxDimensions(d).height / 2)
      .attr('fill', (d: NetworkNode) => {
        if (d.tags.includes('derp')) return '#fecaca'
        if (d.tags.includes('tailscale')) return '#dbeafe'
        if (d.tags.includes('private')) return '#dcfce7'
        if (d.tags.includes('ipv6')) return '#e9d5ff'
        return '#fef3c7'
      })
      .attr('stroke', (d: NetworkNode) => {
        if (d.tags.includes('derp')) return '#dc2626'
        if (d.tags.includes('tailscale')) return '#3b82f6'
        if (d.tags.includes('private')) return '#10b981'
        if (d.tags.includes('ipv6')) return '#8b5cf6'
        return '#f59e0b'
      })
      .attr('stroke-width', 2)
      .attr('rx', 8)
      .attr('ry', 8)

    node.append('text')
      .text((d: NetworkNode) => getBoxDimensions(d).displayName)
      .attr('x', 0)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#1f2937')
      .style('user-select', 'none')

    node.append('text')
      .text((d: NetworkNode) => getBoxDimensions(d).ip)
      .attr('x', 0)
      .attr('y', -2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#6b7280')
      .style('user-select', 'none')

    node.append('text')
      .text((d: NetworkNode) => formatBytes(d.totalBytes))
      .attr('x', 0)
      .attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', '#6b7280')
      .style('user-select', 'none')

    node.on('click', (_, d) => {
      onNodeClick(d)
      
      const connectedNodeIds = new Set<string>()
      links.forEach(l => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id
        const targetId = typeof l.target === 'string' ? l.target : l.target.id
        if (sourceId === d.id) connectedNodeIds.add(targetId)
        if (targetId === d.id) connectedNodeIds.add(sourceId)
      })
      
      connectedNodeIds.add(d.id)
      
      node.style('opacity', (n: NetworkNode) => {
        return connectedNodeIds.has(n.id) ? 1 : 0.1
      })

      link.style('opacity', (l: NetworkLink) => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id
        const targetId = typeof l.target === 'string' ? l.target : l.target.id
        return sourceId === d.id || targetId === d.id ? 0.9 : 0.05
      })
      
      node.selectAll('rect')
        .attr('stroke-width', (n: unknown) => (n as NetworkNode).id === d.id ? 4 : 2)
    })

    link.on('click', (_, d) => {
      onLinkClick(d)
      
      const sourceId = typeof d.source === 'string' ? d.source : d.source.id
      const targetId = typeof d.target === 'string' ? d.target : d.target.id
      
      const connectedNodeIds = new Set<string>([sourceId, targetId])
      
      links.forEach(l => {
        const linkSourceId = typeof l.source === 'string' ? l.source : l.source.id
        const linkTargetId = typeof l.target === 'string' ? l.target : l.target.id
        if (linkSourceId === sourceId || linkSourceId === targetId) {
          connectedNodeIds.add(linkTargetId)
        }
        if (linkTargetId === sourceId || linkTargetId === targetId) {
          connectedNodeIds.add(linkSourceId)
        }
      })
      
      node.style('opacity', (n: any) => connectedNodeIds.has(n.id) ? 1 : 0.1)

      link.style('opacity', (l: any) => {
        const linkSourceId = typeof l.source === 'string' ? l.source : l.source.id
        const linkTargetId = typeof l.target === 'string' ? l.target : l.target.id
        if (linkSourceId === sourceId && linkTargetId === targetId) return 1.0
        if (connectedNodeIds.has(linkSourceId) && connectedNodeIds.has(linkTargetId)) return 0.6
        return 0.05
      })
      .attr('stroke-width', (l: any) => {
        const linkSourceId = typeof l.source === 'string' ? l.source : l.source.id
        const linkTargetId = typeof l.target === 'string' ? l.target : l.target.id
        return (linkSourceId === sourceId && linkTargetId === targetId) ? 
          Math.min(Math.max(Math.log(l.totalBytes + 1) / 2, 1), 8) * 1.5 : 
          Math.min(Math.max(Math.log(l.totalBytes + 1) / 2, 1), 8)
      })
      
      node.selectAll('rect')
        .attr('stroke-width', (n: any) => connectedNodeIds.has(n.id) ? 3 : 2)
    })

    svg.on('click', (event) => {
      if (event.target === event.currentTarget) {
        onBackgroundClick()
        
        node.style('opacity', 1)
          .selectAll('rect')
          .attr('stroke-width', 2)
        
        link.style('opacity', 0.6)
          .attr('stroke-width', (d: any) => Math.min(Math.max(Math.log(d.totalBytes + 1) / 2, 1), 8))
      }
    })

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: NetworkNode) => `translate(${d.x},${d.y})`)
    })

    return () => {
      simulation.stop()
    }
  }, [nodes, links, devices, onNodeClick, onLinkClick, onBackgroundClick])

  return (
    <svg
      ref={svgRef}
      className="w-full h-full cursor-move bg-gray-50 dark:bg-gray-900"
    />
  )
}

export default NetworkGraph