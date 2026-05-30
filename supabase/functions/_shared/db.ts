import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function decryptSecret(db: SupabaseClient, cipher: Uint8Array): Promise<string> {
  const { data, error } = await db.rpc('decrypt_secret_b64', { cipher_b64: btoa(String.fromCharCode(...cipher)) })
  if (error) throw error
  return data as string
}
