'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useSettings, updateSettings, haptic, DEFAULT_SETTINGS, type Settings } from '@/lib/settings'
import { playPackSound, setPackSoundsMuted, usePackSoundsMuted } from '../vending/packSounds'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

/*
 * Per-device settings. Nothing here is saved to your account: a phone and a
 * laptop can each be set up their own way.
 */
export default function SettingsPage() {
  const s = useSettings()
  const muted = usePackSoundsMuted()
  const toast = useToast()
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  useEffect(() => {
    try { const t = localStorage.getItem('theme'); setTheme(t === 'dark' || t === 'light' ? t : 'system') } catch {}
  }, [])

  function pickTheme(t: 'system' | 'light' | 'dark') {
    setTheme(t)
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    try { if (t === 'system') localStorage.removeItem('theme'); else localStorage.setItem('theme', t) } catch {}
  }

  const set = (patch: Partial<Settings>) => updateSettings(patch)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-lg">Settings</h1>
        <p className="text-sm text-muted">Saved on this device only.</p>
      </div>

      <Group title="Sound">
        <Row label="Sound effects" hint="Pack rips, card reveals, the machine.">
          <Toggle checked={!muted} onChange={(on) => setPackSoundsMuted(!on)} label="Sound effects" />
        </Row>
        <Slider label="Effects volume" value={s.effectsVolume} disabled={muted}
          onChange={(v) => set({ effectsVolume: v })}
          onRelease={() => playPackSound('chime')} />
        <Slider label="Music volume" hint="Battle music." value={s.musicVolume} onChange={(v) => set({ musicVolume: v })} />
      </Group>

      <Group title="Battles">
        <Row label="Text speed">
          <Segmented value={s.textSpeed} onChange={(v) => set({ textSpeed: v })}
            options={[['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]} />
        </Row>
        <Row label="Attack announcements" hint={s.advance === 'tap' ? 'Each move waits for a tap, so you can read it and get ready.' : 'Moves carry on by themselves after a moment.'}>
          <Segmented value={s.advance} onChange={(v) => set({ advance: v })}
            options={[['tap', 'Tap to continue'], ['auto', 'Automatic']]} />
        </Row>
      </Group>

      <Group title="Display">
        <Row label="Night mode">
          <Segmented value={theme} onChange={pickTheme}
            options={[['system', 'Device'], ['light', 'Light'], ['dark', 'Dark']]} />
        </Row>
        <Row label="Reduce motion" hint="Cuts animations down to a minimum. Device follows your phone's own setting.">
          <Segmented value={s.reduceMotion} onChange={(v) => set({ reduceMotion: v })}
            options={[['system', 'Device'], ['on', 'On'], ['off', 'Off']]} />
        </Row>
        <Row label="Vibration" hint="A short buzz on purchases and reveals, on phones that support it.">
          <Toggle checked={s.haptics} onChange={(on) => { set({ haptics: on }); if (on) haptic([15, 40, 15]) }} label="Vibration" />
        </Row>
      </Group>

      <Button variant="outline" full onClick={() => { updateSettings(DEFAULT_SETTINGS); setPackSoundsMuted(false); pickTheme('system'); toast.ok('Settings reset to the defaults.') }}>
        Reset to defaults
      </Button>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[11px] font-bold tracking-wide text-muted uppercase">{title}</h2>
      <Card className="divide-y divide-card-border" padded={false}>{children}</Card>
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        {/* Short controls sit on the right; segmented ones get their own line. */}
        {isToggle(children) && children}
      </div>
      {!isToggle(children) && children}
    </div>
  )
}
const isToggle = (c: ReactNode) => (c as { type?: unknown })?.type === Toggle

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition-colors ${checked ? 'bg-signal' : 'bg-ink/20'}`}>
      <span className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="radiogroup" className="flex gap-1 p-1 rounded-xl bg-paper border border-card-border">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`flex-1 min-h-9 rounded-lg text-xs font-semibold transition-colors ${value === v ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Slider({ label, hint, value, onChange, onRelease, disabled }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; onRelease?: () => void; disabled?: boolean
}) {
  return (
    <div className={`px-4 py-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">{label}{hint && <span className="ml-1.5 text-xs font-normal text-muted">{hint}</span>}</p>
        <span className="font-mono text-xs text-muted">{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={Math.round(value * 100)} disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onRelease} onKeyUp={onRelease}
        className="mt-2 w-full h-10 accent-[var(--signal)]" />
    </div>
  )
}
