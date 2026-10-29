'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'

/**
 * Turns the member's public interest-list link on and off (v73). The link
 * opens /share/interest/<token>, a read-only page anyone can see without
 * signing in. Resetting swaps the token so an old link stops working.
 */
export default function ShareMyList({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState(initialToken)
  const [origin, setOrigin] = useState('')
  const [canShare, setCanShare] = useState(false)
  const [busy, startTransition] = useTransition()
  const toast = useToast()

  useEffect(() => {
    setOrigin(window.location.origin)
    setCanShare(typeof navigator.share === 'function')
  }, [])

  const url = token ? `${origin}/share/interest/${token}` : ''

  function createLink(reset: boolean) {
    startTransition(async () => {
      const { data, error } = await createClient().rpc('create_interest_share_link')
      if (error || !data) {
        toast.error('Could not make a link. Try again.')
        return
      }
      setToken(data as string)
      toast.ok(reset ? 'New link made. The old one no longer works.' : 'Share link is on.')
    })
  }

  function turnOff() {
    startTransition(async () => {
      const { error } = await createClient().rpc('revoke_interest_share_link')
      if (error) {
        toast.error('Could not turn the link off. Try again.')
        return
      }
      setToken(null)
      toast.ok('Share link is off.')
    })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.ok('Link copied.')
    } catch {
      toast.error('Could not copy. Select the link and copy it instead.')
    }
  }

  async function share() {
    try {
      await navigator.share({ title: 'My TCG interest check', url })
    } catch {
      // Closing the share sheet rejects; nothing to do.
    }
  }

  const ghost =
    'text-xs font-medium text-muted border border-card-border rounded-lg px-2.5 py-1 hover:text-ink hover:border-ink/20 transition-colors disabled:opacity-50'

  return (
    <section className="bg-card border border-card-border rounded-2xl p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-base">Share my list</h2>
        {token && <span className="font-mono text-[10px] text-signal">link on</span>}
      </div>

      {!token ? (
        <>
          <p className="text-sm text-muted">
            Get a link anyone can open, no sign-in needed. It shows your current requests and their notes, and
            updates as you change them.
          </p>
          <button
            onClick={() => createLink(false)}
            disabled={busy}
            className="w-full bg-signal hover:bg-signal/90 disabled:opacity-50 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
          >
            Create share link
          </button>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Your share link"
              className="min-w-0 flex-1 bg-paper border border-card-border rounded-xl px-3 py-2 font-mono text-xs text-ink outline-none focus:border-signal"
            />
            <button
              onClick={canShare ? share : copy}
              disabled={busy || !origin}
              className="shrink-0 bg-signal hover:bg-signal/90 disabled:opacity-50 text-white font-semibold rounded-xl px-4 text-sm transition-colors"
            >
              {canShare ? 'Share' : 'Copy'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {canShare && (
              <button onClick={copy} disabled={busy} className={ghost}>
                Copy link
              </button>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" className={ghost}>
              Preview
            </a>
            <button onClick={() => createLink(true)} disabled={busy} className={ghost}>
              Reset link
            </button>
            <button
              onClick={turnOff}
              disabled={busy}
              className="text-xs font-medium text-muted border border-card-border rounded-lg px-2.5 py-1 hover:text-red-500 hover:border-red-400/40 transition-colors disabled:opacity-50 ml-auto"
            >
              Turn off
            </button>
          </div>
        </>
      )}
    </section>
  )
}
