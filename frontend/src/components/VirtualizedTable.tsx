import React, { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualizedTableProps<T> {
  data: T[]
  height: number
  rowHeight: number
  renderRow: (item: T, index: number) => React.ReactNode
  renderHeader: () => React.ReactNode
  getRowKey: (item: T, index: number) => string | number
}

export default function VirtualizedTable<T>({
  data,
  height,
  rowHeight,
  renderRow,
  renderHeader,
  getRowKey
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  })

  const items = virtualizer.getVirtualItems()

  return (
    <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg" role="region" aria-label="Virtualized table">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" role="table">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
            {renderHeader()}
          </thead>
        </table>
        
        <div
          ref={parentRef}
          className="overflow-y-auto"
          style={{ height }}
          role="rowgroup"
          tabIndex={0}
          aria-label="Table body with virtual scrolling"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            <table className="min-w-full">
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((virtualItem) => {
                  const item = data[virtualItem.index]
                  return (
                    <tr
                      key={getRowKey(item, virtualItem.index)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      {renderRow(item, virtualItem.index)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}