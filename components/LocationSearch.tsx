'use client'

import { useState, useRef, useEffect, useMemo, useId } from 'react'

export interface LocationItem {
  id: string
  /** Primary label shown for the item, e.g. "Q00037 — Fred Meyer (Main entrance)" or "Costco — Tukwila" */
  primary: string
  /** Secondary line, e.g. address */
  secondary?: string
  region: string
  city: string
  /** All text fields this item should be searchable by */
  searchText: string
}

interface Props {
  items: LocationItem[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  label?: string
}

export default function LocationSearch({ items, value, onChange, placeholder = 'Search by city, store, address…', label }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const selected = items.find((i) => i.id === value) ?? null

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter((i) => i.searchText.toLowerCase().includes(q))
  }, [items, query])

  const grouped = useMemo(() => {
    const byCity = new Map<string, { region: string; city: string; items: LocationItem[] }>()
    for (const item of filtered) {
      const key = `${item.region}__${item.city}`
      if (!byCity.has(key)) {
        byCity.set(key, { region: item.region, city: item.city, items: [] })
      }
      byCity.get(key)!.items.push(item)
    }
    return [...byCity.values()].sort((a, b) => a.region.localeCompare(b.region) || a.city.localeCompare(b.city))
  }, [filtered])

  function handleSelect(item: LocationItem) {
    onChange(item.id)
    setQuery('')
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    setQuery('')
  }

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
      {label && <label className="text-sm font-medium text-ink">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            setTimeout(() => inputRef.current?.focus(), 10)
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          className={`w-full flex items-center justify-between gap-2 bg-card border rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
            open ? 'border-signal ring-2 ring-signal/20' : 'border-card-border hover:border-ink/30'
          }`}
        >
          <span className={selected ? 'text-ink' : 'text-muted'}>
            {selected ? selected.primary : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {selected && (
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
            <svg className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                placeholder="Type a city, store, or address…"
                className="w-full text-sm bg-paper rounded-lg px-3 py-2 outline-none placeholder:text-muted"
              />
            </div>
            <div id={listId} role="listbox" className="max-h-72 overflow-y-auto">
              {grouped.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">No results</p>
              ) : (
                grouped.map((group) => (
                  <div key={`${group.region}__${group.city}`}>
                    <div className="sticky top-0 bg-paper px-3 py-1 border-b border-card-border">
                      <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{group.region}</p>
                      <p className="text-xs font-semibold text-ink">{group.city}</p>
                    </div>
                    <ul>
                      {group.items.map((item) => (
                        <li
                          key={item.id}
                          role="option"
                          aria-selected={item.id === value}
                          onClick={() => handleSelect(item)}
                          className={`px-3 py-2 cursor-pointer transition-colors ${
                            item.id === value ? 'bg-signal/10' : 'hover:bg-paper'
                          }`}
                        >
                          <p className={`text-sm ${item.id === value ? 'text-signal font-medium' : 'text-ink'}`}>{item.primary}</p>
                          {item.secondary && <p className="font-mono text-xs text-muted">{item.secondary}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
