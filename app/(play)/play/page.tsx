import FullScreenShell from '@/components/FullScreenShell'

/*
 * Where battles will run, full screen. Nothing links here yet: it's the frame
 * the RPG drops into (exit, leave-guard, safe areas), ready ahead of time.
 */
export default function PlayPage() {
  return (
    <FullScreenShell title="Battle">
      <div className="text-center space-y-2 px-6">
        <p className="font-display font-bold text-lg">Battles are on their way</p>
        <p className="text-sm text-white/60">This is where they'll play, full screen.</p>
      </div>
    </FullScreenShell>
  )
}
