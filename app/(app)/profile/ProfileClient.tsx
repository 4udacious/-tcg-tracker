'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { checkAchievements } from '@/lib/checkAchievements'
import TrainerIconPicker from '@/components/TrainerIconPicker'

interface TrainerIcon {
  id: number
  file: string
  label: string | null
}

interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  trainer_icon_id: number | null
  trainer_icons: TrainerIcon | TrainerIcon[] | null
}

interface Requirement {
  id: number
  action: string
  qty: number
}

interface UserAchievement {
  id: number
  completed_at: string
  granted_by: string | null
}

interface BadgeIcon {
  file: string
  label: string
}

interface Achievement {
  id: number
  name: string
  description: string
  starts_at: string | null
  ends_at: string | null
  badge_icons: BadgeIcon | BadgeIcon[] | null
  achievement_requirements: Requirement[] | null
  user_achievements: UserAchievement[] | null
}

interface ProgressRow {
  achievement_id: number
  requirement_id: number
  action: string
  required_qty: number
  current_qty: number
}

interface Props {
  userId: string
  profile: Profile | null
  achievements: Achievement[]
  progress: ProgressRow[]
  trainerIcons: TrainerIcon[]
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v
}

const ACTION_LABELS: Record<string, string> = {
  timer_report: 'Timers logged',
  stock_check: 'Stock reports',
  product_interest: 'Items tracked',
  favorite_machine: 'Machines favorited',
}

/** Circular progress ring with arbitrary centered content (badge icon or %). */
function ProgressRing({
  pct,
  size = 60,
  stroke = 4,
  children,
}: {
  pct: number
  size?: number
  stroke?: number
  children?: React.ReactNode
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, pct)) / 100) * circumference
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-paper"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-signal transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

