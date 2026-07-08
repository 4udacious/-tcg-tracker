import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  if (role !== 'mod' && role !== 'admin') redirect('/')

  const adminLinks =
    role === 'admin'
      ? [
          { href: '/admin', label: 'Approvals' },
          { href: '/admin/catalog', label: 'Catalog' },
          { href: '/admin/machines', label: 'Machines' },
          { href: '/admin/roles', label: 'Roles' },
        ]
      : [
          { href: '/admin', label: 'Approvals' },
          { href: '/admin/roles', label: 'Roles' },
        ]

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto pb-1">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium border border-card-border bg-card hover:border-ink/20 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
