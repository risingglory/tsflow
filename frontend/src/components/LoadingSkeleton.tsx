interface LoadingSkeletonProps {
  count?: number
  className?: string
  height?: string
  width?: string
}

export function LoadingSkeleton({ 
  count = 1, 
  className = '', 
  height = 'h-4',
  width = 'w-full'
}: LoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${height} ${width} ${className}`}
          role="status"
          aria-label="Loading"
        >
          <span className="sr-only">Loading...</span>
        </div>
      ))}
    </>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <div className="flex items-center mb-2">
        <LoadingSkeleton height="h-5" width="w-5" className="mr-2" />
        <LoadingSkeleton height="h-4" width="w-24" />
      </div>
      <LoadingSkeleton height="h-8" width="w-16" className="mb-2" />
      <LoadingSkeleton height="h-3" width="w-32" />
    </div>
  )
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      <td className="px-6 py-4">
        <LoadingSkeleton height="h-4" width="w-32" />
      </td>
      <td className="px-6 py-4">
        <LoadingSkeleton height="h-4" width="w-40" />
      </td>
      <td className="px-6 py-4">
        <LoadingSkeleton height="h-4" width="w-40" />
      </td>
      <td className="px-6 py-4">
        <LoadingSkeleton height="h-6" width="w-16" />
      </td>
      <td className="px-6 py-4">
        <LoadingSkeleton height="h-6" width="w-20" />
      </td>
      <td className="px-6 py-4">
        <LoadingSkeleton height="h-4" width="w-24" />
      </td>
      <td className="px-6 py-4">
        <LoadingSkeleton height="h-4" width="w-24" />
      </td>
      <td className="px-6 py-4">
        <LoadingSkeleton height="h-4" width="w-20" />
      </td>
    </tr>
  )
}

export function DeviceListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div 
          key={index}
          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <div className="flex items-center space-x-4">
            <LoadingSkeleton height="h-3" width="w-3" className="rounded-full" />
            <div>
              <LoadingSkeleton height="h-4" width="w-32" className="mb-2" />
              <LoadingSkeleton height="h-3" width="w-48" />
            </div>
          </div>
          <div className="text-right">
            <LoadingSkeleton height="h-3" width="w-20" className="mb-2" />
          </div>
        </div>
      ))}
    </div>
  )
}