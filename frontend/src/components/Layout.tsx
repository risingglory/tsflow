import { Link, useLocation } from 'react-router-dom'
import { Network, Home, Menu, X, FileText } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { clsx } from 'clsx'
import ThemeToggle from '@/components/ThemeToggle'

interface LayoutProps {
  children: React.ReactNode
  networkStats?: {
    nodeCount: number
    linkCount: number
    timeRange?: string
  }
  onClearSelection?: () => void
  showNetworkActions?: boolean
}

export default function Layout({ children, networkStats, onClearSelection, showNetworkActions }: LayoutProps) {
  const location = useLocation()
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Network View', href: '/network', icon: Network },
    { name: 'Logs', href: '/logs', icon: FileText },
  ]

  const isCurrentPath = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setSidebarOpen(false)
            }
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  {/* Main hub node */}
                  <circle cx="10" cy="10" r="2" fill="#3B82F6"/>
                  {/* Satellite nodes */}
                  <circle cx="5" cy="5" r="1.2" fill="#10B981"/>
                  <circle cx="15" cy="5" r="1.2" fill="#10B981"/>
                  <circle cx="5" cy="15" r="1.2" fill="#10B981"/>
                  <circle cx="15" cy="15" r="1.2" fill="#10B981"/>
                  {/* Connection lines */}
                  <line x1="6.2" y1="6.2" x2="8.5" y2="8.5" stroke="#3B82F6" strokeWidth="1" strokeLinecap="round"/>
                  <line x1="13.8" y1="6.2" x2="11.5" y2="8.5" stroke="#3B82F6" strokeWidth="1" strokeLinecap="round"/>
                  <line x1="6.2" y1="13.8" x2="8.5" y2="11.5" stroke="#3B82F6" strokeWidth="1" strokeLinecap="round"/>
                  <line x1="13.8" y1="13.8" x2="11.5" y2="11.5" stroke="#3B82F6" strokeWidth="1" strokeLinecap="round"/>
                  {/* Data flow indicators */}
                  <circle cx="7.5" cy="7.5" r="0.5" fill="#F59E0B" opacity="0.9"/>
                  <circle cx="12.5" cy="7.5" r="0.5" fill="#F59E0B" opacity="0.9"/>
                  <circle cx="7.5" cy="12.5" r="0.5" fill="#F59E0B" opacity="0.9"/>
                  <circle cx="12.5" cy="12.5" r="0.5" fill="#F59E0B" opacity="0.9"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">TSFlow</h1>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto min-h-0">
            {navigation.map((item) => {
              const Icon = item.icon
              const isCurrent = isCurrentPath(item.href)
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={clsx(
                    'flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    isCurrent
                      ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  <Icon className={clsx('mr-3 h-5 w-5', isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500')} aria-hidden="true" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex-shrink-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center leading-relaxed">
              Real-time Tailscale<br />Network Analysis
            </p>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label="Open sidebar"
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            
            <div className="flex-1 flex justify-center lg:justify-start">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {navigation.find(item => isCurrentPath(item.href))?.name || 'TSFlow'}
                </h2>
                {networkStats && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {networkStats.nodeCount} IP nodes, {networkStats.linkCount} traffic flows
                    {networkStats.timeRange && networkStats.timeRange !== 'all' && ` (${networkStats.timeRange})`}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Network actions */}
              {showNetworkActions && (
                <>
                  <button
                    onClick={onClearSelection}
                    className="px-3 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                  >
                    Reset All Filters
                  </button>
                </>
              )}
              
              <ThemeToggle />
              
              <div className="flex items-center space-x-2" role="status" aria-live="polite">
                <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" aria-hidden="true"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Connected</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 bg-gray-50 dark:bg-gray-900 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
} 