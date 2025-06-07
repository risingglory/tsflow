import React, { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import { Search, RefreshCw, XCircle } from 'lucide-react'
import useSWR from 'swr'
import Layout from '@/components/Layout'
import { fetcher } from '@/lib/api'




interface TailscaleDevice {
  id: string
  name: string
  addresses: string[]
  os: string
  tags?: string[]
  lastSeen: string
}

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
  ips?: string[] // Track all IPs for merged devices
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

// Helper function to extract IP from address (remove port if present)
const extractIP = (address: string): string => {
  // Handle IPv6 addresses
  if (address.startsWith('[') && address.includes(']:')) {
    return address.substring(1, address.indexOf(']:'))
  }
  // Handle IPv4 addresses with ports
  const colonIndex = address.lastIndexOf(':')
  if (colonIndex > 0 && !address.includes('::')) {
    return address.substring(0, colonIndex)
  }
  return address
}

// Helper function to get protocol name
const getProtocolName = (proto: number): string => {
  switch (proto) {
    case 1: return 'ICMP'
    case 6: return 'TCP'
    case 17: return 'UDP'
    case 255: return 'Reserved'
    default: return `Proto-${proto}`
  }
}

// Helper function to categorize IP addresses
const categorizeIP = (ip: string): string[] => {
  // IPv4 Tailscale addresses
  if (ip.startsWith('100.')) return ['tailscale']
  
  // IPv6 Tailscale addresses 
  if (ip.startsWith('fd7a:115c:a1e0:')) return ['tailscale', 'ipv6']
  
  // IPv4 private addresses
  if (ip.startsWith('192.168.') || ip.startsWith('10.') || 
      (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31)) {
    return ['private']
  }
  
  // IPv6 private/link-local addresses
  if (ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
    return ['private', 'ipv6']
  }
  
  // Other IPv6 addresses
  if (ip.includes(':')) {
    return ['public', 'ipv6']
  }
  
  // Public IPv4 addresses
  return ['public']
}


// Helper function to get device name from IP
const getDeviceName = (ip: string, devices: TailscaleDevice[] = []): string => {
  const device = devices.find(d => d.addresses.includes(ip))
  return device ? device.name : ip
}


const NetworkView: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null)
  const [selectedLink, setSelectedLink] = useState<NetworkLink | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  
  // Custom time range states
  const [useCustomTimeRange, setUseCustomTimeRange] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // Filter states - Initialize with all options selected
  const [protocolFilters, setProtocolFilters] = useState<Set<string>>(new Set())
  const [trafficTypeFilters, setTrafficTypeFilters] = useState<Set<string>>(new Set())
  const [ipCategoryFilters, setIpCategoryFilters] = useState<Set<string>>(new Set())
  const [ipVersionFilter, setIpVersionFilter] = useState<string>('all') // IPv4/IPv6 filter
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>('1h')
  const [minBandwidth, setMinBandwidth] = useState<number>(0)
  const [maxBandwidth, setMaxBandwidth] = useState<number>(1000000000) // 1GB
  const [nodeCountFilter, setNodeCountFilter] = useState<number>(0) // Minimum connections

  // Fetch Tailscale devices
  const { data: deviceData, error: deviceError, mutate: refetchDevices } = useSWR('/devices', fetcher, {
    errorRetryCount: 2,
    revalidateOnFocus: false,
    refreshInterval: 60000 // Reduced from 30s to 60s
  })

  const devices = (Array.isArray(deviceData) && deviceData.length > 0 && 'name' in deviceData[0]) ? deviceData as TailscaleDevice[] : []

  // Fetch Tailscale network logs - refresh when time range changes
  const networkLogsApiUrl = useMemo(() => {
    const baseUrl = '/network-logs'
    const params = new URLSearchParams()
    
    if (useCustomTimeRange && startDate && endDate) {
      params.append('start', new Date(startDate).toISOString())
      params.append('end', new Date(endDate).toISOString())
    } else if (timeRangeFilter !== 'all') {
      // Convert time range to timestamp
      const now = new Date()
      let since: Date
      switch (timeRangeFilter) {
        case '5m':
          since = new Date(now.getTime() - 5 * 60 * 1000)
          break
        case '15m':
          since = new Date(now.getTime() - 15 * 60 * 1000)
          break
        case '30m':
          since = new Date(now.getTime() - 30 * 60 * 1000)
          break
        case '1h':
          since = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case '6h':
          since = new Date(now.getTime() - 6 * 60 * 60 * 1000)
          break
        case '24h':
          since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          since = new Date(now.getTime() - 60 * 60 * 1000) // Default to last 1h
      }
      params.append('start', since.toISOString())
      params.append('end', now.toISOString())
    }
    
    return `${baseUrl}?${params.toString()}`
  }, [timeRangeFilter, useCustomTimeRange, startDate, endDate])

  const { data: networkLogsData, error: networkLogsError, mutate: refetchNetworkLogs } = useSWR(networkLogsApiUrl, fetcher, {
    errorRetryCount: 2,
    revalidateOnFocus: false,
    refreshInterval: 120000 // Refresh every 2 minutes
  })

  const networkLogs = (Array.isArray(networkLogsData) && networkLogsData.length > 0 && 'logged' in networkLogsData[0]) ? networkLogsData : []

  // Set default date range to show most recent data (last 1 hour)
  useEffect(() => {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    
    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatForInput = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }
    
    setStartDate(formatForInput(oneHourAgo))
    setEndDate(formatForInput(now))
    setLoading(false)
  }, [])
  
  // Process network logs to create nodes and links
  const { nodes, links } = useMemo(() => {
    if (!networkLogs || networkLogs.length === 0) {
      return { nodes: [], links: [] }
    }

    const nodeMap = new Map<string, NetworkNode>()
    const linkMap = new Map<string, NetworkLink>()

    networkLogs.forEach((log: any) => {
      // Combine all traffic types into a single array
      const allTraffic = [
        ...(log.virtualTraffic || []).map((t: any) => ({ ...t, type: 'virtual' as const })),
        ...(log.subnetTraffic || []).map((t: any) => ({ ...t, type: 'subnet' as const })),
        ...(log.physicalTraffic || []).map((t: any) => ({ ...t, type: 'physical' as const, proto: t.proto || 0 }))
      ]

      allTraffic.forEach((traffic: any) => {
        const srcIP = extractIP(traffic.src)
        const dstIP = extractIP(traffic.dst)
        
        // Create or update source node (merge by device name for Tailscale devices)
        const srcDeviceName = getDeviceName(srcIP, devices)
        const srcNodeId = srcDeviceName !== srcIP ? srcDeviceName : srcIP
        if (!nodeMap.has(srcNodeId)) {
          const isTailscale = categorizeIP(srcIP).includes('tailscale')
          nodeMap.set(srcNodeId, {
            id: srcNodeId,
            ip: srcIP,
            displayName: srcDeviceName,
            nodeType: 'ip',
            totalBytes: 0,
            txBytes: 0,
            rxBytes: 0,
            connections: 0,
            tags: categorizeIP(srcIP),
            isTailscale,
            ips: [srcIP]
          })
        } else {
          // Add this IP to the existing device node if not already present
          const existingNode = nodeMap.get(srcNodeId)!
          if (!existingNode.ips?.includes(srcIP)) {
            existingNode.ips = [...(existingNode.ips || []), srcIP]
            // Update tags to include IPv6 if this IP is IPv6
            const newTags = categorizeIP(srcIP)
            newTags.forEach(tag => {
              if (!existingNode.tags.includes(tag)) {
                existingNode.tags.push(tag)
              }
            })
          }
        }
        
        // Create or update destination node (merge by device name for Tailscale devices)
        const dstDeviceName = getDeviceName(dstIP, devices)
        const dstNodeId = dstDeviceName !== dstIP ? dstDeviceName : dstIP
        if (!nodeMap.has(dstNodeId)) {
          const isTailscale = categorizeIP(dstIP).includes('tailscale')
          nodeMap.set(dstNodeId, {
            id: dstNodeId,
            ip: dstIP,
            displayName: dstDeviceName,
            nodeType: 'ip',
            totalBytes: 0,
            txBytes: 0,
            rxBytes: 0,
            connections: 0,
            tags: categorizeIP(dstIP),
            isTailscale,
            ips: [dstIP]
          })
        } else {
          // Add this IP to the existing device node if not already present
          const existingNode = nodeMap.get(dstNodeId)!
          if (!existingNode.ips?.includes(dstIP)) {
            existingNode.ips = [...(existingNode.ips || []), dstIP]
            // Update tags to include IPv6 if this IP is IPv6
            const newTags = categorizeIP(dstIP)
            newTags.forEach(tag => {
              if (!existingNode.tags.includes(tag)) {
                existingNode.tags.push(tag)
              }
            })
          }
        }

        // Update node traffic volumes
        const srcNode = nodeMap.get(srcNodeId)!
        const dstNode = nodeMap.get(dstNodeId)!
        
        // For source node: txBytes from this traffic entry
        srcNode.txBytes += traffic.txBytes || 0
        srcNode.rxBytes += traffic.rxBytes || 0
        srcNode.totalBytes = srcNode.txBytes + srcNode.rxBytes
        
        // For destination node: rxBytes from this traffic entry
        dstNode.txBytes += traffic.rxBytes || 0  // Reverse for destination
        dstNode.rxBytes += traffic.txBytes || 0  // Reverse for destination
        dstNode.totalBytes = dstNode.txBytes + dstNode.rxBytes

        // Create or update link (use device IDs instead of IPs)
        const linkKey = `${srcNodeId}->${dstNodeId}`
        
        if (!linkMap.has(linkKey)) {
          linkMap.set(linkKey, {
            source: srcNodeId,
            target: dstNodeId,
            originalSource: srcIP,
            originalTarget: dstIP,
            totalBytes: 0,
            txBytes: 0,
            rxBytes: 0,
            packets: 0,
            txPackets: 0,
            rxPackets: 0,
            protocol: getProtocolName(traffic.proto || 0),
            trafficType: traffic.type
          })
        }

        const link = linkMap.get(linkKey)!
        link.txBytes += traffic.txBytes || 0
        link.rxBytes += traffic.rxBytes || 0
        link.totalBytes = link.txBytes + link.rxBytes
        link.txPackets += traffic.txPkts || 0
        link.rxPackets += traffic.rxPkts || 0
        link.packets = link.txPackets + link.rxPackets
      })
    })

    // Update connection counts
    linkMap.forEach(link => {
      const srcNode = nodeMap.get(typeof link.source === 'string' ? link.source : link.source.id)
      const dstNode = nodeMap.get(typeof link.target === 'string' ? link.target : link.target.id)
      if (srcNode) srcNode.connections++
      if (dstNode) dstNode.connections++
    })

    return {
      nodes: Array.from(nodeMap.values()),
      links: Array.from(linkMap.values())
    }
  }, [networkLogs, devices])

  // Apply filters
  const filteredData = useMemo(() => {
    let filteredNodes = nodes.filter(node => {
      // Search filter (search both IP and display name)
      if (searchQuery && !node.ip.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !node.displayName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // IP category filter
      if (ipCategoryFilters.size > 0 && !node.tags.some(tag => ipCategoryFilters.has(tag))) {
        return false
      }

      // IP version filter (IPv4/IPv6)
      if (ipVersionFilter !== 'all') {
        const hasIPv6 = node.tags.includes('ipv6')
        if (ipVersionFilter === 'ipv4' && hasIPv6) return false
        if (ipVersionFilter === 'ipv6' && !hasIPv6) return false
      }

      // Bandwidth filter
      if (node.totalBytes < minBandwidth || node.totalBytes > maxBandwidth) {
        return false
      }

      // Connection count filter
      if (node.connections < nodeCountFilter) {
        return false
      }

        return true
      })

    let filteredLinks = links.filter(link => {
      // Protocol filter
      if (protocolFilters.size > 0 && !protocolFilters.has(link.protocol)) {
        return false
      }

      // Traffic type filter
      if (trafficTypeFilters.size > 0 && !trafficTypeFilters.has(link.trafficType)) {
        return false
      }

      // Bandwidth filter for links
      if (link.totalBytes < minBandwidth || link.totalBytes > maxBandwidth) {
        return false
      }

      // Only include links where both nodes are in filtered nodes
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      
      return filteredNodes.some(n => n.id === sourceId) && 
             filteredNodes.some(n => n.id === targetId)
    })
    
    // Remove nodes that have no connections after link filtering
    const connectedNodeIds = new Set<string>()
    filteredLinks.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id
      const targetId = typeof link.target === 'string' ? link.target : link.target.id
      connectedNodeIds.add(sourceId)
      connectedNodeIds.add(targetId)
    })
    
    filteredNodes = filteredNodes.filter(node => connectedNodeIds.has(node.id))
    
    return { nodes: filteredNodes, links: filteredLinks }
  }, [nodes, links, searchQuery, protocolFilters, trafficTypeFilters, ipCategoryFilters, ipVersionFilter, minBandwidth, maxBandwidth, nodeCountFilter])

  // D3 visualization
  useEffect(() => {
    if (!svgRef.current || filteredData.nodes.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 1200
    const height = 800
    
    svg.attr('width', width).attr('height', height)

    const g = svg.append('g')

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Group nodes by category for better clustering
    const nodesByCategory = filteredData.nodes.reduce((acc, node) => {
      const primaryTag = node.tags.find(tag => !tag.includes('+')) || 'unknown'
      if (!acc[primaryTag]) acc[primaryTag] = []
      acc[primaryTag].push(node)
      return acc
    }, {} as Record<string, typeof filteredData.nodes>)

    // Calculate category centers in a grid pattern
    const categories = Object.keys(nodesByCategory)
    const cols = Math.ceil(Math.sqrt(categories.length))
    const categoryPositions = categories.reduce((acc, category, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols
      const offsetX = (width / cols) * col + (width / cols) / 2
      const offsetY = (height / Math.ceil(categories.length / cols)) * row + (height / Math.ceil(categories.length / cols)) / 2
      acc[category] = { x: offsetX, y: offsetY }
      return acc
    }, {} as Record<string, { x: number; y: number }>)

    // Create force simulation with better spacing and clustering
    const simulation = d3.forceSimulation(filteredData.nodes)
      .force('link', d3.forceLink(filteredData.links).id((d: any) => d.id).distance(250).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-800).distanceMin(100).distanceMax(1000))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.02))
      .force('collision', d3.forceCollide().radius((d: any) => {
        const maxTextLength = Math.max(d.displayName.length, d.ip.length, 12)
        const nodeWidth = Math.max(120, Math.min(maxTextLength * 8 + 20, 200))
        return nodeWidth / 2 + 25 // More padding for better separation
      }).strength(1.0).iterations(3))
      .force('categoryX', d3.forceX().x((d: any) => {
        const primaryTag = d.tags.find((tag: string) => !tag.includes('+')) || 'unknown'
        return categoryPositions[primaryTag]?.x || width / 2
      }).strength(0.1))
      .force('categoryY', d3.forceY().y((d: any) => {
        const primaryTag = d.tags.find((tag: string) => !tag.includes('+')) || 'unknown'
        return categoryPositions[primaryTag]?.y || height / 2
      }).strength(0.1))
      .alphaDecay(0.003)
      .velocityDecay(0.7)

    // Create links
    const link = g.append('g')
      .selectAll('line')
      .data(filteredData.links)
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

    // Create nodes
    const node = g.append('g')
      .selectAll('g')
      .data(filteredData.nodes)
      .enter().append('g')
      .call(d3.drag<SVGGElement, NetworkNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
          
          // Find connected nodes and fix their positions too for cluster dragging
          const connectedNodes = new Set<string>()
          filteredData.links.forEach(l => {
            const sourceId = typeof l.source === 'string' ? l.source : l.source.id
            const targetId = typeof l.target === 'string' ? l.target : l.target.id
            if (sourceId === d.id) connectedNodes.add(targetId)
            if (targetId === d.id) connectedNodes.add(sourceId)
          })
          
          // Fix connected nodes positions relative to dragged node
          filteredData.nodes.forEach(node => {
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
          
          // Move connected nodes with the dragged node
          const connectedNodes = new Set<string>()
          filteredData.links.forEach(l => {
            const sourceId = typeof l.source === 'string' ? l.source : l.source.id
            const targetId = typeof l.target === 'string' ? l.target : l.target.id
            if (sourceId === d.id) connectedNodes.add(targetId)
            if (targetId === d.id) connectedNodes.add(sourceId)
          })
          
          filteredData.nodes.forEach(node => {
            if (connectedNodes.has(node.id) && node.fx !== null && node.fy !== null && node.fx !== undefined && node.fy !== undefined) {
              node.fx = node.fx + dx * 0.3 // Reduced influence for more natural movement
              node.fy = node.fy + dy * 0.3
            }
          })
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
          
          // Release connected nodes
          filteredData.nodes.forEach(node => {
            if (node.id !== d.id) {
              node.fx = null
              node.fy = null
            }
          })
        }))

    // Helper function to truncate text
    const truncateText = (text: string, maxLength: number) => {
      return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text
    }

    // Calculate box dimensions based on content
    const getBoxDimensions = (d: NetworkNode) => {
      const displayName = truncateText(d.displayName, 20)
      const ip = d.displayName !== d.ip ? truncateText(d.ip, 20) : ''
      const maxTextLength = Math.max(displayName.length, ip.length, 12) // minimum for traffic volume
      const width = Math.max(120, Math.min(maxTextLength * 8 + 20, 200))
      const height = 80
      return { width, height, displayName, ip }
    }

    // Add rectangles to nodes (boxes instead of circles)
    node.append('rect')
      .attr('width', (d: NetworkNode) => getBoxDimensions(d).width)
      .attr('height', (d: NetworkNode) => getBoxDimensions(d).height)
      .attr('x', (d: NetworkNode) => -getBoxDimensions(d).width / 2)
      .attr('y', (d: NetworkNode) => -getBoxDimensions(d).height / 2)
      .attr('fill', (d: NetworkNode) => {
        if (d.tags.includes('tailscale')) return '#dbeafe'
        if (d.tags.includes('private')) return '#dcfce7'
        if (d.tags.includes('ipv6')) return '#e9d5ff'
        return '#fef3c7'
      })
      .attr('stroke', (d: NetworkNode) => {
        if (d.tags.includes('tailscale')) return '#3b82f6'
        if (d.tags.includes('private')) return '#10b981'
        if (d.tags.includes('ipv6')) return '#8b5cf6'
        return '#f59e0b'
      })
      .attr('stroke-width', 2)
      .attr('rx', 8)
      .attr('ry', 8)

    // Add device name labels (primary)
    node.append('text')
      .text((d: NetworkNode) => getBoxDimensions(d).displayName)
      .attr('x', 0)
      .attr('y', -15)
        .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#1f2937')
      .style('user-select', 'none')

    // Add IP address labels (secondary, only if different from display name)
    node.append('text')
      .text((d: NetworkNode) => getBoxDimensions(d).ip)
      .attr('x', 0)
      .attr('y', -2)
            .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#6b7280')
      .style('user-select', 'none')

    // Add traffic volume labels
    node.append('text')
      .text((d: NetworkNode) => formatBytes(d.totalBytes))
      .attr('x', 0)
      .attr('y', 12)
          .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('fill', '#6b7280')
      .style('user-select', 'none')

    // Removed category tags from display as requested

    // Handle node clicks with improved hiding
    node.on('click', (_, d) => {
      setSelectedNode(d)
      setSelectedLink(null)
      
      // Get connected node IDs
      const connectedNodeIds = new Set<string>()
      filteredData.links.forEach(l => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id
        const targetId = typeof l.target === 'string' ? l.target : l.target.id
        if (sourceId === d.id) connectedNodeIds.add(targetId)
        if (targetId === d.id) connectedNodeIds.add(sourceId)
      })
      
      // Add the selected node itself
      connectedNodeIds.add(d.id)
      
      // Hide/show nodes
      node.style('opacity', (n: any) => {
        return connectedNodeIds.has(n.id) ? 1 : 0.1
      })

      // Hide/show links
      link.style('opacity', (l: any) => {
        const sourceId = typeof l.source === 'string' ? l.source : l.source.id
        const targetId = typeof l.target === 'string' ? l.target : l.target.id
        return sourceId === d.id || targetId === d.id ? 0.9 : 0.05
      })
      
      // Highlight selected node
      node.selectAll('rect')
        .attr('stroke-width', (n: any) => n.id === d.id ? 4 : 2)
    })

    // Handle link clicks with improved hiding
    link.on('click', (_, d) => {
      setSelectedLink(d)
      setSelectedNode(null)
      
      const sourceId = typeof d.source === 'string' ? d.source : d.source.id
      const targetId = typeof d.target === 'string' ? d.target : d.target.id
      
      // Get all connected nodes (both direct and indirect)
      const connectedNodeIds = new Set<string>([sourceId, targetId])
      
      filteredData.links.forEach(l => {
        const linkSourceId = typeof l.source === 'string' ? l.source : l.source.id
        const linkTargetId = typeof l.target === 'string' ? l.target : l.target.id
        if (linkSourceId === sourceId || linkSourceId === targetId) {
          connectedNodeIds.add(linkTargetId)
        }
        if (linkTargetId === sourceId || linkTargetId === targetId) {
          connectedNodeIds.add(linkSourceId)
        }
      })
      
      // Hide/show nodes
      node.style('opacity', (n: any) => connectedNodeIds.has(n.id) ? 1 : 0.1)

      // Hide/show links with better highlighting
      link.style('opacity', (l: any) => {
        const linkSourceId = typeof l.source === 'string' ? l.source : l.source.id
        const linkTargetId = typeof l.target === 'string' ? l.target : l.target.id
        if (linkSourceId === sourceId && linkTargetId === targetId) return 1.0 // Selected link
        if (connectedNodeIds.has(linkSourceId) && connectedNodeIds.has(linkTargetId)) return 0.6 // Connected links
        return 0.05 // Other links
      })
      .attr('stroke-width', (l: any) => {
        const linkSourceId = typeof l.source === 'string' ? l.source : l.source.id
        const linkTargetId = typeof l.target === 'string' ? l.target : l.target.id
        return (linkSourceId === sourceId && linkTargetId === targetId) ? 
          Math.min(Math.max(Math.log(l.totalBytes + 1) / 2, 1), 8) * 1.5 : 
          Math.min(Math.max(Math.log(l.totalBytes + 1) / 2, 1), 8)
      })
      
      // Highlight connected nodes
      node.selectAll('rect')
        .attr('stroke-width', (n: any) => connectedNodeIds.has(n.id) ? 3 : 2)
    })

    // Clear highlight on background click
    svg.on('click', (event) => {
      if (event.target === event.currentTarget) {
        setSelectedNode(null)
        setSelectedLink(null)
        
        // Reset all styling
        node.style('opacity', 1)
          .selectAll('rect')
          .attr('stroke-width', 2)
        
        link.style('opacity', 0.6)
          .attr('stroke-width', (d: any) => Math.min(Math.max(Math.log(d.totalBytes + 1) / 2, 1), 8))
      }
    })

    // Update positions on simulation tick (removed auto-fit functionality)
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: NetworkNode) => `translate(${d.x},${d.y})`)
    })

  }, [filteredData])

  const resetAllFilters = () => {
    // Clear selections
    setSelectedNode(null)
    setSelectedLink(null)
    
    // Reset search
    setSearchQuery('')
    
    // Reset time range to default
    setTimeRangeFilter('1h')
    setUseCustomTimeRange(false)
    
    // Reset all filter sets to include all options
    if (uniqueProtocols.length > 0) setProtocolFilters(new Set(uniqueProtocols))
    if (uniqueTrafficTypes.length > 0) setTrafficTypeFilters(new Set(uniqueTrafficTypes))
    if (uniqueIpCategories.length > 0) setIpCategoryFilters(new Set(uniqueIpCategories.filter(cat => cat !== 'ipv6')))
    
    // Reset other filters
    setIpVersionFilter('all')
    setMinBandwidth(0)
    setMaxBandwidth(bandwidthRange.max)
    setNodeCountFilter(0)
    
    // Reset visualization styling
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.selectAll('g').selectAll('g')
        .style('opacity', 1)
        .selectAll('rect')
        .attr('stroke-width', 2)
      
      svg.selectAll('line')
        .style('opacity', 0.6)
        .attr('stroke-width', (d: any) => Math.min(Math.max(Math.log(d.totalBytes + 1) / 2, 1), 8))
    }
  }

  const resetZoom = () => {
    if (svgRef.current && filteredData.nodes.length > 0) {
      const svg = d3.select(svgRef.current)
      const width = 1200
      const height = 800
      
      // Check if nodes have coordinates
      const nodesWithCoords = filteredData.nodes.filter(d => d.x !== undefined && d.y !== undefined)
      
      if (nodesWithCoords.length === 0) {
        // If no coordinates, just reset to center
        svg.transition().duration(750).call(
          d3.zoom<SVGSVGElement, unknown>().transform,
          d3.zoomIdentity.translate(0, 0).scale(1)
        )
        return
      }
      
      // Calculate bounding box of all nodes
      const padding = 100
      const minX = Math.min(...nodesWithCoords.map(d => d.x!)) - padding
      const maxX = Math.max(...nodesWithCoords.map(d => d.x!)) + padding
      const minY = Math.min(...nodesWithCoords.map(d => d.y!)) - padding
      const maxY = Math.max(...nodesWithCoords.map(d => d.y!)) + padding

      const dataWidth = maxX - minX
      const dataHeight = maxY - minY

      // Calculate scale to fit all data
      const scale = Math.min(width / dataWidth, height / dataHeight) * 0.8

      // Calculate translation to center the data
      const translateX = (width - dataWidth * scale) / 2 - minX * scale
      const translateY = (height - dataHeight * scale) / 2 - minY * scale

      // Apply the transform
      svg.transition().duration(750).call(
        d3.zoom<SVGSVGElement, unknown>().transform,
        d3.zoomIdentity.translate(translateX, translateY).scale(scale)
      )
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  // Get unique values for filters with common defaults
  const baseProtocols = ['TCP', 'UDP', 'ICMP', 'Proto-255', 'Proto-0'] // Added Proto-0 to base protocols
  const baseTrafficTypes = ['virtual', 'subnet', 'physical'] // All possible traffic types
  const baseIpCategories = ['tailscale', 'private', 'public'] // Common IP categories

  const dataProtocols = Array.from(new Set(links.map(l => l.protocol)))
  const dataTrafficTypes = Array.from(new Set(links.map(l => l.trafficType)))
  const dataIpCategories = Array.from(new Set(nodes.flatMap(n => n.tags).filter(tag => tag !== 'ipv6')))

  const uniqueProtocols = Array.from(new Set([...baseProtocols, ...dataProtocols]))
  const uniqueTrafficTypes = Array.from(new Set([...baseTrafficTypes, ...dataTrafficTypes]))
  const uniqueIpCategories = Array.from(new Set([...baseIpCategories, ...dataIpCategories]))

  // Initialize filters with all options selected when data loads (only once)
  const [filtersInitialized, setFiltersInitialized] = useState(false)
  
  useEffect(() => {
    if (!filtersInitialized && uniqueProtocols.length > 0 && uniqueTrafficTypes.length > 0 && uniqueIpCategories.length > 0) {
      setProtocolFilters(new Set(uniqueProtocols))
      setTrafficTypeFilters(new Set(uniqueTrafficTypes))
      setIpCategoryFilters(new Set(uniqueIpCategories.filter(cat => cat !== 'ipv6')))
      setFiltersInitialized(true)
    }
  }, [uniqueProtocols, uniqueTrafficTypes, uniqueIpCategories, filtersInitialized])

    // Calculate bandwidth range for slider
  const bandwidthRange = useMemo(() => {
    if (nodes.length === 0) return { min: 0, max: 1000000000 }
    const allBytes = nodes.map(n => n.totalBytes).filter(b => b > 0)
    if (allBytes.length === 0) return { min: 0, max: 1000000000 }
    const min = Math.min(...allBytes)
    const max = Math.max(...allBytes)
    return { min, max }
  }, [nodes])

  // Update max bandwidth when data changes
  useEffect(() => {
    setMaxBandwidth(bandwidthRange.max)
  }, [bandwidthRange.max])

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading network data...</p>
          </div>
        </div>
      </Layout>
    )
  }

  // Show error states
  if (deviceError || networkLogsError) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center max-w-lg mx-auto p-6">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Unable to Load Network Data
            </h2>
            <div className="text-gray-600 dark:text-gray-400 mb-6 space-y-2">
              {deviceError && (
                <p className="text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <strong>Device Error:</strong> {deviceError.message}
                </p>
              )}
              {networkLogsError && (
                <p className="text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <strong>Network Logs Error:</strong> {networkLogsError.message}
                </p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                This usually means your API credentials are not configured or invalid. 
                Please check your settings and ensure your API key has the necessary permissions.
              </p>
            </div>
            <div className="space-x-3">
              <button
                onClick={() => {
                  setLoading(true)
                  Promise.all([
                    refetchNetworkLogs(),
                    refetchDevices()
                  ]).finally(() => setLoading(false))
                }}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Try Again
              </button>
              <a
                href="/settings"
                className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 transition-colors"
              >
                Settings
              </a>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      networkStats={{
        nodeCount: filteredData.nodes.length,
        linkCount: filteredData.links.length,
        timeRange: timeRangeFilter
      }}
      onResetZoom={resetZoom}
      onClearSelection={resetAllFilters}
      showNetworkActions={true}
    >
      <div className="flex h-full overflow-hidden">
        {/* Filters Sidebar */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0 sticky top-0 h-screen">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Filters</h3>
            
            {/* Search */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search devices or IPs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
          </div>
          
            {/* Time Range */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Range</label>
              
              {/* Toggle for custom time range */}
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="customTimeRange"
                  checked={useCustomTimeRange}
                  onChange={(e) => setUseCustomTimeRange(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                />
                <label htmlFor="customTimeRange" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Custom Date Range
                </label>
              </div>

              {useCustomTimeRange ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Date & Time</label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Date & Time</label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex space-x-2">
                  <select
                    value={timeRangeFilter}
                    onChange={(e) => setTimeRangeFilter(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="5m">Last 5 Minutes</option>
                    <option value="15m">Last 15 Minutes</option>
                    <option value="30m">Last 30 Minutes</option>
                    <option value="1h">Last Hour</option>
                    <option value="6h">Last 6 Hours</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
              )}
            
            <button
                onClick={() => {
                  setLoading(true)
                  Promise.all([
                    refetchNetworkLogs(),
                    refetchDevices()
                  ]).finally(() => setLoading(false))
                }}
                className="mt-2 w-full flex items-center justify-center px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 transition-colors"
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Data
            </button>
        </div>

            {/* Bandwidth Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Traffic Volume: {formatBytes(minBandwidth)} - {formatBytes(maxBandwidth)}
              </label>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Minimum</label>
                  <input
                    type="range"
                    min={bandwidthRange.min}
                    max={bandwidthRange.max}
                    value={minBandwidth}
                    onChange={(e) => setMinBandwidth(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{formatBytes(bandwidthRange.min)}</span>
                    <span>{formatBytes(bandwidthRange.max)}</span>
      </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Maximum</label>
                  <input
                    type="range"
                    min={bandwidthRange.min}
                    max={bandwidthRange.max}
                    value={maxBandwidth}
                    onChange={(e) => setMaxBandwidth(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
              </div>
            </div>
            </div>

            {/* Connection Count Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Connections: {nodeCountFilter}
              </label>
              <input
                type="range"
                min={0}
                max={Math.max(10, ...nodes.map(n => n.connections))}
                value={nodeCountFilter}
                onChange={(e) => setNodeCountFilter(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>0</span>
                <span>{Math.max(10, ...nodes.map(n => n.connections))}</span>
                </div>
              </div>

            {/* Protocol Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Protocol</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {uniqueProtocols.map(protocol => (
                  <label key={protocol} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={protocolFilters.has(protocol)}
                      onChange={(e) => {
                        const newFilters = new Set(protocolFilters)
                        if (e.target.checked) {
                          newFilters.add(protocol)
                        } else {
                          newFilters.delete(protocol)
                        }
                        setProtocolFilters(newFilters)
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{protocol}</span>
                  </label>
                ))}
            </div>
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={() => setProtocolFilters(new Set(uniqueProtocols))}
                  className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
                >
                  Select all
                </button>
                {protocolFilters.size > 0 && (
                  <button
                    onClick={() => setProtocolFilters(new Set())}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  >
                    Clear all ({protocolFilters.size})
                  </button>
                )}
              </div>
            </div>

            {/* Traffic Type Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Traffic Type</label>
              <div className="space-y-2">
                {uniqueTrafficTypes.map(type => (
                  <label key={type} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={trafficTypeFilters.has(type)}
                      onChange={(e) => {
                        const newFilters = new Set(trafficTypeFilters)
                        if (e.target.checked) {
                          newFilters.add(type)
                        } else {
                          newFilters.delete(type)
                        }
                        setTrafficTypeFilters(newFilters)
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{type}</span>
                </label>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={() => setTrafficTypeFilters(new Set(uniqueTrafficTypes))}
                  className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
                >
                  Select all
                </button>
                {trafficTypeFilters.size > 0 && (
                  <button
                    onClick={() => setTrafficTypeFilters(new Set())}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  >
                    Clear all ({trafficTypeFilters.size})
                  </button>
                )}
              </div>
              </div>

            {/* IP Category Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">IP Category</label>
              <div className="space-y-2">
                {uniqueIpCategories.filter(cat => cat !== 'ipv6').map(category => (
                  <label key={category} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={ipCategoryFilters.has(category)}
                      onChange={(e) => {
                        const newFilters = new Set(ipCategoryFilters)
                        if (e.target.checked) {
                          newFilters.add(category)
                        } else {
                          newFilters.delete(category)
                        }
                        setIpCategoryFilters(newFilters)
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{category}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={() => setIpCategoryFilters(new Set(uniqueIpCategories.filter(cat => cat !== 'ipv6')))}
                  className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
                >
                  Select all
                </button>
                {ipCategoryFilters.size > 0 && (
                  <button
                    onClick={() => setIpCategoryFilters(new Set())}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  >
                    Clear all ({ipCategoryFilters.size})
                  </button>
                )}
              </div>
              </div>

            {/* IP Version Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">IP Version</label>
                <select
                value={ipVersionFilter}
                onChange={(e) => setIpVersionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">IPv4 & IPv6</option>
                <option value="ipv4">IPv4 Only</option>
                <option value="ipv6">IPv6 Only</option>
                </select>
              </div>

            {/* Filter Summary */}
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Filter Summary</h4>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                <div>Showing {filteredData.nodes.length} of {nodes.length} devices</div>
                <div>Showing {filteredData.links.length} of {links.length} flows</div>
                <div>Time: {useCustomTimeRange && startDate && endDate ? 
                  `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}` :
                  timeRangeFilter}</div>
                <div>Bandwidth: {formatBytes(minBandwidth)} - {formatBytes(maxBandwidth)}</div>
                {nodeCountFilter > 0 && <div>Min connections: {nodeCountFilter}</div>}
              </div>
              </div>
            </div>
          </div>

        {/* Main Network View */}
        <div className="flex-1">
          <svg
            ref={svgRef}
            className="w-full h-full cursor-move bg-gray-50 dark:bg-gray-900"
          />
              </div>
            
        {/* Details Sidebar */}
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto flex-shrink-0 sticky top-0 h-screen">
            {selectedNode && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Device Details</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Device Name:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono break-all">{selectedNode.displayName}</p>
                </div>
                {selectedNode.displayName !== selectedNode.ip && (
                <div>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">IP Address:</span>
                    <p className="text-sm text-gray-900 dark:text-gray-100 font-mono break-all">{selectedNode.ip}</p>
                </div>
                )}
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Traffic:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatBytes(selectedNode.totalBytes)}</p>
                </div>
                  <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Transmitted:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatBytes(selectedNode.txBytes)}</p>
                  </div>
                  <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Received:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatBytes(selectedNode.rxBytes)}</p>
                  </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Connections:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{selectedNode.connections}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Categories:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedNode.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                        {tag}
                      </span>
                    ))}
                </div>
                </div>
                </div>
              </div>
            )}

            {selectedLink && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Traffic Flow Details</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Source:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono break-all">
                    {getDeviceName(selectedLink.originalSource, devices)} ({selectedLink.originalSource})
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Destination:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono break-all">
                    {getDeviceName(selectedLink.originalTarget, devices)} ({selectedLink.originalTarget})
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Protocol:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{selectedLink.protocol}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Traffic Type:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{selectedLink.trafficType}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Bytes:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatBytes(selectedLink.totalBytes)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Transmitted:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatBytes(selectedLink.txBytes)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Received:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{formatBytes(selectedLink.rxBytes)}</p>
              </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Packets:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{selectedLink.packets.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">TX Packets:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{selectedLink.txPackets.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">RX Packets:</span>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{selectedLink.rxPackets.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {!selectedNode && !selectedLink && (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Network Overview</h3>
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="font-medium text-gray-500 dark:text-gray-400">Total Devices:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{nodes.length}</span>
        </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-500 dark:text-gray-400">Tailscale Devices:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{nodes.filter(n => n.isTailscale).length}</span>
      </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-500 dark:text-gray-400">Total Traffic Flows:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{links.length}</span>
    </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-500 dark:text-gray-400">Network Log Entries:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {networkLogs.length}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Legend</h4>
                <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
                  <div className="flex items-center">
                    <div className="w-3 h-3 border-2 border-blue-500 bg-blue-100 dark:bg-blue-900 mr-2"></div>
                    <span>Tailscale Devices</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 border-2 border-green-500 bg-green-100 dark:bg-green-900 mr-2"></div>
                    <span>Private Networks</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 border-2 border-yellow-500 bg-yellow-100 dark:bg-yellow-900 mr-2"></div>
                    <span>Public Internet</span>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Traffic Types</h4>
                  <div className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                    <div className="flex items-center">
                      <div className="w-4 h-0.5 bg-blue-500 mr-2"></div>
                      <span>Virtual Traffic</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-0.5 bg-green-500 mr-2"></div>
                      <span>Subnet Traffic</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-0.5 bg-yellow-500 mr-2"></div>
                      <span>Physical Traffic</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default NetworkView 