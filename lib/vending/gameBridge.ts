import { createClient } from '@/lib/supabase/client'

/*
 * The battle game (public/rpg) is the VVM's interface in the app, and this is
 * how it reaches the real machine. PlayFrame puts the object below on its own
 * window as `__vvmApi`; the game, in a same-origin frame, calls it through
 * `parent.__vvmApi`. Every call goes through the signed-in member's Supabase
 * session, so the server's rules (one holder at a time, cooldown, stock,
 * prices, the battle award caps) are the ones that apply.
 *
 * Results are plain JSON so they cross into the frame cleanly.
 */

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
const n = (v: unknown) => { const x = typeof v === 'number' ? v : Number(v); return Number.isFinite(x) ? x : 0 }

export interface VvmMachine {
  status: string
  cycle_no: number
  /** Seconds until the machine next changes state, and whether that clock is paused (someone holds the machine). */
  seconds_left: number
  frozen: boolean
  holder_id: string | null
  holder_name: string | null
  holder_expires: string | null
  me: string
  cooldown_until: string | null
  balance: number
  /** Which battles are on for you: always both for admins; for members, what an admin has made live. */
  wild: boolean
  trainers: boolean
  /** What a Pokémon Center heal costs after the day's free ones (v79; null before it). */
  heal_price: number | null
  /** How often an empty tap turns up a spare item, 0-1 (v80; null before it). */
  find_chance: number | null
  packs: { set_code: string; set_name: string; image: string; quantity: number; description: string | null }[]
  tickets: { ticket_id: number; name: string; image: string | null; price: number; quantity: number; max: number }[]
  supplies: { key: string; kind: 'item' | 'bundle'; name: string; description: string | null; price: number; contents: { key: string; qty: number }[] | null }[]
  /** Sealed booster boxes on the shelf; `max` is how many you may add now (stock, what's left, your own cap). */
  boxes: { box_id: number; name: string; set_name: string | null; packs: number; price: number; image: string | null; quantity: number; max: number }[]
}

