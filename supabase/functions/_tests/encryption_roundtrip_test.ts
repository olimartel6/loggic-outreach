import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { adminClient, decryptSecret } from '../_shared/db.ts'

Deno.test({
  name: 'encrypt + decrypt round trip via RPC',
  ignore: !Deno.env.get('SUPABASE_URL'),
  fn: async () => {
    const db = adminClient()
    // Insert a test row via raw SQL would need extra plumbing; instead test via RPC
    // round-trip with a fake hex value if we can read one back.
    // Encrypt a known string, fetch the hex from postgres, decrypt via our function.
    const { data: enc, error: encErr } = await db.rpc('test_encrypt_helper', { plain: 'hello-world' })
    if (encErr) throw encErr
    const decrypted = await decryptSecret(db, enc as string)
    assertEquals(decrypted, 'hello-world')
  },
})
