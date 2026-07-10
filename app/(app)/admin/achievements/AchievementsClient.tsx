'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ACTIONS = [
  { value: 'timer_report', label: 'Log timers' },
  { value: 'stock_check', label: 'Stock reports' },
  { value: 'product_interest', label: 'Interest tracks' },
  { value: 'favorite_machine', label: 'Favorite machines' },
] as const

type ActionValue = typeof ACTIONS[number]['value']

interface BadgeIcon {
  id: number
  file: string
  label: string
  sort_order: number
}

interface Requirement {
  id: number
  action: string
  qty: number
}

interface Achievement {
  id: number
  name: string
  description: string
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  badge_icon_id: number | null
  badge_icons: { id: number; file: string; label: string } | { id: number; file: string; label: string }[] | null
  achievement_requirements: Requirement[] | null
}

interface Member {
  id: string
  username: string
  display_name: string | null
}

interface Props {
  achievements: Achievement[]
  badgeIcons: BadgeIcon[]
  members: Member[]
  userRole: string
}

interface ReqRow {
  action: ActionValue
  qty: number
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v
}

const EMPTY_FORM = {
  name: '',
  description: '',
  badgeIconId: null as number | null,
  startsAt: '',
  endsAt: '',
  requirements: [] as ReqRow[],
  isActive: false,
}

