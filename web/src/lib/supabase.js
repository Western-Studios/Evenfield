import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const authEnabled = !!(url && key)
export const supabase    = authEnabled ? createClient(url, key) : null
