import React, { useEffect, useRef, useCallback } from 'react'
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
  user?: string
  isTailscale: boolean
  ips?: string[]
  incomingPorts: Set<number>
  outgoingPorts: Set<number>
  protocols: Set<string>
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


  const getBoxDimensions = useCallback((d: NetworkNode) => {
    const displayName = d.displayName
    const protocols = Array.from(d.protocols).join(', ')
    
    // Get all IPs for this device (IPv4 and IPv6)
    const allIPs = d.ips || [d.ip]
    const ipv4Addresses = allIPs.filter(ip => !ip.includes(':'))
    const ipv6Addresses = allIPs.filter(ip => ip.includes(':'))
    
    const trafficText = formatBytes(d.totalBytes)
    
    // Port configuration - intelligent sizing based on port number length
    const incomingPorts = Array.from(d.incomingPorts).sort((a, b) => a - b).slice(0, 20) // Limit to 20 ports
    const outgoingPorts = Array.from(d.outgoingPorts).sort((a, b) => a - b).slice(0, 20)
    
    // Port box dimensions for pill shape (wider than tall)
    const maxPortNumLength = Math.max(
      ...incomingPorts.map(p => p.toString().length),
      ...outgoingPorts.map(p => p.toString().length),
      1
    )
    const portBoxWidth = Math.max(24, Math.min(maxPortNumLength * 8 + 8, 40)) // Smaller width for better pills
    const portBoxHeight = Math.max(10, Math.min(maxPortNumLength * 2 + 1, 12)) // Even shorter: 10-12px
    const portSpacing = 2
    
    // Combine all unique ports into single grid
    const allPorts = new Set([...incomingPorts, ...outgoingPorts])
    const uniquePorts = Array.from(allPorts).sort((a, b) => a - b)
    
    // Calculate unified port grid dimensions
    const maxPortsPerRow = Math.min(8, Math.ceil(Math.sqrt(uniquePorts.length) * 1.4))
    const portsPerRow = Math.min(maxPortsPerRow, uniquePorts.length) || 1
    const portRows = Math.ceil(uniquePorts.length / portsPerRow)
    const portGridWidth = portsPerRow * portBoxWidth + (portsPerRow - 1) * portSpacing
    const portGridHeight = portRows * portBoxHeight + (portRows - 1) * portSpacing
    
    // Calculate layout dimensions
    const deviceNameWidth = displayName.length * 7
    const trafficWidth = trafficText.length * 6
    const headerRowWidth = deviceNameWidth + trafficWidth + 20 // 20px gap between device name and traffic
    
    const ipSectionWidth = Math.max(
      Math.max(...ipv4Addresses.map(ip => (ip.length + 6) * 6), 0), // IPv4 with "IPv4: " prefix
      Math.max(...ipv6Addresses.map(ip => Math.min((ip.length + 6) * 5, 200)), 0), // IPv6 with "IPv6: " prefix
      protocols.length * 5
    )
    
    // Device tags configuration - extract tags with 'tag:' prefix
    const deviceTags = (d.tags || [])
      .filter(tag => tag && tag.startsWith('tag:'))
      .map(tag => tag.substring(4))
      .slice(0, 5) // Limit to 5 tags for display
    
    const tagBoxHeight = 18
    const tagSpacing = 4
    const tagPadding = 8
    
    // Calculate tag dimensions
    const tagWidths = deviceTags.map(tag => Math.max(40, tag.length * 7 + tagPadding * 2))
    const totalTagsWidth = tagWidths.reduce((sum, width) => sum + width, 0) + (deviceTags.length - 1) * tagSpacing
    const tagsPerRow = Math.min(3, deviceTags.length) || 1
    const tagRows = Math.ceil(deviceTags.length / tagsPerRow)
    const tagSectionHeight = deviceTags.length > 0 ? (tagRows * tagBoxHeight + (tagRows - 1) * tagSpacing + 8) : 0
    
    // Determine if we have any ports to show
    const hasAnyPorts = incomingPorts.length > 0 || outgoingPorts.length > 0
    
    // Port section calculations - only if we have ports
    let portLabelsWidth = 0
    let portLabelHeight = 0
    let portSectionHeight = 0
    
    if (hasAnyPorts) {
      portLabelsWidth = portGridWidth // Left aligned grid - no extra padding
      portLabelHeight = 0 // No traffic labels needed
      portSectionHeight = Math.max(portGridHeight, 16) // Smaller minimum height
    }
    
    const totalContentWidth = Math.max(headerRowWidth, ipSectionWidth, portLabelsWidth, totalTagsWidth, 200) // Min 200px
    const totalWidth = totalContentWidth + 24 // 12px padding on each side
    
    // Calculate height: header + IPs + tags + (port labels + ports if any) + padding - more compact
    const headerHeight = 36 // Reduced header height
    const ipSectionHeight = (ipv4Addresses.length + ipv6Addresses.length) * 12 + (protocols.length > 0 ? 12 : 0) + 8 // Tighter spacing
    const portsSectionTotalHeight = hasAnyPorts ? (portLabelHeight + portSectionHeight + 4) : 0 // Reduced port section padding
    const totalHeight = headerHeight + ipSectionHeight + tagSectionHeight + portsSectionTotalHeight + 8 // Reduced base padding
    
    return {
      width: totalWidth,
      height: Math.max(90, totalHeight), // Minimum 90px height
      displayName,
      ipv4Addresses,
      ipv6Addresses,
      protocols,
      trafficText,
      incomingPorts,
      outgoingPorts,
      portBoxWidth,
      portBoxHeight,
      portSpacing,
      uniquePorts,
      portsPerRow,
      portGridWidth,
      portGridHeight,
      headerHeight,
      ipSectionHeight,
      portLabelHeight,
      portSectionHeight,
      deviceNameWidth,
      trafficWidth,
      hasAnyPorts,
      deviceTags,
      tagWidths,
      tagBoxHeight,
      tagSpacing,
      tagSectionHeight,
      tagsPerRow
    }
  }, [])


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
        const dimensions = getBoxDimensions(node)
        return Math.max(dimensions.width, dimensions.height) / 2 + 20
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

    // Main device box
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

    // Create content inside each device box with improved layout
    node.each(function(d: NetworkNode) {
      const dimensions = getBoxDimensions(d)
      const nodeGroup = d3.select(this)
      
      const boxTop = -dimensions.height / 2
      const boxLeft = -dimensions.width / 2
      const boxRight = dimensions.width / 2
      
      const contentLeft = boxLeft + 12
      const contentRight = boxRight - 12
      
      // Header row: Device name (left) and Traffic total (right)
      nodeGroup.append('text')
        .text(dimensions.displayName)
        .attr('x', contentLeft)
        .attr('y', boxTop + 16)
        .attr('text-anchor', 'start')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#1f2937')
        .style('user-select', 'none')
        
      nodeGroup.append('text')
        .text(dimensions.trafficText)
        .attr('x', contentRight)
        .attr('y', boxTop + 16)
        .attr('text-anchor', 'end')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', '#059669')
        .style('user-select', 'none')

      // Identity row: Show user or primary tags
      const identityText = d.user ? d.user : 
        dimensions.deviceTags.length > 0 ? dimensions.deviceTags.slice(0, 2).map(tag => `tag:${tag}`).join(' ') : 
        ''
      
      if (identityText) {
        nodeGroup.append('text')
          .text(identityText)
          .attr('x', contentLeft)
          .attr('y', boxTop + 28)
          .attr('text-anchor', 'start')
          .attr('font-size', '8px')
          .attr('font-weight', 'normal')
          .attr('fill', d.user ? '#6366f1' : '#6b7280') // Blue for user, gray for tags
          .style('user-select', 'none')
      }

      let currentY = boxTop + dimensions.headerHeight

      // IP Addresses section
      let ipY = currentY
      
      // IPv4 addresses
      dimensions.ipv4Addresses.forEach((ipv4) => {
        nodeGroup.append('text')
          .text(`IPv4: ${ipv4}`)
          .attr('x', contentLeft)
          .attr('y', ipY)
          .attr('text-anchor', 'start')
          .attr('font-size', '9px')
          .attr('fill', '#2563eb') // Blue for IPv4
          .style('user-select', 'none')
        ipY += 14
      })
      
      // IPv6 addresses (truncated for display)
      dimensions.ipv6Addresses.forEach((ipv6) => {
        const truncatedIPv6 = ipv6.length > 25 ? ipv6.substring(0, 22) + '...' : ipv6
        nodeGroup.append('text')
          .text(`IPv6: ${truncatedIPv6}`)
          .attr('x', contentLeft)
          .attr('y', ipY)
          .attr('text-anchor', 'start')
          .attr('font-size', '9px')
          .attr('fill', '#7c3aed') // Purple for IPv6
          .style('user-select', 'none')
        ipY += 14
      })

      // Protocols
      if (dimensions.protocols) {
        nodeGroup.append('text')
          .text(dimensions.protocols)
          .attr('x', contentLeft)
          .attr('y', ipY)
          .attr('text-anchor', 'start')
          .attr('font-size', '8px')
          .attr('fill', '#6b7280') // Gray for protocols
          .style('user-select', 'none')
      }
      
      // Device tags section
      if (dimensions.deviceTags.length > 0) {
        const tagSectionStartY = boxTop + dimensions.headerHeight + dimensions.ipSectionHeight
        
        dimensions.deviceTags.forEach((tag, index) => {
          const row = Math.floor(index / dimensions.tagsPerRow)
          const col = index % dimensions.tagsPerRow
          
          const tagWidth = dimensions.tagWidths[index]
          let tagX = contentRight - tagWidth
          
          // Position tags from right side, stacking multiple tags
          if (dimensions.deviceTags.length > 1) {
            const rowWidth = dimensions.deviceTags
              .slice(row * dimensions.tagsPerRow, (row + 1) * dimensions.tagsPerRow)
              .reduce((sum, _, i) => sum + dimensions.tagWidths[row * dimensions.tagsPerRow + i] + (i > 0 ? dimensions.tagSpacing : 0), 0)
            
            let offsetX = 0
            for (let i = 0; i < col; i++) {
              offsetX += dimensions.tagWidths[row * dimensions.tagsPerRow + i] + dimensions.tagSpacing
            }
            tagX = contentRight - rowWidth + offsetX
          }
          
          const tagY = tagSectionStartY + row * (dimensions.tagBoxHeight + dimensions.tagSpacing)
          
          // Tag colors based on tag content
          let tagColor = '#e0e7ff'  // Default light blue
          let borderColor = '#6366f1' // Default indigo border
          let textColor = '#3730a3'   // Default dark indigo text
          
          if (tag.includes('prod') || tag.includes('production')) {
            tagColor = '#fecaca'; borderColor = '#ef4444'; textColor = '#991b1b' // Red for production
          } else if (tag.includes('dev') || tag.includes('development')) {
            tagColor = '#fde68a'; borderColor = '#f59e0b'; textColor = '#92400e' // Yellow for development
          } else if (tag.includes('staging') || tag.includes('stage')) {
            tagColor = '#fed7aa'; borderColor = '#f97316'; textColor = '#9a3412' // Orange for staging
          } else if (tag.includes('server')) {
            tagColor = '#dcfce7'; borderColor = '#10b981'; textColor = '#065f46' // Green for server
          } else if (tag.includes('k8s') || tag.includes('kubernetes')) {
            tagColor = '#e9d5ff'; borderColor = '#8b5cf6'; textColor = '#6b21a8' // Purple for k8s
          }
          
          // Tag pill shape
          nodeGroup.append('rect')
            .attr('x', tagX)
            .attr('y', tagY)
            .attr('width', tagWidth)
            .attr('height', dimensions.tagBoxHeight)
            .attr('fill', tagColor)
            .attr('stroke', borderColor)
            .attr('stroke-width', 1)
            .attr('rx', dimensions.tagBoxHeight / 2) // Fully rounded ends for pill shape
            .attr('ry', dimensions.tagBoxHeight / 2)
          
          // Tag text
          nodeGroup.append('text')
            .text(tag)
            .attr('x', tagX + tagWidth / 2)
            .attr('y', tagY + dimensions.tagBoxHeight / 2 + 3)
            .attr('text-anchor', 'middle')
            .attr('font-size', '7px')
            .attr('font-weight', 'bold')
            .attr('fill', textColor)
            .style('user-select', 'none')
        })
      }
      
      // Port section - single unified grid with port:protocol format
      if (dimensions.hasAnyPorts) {
        const portSectionTop = boxTop + dimensions.headerHeight + dimensions.ipSectionHeight + dimensions.tagSectionHeight + 8
        
        // Helper function to determine protocol for port
        const getPortProtocol = (port: number) => {
          const protocols = Array.from(d.protocols)
          // Smart protocol detection based on common ports and available protocols
          if ([53, 67, 68, 69, 123, 161, 162].includes(port) || protocols.includes('UDP')) return 'UDP'
          if ([1, 8].includes(port) || protocols.includes('ICMP')) return 'ICMP'
          return 'TCP' // Default
        }
        
        // Left align the unified port grid
        const gridStartX = contentLeft
        const gridStartY = portSectionTop
        
        // Render all unique ports in a single grid
        dimensions.uniquePorts.forEach((port, index) => {
          const row = Math.floor(index / dimensions.portsPerRow)
          const col = index % dimensions.portsPerRow
          
          const x = gridStartX + col * (dimensions.portBoxWidth + dimensions.portSpacing)
          const y = gridStartY + row * (dimensions.portBoxHeight + dimensions.portSpacing)
          
          const protocol = getPortProtocol(port)
          
          // Port pill - unified blue theme for all ports
          nodeGroup.append('rect')
            .attr('x', x)
            .attr('y', y)
            .attr('width', dimensions.portBoxWidth)
            .attr('height', dimensions.portBoxHeight)
            .attr('fill', '#dbeafe')
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 1)
            .attr('rx', dimensions.portBoxHeight / 2)
            .attr('ry', dimensions.portBoxHeight / 2)
          
          // Port:protocol text
          nodeGroup.append('text')
            .text(`${port}•${protocol}`)
            .attr('x', x + dimensions.portBoxWidth / 2)
            .attr('y', y + dimensions.portBoxHeight / 2 + 1)
            .attr('text-anchor', 'middle')
            .attr('font-size', '5px')
            .attr('font-weight', 'bold')
            .attr('fill', '#1e40af')
            .style('user-select', 'none')
        })
      }
    })

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
  }, [nodes, links, devices, onNodeClick, onLinkClick, onBackgroundClick, getBoxDimensions])

  return (
    <svg
      ref={svgRef}
      className="w-full h-full cursor-move bg-gray-50 dark:bg-gray-900"
    />
  )
}

export default NetworkGraph