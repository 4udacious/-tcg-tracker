'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect, { type SelectOption } from '@/components/SearchableSelect'
import { checkAchievements } from '@/lib/checkAchievements'

interface Set {
  id: string
  name: string
  set_type: string
}

interface MyInterest {
  id: string
  note: string | null
  product_id: string
  created_at: string
  /** null = "forever need"; past timestamp = lapsed. */
  expires_at: string | null
  products: { id: string; name: string; sets: { id: string; name: string } | { id: string; name: string }[] | null } | { id: string; name: string; sets: { id: string; name: string } | { id: string; name: string }[] | null }[] | null
}

const TRACK_DAYS = 14

/** Timestamp `TRACK_DAYS` from now, for starting or resetting a timer. */
function freshExpiry(): string {
  return new Date(Date.now() + TRACK_DAYS * 86400000).toISOString()
}

type InterestStatus =
  | { kind: 'forever' }
  | { kind: 'expired' }
  | { kind: 'active'; label: string; urgent: boolean }

function statusOf(expiresAt: string | null): InterestStatus {
  if (expiresAt === null) return { kind: 'forever' }
  const msLeft = new Date(expiresAt).getTime() - Date.now()
  if (msLeft <= 0) return { kind: 'expired' }
  const hoursLeft = Math.floor(msLeft / 3600000)
  if (hoursLeft < 24) {
    return { kind: 'active', label: hoursLeft <= 1 ? 'expires within the hour' : `${hoursLeft}h left`, urgent: true }
  }
  // Round up so a just-added entry reads "14d left" rather than "13d left".
  const daysLeft = Math.ceil(hoursLeft / 24)
  return { kind: 'active', label: `${daysLeft}d left`, urgent: daysLeft <= 3 }
}

interface Person {
  id: string
  label: string
}

interface PersonItem {
  productName: string
  setName: string
  note: string | null
}

interface BoardRow {
  productName: string
  count: number
  users: string[]
}

interface BoardSet {
  setName: string
  setType: string
  rows: BoardRow[]
}

interface Props {
  sets: Set[]
  myInterests: MyInterest[]
  peopleList: Person[]
  interestsByPerson: Record<string, PersonItem[]>
  interestBoard: BoardSet[]
  userId: string
}

type Tab = 'track' | 'byPerson' | 'bySet'

