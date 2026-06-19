'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect from '@/components/SearchableSelect'
import { Toast, useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'

interface SetRow { id: string; name: string; set_type: string; sort_order: number }
interface InterestRow {
  id: string
  note: string | null
  created_at: string
  product_id: string
  products: { id: string; name: string; set_id: string; sets: { id: string; name: string; set_type: string } | null } | null
}
interface OverviewRow {
  product_id: string
  product_name: string
  set_id: string
  set_name: string
  set_type: string
  set_sort: number
  interested_count: number
  interested_users: string[]
}

interface MemberRow { id: string; username: string | null; display_name: string | null }

interface Props {
  sets: SetRow[]
  myInterests: InterestRow[]
  overview: OverviewRow[]
  members: MemberRow[]
  userId: string
}

export default function InterestClient({ sets, myInterests: initialInterests, overview, members, userId }: Props) {
  const router = useRouter()
  const { toast, show, dismiss } = useToast()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [selectedSet, setSelectedSet] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [note, setNote] = useState('')
  const [products, setProducts] = useState<{ id: string; name: string }[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Browse-another-member state
  const [selectedMember, setSelectedMember] = useState('')
  const [memberInterests, setMemberInterests] = useState<InterestRow[]>([])
  const [loadingMemberInterests, setLoadingMemberInterests] = useState(false)

  // UI state
  const [showAllBySet, setShowAllBySet] = useState(false)
  const [activeTab, setActiveTab] = useState<'add' | 'mine' | 'board' | 'browse'>('board')

  const memberOptions = members.map(m => ({ value: m.id, label: m.display_name ?? m.username ?? 'Unknown' }))

  async function handleMemberChange(memberId: string) {
    setSelectedMember(memberId)
    if (!memberId) { setMemberInterests([]); return }
    setLoadingMemberInterests(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('product_interest')
      .select('id, note, created_at, product_id, products(id, name, set_id, sets(id, name, set_type))')
      .eq('user_id', memberId)
      .order('created_at', { ascending: false })
    setMemberInterests((data ?? []) as unknown as InterestRow[])
    setLoadingMemberInterests(false)
  }

  const setOptions = sets.map(s => ({ value: s.id, label: s.name }))
  const productOptions = products.map(p => ({ value: p.id, label: p.name }))

  async function handleSetChange(setId: string) {
    setSelectedSet(setId)
    setSelectedProduct('')
    if (!setId) { setProducts([]); return }
    setLoadingProducts(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('products')
      .select('id, name')
      .eq('set_id', setId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
    setProducts(data ?? [])
    setLoadingProducts(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct) return

    const supabase = createClient()
    const { error } = await (supabase as any)
      .from('product_interest')
      .insert({ user_id: userId, product_id: selectedProduct, note: note || null })

    if (error) {
      if (error.code === '23505') {
        show('Already tracking this product.', 'info')
      } else {
        show('Failed to add. Try again.', 'error')
      }
      return
    }

    show('Tracking started.', 'success')
    setSelectedSet('')
    setSelectedProduct('')
    setNote('')
    setProducts([])
    startTransition(() => router.refresh())
  }

  async function handleStopTracking(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('product_interest').delete().eq('id', id)
    if (error) { show('Failed to remove.', 'error'); return }
    show('Stopped tracking.', 'info')
    startTransition(() => router.refresh())
  }

  // Group overview by set
  const bySet = overview.reduce<Record<string, { setName: string; setType: string; rows: OverviewRow[] }>>((acc, row) => {
    if (!acc[row.set_id]) acc[row.set_id] = { setName: row.set_name, setType: row.set_type, rows: [] }
    acc[row.set_id].rows.push(row)
    return acc
  }, {})

  const setIds = Object.keys(bySet)

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-1 overflow-x-auto">
        {(['board', 'add', 'mine', 'browse'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-[var(--ink)] text-white'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {tab === 'board' ? 'Interest Board' : tab === 'add' ? 'Track This' : tab === 'mine' ? 'My List' : 'Browse'}
          </button>
        ))}
      </div>

      {/* Add interest form */}
      {activeTab === 'add' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-base" style={{ fontFamily: 'var(--font-display)' }}>
              Track a product
            </h2>
            <SearchableSelect
              options={setOptions}
              value={selectedSet}
              onChange={handleSetChange}
              placeholder="Choose a set…"
              label="Set"
            />
            <SearchableSelect
              options={productOptions}
              value={selectedProduct}
              onChange={setSelectedProduct}
              placeholder={loadingProducts ? 'Loading…' : selectedSet ? 'Choose a product…' : 'Pick a set first'}
              disabled={!selectedSet || loadingProducts}
              label="Product"
            />
            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1.5 uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>
                Note (optional)
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Costco price"
                maxLength={200}
                className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal)] focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={!selectedProduct || isPending}
            className="w-full bg-[var(--signal)] text-[var(--ink)] font-bold rounded-xl py-3.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:opacity-80 transition-opacity"
          >
            Track this
          </button>
        </form>
      )}

      {/* My requests */}
      {activeTab === 'mine' && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
            My List — <span className="text-[var(--ink)]">{initialInterests.length}</span> items
          </h2>
          {initialInterests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--muted)] text-sm">Nothing tracked yet.</p>
              <button
                onClick={() => setActiveTab('add')}
                className="mt-2 text-xs text-[var(--signal)] font-medium hover:underline"
              >
                Pick a set to start.
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {initialInterests.map((item: InterestRow) => (
                <li
                  key={item.id}
                  className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)] truncate">{item.products?.name}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                      {item.products?.sets?.name}
                      {item.note && <span className="ml-2 text-[var(--ink)]/60">· {item.note}</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleStopTracking(item.id)}
                    className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--danger)] transition-colors py-1"
                  >
                    Stop tracking
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Browse another member's list */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          <SearchableSelect
            options={memberOptions}
            value={selectedMember}
            onChange={handleMemberChange}
            placeholder="Choose a member…"
            label="Member"
          />

          {!selectedMember ? (
            <p className="text-sm text-[var(--muted)] text-center py-12">Pick a member to see their list.</p>
          ) : loadingMemberInterests ? (
            <p className="text-sm text-[var(--muted)] text-center py-12">Loading…</p>
          ) : memberInterests.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-12">Nothing tracked yet.</p>
          ) : (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
                {memberOptions.find(m => m.value === selectedMember)?.label}&apos;s List — <span className="text-[var(--ink)]">{memberInterests.length}</span> items
              </h2>
              <ul className="space-y-2">
                {memberInterests.map((item: InterestRow) => (
                  <li
                    key={item.id}
                    className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3"
                  >
                    <p className="text-sm font-medium text-[var(--ink)] truncate">{item.products?.name}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                      {item.products?.sets?.name}
                      {item.note && <span className="ml-2 text-[var(--ink)]/60">· {item.note}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Interest board */}
      {activeTab === 'board' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
              Interest by Set
            </h2>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showAllBySet}
                onChange={e => setShowAllBySet(e.target.checked)}
                className="accent-[var(--signal)]"
              />
              Show all
            </label>
          </div>

          {setIds.length === 0 && (
            <p className="text-sm text-[var(--muted)] text-center py-8">No interest recorded yet.</p>
          )}

          {setIds.map(setId => {
            const { setName, setType, rows } = bySet[setId]
            const visible = showAllBySet ? rows : rows.filter(r => r.interested_count > 0)
            if (visible.length === 0) return null
            const maxCount = Math.max(...visible.map(r => r.interested_count), 1)

            return (
              <div key={setId} className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl overflow-hidden">
                {/* Set header */}
                <div className="px-4 py-3 bg-[var(--ink)] flex items-center justify-between">
                  <span className="font-semibold text-sm text-white" style={{ fontFamily: 'var(--font-display)' }}>
                    {setName}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {setType}
                  </span>
                </div>

                {/* Table */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--card-border)]">
                      <th className="text-left px-4 py-2 text-xs text-[var(--muted)] font-medium uppercase tracking-wide" style={{ fontFamily: 'var(--font-mono)' }}>Product</th>
                      <th className="text-right px-4 py-2 text-xs text-[var(--muted)] font-medium uppercase tracking-wide w-10" style={{ fontFamily: 'var(--font-mono)' }}>#</th>
                      <th className="text-left px-4 py-2 text-xs text-[var(--muted)] font-medium uppercase tracking-wide">Who</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => {
                      const isHot = row.interested_count === maxCount && maxCount > 1
                      return (
                        <tr
                          key={row.product_id}
                          className={`border-b border-[var(--card-border)] last:border-0 ${
                            isHot ? 'bg-gradient-to-r from-cyan-50/60 via-purple-50/40 to-pink-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5 font-medium text-[var(--ink)]">{row.product_name}</td>
                          <td className="px-4 py-2.5 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                            <span className={`font-semibold tabular-nums ${isHot ? 'text-[var(--signal)]' : 'text-[var(--ink)]'}`}>
                              {row.interested_count}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                            {row.interested_users?.join(', ') ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
