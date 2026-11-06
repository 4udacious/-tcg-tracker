/**
 * Admin → VVM → Moves: how members use their moves in the battle game over
 * the last 30 days (v99's move_usage_summary). Uses, players, the share of
 * hits landed PERFECT or missed, and how often the battles a move was used in
 * were won. For balancing: a move nobody uses, or one that wins far more than
 * the rest, is worth a look.
 */
export interface MoveRow {
  move: string
  uses: number
  players: number
  battles: number
  hits: number
  perfect_pct: number | null
  miss_pct: number | null
  win_pct: number | null
  by_kind: Record<string, number> | null
}

const KIND: Record<string, string> = { wild: 'wild', trainer: 'trainers', leader: 'leaders', duo: '2v2' }

export default function MoveUsage({ rows }: { rows: MoveRow[] }) {
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(Number(v))}%`)
  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-base">Move usage <span className="font-normal text-muted text-xs">· last 30 days</span></h2>
        <p className="text-xs text-muted leading-snug">
          Members&apos; own moves in battle (not partners&apos; or foes&apos;). <b>Win</b> is how often the battles a move was used in
          were won; <b>PERFECT</b> and <b>Miss</b> are shares of its hits.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">No battles recorded yet. Usage starts counting from this update.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted text-left">
              <tr><th className="py-1 pr-2 font-medium">Move</th><th className="pr-2 font-medium text-right">Uses</th><th className="pr-2 font-medium text-right">Players</th>
                <th className="pr-2 font-medium text-right">PERFECT</th><th className="pr-2 font-medium text-right">Miss</th><th className="pr-2 font-medium text-right">Win</th><th className="font-medium">Where</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.move} className="border-t border-card-border">
                  <td className="py-1 pr-2 font-mono whitespace-nowrap">{r.move}</td>
                  <td className="pr-2 text-right font-mono">{r.uses}</td>
                  <td className="pr-2 text-right font-mono">{r.players}</td>
                  <td className="pr-2 text-right font-mono">{pct(r.perfect_pct)}</td>
                  <td className="pr-2 text-right font-mono">{pct(r.miss_pct)}</td>
                  <td className="pr-2 text-right font-mono">{pct(r.win_pct)}</td>
                  <td className="text-muted whitespace-nowrap">{Object.entries(r.by_kind ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${KIND[k] ?? k} ${n}`).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
