import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Decrypts a bytea column value via server-side pgcrypto.
 * PostgREST returns bytea as a hex string (e.g. "\xDEADBEEF..."); pass it through as-is.
 */
export async function decryptSecret(db: SupabaseClient, cipherHex: string): Promise<string> {
  const { data, error } = await db.rpc('decrypt_secret_hex', { cipher_hex: cipherHex })
  if (error) throw error
  return data as string
}
