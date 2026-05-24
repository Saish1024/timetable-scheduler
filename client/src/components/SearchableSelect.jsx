import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { inputClass, selectClass } from '../styles/formControls'

const SearchableSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  disabled = false,
  required = false,
  className = '',
}) => {
  const listId = useId()
  const rootRef = useRef(null)
  const searchRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) =>
      option.label.toLowerCase().includes(q)
    )
  }, [options, query])

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (open) {
      searchRef.current?.focus()
    } else {
      setQuery('')
    }
  }, [open])

  const pickOption = (option) => {
    if (option.disabled) return
    onChange(option.value)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev)
        }}
        className={`${selectClass} w-full min-w-0 flex items-center justify-between gap-2 text-left ${
          disabled ? 'opacity-60 cursor-not-allowed' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400 truncate'}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-gray-400 transition ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value || ''}
          onChange={() => {}}
          className="sr-only"
        />
      )}

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <Search className="w-4 h-4 shrink-0 text-gray-400" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={`${inputClass} border-0 shadow-none focus:ring-0 px-0 py-1`}
              aria-label={searchPlaceholder}
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            className="max-h-48 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
            ) : (
              filtered.map((option) => {
                const isSelected = String(option.value) === String(value)
                return (
                  <li key={option.value} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      disabled={option.disabled}
                      onClick={() => pickOption(option)}
                      className={`w-full px-3 py-2 text-left text-sm transition ${
                        option.disabled
                          ? 'text-gray-400 cursor-not-allowed'
                          : isSelected
                            ? 'bg-indigo-50 text-indigo-800 font-medium'
                            : 'text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export default SearchableSelect
