import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function requireAuth(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  return { user, error: null }
}

export async function requireAdmin(req: Request) {
  const { user, error } = await requireAuth(req)
  if (error || !user) return { user: null, error }

  const { data: adminRow } = await supabaseAdmin
    .from('admins')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()

  if (!adminRow) return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { user, error: null }
}
