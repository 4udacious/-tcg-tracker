import { createClient } from '@/lib/supabase/server'
import InterestClient from './InterestClient'

export default async function InterestPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: sets }, { data: myInterests }, { data: overview }] = await Promise.all([
    supabase
      .from('sets')
      .select('id, name, set_type, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .order('name'),
    supabase
      .from('product_interest')
      .select('id, note, created_at, product_id, products(id, name, set_id, sets(id, name, set_type))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('v_interest_overview')
      .select('*')
      .order('set_sort')
      .order('product_name'),
  ])

  return (
    <InterestClient
      sets={sets ?? []}
      myInterests={myInterests ?? []}
      overview={overview ?? []}
      userId={user.id}
    />
  )
}
