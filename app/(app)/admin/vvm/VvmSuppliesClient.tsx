'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SupplyIcon from '@/components/SupplyIcon'
import { fmt, money, num } from '../../vending/tokens'

/**
 * A row of vvm_supplies (v56). Items are fixed - the battle game knows them
 * by key - so an admin only switches them on and off, prices them and sets
 * how often they turn up. Bundles are made, edited and removed here.
 */
export interface SupplyRow {
  key: string
  kind: 'item' | 'bundle'
  name: string
  description: string | null
  /** Bundles only: item key -> how many. */
  contents: Record<string, number> | null
  token_price: number
  appearance_rate: number
  is_active: boolean
  sort_order: number
  updated_at: string
}

const NAME_MAX = 40
const BUNDLE_ITEM_MAX = 99

type Toast = (msg: string) => void

export default function VvmSuppliesClient({ supplies }: { supplies: SupplyRow[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  // A bundle being made, before it exists in the database.
  const [draft, setDraft] = useState<SupplyRow | null>(null)

  const items = supplies.filter((s) => s.kind === 'item')
  const bundles = supplies.filter((s) => s.kind === 'bundle')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function refresh() {
    startTransition(() => router.refresh())
  }

  function newBundle() {
    const lastSort = Math.max(100, ...bundles.map((b) => b.sort_order))
    setDraft({
      // Keys are permanent and only need to be unique, so the clock will do.
      key: `bundle_${Date.now().toString(36)}`,
      kind: 'bundle',
      name: 'New Bundle',
      description: null,
      contents: { [items[0]?.key ?? 'potion']: 2 },
      token_price: 0.45,
      appearance_rate: 20,
      is_active: true,
      sort_order: lastSort + 10,
      updated_at: '',
    })
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg bg-ink text-white">
          {toast}
        </div>
      )}

      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="font-display font-semibold text-base">Battle supplies</h2>
          <p className="text-xs text-muted leading-snug">
            Sold on the machine&apos;s shelf beside the packs. <b>Appearance rate</b> is the
            chance an item is on the shelf when the machine restocks. Changes apply from
            the next restock.
          </p>
        </div>
        <ul className="space-y-2">
          {items.map((s) => (
            // Keyed on updated_at so a saved card starts again from what was saved.
            <ItemCard key={`${s.key}-${s.updated_at}`} item={s} onToast={showToast} onSaved={refresh} />
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="space-y-1">
          <h2 className="font-display font-semibold text-base">Bundles</h2>
          <p className="text-xs text-muted leading-snug">
            Several items sold together at one price. Bought, the items go into the
            member&apos;s bag separately. A bundle can hold an item that is switched off
            above, which makes the bundle the only way to get it.
          </p>
        </div>
        <ul className="space-y-2">
          {bundles.map((b) => (
            <BundleCard
              key={`${b.key}-${b.updated_at}`}
              bundle={b}
              items={items}
              isNew={false}
              onToast={showToast}
              onSaved={refresh}
              onDiscard={() => {}}
            />
          ))}
          {draft && (
            <BundleCard
              key={draft.key}
              bundle={draft}
              items={items}
              isNew
              onToast={showToast}
              onSaved={() => { setDraft(null); refresh() }}
              onDiscard={() => setDraft(null)}
            />
          )}
        </ul>
        {!draft && (
          <button
            onClick={newBundle}
            className="w-full border border-dashed border-card-border rounded-2xl py-3 text-sm font-medium text-muted hover:text-ink hover:border-ink/30 transition-colors"
          >
            + New bundle
          </button>
        )}
      </section>
    </div>
  )
}

/* ─────────────────────────────── shared bits ─────────────────────────────── */

/** Parses a price field to cents, or null if it is not a usable price. */
function parsePrice(raw: string): number | null {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return money(n)
}

function ActiveSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="shrink-0 flex items-center gap-1.5 text-xs font-medium cursor-pointer select-none">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-signal"
      />
      In the machine
    </label>
  )
}

function PriceAndRate({
  price, rate, onPrice, onRate, hint,
}: {
  price: string
  rate: number
  onPrice: (v: string) => void
  onRate: (v: number) => void
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-card-border bg-paper p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium">
          Price {hint && <span className="text-muted font-normal">{hint}</span>}
        </label>
        <span className="flex items-center gap-1.5">
          <input
            type="number"
            min={0.01}
            step={0.05}
            value={price}
            onChange={(e) => onPrice(e.target.value)}
            className="w-20 bg-card border border-card-border rounded-lg px-2 py-1 text-sm text-right font-mono outline-none focus:border-signal"
          />
          <span className="text-xs text-muted">tokens</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium">Appearance rate</label>
        <span className="font-mono text-xs font-semibold">{rate}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={rate}
        onChange={(e) => onRate(Number(e.target.value))}
        className="w-full accent-signal"
        aria-label="Appearance rate"
      />
    </div>
  )
}

/* ─────────────────────────────────── items ───────────────────────────────── */

function ItemCard({ item, onToast, onSaved }: { item: SupplyRow; onToast: Toast; onSaved: () => void }) {
  const [active, setActive] = useState(item.is_active)
  const [price, setPrice] = useState(fmt(item.token_price))
  const [rate, setRate] = useState(item.appearance_rate)
  const [saving, setSaving] = useState(false)

  const dirty = active !== item.is_active || rate !== item.appearance_rate ||
    parsePrice(price) !== money(num(item.token_price))

  async function save() {
    const p = parsePrice(price)
    if (p === null) { onToast('Price must be more than 0.'); return }
    setSaving(true)
    const { error } = await createClient()
      .from('vvm_supplies')
      .update({ is_active: active, token_price: p, appearance_rate: rate })
      .eq('key', item.key)
    setSaving(false)
    if (error) { onToast('Failed to save.'); return }
    onToast(`${item.name} saved.`)
    onSaved()
  }

  return (
    <li className={`bg-card border border-card-border rounded-2xl p-4 space-y-3 ${active ? '' : 'opacity-70'}`}>
      <div className="flex items-center gap-3">
        <SupplyIcon supplyKey={item.key} className="w-9 h-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{item.name}</p>
          <p className="text-[11px] text-muted truncate">{item.description}</p>
        </div>
        <ActiveSwitch on={active} onChange={setActive} />
      </div>

      <PriceAndRate price={price} rate={rate} onPrice={setPrice} onRate={setRate} />

      {dirty && (
        <div className="flex justify-end gap-1.5">
          <button
            onClick={() => { setActive(item.is_active); setPrice(fmt(item.token_price)); setRate(item.appearance_rate) }}
            className="text-xs font-medium text-muted border border-card-border rounded-lg px-2.5 py-1 hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-xs font-medium text-signal border border-signal/30 rounded-lg px-3 py-1 hover:bg-signal/10 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </li>
  )
}

/* ────────────────────────────────── bundles ──────────────────────────────── */

function BundleCard({
  bundle, items, isNew, onToast, onSaved, onDiscard,
}: {
  bundle: SupplyRow
  items: SupplyRow[]
  isNew: boolean
  onToast: Toast
  onSaved: () => void
  onDiscard: () => void
}) {
  const [name, setName] = useState(bundle.name)
  const [active, setActive] = useState(bundle.is_active)
  const [price, setPrice] = useState(fmt(bundle.token_price))
  const [rate, setRate] = useState(bundle.appearance_rate)
  const [counts, setCounts] = useState<Record<string, number>>(bundle.contents ?? {})
  const [saving, setSaving] = useState(false)

  // Only the items actually in it, so an emptied count does not linger as a 0.
  const contents = Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0))
  const size = Object.values(contents).reduce((a, b) => a + b, 0)
  const worth = money(items.reduce((sum, i) => sum + (contents[i.key] ?? 0) * num(i.token_price), 0))

  const dirty = isNew || name.trim() !== bundle.name || active !== bundle.is_active ||
    rate !== bundle.appearance_rate || parsePrice(price) !== money(num(bundle.token_price)) ||
    JSON.stringify(sorted(contents)) !== JSON.stringify(sorted(bundle.contents ?? {}))

  function setCount(key: string, raw: string) {
    const n = Math.max(0, Math.min(BUNDLE_ITEM_MAX, Math.round(Number(raw)) || 0))
    setCounts((c) => ({ ...c, [key]: n }))
  }

  function reset() {
    setName(bundle.name); setActive(bundle.is_active); setPrice(fmt(bundle.token_price))
    setRate(bundle.appearance_rate); setCounts(bundle.contents ?? {})
  }

  async function save() {
    const trimmed = name.trim()
    const p = parsePrice(price)
    if (!trimmed) { onToast('Give the bundle a name.'); return }
    if (size === 0) { onToast('Put at least one item in the bundle.'); return }
    if (p === null) { onToast('Price must be more than 0.'); return }

    const fields = { name: trimmed, contents, token_price: p, appearance_rate: rate, is_active: active }
    setSaving(true)
    const supabase = createClient()
    const { error } = isNew
      ? await supabase.from('vvm_supplies').insert({
          ...fields, key: bundle.key, kind: 'bundle', sort_order: bundle.sort_order,
        })
      : await supabase.from('vvm_supplies').update(fields).eq('key', bundle.key)
    setSaving(false)
    if (error) { onToast('Failed to save.'); return }
    onToast(isNew ? `${trimmed} created.` : `${trimmed} saved.`)
    onSaved()
  }

  async function remove() {
    if (!confirm(`Remove ${bundle.name}? It comes off the shelf straight away. Items already bought stay with their owners.`)) return
    setSaving(true)
    const { error } = await createClient().from('vvm_supplies').delete().eq('key', bundle.key)
    setSaving(false)
    if (error) { onToast('Failed to remove.'); return }
    onToast(`${bundle.name} removed.`)
    onSaved()
  }

  return (
    <li className={`bg-card border rounded-2xl p-4 space-y-3 ${isNew ? 'border-signal/50' : 'border-card-border'} ${active ? '' : 'opacity-70'}`}>
      <div className="flex items-center gap-3">
        <SupplyIcon supplyKey="bundle" className="w-9 h-9 shrink-0" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          aria-label="Bundle name"
          className="min-w-0 flex-1 bg-paper border border-card-border rounded-lg px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-signal"
        />
        <ActiveSwitch on={active} onChange={setActive} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {items.map((i) => (
          <label key={i.key} className="flex items-center gap-2 rounded-lg border border-card-border bg-paper px-2.5 py-1.5">
            <SupplyIcon supplyKey={i.key} className="w-5 h-5 shrink-0" />
            <span className="min-w-0 flex-1 text-xs truncate">
              {i.name}
              {!i.is_active && <span className="text-muted"> · off</span>}
            </span>
            <input
              type="number"
              min={0}
              max={BUNDLE_ITEM_MAX}
              step={1}
              value={counts[i.key] ?? 0}
              onChange={(e) => setCount(i.key, e.target.value)}
              aria-label={`${i.name} in the bundle`}
              className="w-14 bg-card border border-card-border rounded-md px-1.5 py-0.5 text-sm text-right font-mono outline-none focus:border-signal"
            />
          </label>
        ))}
      </div>

      <PriceAndRate
        price={price}
        rate={rate}
        onPrice={setPrice}
        onRate={setRate}
        hint={`(${size} item${size === 1 ? '' : 's'}, ${fmt(worth)} bought separately)`}
      />

      <div className="flex items-center justify-between gap-2">
        {isNew ? (
          <button
            onClick={onDiscard}
            className="text-xs font-medium text-muted border border-card-border rounded-lg px-2.5 py-1 hover:text-ink transition-colors"
          >
            Discard
          </button>
        ) : (
          <button
            onClick={remove}
            disabled={saving}
            className="text-xs font-medium text-red-500 border border-red-500/30 rounded-lg px-2.5 py-1 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            Remove bundle
          </button>
        )}
        {dirty && (
          <div className="flex gap-1.5">
            {!isNew && (
              <button
                onClick={reset}
                className="text-xs font-medium text-muted border border-card-border rounded-lg px-2.5 py-1 hover:text-ink transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="text-xs font-medium text-signal border border-signal/30 rounded-lg px-3 py-1 hover:bg-signal/10 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

/** Same keys in the same order, so two contents objects compare as JSON. */
function sorted(o: Record<string, number>): [string, number][] {
  return Object.entries(o).sort(([a], [b]) => a.localeCompare(b))
}
