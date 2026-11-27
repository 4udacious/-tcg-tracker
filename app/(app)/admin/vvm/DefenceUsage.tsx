/**
 * Admin → VVM → Moves: how members defend in the battle game over the last 30
 * days (v127's defence_usage_summary), by kind of battle. How the rings thrown
 * at them went (PERFECT, parried, jumped, dodged, missed), how the heavy blows
 * (red rings) went, and how often a guard broke or a foe was stunned. For
 * balancing guard, heavy blows and stun against real play rather than the
 * simulator's guesses.
 */
export interface DefenceRow {
  battle_kind: string
  battles: number
  players: number
  win_pct: number | null
  rings_per_battle: number | null
  perfect_pct: number | null
  parry_pct: number | null
  jump_pct: number | null
  dodge_pct: number | null
  miss_pct: number | null
  heavy: number
  heavy_dodged_pct: number | null
  heavy_parried_pct: number | null
  breaks_per_battle: number | null
  stuns_per_battle: number | null
}

const KIND: Record<string, string> = { wild: 'Wild', trainer: 'Trainers', leader: 'Leaders', duo: '2v2' }

export default function DefenceUsage({ rows }: { rows: DefenceRow[] }) {
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(Number(v))}%`)
  const num = (v: number | null, d = 1) => (v == null ? '—' : Number(v).toFixed(d))
  const head = ['Battles', 'Players', 'Win', 'Rings', 'PERFECT', 'Parry', 'Jump', 'Dodge', 'Miss', 'Heavy', 'Dodged', 'Parried', 'Breaks', 'Stuns']
  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-base">Defence <span className="font-normal text-muted text-xs">· last 30 days</span></h2>
        <p className="text-xs text-muted leading-snug">
          The rings thrown at members&apos; own Pokémon. <b>Rings</b> is a battle&apos;s average; <b>PERFECT</b> to <b>Miss</b> are
          shares of all rings (PERFECT counts the parries and jumps that were). <b>Heavy</b> is the red rings: <b>Dodged</b> and{' '}
          <b>Parried</b> (by mistake, which breaks the guard) are shares of those. <b>Breaks</b> and <b>Stuns</b> are a battle&apos;s
          average guard breaks and foes stunned.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">No battles recorded yet. Defence starts counting from this update.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted text-left">
              <tr>
                <th className="py-1 pr-2 font-medium">Kind</th>
                {head.map((h) => <th key={h} className="pr-2 font-medium text-right">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.battle_kind} className="border-t border-card-border">
                  <td className="py-1 pr-2 whitespace-nowrap">{KIND[r.battle_kind] ?? r.battle_kind}</td>
                  {[r.battles, r.players, pct(r.win_pct), num(r.rings_per_battle), pct(r.perfect_pct), pct(r.parry_pct), pct(r.jump_pct),
                    pct(r.dodge_pct), pct(r.miss_pct), r.heavy, pct(r.heavy_dodged_pct), pct(r.heavy_parried_pct),
                    num(r.breaks_per_battle, 2), num(r.stuns_per_battle, 2)].map((v, i) => (
                    <td key={i} className="pr-2 text-right font-mono">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
