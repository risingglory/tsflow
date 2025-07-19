import { useState, useRef, useEffect } from 'react'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { clsx } from 'clsx'

export default function ThemeToggle() {
  const { theme, setTheme, effectiveTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const options = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'auto' as const, label: 'System', icon: Monitor },
  ]

  const current = options.find(opt => opt.value === theme) || options[2]
  const Icon = current.icon

  useEffect(() => {
    if (!isOpen) return

    const handleClick = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        aria-label={`Current theme: ${current.label}`}
      >
        <Icon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-1 z-50">
          {options.map((option) => {
            const OptionIcon = option.icon
            const selected = theme === option.value
            
            return (
              <button
                key={option.value}
                onClick={() => {
                  setTheme(option.value)
                  setIsOpen(false)
                }}
                className={clsx(
                  'w-full px-3 py-2 text-sm text-left flex items-center justify-between',
                  'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                )}
              >
                <div className="flex items-center">
                  <OptionIcon className="w-4 h-4 mr-2" />
                  <span>{option.label}</span>
                  {option.value === 'auto' && theme === 'auto' && (
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                      ({effectiveTheme})
                    </span>
                  )}
                </div>
                {selected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}