'use client'

export interface CrashRow {
  id: number
  created_at: string
  note: {
    kind?: string; who?: string; foeLv?: number; party?: string; music?: string; lines?: string[]; errors?: string[]
    started?: number; at?: number; hidden?: boolean; heapMB?: number; ver?: string; musicTier?: number; musicVol?: number
    /** Newer games: the battle's start, step by step ("0.4s decoding song wild (45 s)"), and the last step reached. */
    trail?: string[]; phase?: string
    /** The session so far (newer games): minutes open, battles, songs decoded, the playing song's length, and the page's size. */
    session?: { mins?: number; battles?: number; decodes?: number; songSecs?: number; nodes?: number; imgs?: number; anims?: number
      /** Newer games: decoding a song hung (Safari 27), so songs stream instead; how many have. */
      hung?: boolean; streams?: number; decodeErr?: string | null; loops?: number; lateMs?: number; jumps?: number; ranOut?: number; upgrades?: number }
    /** A music report, not a crash (a phone that streams the songs, once a session): what the songs went through. */
    report?: 'music'
    events?: { s: number; song?: string; ev: string; off?: number; tries?: number; waited?: number; late?: number; secs?: number; err?: string }[]
  }
  device: { ua?: string; screen?: string; mem?: number | null; cores?: number | null }
  member: { username: string; display_name: string | null } | null
}

/** A browser user agent, shortened: the phone or computer, and the browser. */
function deviceName(ua = '') {
  const os = /iPhone OS ([\d_]+)/.exec(ua) ? `iPhone, iOS ${/iPhone OS ([\d_]+)/.exec(ua)![1].replace(/_/g, '.')}`
    : /iPad/.test(ua) ? 'iPad' : /Android ([\d.]+)/.exec(ua) ? `Android ${/Android ([\d.]+)/.exec(ua)![1]}`
    : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other'
  const browser = /GSA\//.test(ua) ? 'Google app' : /CriOS|Chrome\//.test(ua) && !/Edg/.test(ua) ? 'Chrome' : /FxiOS|Firefox/.test(ua) ? 'Firefox' : /Edg/.test(ua) ? 'Edge' : /Safari/.test(ua) ? 'Safari' : 'a browser'
  return `${os} · ${browser}`
}

function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(1, m)}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

/**
 * Crash reports from the battle game (v83): a member's game reloaded in the
 * middle of a battle, and on the next start it sent where it was. Split in
 * two: crashed on screen, and closed in the background (the page was hidden
 * at its last heartbeat, so the phone most likely dropped a backgrounded tab).
 * Repeat reports of one battle are folded into one.
 */
export default function CrashReportsClient({ reports }: { reports: CrashRow[] }) {
  // One battle can be reported more than once (older games, or the app open twice): keep the latest, count the rest.
  const seen = new Map<string, { row: CrashRow; copies: number }>()
  for (const r of reports) {
    const k = `${r.member?.username ?? '?'}:${r.note.started ?? r.id}`
    const had = seen.get(k)
    if (!had) seen.set(k, { row: r, copies: 1 }); else had.copies++
  }
  const music = [...seen.values()].filter((x) => x.row.note.report === 'music')
  const all = [...seen.values()].filter((x) => x.row.note.report !== 'music')
  const onScreen = all.filter((x) => !x.row.note.hidden), background = all.filter((x) => x.row.note.hidden)
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="font-display font-semibold text-base">Crash reports</h2>
        <p className="text-xs text-muted leading-snug">
          When a member&apos;s game reloads in the middle of a battle, it reports where it was the next time it starts:
          the battle, its first steps, the last lines on screen, the music, any script error, and the device.
        </p>
      </div>
      {all.length === 0 ? (
        <p className="text-xs text-muted">None yet.</p>
      ) : (
        <>
          <Group title="Crashed on screen" hint="The game was in front of them when it died: these are the ones to look into." rows={onScreen} />
          <details className="space-y-1.5">
            <summary className="cursor-pointer text-sm font-semibold">
              Closed in the background <span className="font-normal text-muted">· {background.length}</span>
            </summary>
            <p className="text-xs text-muted leading-snug pt-1">
              The member had switched away (another app, the home screen, a locked phone) and the phone reclaimed the page.
              That&apos;s normal phone behaviour rather than a crash.
            </p>
            <Group rows={background} />
          </details>
        </>
      )}
      {music.length > 0 && <MusicReports rows={music.map((x) => x.row)} />}
    </section>
  )
}

