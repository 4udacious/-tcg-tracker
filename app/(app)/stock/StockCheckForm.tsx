'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect, { type SelectOption } from '@/components/SearchableSelect'
import LocationSearch, { type LocationItem } from '@/components/LocationSearch'
import StoreFavoriteToggle from '@/components/StoreFavoriteToggle'
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
  store_locations:
    | { label: string; city: string; region: string; address: string | null; retailers: { name: string } | { name: string }[] | null }
    | { label: string; city: string; region: string; address: string | null; retailers: { name: string } | { name: string }[] | null }[]
    | null
  product_types: { name: string } | { name: string }[] | null
  profiles: { username: string; display_name?: string } | { username: string; display_name?: string }[] | null
}

interface Props {
  stores: Store[]
  productTypes: ProductType[]
  recentChecks: RecentCheck[]
  favoriteStoreIds: string[]
  userId: string
}

export default function StockCheckForm({ stores, productTypes, recentChecks, favoriteStoreIds, userId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [storeTab, setStoreTab] = useState<'favorites' | 'search'>(
    favoriteStoreIds.length > 0 ? 'favorites' : 'search'
  )
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set(favoriteStoreIds))
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
          // Normalise to string here so favourite matching can't compare a
          // bigint-as-number against a string id.
          id: String(s.id),
          primary: `${retailerName} — ${s.label}`,
          secondary: s.address ?? undefined,
          region: s.region,
          city: s.city,
          searchText: [s.region, s.city, s.neighborhood, retailerName, s.label, s.address].filter(Boolean).join(' '),
        }
      }),
    [stores]
  )

  // Favorited stores, grouped by city for the picker.
  const favoriteStores = useMemo(
    () => storeItems.filter((s) => favoriteIds.has(s.id)),
    [storeItems, favoriteIds]
  )

  const favoritesByCity = useMemo(() => {
    const byCity = new Map<string, LocationItem[]>()
    for (const s of favoriteStores) {
      const city = s.city ?? 'Other'
      if (!byCity.has(city)) byCity.set(city, [])
      byCity.get(city)!.push(s)
    }
    return [...byCity.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [favoriteStores])

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
        {/* Store picker: saved favorites, or full search */}
        <div className="space-y-2">
          <div className="flex gap-1 bg-paper rounded-xl p-1">
            <button
              type="button"
              onClick={() => { setStoreTab('favorites'); setSelectedStoreId(null) }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                storeTab === 'favorites' ? 'bg-ink text-white' : 'text-ink'
              }`}
            >
              Favorites
            </button>
            <button
              type="button"
              onClick={() => { setStoreTab('search'); setSelectedStoreId(null) }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                storeTab === 'search' ? 'bg-ink text-white' : 'text-ink'
              }`}
            >
              Search
            </button>
          </div>

          {storeTab === 'favorites' ? (
            favoriteStores.length === 0 ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-ink font-medium">No favorite stores yet</p>
                <p className="text-xs text-muted">Use the Search tab to find a store, then tap the star to save it here.</p>
                <button
                  type="button"
                  onClick={() => { setStoreTab('search'); setSelectedStoreId(null) }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-signal border border-signal/30 bg-signal/5 hover:bg-signal/10 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                  </svg>
                  Go to Search
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink">Store</label>
                <div className="border border-card-border rounded-xl overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    {favoritesByCity.map(([city, cityStores]) => (
                      <div key={city}>
                        <div className="sticky top-0 bg-paper px-3 py-1 border-b border-card-border">
                          <p className="text-xs font-semibold text-ink">{city}</p>
                        </div>
                        <ul>
                          {cityStores.map((s) => (
                            <li
                              key={s.id}
                              onClick={() => setSelectedStoreId(s.id === selectedStoreId ? null : s.id)}
                              className={`px-3 py-2 cursor-pointer transition-colors ${
                                s.id === selectedStoreId ? 'bg-signal/10' : 'hover:bg-paper'
                              }`}
                            >
                              <p className={`text-sm ${s.id === selectedStoreId ? 'text-signal font-medium' : 'text-ink'}`}>
                                {s.primary}
                              </p>
                              {s.secondary && <p className="font-mono text-xs text-muted">{s.secondary}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <LocationSearch
                  label="Store"
                  items={storeItems}
                  value={selectedStoreId}
                  onChange={setSelectedStoreId}
                  placeholder="Search by city, store, address…"
                />
              </div>
              {selectedStoreId && (
                <StoreFavoriteToggle
                  userId={userId}
                  storeId={selectedStoreId}
                  initialFavorited={favoriteIds.has(selectedStoreId)}
                  onChange={(fav) => {
                    setFavoriteIds((prev) => {
                      const next = new Set(prev)
                      if (fav) next.add(selectedStoreId)
                      else next.delete(selectedStoreId)
                      return next
                    })
                  }}
                />
              )}
            </div>
          )}
        </div>
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
              const storeRaw = Array.isArray(check.store_locations) ? check.store_locations[0] : check.store_locations
              const store = storeRaw as { label: string; city: string; region: string; address: string | null; retailers: { name: string } | { name: string }[] | null } | null
              const retailer = store ? (Array.isArray(store.retailers) ? store.retailers[0] : store.retailers) : null
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
                      {retailer?.name ? `${retailer.name} — ` : ''}{store?.label}, {store?.city}
                    </p>
                    {store?.address && (
                      <p className="font-mono text-[10px] text-muted">{store.address}</p>
                    )}
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
