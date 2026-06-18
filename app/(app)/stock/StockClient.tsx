'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect from '@/components/SearchableSelect'
import { Toast, useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'

interface Props {
  areas: string[]
  productTypes: { id: string; name: string }[]
  recentChecks: any[]
  userId: string
}

export default function StockClient({ areas, productTypes, recentChecks, userId }: Props) {
  const router = useRouter()
  const { toast, show, dismiss } = useToast()
  const [isPending, startTransition] = useTransition()

  const [selectedArea, setSelectedArea] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [note, setNote] = useState('')
  const [stores, setStores] = useState<{ id: string; label: string; retailer_name: string }[]>([])
  const [loadingStores, setLoadingStores] = useState(false)

  const areaOptions = areas.map(a => ({ value: a, label: a }))
  const storeOptions = stores.map(s => ({ value: s.id, label: `${s.retailer_name} — ${s.label}` }))
  const typeOptions = productTypes.map(t => ({ value: t.id, label: t.name }))

  async function handleAreaChange(area: string) {
    setSelectedArea(area)
    setSelectedStore('')
    if (!area) { setStores([]); return }
    setLoadingStores(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('store_locations')
      .select('id, label, retailers(name)')
      .eq('area', area)
      .eq('is_active', true)
      .order('label')
    const mapped = (data ?? []).map((s: any) => ({
      id: s.id,
      label: s.label,
      retailer_name: s.retailers?.name ?? '',
    }))
    setStores(mapped)
    setLoadingStores(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStore || !selectedType) return

    const supabase = createClient()
    const { error } = await (supabase as any).from('stock_checks').insert({
      user_id: userId,
      store_location_id: selectedStore,
      product_type_id: selectedType,
      note: note || null,
    })

    if (error) { show('Failed to report. Try again.', 'error'); return }

    show('Stock reported.', 'success')
    setSelectedArea('')
    setSelectedStore('')
    setSelectedType('')
    setNote('')
    setStores([])
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-base" style={{ fontFamily: 'var(--font-display)' }}>
            Report stock
          </h2>
          <SearchableSelect
            options={areaOptions}
            value={selectedArea}
            onChange={handleAreaChange}
            placeholder="Choose an area…"
            label="Area"
          />
          <SearchableSelect
            options={storeOptions}
            value={selectedStore}
            onChange={setSelectedStore}
            placeholder={loadingStores ? 'Loading…' : selectedArea ? 'Choose a store…' : 'Pick an area first'}
            disabled={!selectedArea || loadingStores}
            label="Store"
          />
          <SearchableSelect
            options={typeOptions}
            value={selectedType}
            onChange={setSelectedType}
            placeholder="Choose product type…"
            label="Product Type"
          />
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. 3 packs left, end cap"
              maxLength={200}
              className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal)] focus:border-transparent"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!selectedStore || !selectedType || isPending}
          className="w-full bg-[var(--signal)] text-[var(--ink)] font-bold rounded-xl py-3.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:opacity-80 transition-opacity"
        >
          Report stock
        </button>
      </form>

      {/* Recent check-ins */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Recent Check-ins
        </h2>
        {recentChecks.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-6">No check-ins yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentChecks.map((check: any) => {
              const isRecent = Date.now() - new Date(check.created_at).getTime() < 60 * 60 * 1000
              return (
                <li
                  key={check.id}
                  className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 flex items-start gap-3"
                >
                  {isRecent && (
                    <span className="mt-1 w-2 h-2 rounded-full bg-[var(--signal)] shrink-0 amber-pulse" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--ink)]">
                      {check.store_locations?.retailers?.name && `${check.store_locations.retailers.name} — `}
                      {check.store_locations?.label}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                      {check.product_types?.name}
                      {check.note && <span className="ml-2">· {check.note}</span>}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                      {check.profiles?.username} · {timeAgo(check.created_at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
