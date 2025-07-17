import type { TailscaleDevice, NetworkFlowLog, TrafficFlow } from '@/types/tailscale'

// Type guards for runtime validation
export function isValidDevice(device: unknown): device is TailscaleDevice {
  if (!device || typeof device !== 'object') return false
  
  const d = device as any
  return (
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    typeof d.hostname === 'string' &&
    Array.isArray(d.addresses) &&
    typeof d.os === 'string' &&
    typeof d.lastSeen === 'string' &&
    typeof d.authorized === 'boolean'
  )
}

export function isValidNetworkFlowLog(log: unknown): log is NetworkFlowLog {
  if (!log || typeof log !== 'object') return false
  
  const l = log as any
  return (
    typeof l.logged === 'string' &&
    typeof l.nodeId === 'string' &&
    typeof l.start === 'string' &&
    typeof l.end === 'string' &&
    (l.virtualTraffic === undefined || Array.isArray(l.virtualTraffic)) &&
    (l.physicalTraffic === undefined || Array.isArray(l.physicalTraffic)) &&
    (l.subnetTraffic === undefined || Array.isArray(l.subnetTraffic))
  )
}

export function isValidTrafficFlow(flow: unknown): flow is TrafficFlow {
  if (!flow || typeof flow !== 'object') return false
  
  const f = flow as any
  return (
    typeof f.src === 'string' &&
    typeof f.dst === 'string' &&
    typeof f.proto === 'number' &&
    typeof f.rxBytes === 'number' &&
    typeof f.txBytes === 'number'
  )
}

// Validate array of items
export function validateArray<T>(
  items: unknown[],
  validator: (item: unknown) => item is T
): T[] {
  return items.filter(validator)
}

// Sanitize search input to prevent XSS
export function sanitizeSearchInput(input: string): string {
  // Remove any HTML tags and special characters that could be used for injection
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>"'&]/g, '') // Remove potentially dangerous characters
    .trim()
}

// Validate and sanitize device response
export function validateDeviceResponse(response: unknown): TailscaleDevice[] {
  if (!response || typeof response !== 'object') {
    console.warn('Invalid device response format')
    return []
  }
  
  const data = response as any
  const devices = data.devices || response
  
  if (!Array.isArray(devices)) {
    console.warn('Device response is not an array')
    return []
  }
  
  const validDevices = validateArray(devices, isValidDevice)
  
  if (validDevices.length !== devices.length) {
    console.warn(`Filtered out ${devices.length - validDevices.length} invalid devices`)
  }
  
  return validDevices
}

// Validate and sanitize network logs response
export function validateNetworkLogsResponse(response: unknown): NetworkFlowLog[] {
  if (!response) {
    return []
  }
  
  // Handle array response
  if (Array.isArray(response)) {
    const validLogs = validateArray(response, isValidNetworkFlowLog)
    if (validLogs.length !== response.length) {
      console.warn(`Filtered out ${response.length - validLogs.length} invalid network logs`)
    }
    return validLogs
  }
  
  // Handle object response with logs property
  if (typeof response === 'object' && 'logs' in (response as any)) {
    const logs = (response as any).logs
    if (Array.isArray(logs)) {
      return validateArray(logs, isValidNetworkFlowLog)
    }
  }
  
  console.warn('Invalid network logs response format')
  return []
}