export default function InterestTracker({ sets, myInterests, peopleList, interestsByPerson, interestBoard, userId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [tab, setTab] = useState<Tab>('track')
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [expandedWho, setExpandedWho] = useState<globalThis.Set<string>>(new globalThis.Set())

  function toggleWho(productName: string) {
    setExpandedWho((prev: globalThis.Set<string>) => {
      const next = new globalThis.Set(prev)
      if (next.has(productName)) next.delete(productName)
      else next.add(productName)
      return next
    })
  }

  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)
  const [products, setProducts] = useState<SelectOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [productFilter, setProductFilter] = useState('')
  const [note, setNote] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const filteredProducts = productFilter.trim()
    ? products.filter((p) => p.label.toLowerCase().includes(productFilter.toLowerCase()))
    : products

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [selectedBoardSetName, setSelectedBoardSetName] = useState<string | null>(null)

  const setOptions: SelectOption[] = sets.map((s) => ({ id: s.id, label: s.name }))
  const personOptions: SelectOption[] = peopleList.map((p) => ({ id: p.id, label: p.label }))
  const boardSetOptions: SelectOption[] = interestBoard.map((s) => ({ id: s.setName, label: s.setName }))

  const selectedPersonItems = selectedPersonId ? interestsByPerson[selectedPersonId] ?? [] : []
  const selectedBoardSet = interestBoard.find((s) => s.setName === selectedBoardSetName) ?? null

  async function handleSetChange(setId: string | null) {
    setSelectedSetId(setId)
    setSelectedProductIds([])
    setProductFilter('')
    setProducts([])
    if (!setId) return
    setLoadingProducts(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('set_id', setId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
    setProducts((data ?? []).map((p) => ({ id: p.id, label: p.name })))
    setLoadingProducts(false)
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleTrack() {
    if (selectedProductIds.length === 0) return
    const supabase = createClient()
    const singleNote = selectedProductIds.length === 1 ? note.trim() || null : null
    const rows = selectedProductIds.map((productId) => ({
      user_id: userId,
      product_id: productId,
      note: singleNote,
    }))
    const { data, error } = await supabase
      .from('product_interest')
      .upsert(rows, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
      .select('id')
    if (error) {
      showToast('Something went wrong.', false)
      return
    }
    const addedCount = data?.length ?? 0

    // Anything already on the list that had lapsed gets its timer restarted —
    // otherwise the insert above is ignored and re-adding would appear to do
    // nothing. Active and "forever need" rows are left untouched.
    const { data: revived } = await supabase
      .from('product_interest')
      .update({ expires_at: freshExpiry() })
      .eq('user_id', userId)
      .in('product_id', selectedProductIds)
      .lt('expires_at', new Date().toISOString())
      .select('id')
    const revivedCount = revived?.length ?? 0

    const skipped = rows.length - addedCount - revivedCount
    const touched = addedCount + revivedCount
    if (touched === 0) {
      showToast(rows.length === 1 ? 'Already tracking.' : 'Already tracking all of those.', false)
    } else if (skipped > 0) {
      showToast(`Tracked ${touched}, already tracking ${skipped}.`, true)
    } else {
      showToast(touched === 1 ? 'Tracked!' : `Tracked ${touched} items!`, true)
    }
    setSelectedSetId(null)
    setSelectedProductIds([])
    setProductFilter('')
    setProducts([])
    setNote('')
    startTransition(() => router.refresh())
    if (addedCount > 0) {
      checkAchievements(userId).then((earned) => {
        if (earned.length > 0) {
          const msg = earned.length === 1 ? `🏅 Badge earned: ${earned[0]}!` : `🏅 ${earned.length} new badges earned!`
          setTimeout(() => showToast(msg, true), 2000)
        }
      })
    }
  }

  async function handleStopTracking(id: string) {
    const supabase = createClient()
    await supabase.from('product_interest').delete().eq('id', id)
    showToast('Stopped tracking.', true)
    startTransition(() => router.refresh())
  }

  /** null resets to a fresh 14 days; 'forever' clears the time limit. */
  async function handleSetExpiry(id: string, mode: 'reset' | 'forever', msg: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('product_interest')
      .update({ expires_at: mode === 'forever' ? null : freshExpiry() })
      .eq('id', id)
    if (error) {
      showToast('Something went wrong.', false)
      return
    }
    showToast(msg, true)
    startTransition(() => router.refresh())
  }

  // Live entries first, lapsed ones collected at the bottom; otherwise keep the
  // newest-first order the server sent.
  const sortedInterests = useMemo(
    () =>
      [...myInterests].sort((a, b) => {
        const aDead = statusOf(a.expires_at).kind === 'expired' ? 1 : 0
        const bDead = statusOf(b.expires_at).kind === 'expired' ? 1 : 0
        return aDead - bDead
      }),
    [myInterests]
  )

  const tabs: { id: Tab; label: string }[] = useMemo(
    () => [
      { id: 'track', label: 'Track' },
      { id: 'byPerson', label: 'By Person' },
      { id: 'bySet', label: 'By Set' },
    ],
    []
  )

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg transition-all ${
            toast.ok ? 'bg-ok text-white' : 'bg-ink text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-ink text-white' : 'bg-card border border-card-border text-ink hover:border-ink/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'track' && (
        <>
          <section className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
            <h2 className="font-display font-semibold text-base">Track this</h2>
            <SearchableSelect
              label="Set"
              options={setOptions}
              value={selectedSetId}
              onChange={handleSetChange}
              placeholder="Pick a set…"
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink">
                Product{selectedProductIds.length > 0 ? ` (${selectedProductIds.length} selected)` : ''}
              </label>
              {!selectedSetId ? (
                <p className="text-sm text-muted bg-paper border border-card-border rounded-xl px-3 py-2.5">Pick a set first</p>
              ) : loadingProducts ? (
                <p className="text-sm text-muted bg-paper border border-card-border rounded-xl px-3 py-2.5">Loading…</p>
              ) : (
                <div className="border border-card-border rounded-xl overflow-hidden">
                  <input
                    type="text"
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    placeholder="Type to filter…"
                    className="w-full text-sm bg-paper px-3 py-2 outline-none placeholder:text-muted border-b border-card-border"
                  />
                  <ul className="max-h-52 overflow-y-auto divide-y divide-card-border">
                    {filteredProducts.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-muted">No products</li>
                    ) : (
                      filteredProducts.map((p) => (
                        <li key={p.id}>
                          <label className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-paper transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(p.id)}
                              onChange={() => toggleProduct(p.id)}
                              className="accent-signal w-4 h-4 rounded shrink-0"
                            />
                            <span className="text-ink">{p.label}</span>
                          </label>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
            {selectedProductIds.length === 1 ? (
              <div className="space-y-1">
                <label className="text-sm font-medium text-ink">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Costco price"
                  maxLength={200}
                  className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 placeholder:text-muted"
                />
              </div>
            ) : selectedProductIds.length > 1 ? (
              <p className="text-xs text-muted italic">Notes can only be added when tracking a single item.</p>
            ) : null}
            <button
              onClick={handleTrack}
              disabled={selectedProductIds.length === 0 || isPending}
              className="w-full bg-signal hover:bg-signal/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
            >
              {selectedProductIds.length > 1 ? `Track ${selectedProductIds.length} items` : 'Track this'}
            </button>
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display font-semibold text-base">My Requests</h2>
              <span className="font-mono text-[10px] text-muted">expire after {TRACK_DAYS} days</span>
            </div>
            {myInterests.length === 0 ? (
              <p className="text-sm text-muted">Nothing tracked yet. Pick a set to start.</p>
            ) : (
              <ul className="space-y-2">
                {sortedInterests.map((item) => {
                  const product = Array.isArray(item.products) ? item.products[0] : item.products
                  const set = product
                    ? Array.isArray((product as { sets: unknown }).sets)
                      ? ((product as { sets: { name: string }[] }).sets)[0]
                      : (product as { sets: { name: string } | null }).sets
                    : null
                  const status = statusOf(item.expires_at)
                  const expired = status.kind === 'expired'
                  return (
                    <li
                      key={item.id}
                      className={`bg-card border rounded-xl px-4 py-3 space-y-2 ${
                        expired ? 'border-card-border opacity-60' : 'border-card-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-medium text-sm truncate">{(product as { name: string } | null)?.name}</p>
                          <p className="font-mono text-xs text-muted">{(set as { name: string } | null)?.name}</p>
                          {item.note && <p className="text-xs text-muted italic">{item.note}</p>}
                        </div>
                        <span
                          className={`shrink-0 font-mono text-[10px] px-2 py-0.5 rounded-full border ${
                            status.kind === 'forever'
                              ? 'text-signal border-signal/40 bg-signal/5'
                              : status.kind === 'expired'
                              ? 'text-muted border-card-border'
                              : status.urgent
                              ? 'text-[#f97316] border-[#f97316]/40 bg-[#f97316]/5'
                              : 'text-muted border-card-border'
                          }`}
                        >
                          {status.kind === 'forever'
                            ? 'forever'
                            : status.kind === 'expired'
                            ? 'expired'
                            : status.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {expired ? (
                          <button
                            onClick={() => handleSetExpiry(item.id, 'reset', 'Re-added for 2 weeks.')}
                            className="text-xs font-medium text-signal border border-signal/30 rounded-lg px-2.5 py-1 hover:bg-signal/10 transition-colors"
                          >
                            Re-add
                          </button>
                        ) : status.kind === 'forever' ? (
                          <button
                            onClick={() => handleSetExpiry(item.id, 'reset', 'Back on a 2-week timer.')}
                            className="text-xs font-medium text-muted border border-card-border rounded-lg px-2.5 py-1 hover:text-ink hover:border-ink/20 transition-colors"
                          >
                            Use timer
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSetExpiry(item.id, 'reset', 'Extended 2 weeks.')}
                            className="text-xs font-medium text-muted border border-card-border rounded-lg px-2.5 py-1 hover:text-ink hover:border-ink/20 transition-colors"
                          >
                            Extend
                          </button>
                        )}

                        {status.kind !== 'forever' && (
                          <button
                            onClick={() => handleSetExpiry(item.id, 'forever', 'Marked as a forever need.')}
                            className="text-xs font-medium text-signal border border-signal/30 rounded-lg px-2.5 py-1 hover:bg-signal/10 transition-colors"
                          >
                            Forever need
                          </button>
                        )}

                        <button
                          onClick={() => handleStopTracking(item.id)}
                          className="text-xs font-medium text-muted border border-card-border rounded-lg px-2.5 py-1 hover:text-red-500 hover:border-red-400/40 transition-colors ml-auto"
                        >
                          Stop tracking
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === 'byPerson' && (
        <section className="space-y-4">
          <SearchableSelect
            label="Person"
            options={personOptions}
            value={selectedPersonId}
            onChange={setSelectedPersonId}
            placeholder="Pick a person…"
          />
          {!selectedPersonId ? (
            <p className="text-sm text-muted">Pick a person to see what they&apos;re tracking.</p>
          ) : selectedPersonItems.length === 0 ? (
            <p className="text-sm text-muted">Nothing tracked by this person yet.</p>
          ) : (
            <ul className="space-y-2">
              {selectedPersonItems.map((item, i) => (
                <li key={i} className="bg-card border border-card-border rounded-xl px-4 py-3 space-y-0.5">
                  <p className="font-medium text-sm">{item.productName}</p>
                  <p className="font-mono text-xs text-muted">{item.setName}</p>
                  {item.note && <p className="text-xs text-muted italic">{item.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'bySet' && (
        <section className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <SearchableSelect
                label="Set"
                options={boardSetOptions}
                value={selectedBoardSetName}
                onChange={setSelectedBoardSetName}
                placeholder="Pick a set…"
              />
            </div>
            <button
              onClick={() => setShowAllProducts((v) => !v)}
              className="shrink-0 font-mono text-xs text-muted hover:text-ink underline underline-offset-2 transition-colors pb-2.5"
            >
              {showAllProducts ? 'Wanted only' : 'Show all'}
            </button>
          </div>

          {!selectedBoardSet ? (
            <p className="text-sm text-muted">Pick a set to see who wants what.</p>
          ) : (
            (() => {
              const visibleRows = showAllProducts ? selectedBoardSet.rows : selectedBoardSet.rows.filter((r) => r.count > 0)
              if (visibleRows.length === 0) {
                return <p className="text-sm text-muted">No interest in this set yet.</p>
              }
              return (
                <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-ink flex items-center justify-between">
                    <span className="font-display text-sm font-semibold text-white">{selectedBoardSet.setName}</span>
                    {selectedBoardSet.setType && (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">{selectedBoardSet.setType}</span>
                    )}
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {visibleRows.map((row, idx) => (
                        <tr
                          key={row.productName}
                          className={`border-t border-card-border first:border-t-0 ${
                            idx === 0 && row.count > 0 ? 'bg-gradient-to-r from-signal/5 to-transparent' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <p className={`font-medium leading-snug break-words ${row.productName.length > 26 ? 'text-xs' : 'text-sm'}`}>
                              {row.productName}
                            </p>
                            {row.users.length > 0 && (
                              <WhoCell
                                users={row.users}
                                expanded={expandedWho.has(row.productName)}
                                onToggle={() => toggleWho(row.productName)}
                              />
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-mono font-semibold ${row.count > 0 ? 'text-signal' : 'text-muted'}`}>
                              {row.count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()
          )}
        </section>
      )}
    </div>
  )
}

const WHO_PREVIEW_COUNT = 2

function WhoCell({ users, expanded, onToggle }: { users: string[]; expanded: boolean; onToggle: () => void }) {
  const hasMore = users.length > WHO_PREVIEW_COUNT

  if (!hasMore) {
    return <p className="text-xs text-muted truncate max-w-[220px]">{users.join(', ')}</p>
  }

  if (expanded) {
    return (
      <p className="text-xs text-muted">
        {users.join(', ')}{' '}
        <button
          type="button"
          onClick={onToggle}
          className="font-semibold text-signal"
          aria-label="Show fewer names"
        >
          −
        </button>
      </p>
    )
  }

  const remaining = users.length - WHO_PREVIEW_COUNT
  return (
    <p className="text-xs text-muted truncate max-w-[220px]">
      {users.slice(0, WHO_PREVIEW_COUNT).join(', ')}{' '}
      <button
        type="button"
        onClick={onToggle}
        className="font-semibold text-signal"
        aria-label={`Show ${remaining} more`}
      >
        +{remaining}
      </button>
    </p>
  )
}