/** One event of a streamed song, as a line: "12.4s battle · hand-over 8 ms out of step". */
function eventLine(e: NonNullable<CrashRow['note']['events']>[number]) {
  const what = e.ev === 'hand-over' ? `hand-over ${Math.abs(e.off ?? 0)} ms out of step${e.tries ? `, ${e.tries} nudges` : ''}${e.waited ? `, ${e.waited} ms to start` : ''}`
    : e.ev === 'jump back' ? `jumped back (${e.late ?? '?'} ms past the loop)` : e.secs != null ? `${e.ev} (after ${e.secs} s)` : e.err ? `${e.ev}: ${e.err}` : e.ev
  return `${e.s.toFixed(1)}s ${e.song ?? ''} · ${what}`
}

/**
 * Music reports (newer games): a phone that can't decode the songs quickly
 * plays them from <audio> players instead, and once a session, after a
 * battle, it reports how that went: every loop's hand-over between its two
 * players, any jump back, a player left waiting on its file, the audio
 * interrupted, and the song decoded in the background at last.
 */
function MusicReports({ rows }: { rows: CrashRow[] }) {
  return (
    <details className="space-y-1.5">
      <summary className="cursor-pointer text-sm font-semibold">Music reports <span className="font-normal text-muted">· {rows.length}</span></summary>
      <p className="text-xs text-muted leading-snug pt-1">
        Not crashes: phones that play the songs from audio players (their browser decodes too slowly) report how the songs went, once a session.
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="bg-card border border-card-border rounded-xl px-3 py-2">
            <details>
              <summary className="cursor-pointer list-none text-xs flex items-baseline gap-2">
                <span className="font-medium shrink-0">{r.member ? (r.member.display_name || `@${r.member.username}`) : 'A member'}</span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {deviceName(r.device.ua)} · {r.note.session?.loops ?? 0} loops, worst {r.note.session?.lateMs ?? 0} ms{r.note.session?.jumps ? ` · ${r.note.session.jumps} jumps` : ''}{r.note.session?.upgrades ? ` · ${r.note.session.upgrades} decoded later` : ''}
                </span>
                <span className="font-mono text-[11px] text-muted shrink-0">{ago(r.created_at)}</span>
              </summary>
              <div className="mt-2 space-y-0.5 text-[11px]">
                <p className="text-muted">Why streaming: {r.note.session?.decodeErr ?? '?'} · {r.note.session?.streams ?? 0} songs streamed · game {r.note.ver ?? '?'}</p>
                {(r.note.events ?? []).map((e, i) => <p key={i} className={`font-mono ${/jump|waiting|stalled|ran out|interrupted|failed/.test(e.ev) ? 'text-signal' : ''}`}>{eventLine(e)}</p>)}
                <p className="font-mono break-all text-muted pt-1">{r.device.ua ?? ''}</p>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </details>
  )
}

