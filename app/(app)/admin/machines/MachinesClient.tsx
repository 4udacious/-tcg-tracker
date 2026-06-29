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

export default function MachinesClient({ machines }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const [query, setQuery] = useState('')

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
          <li key={m.id} className="bg-card border border-card-border rounded-xl px-4 py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                <span className="font-mono text-muted">{m.machine_code}</span> — {m.venue}{m.nickname ? ` (${m.nickname})` : ''}
              </p>
              <p className="font-mono text-xs text-muted truncate">{m.region} · {m.city}{m.address ? ` · ${m.address}` : ''}</p>
            </div>
            <button
              onClick={() => toggleMachine(m.id, m.is_active)}
              className={`shrink-0 text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${m.is_active ? 'text-ok border-ok/30 hover:bg-ok/10' : 'text-muted border-card-border hover:text-ink'}`}
            >
              {m.is_active ? 'Active' : 'Inactive'}
            </button>
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
