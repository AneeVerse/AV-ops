import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api-auth'

export async function POST(req: Request) {
  const { error: authError } = await requireAdmin(req)
  if (authError) return authError

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set in .env.local' }, { status: 500 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const { email, password, brand_id, tokens } = await req.json()

    if (!email || !password || !brand_id) {
      return NextResponse.json({ error: 'Email, password and brand are required.' }, { status: 400 })
    }

    // Create user in Supabase Auth (auto-confirms, no confirmation email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // Insert into users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({ email, brand_id, tokens: tokens ?? 0, role: 'user' })

    if (dbError) {
      // Rollback: delete auth user so it doesn't become orphaned
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message ?? 'Unexpected error' }, { status: 500 })
  }
}
