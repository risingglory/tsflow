import { Calendar, Clock } from 'lucide-react'
import * as Select from '@radix-ui/react-select'
import { useFilter, setTimeRangePreset } from '@/lib/store'
import { format } from 'date-fns'

export default function TimeRangeSelector() {
  const { filter } = useFilter()

  const presets = [
    { value: 'last-hour', label: 'Last Hour' },
    { value: 'last-day', label: 'Last 24 Hours' },
    { value: 'last-week', label: 'Last Week' },
    { value: 'custom', label: 'Custom Range' },
  ]

  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      // Handle custom range - could open a date picker modal
      return
    }
    setTimeRangePreset(value as 'last-hour' | 'last-day' | 'last-week')
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        <Calendar className="h-4 w-4" />
        <span>
          {format(filter.timeRange.start, 'MMM d, HH:mm')} - {format(filter.timeRange.end, 'MMM d, HH:mm')}
        </span>
      </div>
      
      <Select.Root
        value={filter.timeRange.preset || 'custom'}
        onValueChange={handlePresetChange}
      >
        <Select.Trigger className="btn-secondary px-3 py-2 min-w-[140px]">
          <Clock className="h-4 w-4 mr-2" />
          <Select.Value />
        </Select.Trigger>
        
        <Select.Portal>
          <Select.Content className="bg-white rounded-lg shadow-lg border border-gray-200 p-1 z-50">
            <Select.Viewport>
              {presets.map((preset) => (
                <Select.Item
                  key={preset.value}
                  value={preset.value}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 rounded"
                >
                  <Select.ItemText>{preset.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  )
} 