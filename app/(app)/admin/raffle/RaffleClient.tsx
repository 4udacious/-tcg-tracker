'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export interface RaffleTicket {
  id: number
  name: string
  description: string | null
  token_price: number
  rarity: string
  image_url: string | null
  starts_at: string | null
  ends_at: string | null
  total_quantity: number
  claimed_quantity: number
  /** null = a member may hold any number of this ticket. */
  per_user_limit: number | null
  is_active: boolean
  created_at: string
}

export interface TicketHolder {
  id: number
  ticket_id: number
  acquired_at: string
  holder: string
}

/** Chances mirror raffle_rarity_chance() in the database. */
const RARITIES = [
  { value: 'common', label: 'Common', chance: '50%', className: 'text-muted border-card-border' },
  { value: 'uncommon', label: 'Uncommon', chance: '30%', className: 'text-ok border-ok/40 bg-ok/5' },
  { value: 'rare', label: 'Rare', chance: '15%', className: 'text-sky-500 border-sky-400/40 bg-sky-400/5' },
  { value: 'ultra', label: 'Ultra', chance: '6%', className: 'text-[#a855f7] border-[#a855f7]/40 bg-[#a855f7]/5' },
  { value: 'legendary', label: 'Legendary', chance: '2%', className: 'text-signal border-signal/40 bg-signal/5' },
] as const

const MAX_IMAGE_BYTES = 2 * 1024 * 1024

const EMPTY_FORM = {
  name: '',
  description: '',
  tokenPrice: 1,
  rarity: 'common' as string,
  imageUrl: null as string | null,
  startsAt: '',
  endsAt: '',
  totalQuantity: 10,
  // Empty string means "no cap", so the input can be cleared.
  perUserLimit: '' as number | '',
  isActive: false,
}

function rarityMeta(r: string) {
  return RARITIES.find((x) => x.value === r) ?? RARITIES[0]
}

