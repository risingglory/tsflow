// Time range conversion utility to avoid duplication

export const getTimeRangeInMs = (timeRange: string): number => {
  switch (timeRange) {
    case '5m':
      return 5 * 60 * 1000
    case '15m':
      return 15 * 60 * 1000
    case '30m':
      return 30 * 60 * 1000
    case '1h':
      return 60 * 60 * 1000
    case '6h':
      return 6 * 60 * 60 * 1000
    case '24h':
      return 24 * 60 * 60 * 1000
    case '7d':
      return 7 * 24 * 60 * 60 * 1000
    case '30d':
      return 30 * 24 * 60 * 60 * 1000
    default:
      return 5 * 60 * 1000 // Default to 5 minutes
  }
}

export const getStartDateFromTimeRange = (timeRange: string): Date => {
  const now = new Date()
  return new Date(now.getTime() - getTimeRangeInMs(timeRange))
}

// Format date for datetime-local input
export const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}