// Submit leads as drafts from an external agent (e.g. Hermes, CA's IDE assistant).
// Drafts immediately count in `contacted_domains` so other sessions/agents won't
// re-pitch the same domains. Oli or CA approve them via the CampaignDetail UI
// (`Brouillons` section → `Tout activer`).
import { adminClient } from '../_shared/db.ts'

type LeadDraft = {
  email: string
  first_name?: string
  last_name?: string
  company?: string
  demo_link?: string
  custom1?: string
  custom_subject?: string
  custom_body?: string
}

type Body = {
  campaign_id: string
  leads: LeadDraft[]
  submitted_by?: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  // Auth via Bearer submission token (stored in private.app_secrets).
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return json({ error: 'missing token' }, 401)

  const db = adminClient()
  const { data: matches, error: matchErr } = await db.rpc('check_submission_token', { p_token: token })
  if (matchErr || !matches) return json({ error: 'invalid token' }, 401)

  // Parse body.
  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  if (!body.campaign_id || !Array.isArray(body.leads) || body.leads.length === 0) {
    return json({ error: 'campaign_id and non-empty leads required' }, 400)
  }

  // Validate campaign exists.
  const { data: camp } = await db.from('campaigns').select('id').eq('id', body.campaign_id).maybeSingle()
  if (!camp) return json({ error: 'campaign not found' }, 404)

  // Build rows. Encode provenance into custom1 when not already set so we can
  // tell who proposed the draft in the UI.
  const submitter = body.submitted_by?.trim() || null
  const rows = body.leads
    .filter((l) => l?.email && typeof l.email === 'string' && l.email.includes('@'))
    .map((l) => {
      const baseCustom1 = l.custom1?.trim() || null
      const custom1 = baseCustom1
        ? (submitter ? `${baseCustom1} [via ${submitter}]` : baseCustom1)
        : (submitter ? `[via ${submitter}]` : null)
      return {
        campaign_id: body.campaign_id,
        email: l.email.toLowerCase().trim(),
        first_name: l.first_name?.trim() || null,
        last_name: l.last_name?.trim() || null,
        company: l.company?.trim() || null,
        demo_link: l.demo_link?.trim() || null,
        custom1,
        custom_subject: l.custom_subject?.trim() || null,
        custom_body: l.custom_body?.trim() || null,
        status: 'draft' as const,
        current_step: 0,
      }
    })

  if (rows.length === 0) return json({ error: 'no valid emails in payload' }, 400)

  // Upsert as drafts. Existing (campaign_id, email) rows are silently skipped.
  const { data, error } = await db
    .from('leads')
    .upsert(rows, { onConflict: 'campaign_id,email', ignoreDuplicates: true })
    .select('id')

  if (error) return json({ error: error.message }, 500)

  return json({
    ok: true,
    inserted: data?.length ?? 0,
    skipped_duplicates: rows.length - (data?.length ?? 0),
  })
})
