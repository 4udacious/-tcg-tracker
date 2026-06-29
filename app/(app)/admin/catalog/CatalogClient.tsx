'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SearchableSelect, { type SelectOption } from '@/components/SearchableSelect'

type Tab = 'sets' | 'products' | 'retailers' | 'stores'

interface Set { id: string; name: string; set_type: string; sort_order: number; is_active: boolean }
interface Product { id: string; name: string; set_id: string; is_active: boolean }
interface Retailer { id: string; name: string }
interface Store { id: string; region: string; city: string; neighborhood: string | null; label: string; address: string | null; latitude: number | null; longitude: number | null; is_active: boolean; retailer_id: string }

const SET_TYPES = ['standard', 'special', 'special-collections', 'tins']

export default function CatalogClient({
  sets, products, retailers, stores,
}: {
  sets: Set[]; products: Product[]; retailers: Retailer[]; stores: Store[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('sets')
  const [toast, setToast] = useState<string | null>(null)

  // Set form state
  const [setName, setSetName] = useState('')
  const [setType, setSetType] = useState('standard')
  const [setSortOrder, setSetSortOrder] = useState(0)

  // Product form state
  const [productName, setProductName] = useState('')
  const [productSetId, setProductSetId] = useState<string | null>(null)

  // Retailer form state
  const [retailerName, setRetailerName] = useState('')

  // Store form state
  const [storeRegion, setStoreRegion] = useState('')
  const [storeCity, setStoreCity] = useState('')
  const [storeNeighborhood, setStoreNeighborhood] = useState('')
  const [storeLabel, setStoreLabel] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [storeLat, setStoreLat] = useState('')
  const [storeLng, setStoreLng] = useState('')
  const [storeRetailerId, setStoreRetailerId] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function addSet() {
    if (!setName.trim()) return
    const supabase = createClient()
    const { error } = await supabase.from('sets').insert({ name: setName.trim(), set_type: setType, sort_order: setSortOrder })
    if (error) { showToast('Failed to add set.'); return }
    showToast('Set added.')
    setSetName('')
    startTransition(() => router.refresh())
  }

  async function toggleSet(id: string, current: boolean) {
    const supabase = createClient()
    await supabase.from('sets').update({ is_active: !current }).eq('id', id)
    startTransition(() => router.refresh())
  }

  async function addProduct() {
    if (!productName.trim() || !productSetId) return
    const supabase = createClient()
    const { error } = await supabase.from('products').insert({ name: productName.trim(), set_id: productSetId })
    if (error) { showToast('Failed to add product.'); return }
    showToast('Product added.')
    setProductName('')
    startTransition(() => router.refresh())
  }

  async function addRetailer() {
    if (!retailerName.trim()) return
    const supabase = createClient()
    const { error } = await supabase.from('retailers').insert({ name: retailerName.trim() })
    if (error) { showToast('Failed to add retailer.'); return }
    showToast('Retailer added.')
    setRetailerName('')
    startTransition(() => router.refresh())
  }

  async function addStore() {
    if (!storeRegion.trim() || !storeCity.trim() || !storeLabel.trim() || !storeRetailerId) return
    const supabase = createClient()
    const { error } = await supabase.from('store_locations').insert({
      region: storeRegion.trim(),
      city: storeCity.trim(),
      neighborhood: storeNeighborhood || null,
      label: storeLabel.trim(),
      address: storeAddress || null,
      latitude: storeLat ? parseFloat(storeLat) : null,
      longitude: storeLng ? parseFloat(storeLng) : null,
      retailer_id: storeRetailerId,
    })
    if (error) { showToast('Failed to add store.'); return }
    showToast('Store added.')
    setStoreRegion(''); setStoreCity(''); setStoreNeighborhood('')
    setStoreLabel(''); setStoreAddress(''); setStoreLat(''); setStoreLng('')
    startTransition(() => router.refresh())
  }

  const setOptions: SelectOption[] = sets.map((s) => ({ id: s.id, label: s.name }))
  const retailerOptions: SelectOption[] = retailers.map((r) => ({ id: r.id, label: r.name }))

  const tabs: { id: Tab; label: string }[] = [
    { id: 'sets', label: 'Sets' },
    { id: 'products', label: 'Products' },
    { id: 'retailers', label: 'Retailers' },
    { id: 'stores', label: 'Stores' },
  ]

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg bg-ink text-white">
          {toast}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-ink text-white' : 'bg-card border border-card-border text-ink hover:border-ink/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sets' && (
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">Add set</h3>
            <input value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="Set name" className="input-field" />
            <select value={setType} onChange={(e) => setSetType(e.target.value)} className="input-field">
              {SET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" value={setSortOrder} onChange={(e) => setSetSortOrder(Number(e.target.value))} placeholder="Sort order" className="input-field" />
            <button onClick={addSet} className="btn-primary w-full">Add set</button>
          </div>
          <ul className="space-y-2">
            {sets.map((s) => (
              <li key={s.id} className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="font-mono text-xs text-muted">{s.set_type}</p>
                </div>
                <button onClick={() => toggleSet(s.id, s.is_active)} className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${s.is_active ? 'text-ok border-ok/30 hover:bg-ok/10' : 'text-muted border-card-border hover:text-ink'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">Add product</h3>
            <SearchableSelect label="Set" options={setOptions} value={productSetId} onChange={setProductSetId} placeholder="Pick a set…" />
            <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Product name" className="input-field" />
            <button onClick={addProduct} className="btn-primary w-full">Add product</button>
          </div>
          <ul className="space-y-2">
            {products.map((p) => {
              const set = sets.find((s) => s.id === p.set_id)
              return (
                <li key={p.id} className="bg-card border border-card-border rounded-xl px-4 py-3">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="font-mono text-xs text-muted">{set?.name ?? p.set_id}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {tab === 'retailers' && (
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">Add retailer</h3>
            <input value={retailerName} onChange={(e) => setRetailerName(e.target.value)} placeholder="Retailer name" className="input-field" />
            <button onClick={addRetailer} className="btn-primary w-full">Add retailer</button>
          </div>
          <ul className="space-y-2">
            {retailers.map((r) => (
              <li key={r.id} className="bg-card border border-card-border rounded-xl px-4 py-3">
                <p className="text-sm font-medium">{r.name}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'stores' && (
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-sm">Add store</h3>
            <SearchableSelect label="Retailer" options={retailerOptions} value={storeRetailerId} onChange={setStoreRetailerId} placeholder="Pick a retailer…" />
            <div className="flex gap-2">
              <input value={storeRegion} onChange={(e) => setStoreRegion(e.target.value)} placeholder="Region" className="input-field flex-1" />
              <input value={storeCity} onChange={(e) => setStoreCity(e.target.value)} placeholder="City" className="input-field flex-1" />
            </div>
            <input value={storeNeighborhood} onChange={(e) => setStoreNeighborhood(e.target.value)} placeholder="Neighborhood (optional)" className="input-field" />
            <input value={storeLabel} onChange={(e) => setStoreLabel(e.target.value)} placeholder="Label (e.g. Costco #1234)" className="input-field" />
            <input value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="Address (optional)" className="input-field" />
            <div className="flex gap-2">
              <input value={storeLat} onChange={(e) => setStoreLat(e.target.value)} placeholder="Lat" className="input-field flex-1" />
              <input value={storeLng} onChange={(e) => setStoreLng(e.target.value)} placeholder="Long" className="input-field flex-1" />
            </div>
            <button onClick={addStore} className="btn-primary w-full">Add store</button>
          </div>
          <ul className="space-y-2">
            {stores.map((s) => {
              const retailer = retailers.find((r) => r.id === s.retailer_id)
              return (
                <li key={s.id} className="bg-card border border-card-border rounded-xl px-4 py-3">
                  <p className="text-sm font-medium">{retailer?.name} — {s.label}</p>
                  <p className="font-mono text-xs text-muted">{s.region} · {s.city}{s.address ? ` · ${s.address}` : ''}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <style>{`
        .input-field {
          width: 100%;
          background: #EEF1F6;
          border: 1px solid #E2E6EE;
          border-radius: 0.75rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input-field:focus {
          border-color: #F6A609;
          box-shadow: 0 0 0 2px rgba(246,166,9,0.2);
        }
        .btn-primary {
          background: #F6A609;
          color: white;
          font-weight: 600;
          border-radius: 0.75rem;
          padding: 0.625rem 1rem;
          font-size: 0.875rem;
          transition: opacity 0.15s;
        }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  )
}
