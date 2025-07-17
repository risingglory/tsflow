import { describe, it, expect } from 'vitest'
import { render, screen } from '@/test/utils'
import { LoadingSkeleton, CardSkeleton, TableRowSkeleton, DeviceListSkeleton } from '../LoadingSkeleton'

describe('LoadingSkeleton', () => {
  it('renders single skeleton by default', () => {
    render(<LoadingSkeleton />)
    
    const skeletons = screen.getAllByRole('status')
    expect(skeletons).toHaveLength(1)
    expect(skeletons[0]).toHaveAttribute('aria-label', 'Loading')
  })

  it('renders multiple skeletons when count is specified', () => {
    render(<LoadingSkeleton count={3} />)
    
    const skeletons = screen.getAllByRole('status')
    expect(skeletons).toHaveLength(3)
  })

  it('applies custom className', () => {
    render(<LoadingSkeleton className="custom-class" />)
    
    const skeleton = screen.getByRole('status')
    expect(skeleton).toHaveClass('custom-class')
  })

  it('applies custom height and width', () => {
    render(<LoadingSkeleton height="h-8" width="w-32" />)
    
    const skeleton = screen.getByRole('status')
    expect(skeleton).toHaveClass('h-8', 'w-32')
  })
})

describe('CardSkeleton', () => {
  it('renders card skeleton structure', () => {
    render(<CardSkeleton />)
    
    const skeletons = screen.getAllByRole('status')
    expect(skeletons.length).toBeGreaterThan(1)
    
    // Should have multiple skeleton elements for card content
    expect(skeletons.length).toBe(4) // icon, title, main content, footer
  })
})

describe('TableRowSkeleton', () => {
  it('renders table row skeleton with 8 cells', () => {
    render(
      <table>
        <tbody>
          <TableRowSkeleton />
        </tbody>
      </table>
    )
    
    const cells = screen.getAllByRole('cell')
    expect(cells).toHaveLength(8)
  })
})

describe('DeviceListSkeleton', () => {
  it('renders 5 device skeleton items by default', () => {
    render(<DeviceListSkeleton />)
    
    const deviceItems = screen.getAllByRole('status')
    // Each device item has 3 skeleton elements (status dot, name, last seen)
    expect(deviceItems.length).toBeGreaterThanOrEqual(5)
  })
})