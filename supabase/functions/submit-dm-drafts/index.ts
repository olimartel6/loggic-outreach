// Submit DM drafts (Instagram / Messenger / LinkedIn / other) from an external agent.
// Drafts land in `dm_drafts` with status='pending' and show up in the DMs tab.
// When marked 'sent' in the UI, the business domain enters `contacted_domains`
// so other sessions/agents won't re-pitch the same business.
import { adminClient } from '../_shared/db.ts'

type DraftInput = {
  business_name: string
  business_email?: string
  business_handle?: string
  business_url?: string
  channel: 'instagram' | 'messenger' | 'linkedin' | 'other'
  draft_text: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return json({ error: 'missing token' }, 401)

  const db = adminClient()
  const { data: matches, error: matchErr } = await db.rpc('check_submission_token', { p_token: token })
  if (matchErr || !matches) return json({ error: 'invalid token' }, 401)

  let body: { drafts: DraftInput[], submitted_by?: string }
  try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

  if (!Array.isArray(body.drafts) || body.drafts.length === 0) {
    return json({ error: 'drafts must be non-empty array' }, 400)
  }

  const rows = body.drafts
    .filter(d => d?.business_name && d?.draft_text && d?.channel)
    .map(d => ({
      business_name: d.business_name.trim(),
      business_email: d.business_email?.toLowerCase().trim() || null,
      business_handle: d.business_handle?.trim() || null,
      business_url: d.business_url?.trim() || null,
      channel: d.channel,
      draft_text: d.draft_text.trim(),
      submitted_by: body.submitted_by?.trim() || null,
    }))

  if (rows.length === 0) {
    return json({ error: 'no valid drafts (need business_name + draft_text + channel)' }, 400)
  }

  const { data, error } = await db.from('dm_drafts').insert(rows).select('id')
  if (error) return json({ error: error.message }, 500)

  return json({ ok: true, inserted: data?.length ?? 0 })
})