function Group({ title, hint, rows }: { title?: string; hint?: string; rows: { row: CrashRow; copies: number }[] }) {
  return (
    <div className="space-y-1.5">
      {title && <h3 className="text-sm font-semibold">{title} <span className="font-normal text-muted">· {rows.length}</span></h3>}
      {hint && <p className="text-xs text-muted leading-snug">{hint}</p>}
      {rows.length === 0 ? <p className="text-xs text-muted">None.</p> : (
        <ul className="space-y-1.5">
          {rows.map(({ row: r, copies }) => (
            <li key={r.id} className="bg-card border border-card-border rounded-xl px-3 py-2">
              <details>
                <summary className="cursor-pointer list-none text-xs flex items-baseline gap-2">
                  <span className="font-medium shrink-0">{r.member ? (r.member.display_name || `@${r.member.username}`) : 'A member'}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {r.note.who || r.note.kind || 'a battle'} · {deviceName(r.device.ua)}{r.note.phase ? ` · at: ${r.note.phase}` : ''}{r.note.errors?.length ? ' · script error' : ''}{copies > 1 ? ` · reported ${copies}×` : ''}
                  </span>
                  <span className="font-mono text-[11px] text-muted shrink-0">{ago(r.created_at)}</span>
                </summary>
                <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1 text-[11px]">
                  <dt className="text-muted">Battle</dt><dd>{[r.note.kind, r.note.who, r.note.foeLv ? `Lv ${r.note.foeLv}` : ''].filter(Boolean).join(' · ') || '—'}</dd>
                  <dt className="text-muted">Their party</dt><dd>{r.note.party || '—'}</dd>
                  <dt className="text-muted">Music</dt><dd>{r.note.music || '—'}{r.note.musicTier != null ? ` · ${['full', 'lighter', 'lightest'][r.note.musicTier] ?? r.note.musicTier} detail` : ''}{r.note.musicVol != null ? ` · volume ${Math.round(r.note.musicVol * 60)}%` : ''}</dd>
                  {r.note.session && (<><dt className="text-muted">Session</dt><dd>
                    {r.note.session.mins ?? '?'} min open · battle {r.note.session.battles ?? '?'} · {r.note.session.decodes ?? '?'} songs loaded{r.note.session.songSecs ? ` (this one ${r.note.session.songSecs} s)` : ''}{r.note.session.hung ? ` · decode failed (${r.note.session.decodeErr ?? '?'}), ${r.note.session.streams ?? 0} songs streamed${r.note.session.loops ? `, ${r.note.session.loops} loops (worst hand-over ${r.note.session.lateMs ?? 0} ms out of step${r.note.session.jumps ? `, ${r.note.session.jumps} jumped back` : ''}${r.note.session.ranOut ? `, ran out ${r.note.session.ranOut}×` : ''})` : ''}` : ''} · {r.note.session.nodes ?? '?'} elements, {r.note.session.imgs ?? '?'} images, {r.note.session.anims ?? '?'} animations
                  </dd></>)}
                  <dt className="text-muted">In battle for</dt><dd>{r.note.started && r.note.at ? `${Math.round((r.note.at - r.note.started) / 1000)} s` : '—'}</dd>
                  {!!r.note.trail?.length && (<><dt className="text-muted">Battle start</dt>
                    <dd className="space-y-0.5">{r.note.trail.map((l, i) => <p key={i} className={`font-mono ${/FAILED/.test(l) ? 'text-signal' : ''}`}>{l}</p>)}</dd></>)}
                  <dt className="text-muted">Last on screen</dt>
                  <dd className="space-y-0.5">{(r.note.lines ?? []).slice(-6).map((l, i) => <p key={i} className="font-mono">{l}</p>)}</dd>
                  {!!r.note.errors?.length && (<><dt className="text-muted">Script errors</dt><dd className="space-y-0.5 text-signal">{r.note.errors.map((e, i) => <p key={i} className="font-mono break-all">{e}</p>)}</dd></>)}
                  <dt className="text-muted">Device</dt>
                  <dd>{deviceName(r.device.ua)} · screen {r.device.screen ?? '?'}{r.device.mem ? ` · ${r.device.mem} GB` : ''}{r.device.cores ? ` · ${r.device.cores} cores` : ''}{r.note.heapMB ? ` · ${r.note.heapMB} MB used` : ''}</dd>
                  <dt className="text-muted">Browser</dt><dd className="font-mono break-all text-muted">{r.device.ua ?? '—'}</dd>
                  <dt className="text-muted">Game version</dt><dd className="font-mono">{r.note.ver || '—'}</dd>
                </dl>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