export default function AchievementsClient({ achievements, badgeIcons, members, userRole }: Props) {
  const isAdmin = userRole === 'admin'
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  // Grant panel state
  const [grantAchId, setGrantAchId] = useState<number | ''>('')
  const [grantMemberId, setGrantMemberId] = useState<string>('')
  const [granting, setGranting] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM })
    setEditingId(null)
    setView('create')
  }

  function openEdit(ach: Achievement) {
    const icon = one(ach.badge_icons)
    const reqs = (ach.achievement_requirements ?? []).map((r) => ({
      action: r.action as ActionValue,
      qty: r.qty,
    }))
    setForm({
      name: ach.name,
      description: ach.description,
      badgeIconId: ach.badge_icon_id,
      startsAt: ach.starts_at ? ach.starts_at.slice(0, 16) : '',
      endsAt: ach.ends_at ? ach.ends_at.slice(0, 16) : '',
      requirements: reqs,
      isActive: ach.is_active,
    })
    setEditingId(ach.id)
    setView('edit')
  }

  function addReq() {
    const used = form.requirements.map((r) => r.action)
    const next = ACTIONS.find((a) => !used.includes(a.value))
    if (!next) return
    setForm((f) => ({ ...f, requirements: [...f.requirements, { action: next.value, qty: 1 }] }))
  }

  function removeReq(i: number) {
    setForm((f) => ({ ...f, requirements: f.requirements.filter((_, j) => j !== i) }))
  }

  function updateReq(i: number, field: 'action' | 'qty', value: string | number) {
    setForm((f) => {
      const reqs = [...f.requirements]
      reqs[i] = { ...reqs[i], [field]: value }
      return { ...f, requirements: reqs }
    })
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Name is required.', false); return }
    const supabase = createClient()

    const achData = {
      name: form.name.trim(),
      description: form.description.trim(),
      badge_icon_id: form.badgeIconId,
      starts_at: form.startsAt || null,
      ends_at: form.endsAt || null,
      is_active: form.isActive,
    }

    if (view === 'create') {
      const { data: newAch, error } = await supabase
        .from('achievements')
        .insert(achData)
        .select('id')
        .single()
      if (error || !newAch) { showToast('Failed to create.', false); return }

      if (form.requirements.length > 0) {
        const { error: reqErr } = await supabase.from('achievement_requirements').insert(
          form.requirements.map((r) => ({ achievement_id: newAch.id, action: r.action, qty: r.qty }))
        )
        if (reqErr) { showToast('Created, but requirements failed to save.', false); return }
      }
      showToast('Achievement created.', true)
    } else if (editingId) {
      const { error } = await supabase.from('achievements').update(achData).eq('id', editingId)
      if (error) { showToast('Failed to update.', false); return }

      // Replace requirements: delete old, insert new
      await supabase.from('achievement_requirements').delete().eq('achievement_id', editingId)
      if (form.requirements.length > 0) {
        const { error: reqErr } = await supabase.from('achievement_requirements').insert(
          form.requirements.map((r) => ({ achievement_id: editingId, action: r.action, qty: r.qty }))
        )
        if (reqErr) { showToast('Saved, but requirements failed to save.', false); return }
      }
      showToast('Achievement updated.', true)
    }

    setView('list')
    startTransition(() => router.refresh())
  }

  async function handleToggleActive(ach: Achievement) {
    const supabase = createClient()
    await supabase.from('achievements').update({ is_active: !ach.is_active }).eq('id', ach.id)
    startTransition(() => router.refresh())
  }

  async function handleDelete(ach: Achievement) {
    if (!window.confirm(`Permanently delete "${ach.name}"? This removes it for everyone, including anyone who earned it. This cannot be undone.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('achievements').delete().eq('id', ach.id)
    if (error) { showToast('Failed to delete.', false); return }
    if (view !== 'list') setView('list')
    showToast('Achievement deleted.', true)
    startTransition(() => router.refresh())
  }

  async function handleGrant() {
    if (!grantAchId || !grantMemberId) return
    setGranting(true)
    const supabase = createClient()
    const { error } = await supabase.rpc('grant_achievement', { target: grantMemberId, ach: grantAchId })
    if (error) showToast('Failed to grant.', false)
    else {
      showToast('Badge granted.', true)
      setGrantAchId('')
      setGrantMemberId('')
    }
    setGranting(false)
    startTransition(() => router.refresh())
  }

  const filteredMembers = memberSearch.trim()
    ? members.filter((m) =>
        (m.display_name ?? m.username).toLowerCase().includes(memberSearch.toLowerCase())
      )
    : members

  const usedActions = form.requirements.map((r) => r.action)
  const availableActions = ACTIONS.filter((a) => !usedActions.includes(a.value))

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg ${toast.ok ? 'bg-ok text-white' : 'bg-ink text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Grant panel (admin only) ── */}
      {isAdmin && (
      <section className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
        <h2 className="font-display font-semibold text-base">Grant Badge</h2>
        <select
          value={grantAchId}
          onChange={(e) => setGrantAchId(e.target.value ? Number(e.target.value) : '')}
          className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal"
        >
          <option value="">Pick an achievement…</option>
          {achievements.filter((a) => a.is_active).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search member…"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="w-full bg-paper border border-card-border rounded-xl px-3 py-2 text-sm outline-none focus:border-signal placeholder:text-muted"
          />
          <select
            value={grantMemberId}
            onChange={(e) => setGrantMemberId(e.target.value)}
            size={Math.min(5, filteredMembers.length + 1)}
            className="w-full bg-paper border border-card-border rounded-xl px-3 py-1.5 text-sm outline-none focus:border-signal"
          >
            <option value="">Select member…</option>
            {filteredMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name ?? m.username}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGrant}
          disabled={!grantAchId || !grantMemberId || granting}
          className="w-full bg-signal hover:bg-signal/90 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
        >
          Grant badge
        </button>
      </section>
      )}

      {/* ── Builder / editor ── */}
      {view === 'list' ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base">Achievements</h2>
            {isAdmin && (
              <button
                onClick={openCreate}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-signal text-white hover:bg-signal/90 transition-colors"
              >
                + New
              </button>
            )}
          </div>
          {achievements.length === 0 ? (
            <p className="text-sm text-muted">No achievements yet.</p>
          ) : (
            <div className="space-y-2">
              {achievements.map((ach) => {
                const icon = one(ach.badge_icons)
                const reqs = ach.achievement_requirements ?? []
                return (
                  <div key={ach.id} className={`bg-card border rounded-2xl p-4 flex items-start gap-3 ${ach.is_active ? 'border-card-border' : 'border-card-border opacity-50'}`}>
                    {icon ? (
                      <img src={`/badges/${icon.file}`} alt={icon.label} className={`w-10 h-10 object-contain shrink-0 ${ach.is_active ? '' : 'grayscale'}`} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-paper border border-card-border flex items-center justify-center text-muted shrink-0">🏅</div>
                    )}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <p className="font-semibold text-sm">{ach.name}</p>
                      <p className="text-xs text-muted">{ach.description}</p>
                      {reqs.length === 0 ? (
                        <p className="font-mono text-[10px] text-muted">Discord-granted</p>
                      ) : (
                        <p className="font-mono text-[10px] text-muted">
                          {reqs.map((r) => `${r.qty} ${ACTIONS.find((a) => a.value === r.action)?.label ?? r.action}`).join(' · ')}
                        </p>
                      )}
                      {(ach.starts_at || ach.ends_at) && (
                        <p className="font-mono text-[10px] text-signal">
                          {ach.starts_at ? new Date(ach.starts_at).toLocaleDateString() : ''}
                          {ach.starts_at && ach.ends_at ? ' – ' : ''}
                          {ach.ends_at ? new Date(ach.ends_at).toLocaleDateString() : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEdit(ach)}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-card-border hover:border-ink/20 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(ach)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                              ach.is_active
                                ? 'border border-card-border text-muted hover:border-ink/20'
                                : 'bg-ok/10 text-ok border border-ok/20'
                            }`}
                          >
                            {ach.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(ach)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium border border-red-400/40 text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base">{view === 'create' ? 'New Achievement' : 'Edit Achievement'}</h2>
            <button onClick={() => setView('list')} className="text-sm text-muted hover:text-ink">Cancel</button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={80}
                className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-ink">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                maxLength={200}
                className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal resize-none"
              />
            </div>

            {/* Badge icon picker */}
            {badgeIcons.length > 0 && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-ink">Badge icon</label>
                <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1">
                  {badgeIcons.map((icon) => (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, badgeIconId: f.badgeIconId === icon.id ? null : icon.id }))}
                      className={`rounded-xl p-1 border-2 transition-colors ${
                        form.badgeIconId === icon.id ? 'border-signal' : 'border-transparent hover:border-card-border'
                      }`}
                      title={icon.label}
                    >
                      <img src={`/badges/${icon.file}`} alt={icon.label} className="w-full aspect-square object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Starts at (optional)</label>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  className="w-full bg-paper border border-card-border rounded-xl px-2 py-2 text-xs outline-none focus:border-signal"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted">Ends at (optional)</label>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  className="w-full bg-paper border border-card-border rounded-xl px-2 py-2 text-xs outline-none focus:border-signal"
                />
              </div>
            </div>

            {/* Requirements */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-ink">Requirements</label>
                {availableActions.length > 0 && (
                  <button
                    type="button"
                    onClick={addReq}
                    className="text-xs text-signal font-medium hover:text-signal/80"
                  >
                    + Add
                  </button>
                )}
              </div>
              {form.requirements.length === 0 && (
                <p className="text-xs text-muted italic">No requirements — this is a Discord-granted achievement.</p>
              )}
              {form.requirements.map((req, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={req.action}
                    onChange={(e) => updateReq(i, 'action', e.target.value)}
                    className="flex-1 bg-paper border border-card-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-signal"
                  >
                    {ACTIONS.map((a) => (
                      <option key={a.value} value={a.value} disabled={usedActions.includes(a.value) && req.action !== a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={req.qty}
                    onChange={(e) => updateReq(i, 'qty', Number(e.target.value))}
                    className="w-16 bg-paper border border-card-border rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:border-signal"
                  />
                  <button
                    type="button"
                    onClick={() => removeReq(i)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-paper transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Active toggle */}
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
                {form.isActive ? 'Visible to members — can be earned now' : 'Offline draft — not visible to members yet'}
              </p>
            </div>
            <div className={`w-10 h-6 rounded-full flex items-center transition-colors shrink-0 ${form.isActive ? 'bg-ok' : 'bg-card-border'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${form.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>

          <button
            onClick={handleSave}
            className="w-full bg-signal hover:bg-signal/90 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
          >
            {view === 'create' ? 'Create achievement' : 'Save changes'}
          </button>
        </section>
      )}
    </div>
  )
}
