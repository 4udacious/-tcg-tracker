'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Toast, useToast } from '@/components/Toast'
import SearchableSelect from '@/components/SearchableSelect'
import { useRouter } from 'next/navigation'

type SetType = 'standard' | 'special' | 'special-collections' | 'tins'

const SET_TYPE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'special', label: 'Special' },
  { value: 'special-collections', label: 'Special Collections' },
  { value: 'tins', label: 'Tins' },
]

export default function CatalogClient({ sets, products, retailers, stores }: any) {
  const router = useRouter()
  const { toast, show, dismiss } = useToast()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'sets' | 'products' | 'retailers' | 'stores'>('sets')

  // Set form
  const [newSetName, setNewSetName] = useState('')
  const [newSetType, setNewSetType] = useState<SetType>('standard')
  const [newSetOrder, setNewSetOrder] = useState('')

  // Product form
  const [newProdSet, setNewProdSet] = useState('')
  const [newProdName, setNewProdName] = useState('')

  // Retailer form
  const [newRetailerName, setNewRetailerName] = useState('')

  // Store form
  const [newStoreRetailer, setNewStoreRetailer] = useState('')
  const [newStoreArea, setNewStoreArea] = useState('')
  const [newStoreLabel, setNewStoreLabel] = useState('')
  const [newStoreAddress, setNewStoreAddress] = useState('')

  const setOptions = sets.map((s: any) => ({ value: s.id, label: s.name }))
  const retailerOptions = retailers.map((r: any) => ({ value: r.id, label: r.name }))

  async function addSet(e: React.FormEvent) {
    e.preventDefault()
    if (!newSetName) return
    const supabase = createClient()
    const { error } = await (supabase as any).from('sets').insert({
      name: newSetName,
      set_type: newSetType,
      sort_order: newSetOrder ? parseInt(newSetOrder) : 999,
      is_active: true,
    })
    if (error) { show('Failed to add set.', 'error'); return }
    show('Set added.', 'success')
    setNewSetName(''); setNewSetOrder('')
    startTransition(() => router.refresh())
  }

  async function toggleActive(table: string, id: string, current: boolean) {
    const supabase = createClient()
    await (supabase.from(table as any) as any).update({ is_active: !current }).eq('id', id)
    startTransition(() => router.refresh())
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!newProdSet || !newProdName) return
    const supabase = createClient()
    const { error } = await (supabase as any).from('products').insert({
      set_id: newProdSet,
      name: newProdName,
      sort_order: 999,
      is_active: true,
    })
    if (error) { show('Failed to add product.', 'error'); return }
    show('Product added.', 'success')
    setNewProdName('')
    startTransition(() => router.refresh())
  }

  async function addRetailer(e: React.FormEvent) {
    e.preventDefault()
    if (!newRetailerName) return
    const supabase = createClient()
    const { error } = await (supabase as any).from('retailers').insert({ name: newRetailerName })
    if (error) { show('Failed to add retailer.', 'error'); return }
    show('Retailer added.', 'success')
    setNewRetailerName('')
    startTransition(() => router.refresh())
  }

  async function addStore(e: React.FormEvent) {
    e.preventDefault()
    if (!newStoreRetailer || !newStoreArea || !newStoreLabel || !newStoreAddress) return
    const supabase = createClient()
    const { error } = await (supabase as any).from('store_locations').insert({
      retailer_id: newStoreRetailer,
      area: newStoreArea,
      label: newStoreLabel,
      address: newStoreAddress,
      is_active: true,
    })
    if (error) { show('Failed to add store.', 'error'); return }
    show('Store added.', 'success')
    setNewStoreArea(''); setNewStoreLabel(''); setNewStoreAddress('')
    startTransition(() => router.refresh())
  }

  const tabs = ['sets', 'products', 'retailers', 'stores'] as const

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Catalog</h1>

      <div className="flex gap-1 bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === t ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Sets */}
      {activeTab === 'sets' && (
        <div className="space-y-4">
          <form onSubmit={addSet} className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold">Add Set</h3>
            <input
              type="text" value={newSetName} onChange={e => setNewSetName(e.target.value)}
              placeholder="Set name" required
              className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
            />
            <SearchableSelect options={SET_TYPE_OPTIONS} value={newSetType} onChange={v => setNewSetType(v as SetType)} label="Type" />
            <input
              type="number" value={newSetOrder} onChange={e => setNewSetOrder(e.target.value)}
              placeholder="Sort order (optional)"
              className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
            />
            <button type="submit" disabled={isPending} className="w-full bg-[var(--signal)] text-[var(--ink)] font-bold rounded-xl py-2.5 text-sm disabled:opacity-40">
              Add Set
            </button>
          </form>

          <ul className="space-y-2">
            {sets.map((s: any) => (
              <li key={s.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-[var(--muted)] font-mono">{s.set_type} · order {s.sort_order}</p>
                </div>
                <button onClick={() => toggleActive('sets', s.id, s.is_active)} className={`text-xs px-3 py-1 rounded-full border ${s.is_active ? 'border-[var(--ok)] text-[var(--ok)]' : 'border-[var(--muted)] text-[var(--muted)]'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Products */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <form onSubmit={addProduct} className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold">Add Product</h3>
            <SearchableSelect options={setOptions} value={newProdSet} onChange={setNewProdSet} label="Set" placeholder="Choose a set…" />
            <input
              type="text" value={newProdName} onChange={e => setNewProdName(e.target.value)}
              placeholder="Product name" required
              className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
            />
            <button type="submit" disabled={isPending || !newProdSet} className="w-full bg-[var(--signal)] text-[var(--ink)] font-bold rounded-xl py-2.5 text-sm disabled:opacity-40">
              Add Product
            </button>
          </form>

          <ul className="space-y-2">
            {products.map((p: any) => (
              <li key={p.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-[var(--muted)] font-mono">{p.sets?.name}</p>
                </div>
                <button onClick={() => toggleActive('products', p.id, p.is_active)} className={`text-xs px-3 py-1 rounded-full border shrink-0 ${p.is_active ? 'border-[var(--ok)] text-[var(--ok)]' : 'border-[var(--muted)] text-[var(--muted)]'}`}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Retailers */}
      {activeTab === 'retailers' && (
        <div className="space-y-4">
          <form onSubmit={addRetailer} className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold">Add Retailer</h3>
            <input
              type="text" value={newRetailerName} onChange={e => setNewRetailerName(e.target.value)}
              placeholder="Retailer name" required
              className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
            />
            <button type="submit" disabled={isPending} className="w-full bg-[var(--signal)] text-[var(--ink)] font-bold rounded-xl py-2.5 text-sm disabled:opacity-40">
              Add Retailer
            </button>
          </form>

          <ul className="space-y-2">
            {retailers.map((r: any) => (
              <li key={r.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3">
                <p className="text-sm font-medium">{r.name}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stores */}
      {activeTab === 'stores' && (
        <div className="space-y-4">
          <form onSubmit={addStore} className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold">Add Store</h3>
            <SearchableSelect options={retailerOptions} value={newStoreRetailer} onChange={setNewStoreRetailer} label="Retailer" placeholder="Choose retailer…" />
            <input
              type="text" value={newStoreArea} onChange={e => setNewStoreArea(e.target.value)}
              placeholder="Area (e.g. Federal Way)" required
              className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
            />
            <input
              type="text" value={newStoreLabel} onChange={e => setNewStoreLabel(e.target.value)}
              placeholder="Label (e.g. Supercenter)" required
              className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
            />
            <input
              type="text" value={newStoreAddress} onChange={e => setNewStoreAddress(e.target.value)}
              placeholder="Address" required
              className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
            />
            <button type="submit" disabled={isPending || !newStoreRetailer} className="w-full bg-[var(--signal)] text-[var(--ink)] font-bold rounded-xl py-2.5 text-sm disabled:opacity-40">
              Add Store
            </button>
          </form>

          <ul className="space-y-2">
            {stores.map((s: any) => (
              <li key={s.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.retailers?.name} — {s.label}</p>
                  <p className="text-xs text-[var(--muted)] font-mono">{s.area} · {s.address}</p>
                </div>
                <button onClick={() => toggleActive('store_locations', s.id, s.is_active)} className={`text-xs px-3 py-1 rounded-full border shrink-0 ${s.is_active ? 'border-[var(--ok)] text-[var(--ok)]' : 'border-[var(--muted)] text-[var(--muted)]'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
