'use client'

import { useState, useRef, useEffect, useId } from 'react'

export interface SelectOption {
  id: string
  label: string
}

interface Props {
  options: SelectOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  label?: string
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  label,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.id === value) ?? null

  const filtered = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase())
      )
    : options

  function handleSelect(opt: SelectOption) {
    onChange(opt.id)
    setQuery('')
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    setQuery('')
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="space-y-1" ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-ink">{label}</label>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return
            setOpen((v) => !v)
            setTimeout(() => inputRef.current?.focus(), 10)
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          className={`w-full flex items-center justify-between gap-2 bg-card border rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
            disabled
              ? 'border-card-border opacity-50 cursor-not-allowed'
              : open
              ? 'border-signal ring-2 ring-signal/20'
              : 'border-card-border hover:border-ink/30'
          }`}
        >
          <span className={selected ? 'text-ink' : 'text-muted'}>
            {selected ? selected.label : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selected && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
                className="w-4 h-4 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-paper transition-colors"
                aria-label="Clear selection"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}
            <svg
              className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-card border border-card-border rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-card-border">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to filter…"
                className="w-full text-sm bg-paper rounded-lg px-3 py-2 outline-none placeholder:text-muted"
              />
            </div>
            <ul
              id={listId}
              role="listbox"
              className="max-h-52 overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted">No results</li>
              ) : (
                filtered.map((opt) => (
                  <li
                    key={opt.id}
                    role="option"
                    aria-selected={opt.id === value}
                    onClick={() => handleSelect(opt)}
                    className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                      opt.id === value
                        ? 'bg-signal/10 text-signal font-medium'
                        : 'hover:bg-paper text-ink'
                    }`}
                  >
                    {opt.label}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
