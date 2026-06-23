'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Toast, useToast } from '@/components/Toast'
import { useRouter } from 'next/navigation'

export default function MachinesClient({ machines }: any) {
  const router = useRouter()
  const { toast, show, dismiss } = useToast()
  const [isPending, startTransition] = useTransition()

  const [machineCode, setMachineCode] = useState('')
  const [area, setArea] = useState('')
  const [venue, setVenue] = useState('')
  const [address, setAddress] = useState('')
  const [nickname, setNickname] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!machineCode || !area || !venue || !address) return
    const supabase = createClient()
    const { error } = await (supabase as any).from('machines').insert({
      machine_code: machineCode,
      area,
      venue,
      address,
      nickname: nickname || null,
      is_active: true,
    })
    if (error) { show('Failed to add machine.', 'error'); return }
    show('Machine added.', 'success')
    setMachineCode(''); setArea(''); setVenue(''); setAddress(''); setNickname('')
    startTransition(() => router.refresh())
  }

  async function toggleActive(id: string, current: boolean) {
    const supabase = createClient()
    await (supabase as any).from('machines').update({ is_active: !current }).eq('id', id)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismiss} />}

      <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>Machines</h1>

      <form onSubmit={handleAdd} className="bg-[var(--card)] border border-[var(--card-border)] rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-semibold">Add Machine</h3>
        {[
          { label: 'Machine Code', value: machineCode, set: setMachineCode, placeholder: 'Q00037' },
          { label: 'Area', value: area, set: setArea, placeholder: 'Federal Way' },
          { label: 'Venue', value: venue, set: setVenue, placeholder: 'Fred Meyer' },
          { label: 'Address', value: address, set: setAddress, placeholder: '33702 21st Ave SW' },
          { label: 'Nickname (optional)', value: nickname, set: setNickname, placeholder: 'Main entrance', required: false },
        ].map(({ label, value, set, placeholder, required = true }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1 uppercase tracking-wide font-mono">{label}</label>
            <input
              type="text" value={value} onChange={e => set(e.target.value)}
              placeholder={placeholder} required={required}
              className="w-full border border-[var(--card-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
            />
          </div>
        ))}
        <button type="submit" disabled={isPending} className="w-full bg-[var(--signal)] text-[var(--ink)] font-bold rounded-xl py-2.5 text-sm disabled:opacity-40">
          Add Machine
        </button>
      </form>

      <ul className="space-y-2">
        {machines.map((m: any) => (
          <li key={m.id} className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold font-mono">{m.machine_code}</p>
              <p className="text-sm text-[var(--ink)]">{m.venue}{m.nickname ? ` (${m.nickname})` : ''}</p>
              <p className="text-xs text-[var(--muted)] font-mono">{m.area} · {m.address}</p>
            </div>
            <button
              onClick={() => toggleActive(m.id, m.is_active)}
              className={`text-xs px-3 py-1 rounded-full border shrink-0 ${m.is_active ? 'border-[var(--ok)] text-[var(--ok)]' : 'border-[var(--muted)] text-[var(--muted)]'}`}
            >
              {m.is_active ? 'Active' : 'Inactive'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