function timeAgo(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function ProfileClient({ userId, profile, achievements, progress, trainerIcons }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'profile' | 'achievements'>('profile')
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const initialIcon = one(profile?.trainer_icons ?? null)
  const [trainerIconFile, setTrainerIconFile] = useState<string | null>(initialIcon?.file ?? null)
  const [trainerIconId, setTrainerIconId] = useState<number | null>(profile?.trainer_icon_id ?? null)

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // Safety net: evaluate achievements on profile open so anything already
  // qualified (e.g. via data that predates a trigger) gets granted here.
  useEffect(() => {
    checkAchievements(userId).then((earned) => {
      if (earned.length > 0) {
        const msg = earned.length === 1 ? `🏅 Badge earned: ${earned[0]}!` : `🏅 ${earned.length} new badges earned!`
        showToast(msg, true)
        router.refresh()
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null })
      .eq('id', userId)
    if (error) showToast('Failed to save.', false)
    else showToast('Saved.', true)
    setSaving(false)
  }

  // Split achievements into earned / in-progress / off-app
  const now = new Date()
  const earned: Achievement[] = []
  const inProgress: Achievement[] = []
  const offApp: Achievement[] = []

  for (const ach of achievements) {
    const reqs = ach.achievement_requirements ?? []
    const ua = ach.user_achievements ?? []
    const isEarned = ua.length > 0

    // Hide expired special events the user didn't earn
    if (ach.ends_at && new Date(ach.ends_at) < now && !isEarned) continue

    if (isEarned) {
      earned.push(ach)
    } else if (reqs.length === 0) {
      offApp.push(ach)
    } else {
      inProgress.push(ach)
    }
  }

  function progressFor(achId: number) {
    return progress.filter((p) => p.achievement_id === achId)
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg ${toast.ok ? 'bg-ok text-white' : 'bg-ink text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1">
        {(['profile', 'achievements'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-ink text-white' : 'bg-card border border-card-border text-ink hover:border-ink/20'
            }`}
          >
            {t === 'achievements' ? `Achievements${earned.length > 0 ? ` (${earned.length})` : ''}` : 'Profile'}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <section className="space-y-4">
          {/* Avatar + username */}
          <div className="bg-card border border-card-border rounded-2xl p-4 flex items-center gap-4">
            {trainerIconFile ? (
              <img
                src={`/Trainers/${trainerIconFile}`}
                alt="Trainer avatar"
                className="w-14 h-14 rounded-full object-contain bg-paper"
              />
            ) : profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.username}
                width={56}
                height={56}
                className="rounded-full"
                unoptimized
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-paper border border-card-border flex items-center justify-center text-muted">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{profile?.username}</p>
              <p className="font-mono text-xs text-muted capitalize">{profile?.role}</p>
            </div>
          </div>

          {/* Display name */}
          <div className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
            <label className="text-sm font-medium text-ink">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={profile?.username ?? 'Your display name'}
              maxLength={40}
              className="w-full bg-paper border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/20 placeholder:text-muted"
            />
            <p className="text-xs text-muted">This name appears across the app instead of your Discord username.</p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-signal hover:bg-signal/90 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {/* Trainer avatar picker */}
          {trainerIcons.length > 0 && (
            <div className="bg-card border border-card-border rounded-2xl p-4">
              <TrainerIconPicker
                icons={trainerIcons}
                selectedId={trainerIconId}
                userId={userId}
                onSelect={(id, file) => { setTrainerIconId(id); setTrainerIconFile(file) }}
              />
            </div>
          )}
        </section>
      )}

      {tab === 'achievements' && (
        <section className="space-y-6">
          {/* Earned */}
          {earned.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display font-semibold text-base">Earned</h2>
              <div className="grid grid-cols-2 gap-3">
                {earned.map((ach) => {
                  const icon = one(ach.badge_icons)
                  const ua = (ach.user_achievements ?? [])[0]
                  return (
                    <div key={ach.id} className="bg-card border border-card-border rounded-2xl p-3 flex flex-col items-center text-center gap-2">
                      {icon ? (
                        <img
                          src={`/badges/${icon.file}`}
                          alt={icon.label}
                          className="w-14 h-14 object-contain"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-signal/10 flex items-center justify-center text-signal text-2xl">🏅</div>
                      )}
                      <div className="space-y-0.5">
                        <p className="font-semibold text-xs">{ach.name}</p>
                        <p className="text-[10px] text-muted leading-snug">{ach.description}</p>
                        {ua && (
                          <p className="font-mono text-[10px] text-ok">
                            {ua.granted_by ? 'Granted by organizer' : `Earned ${timeAgo(ua.completed_at)}`}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* In-progress */}
          {inProgress.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display font-semibold text-base">In Progress</h2>
              <div className="space-y-3">
                {inProgress.map((ach) => {
                  const icon = one(ach.badge_icons)
                  const reqs = ach.achievement_requirements ?? []
                  const achProgress = progressFor(ach.id)
                  const reqRows = reqs.map((req) => {
                    const prog = achProgress.find((p) => p.requirement_id === req.id)
                    const current = Math.min(prog?.current_qty ?? 0, req.qty)
                    const pct = req.qty > 0 ? Math.min(100, Math.round((current / req.qty) * 100)) : 0
                    return { req, current, pct }
                  })
                  const overallPct = reqRows.length
                    ? Math.round(reqRows.reduce((sum, r) => sum + r.pct, 0) / reqRows.length)
                    : 0
                  return (
                    <div key={ach.id} className="bg-card border border-card-border rounded-2xl p-4 flex gap-3">
                      <ProgressRing pct={overallPct} size={60} stroke={4}>
                        {icon ? (
                          <img
                            src={`/badges/${icon.file}`}
                            alt={icon.label}
                            className="w-9 h-9 object-contain grayscale opacity-60"
                          />
                        ) : (
                          <span className="text-xl">🏅</span>
                        )}
                      </ProgressRing>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">{ach.name}</p>
                            <p className="text-xs text-muted leading-snug">{ach.description}</p>
                          </div>
                          <span className="font-mono text-xs font-semibold text-signal shrink-0">{overallPct}%</span>
                        </div>
                        {reqRows.map(({ req, current, pct }) => (
                          <div key={req.id} className="space-y-1">
                            <div className="flex justify-between text-xs text-muted">
                              <span>{ACTION_LABELS[req.action] ?? req.action}</span>
                              <span className="font-mono">{current}/{req.qty}</span>
                            </div>
                            <div className="h-1.5 bg-paper rounded-full overflow-hidden">
                              <div
                                className="h-full bg-signal rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                        {ach.ends_at && (
                          <p className="font-mono text-[10px] text-muted">
                            Ends {new Date(ach.ends_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Off-app / Discord achievements */}
          {offApp.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display font-semibold text-base">Discord Challenges</h2>
              <div className="grid grid-cols-2 gap-3">
                {offApp.map((ach) => {
                  const icon = one(ach.badge_icons)
                  return (
                    <div key={ach.id} className="bg-card border border-card-border rounded-2xl p-3 flex flex-col items-center text-center gap-2 opacity-50">
                      {icon ? (
                        <img
                          src={`/badges/${icon.file}`}
                          alt={icon.label}
                          className="w-14 h-14 object-contain grayscale"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-paper border border-card-border flex items-center justify-center text-muted text-2xl">🏅</div>
                      )}
                      <div className="space-y-0.5">
                        <p className="font-semibold text-xs">{ach.name}</p>
                        <p className="text-[10px] text-muted leading-snug">{ach.description}</p>
                        <p className="font-mono text-[10px] text-muted">Awarded by an organizer</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {earned.length === 0 && inProgress.length === 0 && offApp.length === 0 && (
            <p className="text-sm text-muted">No achievements available yet.</p>
          )}
        </section>
      )}
    </div>
  )
}
