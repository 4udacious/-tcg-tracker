'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect, { type SelectOption } from '@/components/SearchableSelect'
import LocationSearch, { type LocationItem } from '@/components/LocationSearch'
import { checkAchievements } from '@/lib/checkAchievements'

interface Store {
  id: string
  retailer_id: string
  region: string
  city: string
  neighborhood: string | null
  label: string
  address: string | null
  retailers: { name: string } | { name: string }[] | null
}

interface ProductType {
  id: string
  name: string
}

interface RecentCheck {
  id: string
  user_id: string
  created_at: string
  note: string | null
  has_stock: boolean
  store_locations: { label: string; city: string; region: string } | { label: string; city: string; region: string }[] | null
  product_types: { name: string } | { name: string }[] | null
  profiles: { username: string; display_name?: string } | { username: string; display_name?: string }[] | null
}

interface Props {
  stores: Store[]
  productTypes: ProductType[]
  recentChecks: RecentCheck[]
  userId: string
}

export default function StockCheckForm({ stores, productTypes, recentChecks, userId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [hasStock, setHasStock] = useState<boolean | null>(null)
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const storeItems: LocationItem[] = useMemo(
    () =>
      stores.map((s) => {
        const retailer = Array.isArray(s.retailers) ? s.retailers[0] : s.retailers
        const retailerName = (retailer as { name: string } | null)?.name ?? ''
        return {
          id: s.id,
          primary: `${retailerName} — ${s.label}`,
          secondary: s.address ?? undefined,
          region: s.region,
          city: s.city,
          searchText: [s.region, s.city, s.neighborhood, retailerName, s.label, s.address].filter(Boolean).join(' '),
        }
      }),
    [stores]
  )

  const typeOptions: SelectOption[] = productTypes.map((t) => ({ id: t.id, label: t.name }))

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this check-in?')) return
    const supabase = createClient()
    const { error } = await supabase.from('stock_checks').delete().eq('id', id)
    if (error) { showToast('Failed to delete.', false); return }
    setDeletedIds((prev) => new Set(prev).add(id))
    showToast('Check-in deleted.', true)
  }

  async function handleSubmit() {
    if (!selectedStoreId || !selectedTypeId || hasStock === null) return
    const supabase = createClient()
    const { error } = await supabase
      .from('stock_checks')
      .insert({ user_id: userId, store_location_id: selectedStoreId, product_type_id: selectedTypeId, has_stock: hasStock, note: note || null })
    if (error) {
      showToast('Something went wrong.', false)
      return
    }
    showToast('Stock reported.', true)
    setSelectedStoreId(null)
    setSelectedTypeId(null)
    setHasStock(null)
    setNote('')
    startTransition(() => router.refresh())
    checkAchievements(userId).then((earned) => {
      if (earned.length > 0) {
        const msg = earned.length === 1 ? `🏅 Badge earned: ${earned[0]}!` : `🏅 ${earned.length} new badges earned!`
        setTimeout(() => showToast(msg, true), 2000)
      }
    })
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg ${toast.ok ? 'bg-ok text-white' : 'bg-ink text-white'}`}>
          {toast.msg}
        </div>
      )}

      <section className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
        <h2 className="font-display font-semibold text-base">Report stock</h2>
        <LocationSearch
          label="Store"
          items={storeItems}
          value={selectedStoreId}
          onChange={setSelectedStoreId}
          placeholder="Search by city, store, address…"
        />
        <SearchableSelect
          label="Product type"
          options={typeOptions}
          value={selectedTypeId}
          onChange={setSelectedTypeId}
          placeholder="Pick a type…"
        />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-ink">Stock status</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setHasStock(true)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                hasStock === true ? 'bg-ok text-white border-ok' : 'bg-paper border-card-border text-ink hover:border-ok/40'
              }`}
            >
              In Stock
            </button>
            <button
              type="button"
              onClick={() => setHasStock(false)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                hasStock === false ? 'bg-ink text-white border-ink' : 'bg-paper border-card-border text-ink hover:border-ink/40'
              }`}
            >
              No Stock
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-ink">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. 3 left on shelf"
            maxLength={200}
            className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 placeholder:text-muted"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!selectedStoreId || !selectedTypeId || hasStock === null || isPending}
          className="w-full bg-signal hover:bg-signal/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
        >
          Report stock
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-semibold text-base">Recent Check-ins</h2>
        {recentChecks.length === 0 ? (
          <p className="text-sm text-muted">No recent check-ins.</p>
        ) : (
          <ul className="space-y-2">
            {recentChecks.filter((c) => !deletedIds.has(c.id)).map((check) => {
              const store = Array.isArray(check.store_locations) ? check.store_locations[0] : check.store_locations
              const type = Array.isArray(check.product_types) ? check.product_types[0] : check.product_types
              const reporter = Array.isArray(check.profiles) ? check.profiles[0] : check.profiles
              const ago = timeAgo(new Date(check.created_at))
              const fresh = Date.now() - new Date(check.created_at).getTime() < 3600000
              const isOwn = check.user_id === userId
              return (
                <li
                  key={check.id}
                  className={`bg-card border rounded-xl px-4 py-3 flex items-start justify-between gap-2 ${fresh ? 'border-signal/40' : 'border-card-border'}`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      {fresh && <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse shrink-0" />}
                      <p className="font-medium text-sm truncate">{(type as { name: string } | null)?.name}</p>
                      <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${check.has_stock ? 'bg-ok/15 text-ok' : 'bg-ink/10 text-muted'}`}>
                        {check.has_stock ? 'In Stock' : 'No Stock'}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-muted">
                      {(store as { region: string; city: string; label: string } | null)?.city} — {(store as { region: string; city: string; label: string } | null)?.label}
                    </p>
                    {check.note && <p className="text-xs text-muted italic">{check.note}</p>}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-mono text-xs text-muted">{ago}</p>
                    <p className="text-xs text-muted">{(reporter as { display_name?: string; username: string } | null)?.display_name ?? (reporter as { display_name?: string; username: string } | null)?.username}</p>
                    {isOwn && (
                      <button
                        onClick={() => handleDelete(check.id)}
                        className="text-[10px] text-muted hover:text-red-500 transition-colors"
                      >
                        Delete
                      </button>
                    )}
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

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
