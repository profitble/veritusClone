import { createClient } from '@supabase/supabase-js'

// Client-side (safe to expose)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

// Server-side only (admin tasks, bypass RLS)
// Only create if secret key is available (server-side)
export const supabaseAdmin = typeof window === 'undefined' && process.env.SUPABASE_SECRET_KEY
  ? createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY
)
  : null