export default function RaffleClient({ tickets, holders }: { tickets: RaffleTicket[]; holders: TicketHolder[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedHolders, setExpandedHolders] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM })
    setEditingId(null)
    setView('form')
  }

  function openEdit(t: RaffleTicket) {
    setForm({
      name: t.name,
      description: t.description ?? '',
      tokenPrice: t.token_price,
      rarity: t.rarity,
      imageUrl: t.image_url,
      startsAt: t.starts_at ? t.starts_at.slice(0, 16) : '',
      endsAt: t.ends_at ? t.ends_at.slice(0, 16) : '',
      totalQuantity: t.total_quantity,
      perUserLimit: t.per_user_limit ?? '',
      isActive: t.is_active,
    })
    setEditingId(t.id)
    setView('form')
  }

  async function handleUpload(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      showToast('Image must be 2MB or smaller.', false)
      return
    }
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('raffle-tickets').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) {
      showToast('Upload failed.', false)
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('raffle-tickets').getPublicUrl(path)
    setForm((f) => ({ ...f, imageUrl: data.publicUrl }))
    setUploading(false)
    showToast('Image uploaded.', true)
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Name is required.', false); return }
    if (form.totalQuantity < 1) { showToast('Quantity must be at least 1.', false); return }
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      showToast('End date must be after the start date.', false); return
    }
    if (form.perUserLimit !== '' && Number(form.perUserLimit) < 1) {
      showToast('Per-member limit must be at least 1, or blank for no limit.', false); return
    }
    if (form.perUserLimit !== '' && Number(form.perUserLimit) > form.totalQuantity) {
      showToast('Per-member limit cannot exceed the total quantity.', false); return
    }
    if (editingId) {
      const current = tickets.find((t) => t.id === editingId)
      if (current && form.totalQuantity < current.claimed_quantity) {
        showToast(`Already claimed ${current.claimed_quantity}; quantity can't go below that.`, false)
        return
      }
    }

    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      token_price: form.tokenPrice,
      rarity: form.rarity,
      image_url: form.imageUrl,
      starts_at: form.startsAt || null,
      ends_at: form.endsAt || null,
      total_quantity: form.totalQuantity,
      per_user_limit: form.perUserLimit === '' ? null : Number(form.perUserLimit),
      is_active: form.isActive,
    }

    const { error } = editingId
      ? await supabase.from('raffle_tickets').update(payload).eq('id', editingId)
      : await supabase.from('raffle_tickets').insert(payload)

    setSaving(false)
    if (error) { showToast(editingId ? 'Failed to update.' : 'Failed to create.', false); return }
    showToast(editingId ? 'Ticket updated.' : 'Ticket created.', true)
    setView('list')
    startTransition(() => router.refresh())
  }

  async function handleToggleActive(t: RaffleTicket) {
    const supabase = createClient()
    const { error } = await supabase
      .from('raffle_tickets')
      .update({ is_active: !t.is_active })
      .eq('id', t.id)
    if (error) { showToast('Failed to update.', false); return }
    startTransition(() => router.refresh())
  }

  async function handleDelete(t: RaffleTicket) {
    const owned = holders.filter((h) => h.ticket_id === t.id).length
    const warning = owned > 0
      ? `"${t.name}" has been claimed ${owned} time${owned === 1 ? '' : 's'}. Deleting it also removes it from those members' collections. This cannot be undone.`
      : `Permanently delete "${t.name}"? This cannot be undone.`
    if (!window.confirm(warning)) return
    const supabase = createClient()
    const { error } = await supabase.from('raffle_tickets').delete().eq('id', t.id)
    if (error) { showToast('Failed to delete.', false); return }
    showToast('Ticket deleted.', true)
    startTransition(() => router.refresh())
  }

  const holdersFor = (id: number) => holders.filter((h) => h.ticket_id === id)

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg ${toast.ok ? 'bg-ok text-white' : 'bg-ink text-white'}`}>
          {toast.msg}
        </div>
      )}

      {view === 'list' ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-base">Raffle Tickets</h2>
              <p className="text-xs text-muted">Rarer tickets appear in the machine less often.</p>
            </div>
            <button
              onClick={openCreate}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-signal text-white hover:bg-signal/90 transition-colors"
            >
              + New
            </button>
          </div>

          {tickets.length === 0 ? (
            <p className="text-sm text-muted">No raffle tickets yet.</p>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => {
                const meta = rarityMeta(t.rarity)
                const remaining = t.total_quantity - t.claimed_quantity
                const owners = holdersFor(t.id)
                const expired = t.ends_at ? new Date(t.ends_at) < new Date() : false
                const pending = t.starts_at ? new Date(t.starts_at) > new Date() : false
                return (
                  <li key={t.id} className={`bg-card border border-card-border rounded-2xl p-4 space-y-3 ${t.is_active ? '' : 'opacity-60'}`}>
                    <div className="flex items-start gap-3">
                      {t.image_url ? (
                        <img src={t.image_url} alt="" className="w-14 h-14 rounded-xl object-cover bg-paper shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-paper border border-card-border flex items-center justify-center text-xl shrink-0">🎟️</div>
                      )}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{t.name}</p>
                          <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${meta.className}`}>
                            {meta.label} · {meta.chance}
                          </span>
                          {!t.is_active && <span className="font-mono text-[10px] text-muted">inactive</span>}
                          {expired && <span className="font-mono text-[10px] text-muted">ended</span>}
                          {pending && <span className="font-mono text-[10px] text-signal">scheduled</span>}
                        </div>
                        {t.description && <p className="text-xs text-muted leading-snug">{t.description}</p>}
                        <p className="font-mono text-[11px] text-muted">
                          {t.token_price} token{t.token_price === 1 ? '' : 's'} · {remaining}/{t.total_quantity} left
                          {t.per_user_limit ? ` · max ${t.per_user_limit} per member` : ''}
                        </p>
                        {(t.starts_at || t.ends_at) && (
                          <p className="font-mono text-[10px] text-signal">
                            {t.starts_at ? new Date(t.starts_at).toLocaleDateString() : 'any time'}
                            {' – '}
                            {t.ends_at ? new Date(t.ends_at).toLocaleDateString() : 'no end'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="h-1.5 bg-paper rounded-full overflow-hidden">
                      <div
                        className="h-full bg-signal rounded-full transition-all"
                        style={{ width: `${Math.round((t.claimed_quantity / t.total_quantity) * 100)}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => openEdit(t)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-card-border hover:border-ink/20 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(t)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          t.is_active
                            ? 'border border-card-border text-muted hover:border-ink/20'
                            : 'bg-ok/10 text-ok border border-ok/20'
                        }`}
                      >
                        {t.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      {owners.length > 0 && (
                        <button
                          onClick={() => setExpandedHolders(expandedHolders === t.id ? null : t.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium border border-card-border hover:border-ink/20 transition-colors"
                        >
                          {owners.length} holder{owners.length === 1 ? '' : 's'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(t)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-red-400/40 text-red-500 hover:bg-red-500/10 transition-colors ml-auto"
                      >
                        Delete
                      </button>
                    </div>

                    {expandedHolders === t.id && owners.length > 0 && (
                      <ul className="border-t border-card-border pt-2 space-y-1">
                        {owners.map((h) => (
                          <li key={h.id} className="flex justify-between text-xs">
                            <span className="text-ink">{h.holder}</span>
                            <span className="font-mono text-muted">{new Date(h.acquired_at).toLocaleDateString()}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      ) : (
        <section className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base">{editingId ? 'Edit Ticket' : 'New Ticket'}</h2>
            <button onClick={() => setView('list')} className="text-sm text-muted hover:text-ink">Cancel</button>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-ink">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={80}
              placeholder="e.g. Booster Box Raffle"
              className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal placeholder:text-muted"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-ink">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              maxLength={200}
              placeholder="What the winner gets"
              className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal resize-none placeholder:text-muted"
            />
          </div>

          {/* Artwork */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink">Artwork</label>
            <div className="flex items-center gap-3">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover bg-paper shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-paper border border-card-border flex items-center justify-center text-2xl shrink-0">🎟️</div>
              )}
              <div className="space-y-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleUpload(f)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-xs font-medium text-signal border border-signal/30 rounded-lg px-3 py-1.5 hover:bg-signal/10 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : form.imageUrl ? 'Replace image' : 'Upload image'}
                </button>
                {form.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}
                    className="block text-xs text-muted hover:text-ink transition-colors"
                  >
                    Remove
                  </button>
                )}
                <p className="text-[10px] text-muted">PNG, JPG, WEBP or GIF · max 2MB</p>
              </div>
            </div>
          </div>

          {/* Price + quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink">Token price</label>
              <input
                type="number"
                min={0}
                max={999}
                value={form.tokenPrice}
                onChange={(e) => setForm((f) => ({ ...f, tokenPrice: Number(e.target.value) }))}
                className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink">Total quantity</label>
              <input
                type="number"
                min={1}
                max={9999}
                value={form.totalQuantity}
                onChange={(e) => setForm((f) => ({ ...f, totalQuantity: Number(e.target.value) }))}
                className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal"
              />
            </div>
          </div>

          {/* Per-member holding cap */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-ink">Limit per member</label>
            <p className="text-xs text-muted leading-snug">
              Most copies one member may hold. Leave blank for no limit.
            </p>
            <input
              type="number"
              min={1}
              max={form.totalQuantity}
              value={form.perUserLimit}
              placeholder="No limit"
              onChange={(e) =>
                setForm((f) => ({ ...f, perUserLimit: e.target.value === '' ? '' : Number(e.target.value) }))
              }
              className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal placeholder:text-muted"
            />
          </div>

          {/* Rarity */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-ink">Rarity</label>
            <p className="text-xs text-muted leading-snug">
              Sets how likely the ticket is to show up each time the machine restocks.
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {RARITIES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, rarity: r.value }))}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    form.rarity === r.value ? r.className + ' font-bold' : 'text-muted border-card-border hover:text-ink'
                  }`}
                >
                  {r.label} <span className="font-mono opacity-70">{r.chance}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Appearance window */}
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium text-ink">Appearance window</label>
              <p className="text-xs text-muted leading-snug">
                The ticket only appears between these dates. Leave blank for no limit.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Starts</label>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  className="w-full bg-paper border border-card-border rounded-xl px-2 py-2 text-xs outline-none focus:border-signal"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Ends</label>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  className="w-full bg-paper border border-card-border rounded-xl px-2 py-2 text-xs outline-none focus:border-signal"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
              form.isActive ? 'border-ok/40 bg-ok/5' : 'border-card-border bg-paper'
            }`}
          >
            <div className="text-left">
              <p className="text-sm font-medium text-ink">Active</p>
              <p className="text-xs text-muted">
                {form.isActive ? 'Can be rolled into the machine' : 'Draft — never appears'}
              </p>
            </div>
            <div className={`w-10 h-6 rounded-full flex items-center transition-colors shrink-0 ${form.isActive ? 'bg-ok' : 'bg-card-border'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${form.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>

          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="w-full bg-signal hover:bg-signal/90 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
          >
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create ticket'}
          </button>
        </section>
      )}
    </div>
  )
}
