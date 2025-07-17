import { describe, it, expect } from 'vitest'
import { 
  isValidDevice, 
  isValidNetworkFlowLog, 
  validateDeviceResponse, 
  sanitizeSearchInput 
} from '../validation'
import type { TailscaleDevice, NetworkFlowLog } from '@/types/tailscale'

describe('validation utilities', () => {
  describe('isValidDevice', () => {
    it('returns true for valid device', () => {
      const validDevice: TailscaleDevice = {
        id: 'test-id',
        name: 'test-device',
        hostname: 'test-hostname',
        addresses: ['100.64.0.1'],
        os: 'linux',
        user: 'test-user',
        clientVersion: '1.0.0',
        updateAvailable: false,
        created: '2023-01-01T00:00:00Z',
        lastSeen: '2023-01-01T00:00:00Z',
        keyExpiryDisabled: false,
        expires: '2024-01-01T00:00:00Z',
        authorized: true,
        isExternal: false,
        machineKey: 'test-machine-key',
        nodeKey: 'test-node-key',
        blocksIncomingConnections: false,
        enabledRoutes: [],
        advertisedRoutes: [],
        clientConnectivity: {
          endpoints: [],
          derp: '',
          mappingVariesByDestIP: false,
          latency: {},
          clientSupports: {
            hairPinning: false,
            ipv6: false,
            pcp: false,
            pmp: false,
            udp: false,
            upnp: false
          }
        },
        tags: []
      }

      expect(isValidDevice(validDevice)).toBe(true)
    })

    it('returns false for invalid device (missing required fields)', () => {
      const invalidDevice = {
        id: 'test-id',
        // missing name and other required fields
      }

      expect(isValidDevice(invalidDevice)).toBe(false)
    })

    it('returns false for non-object input', () => {
      expect(isValidDevice(null)).toBe(false)
      expect(isValidDevice(undefined)).toBe(false)
      expect(isValidDevice('string')).toBe(false)
      expect(isValidDevice(123)).toBe(false)
    })
  })

  describe('isValidNetworkFlowLog', () => {
    it('returns true for valid network flow log', () => {
      const validLog: NetworkFlowLog = {
        logged: '2023-01-01T00:00:00Z',
        nodeId: 'test-node-id',
        start: '2023-01-01T00:00:00Z',
        end: '2023-01-01T00:01:00Z',
        virtualTraffic: [],
        physicalTraffic: [],
        subnetTraffic: []
      }

      expect(isValidNetworkFlowLog(validLog)).toBe(true)
    })

    it('returns false for invalid log (missing required fields)', () => {
      const invalidLog = {
        logged: '2023-01-01T00:00:00Z',
        // missing other required fields
      }

      expect(isValidNetworkFlowLog(invalidLog)).toBe(false)
    })
  })

  describe('validateDeviceResponse', () => {
    it('handles array response correctly', () => {
      const mockDevices = [
        {
          id: 'test-1',
          name: 'device-1',
          hostname: 'hostname-1',
          addresses: ['100.64.0.1'],
          os: 'linux',
          user: 'test-user',
          clientVersion: '1.0.0',
          updateAvailable: false,
          created: '2023-01-01T00:00:00Z',
          lastSeen: '2023-01-01T00:00:00Z',
          keyExpiryDisabled: false,
          expires: '2024-01-01T00:00:00Z',
          authorized: true,
          isExternal: false,
          machineKey: 'test-machine-key',
          nodeKey: 'test-node-key',
          blocksIncomingConnections: false,
          enabledRoutes: [],
          advertisedRoutes: [],
          clientConnectivity: {
            endpoints: [],
            derp: '',
            mappingVariesByDestIP: false,
            latency: {},
            clientSupports: {
              hairPinning: false,
              ipv6: false,
              pcp: false,
              pmp: false,
              udp: false,
              upnp: false
            }
          },
          tags: []
        }
      ]

      const result = validateDeviceResponse(mockDevices)
      expect(result).toEqual(mockDevices)
    })

    it('handles object with devices property', () => {
      const mockResponse = {
        devices: [
          {
            id: 'test-1',
            name: 'device-1',
            hostname: 'hostname-1',
            addresses: ['100.64.0.1'],
            os: 'linux',
            user: 'test-user',
            clientVersion: '1.0.0',
            updateAvailable: false,
            created: '2023-01-01T00:00:00Z',
            lastSeen: '2023-01-01T00:00:00Z',
            keyExpiryDisabled: false,
            expires: '2024-01-01T00:00:00Z',
            authorized: true,
            isExternal: false,
            machineKey: 'test-machine-key',
            nodeKey: 'test-node-key',
            blocksIncomingConnections: false,
            enabledRoutes: [],
            advertisedRoutes: [],
            clientConnectivity: {
              endpoints: [],
              derp: '',
              mappingVariesByDestIP: false,
              latency: {},
              clientSupports: {
                hairPinning: false,
                ipv6: false,
                pcp: false,
                pmp: false,
                udp: false,
                upnp: false
              }
            },
            tags: []
          }
        ]
      }

      const result = validateDeviceResponse(mockResponse)
      expect(result).toEqual(mockResponse.devices)
    })

    it('returns empty array for invalid input', () => {
      expect(validateDeviceResponse(null)).toEqual([])
      expect(validateDeviceResponse(undefined)).toEqual([])
      expect(validateDeviceResponse('invalid')).toEqual([])
    })
  })

  describe('sanitizeSearchInput', () => {
    it('removes HTML tags', () => {
      const input = '<script>alert("xss")</script>test'
      const result = sanitizeSearchInput(input)
      expect(result).toBe('alert(xss)test') // Script tags removed, quotes removed
    })

    it('removes dangerous characters', () => {
      const input = 'test<>"&\''
      const result = sanitizeSearchInput(input)
      expect(result).toBe('test')
    })

    it('trims whitespace', () => {
      const input = '  test  '
      const result = sanitizeSearchInput(input)
      expect(result).toBe('test')
    })

    it('handles empty string', () => {
      const result = sanitizeSearchInput('')
      expect(result).toBe('')
    })

    it('preserves safe characters', () => {
      const input = 'test123-_@.'
      const result = sanitizeSearchInput(input)
      expect(result).toBe('test123-_@.')
    })
  })
})