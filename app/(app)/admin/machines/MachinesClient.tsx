'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Machine {
  id: string
  machine_code: string
  region: string
  city: string
  neighborhood: string | null
  venue: string
  address: string | null
  nickname: string | null
  latitude: number | null
  longitude: number | null
  is_active: boolean
}

interface Props {
  machines: Machine[]
}

interface EditState {
  machineCode: string
  region: string
  city: string
  neighborhood: string
  venue: string
  address: string
  nickname: string
  latitude: string
  longitude: string
}

export default function MachinesClient({ machines }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)

  const [machineCode, setMachineCode] = useState('')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [venue, setVenue] = useState('')
  const [address, setAddress] = useState('')
  const [nickname, setNickname] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')

  const filtered = query
    ? machines.filter((m) =>
        [m.machine_code, m.region, m.city, m.neighborhood, m.venue, m.address, m.nickname]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    : machines

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAdd() {
    if (!machineCode.trim() || !region.trim() || !city.trim() || !venue.trim()) return
    const supabase = createClient()
    const { error } = await supabase.from('machines').insert({
      machine_code: machineCode.trim(),
      region: region.trim(),
      city: city.trim(),
      neighborhood: neighborhood || null,
      venue: venue.trim(),
      address: address || null,
      nickname: nickname || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    })
    if (error) {
      showToast('Failed to add machine.')
      return
    }
    showToast('Machine added.')
    setMachineCode(''); setRegion(''); setCity(''); setNeighborhood('')
    setVenue(''); setAddress(''); setNickname(''); setLatitude(''); setLongitude('')
    startTransition(() => router.refresh())
  }

  async function toggleMachine(id: string, current: boolean) {
    const supabase = createClient()
    await supabase.from('machines').update({ is_active: !current }).eq('id', id)
    startTransition(() => router.refresh())
  }

  async function deleteMachine(id: string, label: string) {
    if (!window.confirm(`Permanently delete "${label}"? This cannot be undone.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('machines').delete().eq('id', id)
    if (error) { showToast('Failed to delete machine.'); return }
    showToast('Machine deleted.')
    startTransition(() => router.refresh())
  }

  function startEdit(m: Machine) {
    setEditingId(m.id)
    setEditState({
      machineCode: m.machine_code,
      region: m.region,
      city: m.city,
      neighborhood: m.neighborhood ?? '',
      venue: m.venue,
      address: m.address ?? '',
      nickname: m.nickname ?? '',
      latitude: m.latitude != null ? String(m.latitude) : '',
      longitude: m.longitude != null ? String(m.longitude) : '',
    })
  }

  async function handleSaveEdit(id: string) {
    if (!editState) return
    const supabase = createClient()
    const { error } = await supabase.from('machines').update({
      machine_code: editState.machineCode.trim(),
      region: editState.region.trim(),
      city: editState.city.trim(),
      neighborhood: editState.neighborhood.trim() || null,
      venue: editState.venue.trim(),
      address: editState.address.trim() || null,
      nickname: editState.nickname.trim() || null,
      latitude: editState.latitude ? parseFloat(editState.latitude) : null,
      longitude: editState.longitude ? parseFloat(editState.longitude) : null,
    }).eq('id', id)
    if (error) { showToast('Failed to save changes.'); return }
    showToast('Machine updated.')
    setEditingId(null)
    setEditState(null)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg bg-ink text-white">
          {toast}
        </div>
      )}

      <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold text-sm">Add machine</h3>
        <input value={machineCode} onChange={(e) => setMachineCode(e.target.value)} placeholder="Machine code (e.g. Q00037)" className="input-field" />
        <div className="flex gap-2">
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region" className="input-field flex-1" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="input-field flex-1" />
        </div>
        <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Neighborhood (optional)" className="input-field" />
        <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue (e.g. Fred Meyer)" className="input-field" />
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname (optional, e.g. Main entrance)" className="input-field" />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" className="input-field" />
        <div className="flex gap-2">
          <input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Lat" className="input-field flex-1" />
          <input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Long" className="input-field flex-1" />
        </div>
        <button onClick={handleAdd} className="btn-primary w-full">Add machine</button>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search machines…"
        className="w-full bg-card border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 placeholder:text-muted"
      />

      <ul className="space-y-2">
        {filtered.map((m) => (
          <li key={m.id} className="bg-card border border-card-border rounded-xl overflow-hidden">
            {editingId === m.id && editState ? (
              <div className="p-4 space-y-2">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Editing {m.machine_code}</p>
                <input value={editState.machineCode} onChange={(e) => setEditState({ ...editState, machineCode: e.target.value })} placeholder="Machine code" className="input-field" />
                <div className="flex gap-2">
                  <input value={editState.region} onChange={(e) => setEditState({ ...editState, region: e.target.value })} placeholder="Region" className="input-field flex-1" />
                  <input value={editState.city} onChange={(e) => setEditState({ ...editState, city: e.target.value })} placeholder="City" className="input-field flex-1" />
                </div>
                <input value={editState.neighborhood} onChange={(e) => setEditState({ ...editState, neighborhood: e.target.value })} placeholder="Neighborhood (optional)" className="input-field" />
                <input value={editState.venue} onChange={(e) => setEditState({ ...editState, venue: e.target.value })} placeholder="Venue" className="input-field" />
                <input value={editState.nickname} onChange={(e) => setEditState({ ...editState, nickname: e.target.value })} placeholder="Nickname (optional)" className="input-field" />
                <input value={editState.address} onChange={(e) => setEditState({ ...editState, address: e.target.value })} placeholder="Address (optional)" className="input-field" />
                <div className="flex gap-2">
                  <input value={editState.latitude} onChange={(e) => setEditState({ ...editState, latitude: e.target.value })} placeholder="Lat" className="input-field flex-1" />
                  <input value={editState.longitude} onChange={(e) => setEditState({ ...editState, longitude: e.target.value })} placeholder="Long" className="input-field flex-1" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => handleSaveEdit(m.id)} className="btn-primary flex-1">Save</button>
                  <button onClick={() => { setEditingId(null); setEditState(null) }} className="flex-1 border border-card-border rounded-xl py-2 text-sm font-semibold text-ink hover:border-ink/30 transition-colors">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    <span className="font-mono text-muted">{m.machine_code}</span> — {m.venue}{m.nickname ? ` (${m.nickname})` : ''}
                  </p>
                  <p className="font-mono text-xs text-muted truncate">{m.region} · {m.city}{m.address ? ` · ${m.address}` : ''}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => startEdit(m)}
                    className="text-xs font-medium px-3 py-1 rounded-lg border border-card-border hover:border-ink/30 text-ink transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleMachine(m.id, m.is_active)}
                    className={`text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${m.is_active ? 'text-ok border-ok/30 hover:bg-ok/10' : 'text-muted border-card-border hover:text-ink'}`}
                  >
                    {m.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => deleteMachine(m.id, `${m.machine_code} — ${m.venue}`)}
                    className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted">No matches.</p>}
      </ul>

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
      `}</style>
    </div>
  )
}
