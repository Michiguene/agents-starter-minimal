
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabase = (url && anon) ? createClient(url, anon) : null
export const supabaseAdmin = (url && serviceRole)
  ? createClient(url, serviceRole, { auth: { persistSession: false } })
  : { from: () => ({ insert: async () => ({ data: null, error: null }) }) }