export function makeVvmApi(userId: string) {
  const db = createClient()
  let holding = false
  let activeMachines: { code: string; venue: string; city: string }[] | null = null

  async function balance() {
    const { data } = await db.rpc('token_breakdown')
    return n(one(data as { total: number } | null)?.total)
  }

  return {
    /** The machine as everyone sees it, plus your balance and cooldown. */
    async machine(): Promise<VvmMachine | null> {
      const { data } = await db.rpc('get_vending_state')
      const st = one(data as { status: string; cycle_no: number; seconds_left: number; frozen: boolean; holder_id: string | null; holder_name: string | null; holder_expires: string | null } | null)
      if (!st) return null
      const stocked = st.status === 'in_stock' || st.status === 'out_of_stock'
      const [stock, tickets, supplies, boxes, me, bal, battles] = await Promise.all([
        stocked ? db.rpc('get_vending_stock', { p_cycle: st.cycle_no }) : Promise.resolve({ data: [] }),
        stocked ? db.rpc('get_vending_ticket_stock', { p_cycle: st.cycle_no }) : Promise.resolve({ data: [] }),
        stocked ? db.rpc('get_vending_supply_stock', { p_cycle: st.cycle_no }) : Promise.resolve({ data: [] }),
        stocked ? db.rpc('get_vending_box_stock', { p_cycle: st.cycle_no }) : Promise.resolve({ data: [] }),
        db.from('profiles').select('vending_cooldown_until').eq('id', userId).single(),
        balance(),
        db.rpc('battle_modes'),
      ])
      type P = { set_code: string; set_name: string; display_image_url: string; quantity: number; description: string | null }
      type T = { ticket_id: number; name: string; image_url: string | null; token_price: number; quantity: number; remaining: number; per_user_limit: number | null; owned: number }
      type S = { key: string; kind: 'item' | 'bundle'; name: string; description: string | null; token_price: number; contents: { key: string; qty: number }[] | null }
      type B = { box_id: number; name: string; set_name: string | null; packs: number; token_price: number; quantity: number; remaining: number; per_user_limit: number | null; owned: number; pack_images: string[] | null; image_url?: string | null }
      holding = st.holder_id === userId
      return {
        status: st.status, cycle_no: st.cycle_no, seconds_left: n(st.seconds_left), frozen: !!st.frozen, holder_id: st.holder_id, holder_name: st.holder_name, holder_expires: st.holder_expires,
        me: userId, cooldown_until: (me.data as { vending_cooldown_until: string | null } | null)?.vending_cooldown_until ?? null, balance: bal,
        wild: one(battles.data as { wild: boolean } | null)?.wild === true,
        trainers: one(battles.data as { trainers: boolean } | null)?.trainers === true,
        heal_price: one(battles.data as { heal_price?: number | null } | null)?.heal_price != null ? n(one(battles.data as { heal_price: number })!.heal_price) : null,
        find_chance: one(battles.data as { find_chance?: number | null } | null)?.find_chance != null ? n(one(battles.data as { find_chance: number })!.find_chance) : null,
        packs: ((stock.data as P[] | null) ?? []).map((p) => ({ set_code: p.set_code, set_name: p.set_name, image: p.display_image_url, quantity: p.quantity, description: p.description })),
        tickets: ((tickets.data as T[] | null) ?? []).map((t) => ({
          ticket_id: t.ticket_id, name: t.name, image: t.image_url, price: n(t.token_price), quantity: t.quantity,
          max: Math.max(0, Math.min(t.quantity, t.remaining, t.per_user_limit == null ? Infinity : t.per_user_limit - t.owned)),
        })),
        supplies: ((supplies.data as S[] | null) ?? []).map((s) => ({ key: s.key, kind: s.kind, name: s.name, description: s.description, price: n(s.token_price), contents: s.contents?.map((c) => ({ key: c.key, qty: c.qty })) ?? null })),
        boxes: ((boxes.data as B[] | null) ?? []).map((b) => ({
          box_id: b.box_id, name: b.name, set_name: b.set_name, packs: b.packs, price: n(b.token_price), image: b.image_url ?? b.pack_images?.[0] ?? null, quantity: b.quantity,
          max: Math.max(0, Math.min(b.quantity, b.remaining, b.per_user_limit == null ? Infinity : b.per_user_limit - b.owned)),
        })),
      }
    },
    balance,
    /** The purchase screen: one member at a time. */
    async claim() {
      const { data } = await db.rpc('vending_claim')
      const r = one(data as { ok: boolean; reason: string; holder_name: string | null; expires_at: string | null } | null)
      holding = !!r?.ok
      return r ?? { ok: false, reason: 'error', holder_name: null, expires_at: null }
    },
    async heartbeat() { if (holding) await db.rpc('vending_heartbeat') },
    async release() { if (holding) { holding = false; await db.rpc('vending_release') } },
    /** Packs by set, raffle tickets, supplies and sealed boxes, all in one checkout. */
    async checkout(packs: { set_code: string; qty: number }[], tickets: { ticket_id: number; qty: number }[], supplies: { key: string; qty: number }[], boxes: { box_id: number; qty: number }[] = []) {
      const { data, error } = await db.rpc('vending_checkout', { p_items: packs, p_tickets: tickets, ...(supplies.length ? { p_supplies: supplies } : {}), ...(boxes.length ? { p_boxes: boxes } : {}) })
      const r = one(data as { ok: boolean; reason: string; packs_bought: number; tickets_bought: number; supplies_bought: number; boxes_bought?: number; balance: number; restocked: boolean; packs_stuck?: number; packs_freed?: number } | null)
      if (r?.ok) holding = false   // checkout releases the machine
      return r ? { ...r, balance: n(r.balance) } : { ok: false, reason: error?.message ?? 'error', packs_bought: 0, tickets_bought: 0, supplies_bought: 0, boxes_bought: 0, balance: await balance(), restocked: false }
    },
    /** Supplies bought at the machine move into the game's Bag. */
    async takeItems(keys: string[]) {
      const { data } = await db.rpc('battle_take_items', { p_keys: keys })
      return ((data as { item_key: string; qty: number }[] | null) ?? []).map((r) => ({ key: r.item_key, qty: r.qty }))
    },
    /** A real pack from a set's inventory into your collection (capped per day). */
    async awardPack(source: string) {
      const { data } = await db.rpc('battle_award_pack', { p_source: source })
      return one(data as { ok: boolean; reason: string; set_name: string | null; pack_name: string | null; image_url: string | null; left_today: number } | null)
        ?? { ok: false, reason: 'error', set_name: null, pack_name: null, image_url: null, left_today: 0 }
    },
    /** Your account's game save, or null if you have none. Throws if the server can't be reached. */
    async loadSave() {
      const { data, error } = await db.rpc('game_save_get')
      if (error) throw new Error(error.message)
      const r = one(data as { data: unknown; rev: number } | null)
      return r ? { data: r.data, rev: r.rev } : null
    },
    /**
     * Writes the save, made from revision `rev` (null if this device has never
     * synced). A 'conflict' means the account's save moved on elsewhere: the
     * newer one comes back in `data`.
     */
    async putSave(save: unknown, rev: number | null) {
      const { data, error } = await db.rpc('game_save_put', { p_data: save, p_rev: rev })
      if (error) return { ok: false, reason: error.message, rev: null, data: null }
      return one(data as { ok: boolean; reason: string; rev: number | null; data: unknown } | null) ?? { ok: false, reason: 'error', rev: null, data: null }
    },
    async deleteSave() { await db.rpc('game_save_delete') },
    /**
     * A badge, League, rival or glitcher win's tokens (v77): the server's amount
     * for `key` ('gym:3', 'elite:LANCE', 'kanto:RED', 'rival:2', 'herb:0'),
     * once per account, outside the daily cap.
     */
    async awardMilestone(key: string) {
      const { data } = await db.rpc('battle_award_milestone', { p_key: key })
      const r = one(data as { ok: boolean; reason: string; awarded: number; balance: number } | null)
      return r ? { ...r, awarded: n(r.awarded), balance: n(r.balance) } : { ok: false, reason: 'error', awarded: 0, balance: await balance() }
    },
    /**
     * Where your wild Pokémon come from: the machine of your latest timer
     * report (Timers tab), and the active machines to pick from when you have
     * none. The machine list is read once.
     */
    async wildSeed() {
      type M = { machine_code: string; venue: string | null; city: string | null; nickname: string | null }
      const label = (m: M) => ({ code: m.machine_code, venue: m.nickname || m.venue || m.machine_code, city: m.city ?? '' })
      const [{ data: rep }, list] = await Promise.all([
        db.from('timer_reports').select('reported_at, machines(machine_code, venue, city, nickname)')
          .eq('user_id', userId).order('reported_at', { ascending: false }).limit(1),
        activeMachines ?? db.from('machines').select('machine_code, venue, city, nickname').eq('is_active', true).order('machine_code')
          .then(({ data }) => (activeMachines = ((data as M[] | null) ?? []).map(label))),
      ])
      const r = one(rep as { reported_at: string; machines: M | M[] | null }[] | null)
      const m = r ? one(r.machines) : null
      return { report: m ? { ...label(m), at: r!.reported_at } : null, machines: list }
    },
    /** A Pokémon Center heal after the day's free ones (v79): the server's price, from your tokens. */
    async buyHeal() {
      const { data, error } = await db.rpc('battle_buy_heal')
      const r = one(data as { ok: boolean; reason: string; price: number; balance: number } | null)
      return r ? { ...r, price: n(r.price), balance: n(r.balance) } : { ok: false, reason: error?.message ?? 'error', price: 0, balance: await balance() }
    },
    /** Real tokens into the earned bucket (capped per day). */
    async awardTokens(amount: number, source: string) {
      const { data } = await db.rpc('battle_award_tokens', { p_amount: amount, p_source: source })
      const r = one(data as { ok: boolean; reason: string; awarded: number; balance: number } | null)
      return r ? { ...r, awarded: n(r.awarded), balance: n(r.balance) } : { ok: false, reason: 'error', awarded: 0, balance: await balance() }
    },
  }
}

export type VvmApi = ReturnType<typeof makeVvmApi>
