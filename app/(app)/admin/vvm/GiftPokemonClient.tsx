'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

export interface GiftMember { user_id: string; username: string; display_name: string | null }
export interface GiftRow {
  id: number
  user_id: string
  species: string
  level: number | null
  note: string | null
  created_at: string
  claimed_at: string | null
  member: { username: string; display_name: string | null } | null
}
interface Species { id: number; name: string }

const NOTE_MAX = 120
const memberName = (m: { username: string; display_name: string | null }) => (m.display_name ? `${m.display_name} (@${m.username})` : `@${m.username}`)

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

/**
 * Send a member a Pokémon for the battle game (admin_gift_pokemon, v82): for
 * Discord activities and the like. Their game collects it the next time it
 * opens or syncs, rolled like a wild one: random IVs and nature, the same
 * shiny odds, and a wild one's level unless one is set here.
 */
export default function GiftPokemonClient({ members, recent }: { members: GiftMember[]; recent: GiftRow[] }) {
  const toast = useToast()
  const [species, setSpecies] = useState<Species[]>([])
  const [who, setWho] = useState('')
  const [pick, setPick] = useState('')
  const [level, setLevel] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [rows, setRows] = useState(recent)

  // The game's own list of species (public/rpg/species.json, kept in step with the game by its tests).
  useEffect(() => {
    fetch('/rpg/species.json').then((r) => r.json()).then((l: Species[]) => setSpecies(l)).catch(() => setSpecies([]))
  }, [])
  const chosen = useMemo(() => species.find((s) => s.name === pick.trim().toUpperCase()) ?? null, [species, pick])
  const lv = level.trim() === '' ? null : Number(level)
  const levelOk = lv === null || (Number.isInteger(lv) && lv >= 1 && lv <= 100)

  async function send() {
    if (!who || !chosen || !levelOk) return
    setSending(true)
    const { data, error } = await createClient().rpc('admin_gift_pokemon', { p_user: who, p_species: chosen.name, p_level: lv, p_note: note.trim() || null })
    setSending(false)
    if (error) { toast.show(`Couldn't send it: ${error.message}`); return }
    const m = members.find((x) => x.user_id === who)!
    toast.show(`${chosen.name} is on its way to ${m.display_name || m.username}.`)
    setRows((r) => [{ id: Number(data), user_id: who, species: chosen.name, level: lv, note: note.trim() || null, created_at: new Date().toISOString(), claimed_at: null, member: { username: m.username, display_name: m.display_name } }, ...r].slice(0, 15))
    setPick(''); setLevel(''); setNote('')
  }

  const spriteOf = (name: string) => species.find((s) => s.name === name)?.id

  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-base">Gift a Pokémon</h2>
        <p className="text-xs text-muted leading-snug">
          For Discord activities and the like. Their game collects it the next time they open the VVM tab, rolled
          like a wild one: random IVs and nature, the same 1-in-500 shiny chance. It joins their party, or their
          Box if the party is full.
        </p>
      </div>

      <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium">Member</span>
          <select value={who} onChange={(e) => setWho(e.target.value)}
            className="w-full bg-card border border-card-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-signal">
            <option value="">Choose a member…</option>
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{memberName(m)}</option>)}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium">Pokémon</span>
          <div className="flex items-center gap-2">
            <input list="gift-species" value={pick} onChange={(e) => setPick(e.target.value)} placeholder={species.length ? `Type to search ${species.length} Pokémon` : 'Loading…'}
              className="flex-1 bg-card border border-card-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-signal uppercase placeholder:normal-case"
              aria-label="Pokémon to gift" />
            <datalist id="gift-species">{species.map((s) => <option key={s.id + s.name} value={s.name} />)}</datalist>
            <span className="w-10 h-10 shrink-0 rounded-lg bg-paper border border-card-border flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {chosen && <img src={`/rpg/a/${chosen.id}.gif`} alt={chosen.name} className="max-w-full max-h-full [image-rendering:pixelated]" />}
            </span>
          </div>
          {pick.trim() !== '' && !chosen && <span className="text-[11px] text-signal">Pick one from the list.</span>}
        </label>

        <div className="flex gap-3">
          <label className="block space-y-1 w-28 shrink-0">
            <span className="text-xs font-medium">Level</span>
            <input type="number" inputMode="numeric" min={1} max={100} value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Like wild"
              className="w-full bg-card border border-card-border rounded-lg px-2 py-1.5 text-sm font-mono outline-none focus:border-signal" />
          </label>
          <label className="block space-y-1 flex-1 min-w-0">
            <span className="text-xs font-medium">Note <span className="text-muted font-normal">(they'll see it)</span></span>
            <input value={note} onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))} placeholder="e.g. Discord art contest winner"
              className="w-full bg-card border border-card-border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-signal" />
          </label>
        </div>
        {!levelOk && <p className="text-[11px] text-signal">The level must be a whole number from 1 to 100, or blank.</p>}

        <button type="button" onClick={send} disabled={sending || !who || !chosen || !levelOk}
          className="text-xs font-medium text-signal border border-signal/30 rounded-lg px-3 py-1.5 hover:bg-signal/10 transition-colors disabled:opacity-50">
          {sending ? 'Sending…' : 'Send gift'}
        </button>
      </div>

      {rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((g) => (
            <li key={g.id} className="bg-card border border-card-border rounded-xl px-3 py-2 flex items-center gap-2.5">
              <span className="w-8 h-8 shrink-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {spriteOf(g.species) && <img src={`/rpg/a/${spriteOf(g.species)}.gif`} alt="" className="max-w-full max-h-full [image-rendering:pixelated]" />}
              </span>
              <p className="text-xs min-w-0 flex-1">
                <span className="font-medium">{g.species}</span>
                {g.level != null && <span className="text-muted"> Lv {g.level}</span>}
                <span className="text-muted"> to </span>
                <span className="font-medium">{g.member ? memberName(g.member) : 'a member'}</span>
                {g.note && <span className="block text-muted truncate">{g.note}</span>}
              </p>
              <span className={`font-mono text-[11px] shrink-0 ${g.claimed_at ? 'text-signal' : 'text-muted'}`}>
                {g.claimed_at ? 'Collected' : 'Waiting'} · {ago(g.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
