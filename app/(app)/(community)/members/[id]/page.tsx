import Link from 'next/link'
import TrainerCard from '@/components/TrainerCard'

export const dynamic = 'force-dynamic'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="space-y-4">
      <Link href="/members" className="inline-flex items-center gap-1 min-h-10 text-sm text-muted hover:text-ink transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All members
      </Link>
      <TrainerCard id={id} />
    </div>
  )
}
