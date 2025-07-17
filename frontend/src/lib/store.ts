import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { NetworkFilter } from '@/types/tailscale'
import { subHours } from 'date-fns'

interface AppState {
  // Network filter state
  filter: NetworkFilter
  setFilter: (filter: Partial<NetworkFilter>) => void
  resetFilter: () => void

  // UI state
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
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

      // UI state
      sidebarOpen: false,
      setSidebarOpen: (open) =>
        set({ sidebarOpen: open }, false, 'setSidebarOpen'),
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