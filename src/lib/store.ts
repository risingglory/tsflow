import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { 
  NetworkFilter, 
  LayoutConfig, 
  TailscaleConfig,
  DeviceNode,
  FlowLink 
} from '@/types/tailscale'
import { subDays, subHours } from 'date-fns'

interface AppState {
  // Network filter state
  filter: NetworkFilter
  setFilter: (filter: Partial<NetworkFilter>) => void
  resetFilter: () => void

  // Layout configuration
  layoutConfig: LayoutConfig
  setLayoutConfig: (config: Partial<LayoutConfig>) => void

  // Tailscale configuration
  tailscaleConfig: Partial<TailscaleConfig>
  setTailscaleConfig: (config: Partial<TailscaleConfig>) => void

  // Selected nodes/devices
  selectedNodes: string[]
  setSelectedNodes: (nodes: string[]) => void
  toggleNodeSelection: (nodeId: string) => void
  clearSelection: () => void

  // Network topology data (derived from API data)
  networkTopology: {
    nodes: DeviceNode[]
    links: FlowLink[]
  }
  setNetworkTopology: (topology: { nodes: DeviceNode[]; links: FlowLink[] }) => void

  // UI state
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  
  // Search state
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Loading states
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Error state
  error: string | null
  setError: (error: string | null) => void
}

const createDefaultFilter = (): NetworkFilter => ({
  timeRange: {
    start: subHours(new Date(), 1),
    end: new Date(),
    preset: 'last-hour'
  },
  devices: [],
  protocols: [],
  ports: [],
  tags: [],
  trafficThreshold: {
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
    unit: 'MB'
  },
  search: ''
})

const createDefaultLayoutConfig = (): LayoutConfig => ({
  type: 'force',
  strength: 0.3,
  distance: 100,
  centerForce: 0.1,
  collisionRadius: 30
})

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      // Filter state
      filter: createDefaultFilter(),
      setFilter: (newFilter) =>
        set((state) => ({
          filter: { ...state.filter, ...newFilter }
        }), false, 'setFilter'),
      resetFilter: () =>
        set({ filter: createDefaultFilter() }, false, 'resetFilter'),

      // Layout configuration
      layoutConfig: createDefaultLayoutConfig(),
      setLayoutConfig: (config) =>
        set((state) => ({
          layoutConfig: { ...state.layoutConfig, ...config }
        }), false, 'setLayoutConfig'),

      // Tailscale configuration
      tailscaleConfig: {},
      setTailscaleConfig: (config) =>
        set((state) => ({
          tailscaleConfig: { ...state.tailscaleConfig, ...config }
        }), false, 'setTailscaleConfig'),

      // Selected nodes
      selectedNodes: [],
      setSelectedNodes: (nodes) =>
        set({ selectedNodes: nodes }, false, 'setSelectedNodes'),
      toggleNodeSelection: (nodeId) =>
        set((state) => {
          const isSelected = state.selectedNodes.includes(nodeId)
          const selectedNodes = isSelected
            ? state.selectedNodes.filter(id => id !== nodeId)
            : [...state.selectedNodes, nodeId]
          return { selectedNodes }
        }, false, 'toggleNodeSelection'),
      clearSelection: () =>
        set({ selectedNodes: [] }, false, 'clearSelection'),

      // Network topology
      networkTopology: { nodes: [], links: [] },
      setNetworkTopology: (topology) =>
        set({ networkTopology: topology }, false, 'setNetworkTopology'),

      // UI state
      sidebarOpen: false,
      setSidebarOpen: (open) =>
        set({ sidebarOpen: open }, false, 'setSidebarOpen'),

      // Search
      searchQuery: '',
      setSearchQuery: (query) =>
        set({ searchQuery: query }, false, 'setSearchQuery'),

      // Loading state
      isLoading: false,
      setIsLoading: (loading) =>
        set({ isLoading: loading }, false, 'setIsLoading'),

      // Error state
      error: null,
      setError: (error) =>
        set({ error }, false, 'setError'),
    }),
    {
      name: 'tsflow-store',
    }
  )
)

// Utility hooks
export const useFilter = () => {
  const filter = useAppStore((state) => state.filter)
  const setFilter = useAppStore((state) => state.setFilter)
  const resetFilter = useAppStore((state) => state.resetFilter)
  return { filter, setFilter, resetFilter }
}

export const useLayout = () => {
  const layoutConfig = useAppStore((state) => state.layoutConfig)
  const setLayoutConfig = useAppStore((state) => state.setLayoutConfig)
  return { layoutConfig, setLayoutConfig }
}

export const useSelection = () => {
  const selectedNodes = useAppStore((state) => state.selectedNodes)
  const setSelectedNodes = useAppStore((state) => state.setSelectedNodes)
  const toggleNodeSelection = useAppStore((state) => state.toggleNodeSelection)
  const clearSelection = useAppStore((state) => state.clearSelection)
  return { selectedNodes, setSelectedNodes, toggleNodeSelection, clearSelection }
}

export const useNetworkData = () => {
  const networkTopology = useAppStore((state) => state.networkTopology)
  const setNetworkTopology = useAppStore((state) => state.setNetworkTopology)
  return { networkTopology, setNetworkTopology }
}

// Time range helper functions
export const setTimeRangePreset = (preset: 'last-hour' | 'last-day' | 'last-week') => {
  const now = new Date()
  let start: Date

  switch (preset) {
    case 'last-hour':
      start = subHours(now, 1)
      break
    case 'last-day':
      start = subDays(now, 1)
      break
    case 'last-week':
      start = subDays(now, 7)
      break
    default:
      start = subHours(now, 1)
  }

  useAppStore.getState().setFilter({
    timeRange: { start, end: now, preset }
  })
} 