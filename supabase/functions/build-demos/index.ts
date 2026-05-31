// Auto-create personalized loyalty SaaS demos for leads.
// For each lead in the Loggic Outreach project that has no demo_link yet,
// we slugify their company name, insert a row into the loyalty SaaS project's
// `loyalty_businesses` table (if missing), and stamp the resulting tenant URL
// back onto the lead via leads.demo_link.
//
// The demo URL https://demo.logiccsupplies.ca/?tenant=<slug> resolves
// immediately from the loyalty SaaS frontend — no build / no deploy.
import { adminClient } from '../_shared/db.ts'

function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

async function getSecret(db: ReturnType<typeof adminClient>, key: string): Promise<string> {
  const { data, error } = await db.from('app_secrets').select('value').eq('key', key).maybeSingle()
  if (error || !data) throw new Error(`secret ${key} not found: ${error?.message ?? 'missing'}`)
  return data.value as string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  // Auth via the same submission_token used by /submit-leads
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return json({ error: 'missing token' }, 401)

  const db = adminClient()
  const { data: matches, error: matchErr } = await db.rpc('check_submission_token', { p_token: token })
  if (matchErr || !matches) return json({ error: 'invalid token' }, 401)

  let body: { campaign_id?: string } = {}
  try { body = await req.json() } catch { /* allow empty body = all queued */ }

  // Loyalty SaaS connection. Stored in private.app_secrets, exposed via the
  // public.app_secrets view granted to service_role.
  let loyaltyUrl: string
  let loyaltyKey: string
  try {
    loyaltyUrl = await getSecret(db, 'loyalty_url')
    loyaltyKey = await getSecret(db, 'loyalty_service_role_key')
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }

  // Fetch leads needing a demo.
  let leadsQ = db
    .from('leads')
    .select('id, company, email')
    .is('demo_link', null)
    .not('company', 'is', null)
    .in('status', ['queued', 'in_progress', 'draft'])
  if (body.campaign_id) leadsQ = leadsQ.eq('campaign_id', body.campaign_id)
  const { data: leads, error: leadsErr } = await leadsQ
  if (leadsErr) return json({ error: leadsErr.message }, 500)

  let built = 0
  let reused_existing = 0
  let skipped_no_company = 0
  const errors: { lead_id: string, reason: string }[] = []

  for (const lead of leads ?? []) {
    if (!lead.company) { skipped_no_company++; continue }
    const slug = slugify(lead.company as string)
    if (!slug || slug.length < 2) {
      errors.push({ lead_id: lead.id as string, reason: 'invalid slug' })
      continue
    }

    // Check if business already exists in loyalty SaaS.
    const checkResp = await fetch(
      `${loyaltyUrl}/rest/v1/loyalty_businesses?slug=eq.${encodeURIComponent(slug)}&select=slug`,
      { headers: { apikey: loyaltyKey, Authorization: `Bearer ${loyaltyKey}` } },
    )
    const existing = await checkResp.json().catch(() => [])
    const alreadyExists = Array.isArray(existing) && existing.length > 0

    if (!alreadyExists) {
      const createResp = await fetch(`${loyaltyUrl}/rest/v1/loyalty_businesses`, {
        method: 'POST',
        headers: {
          apikey: loyaltyKey,
          Authorization: `Bearer ${loyaltyKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ slug, name: lead.company }),
      })
      if (!createResp.ok) {
        const errText = await createResp.text()
        errors.push({ lead_id: lead.id as string, reason: `loyalty insert failed: ${errText.slice(0, 200)}` })
        continue
      }
      built++
    } else {
      reused_existing++
    }

    // Update the lead with the demo URL.
    const demoUrl = `https://demo.logiccsupplies.ca/?tenant=${slug}`
    const { error: updateErr } = await db.from('leads').update({ demo_link: demoUrl }).eq('id', lead.id)
    if (updateErr) errors.push({ lead_id: lead.id as string, reason: `lead update failed: ${updateErr.message}` })
  }

  return json({
    ok: true,
    total_considered: leads?.length ?? 0,
    built,
    reused_existing,
    skipped_no_company,
    errors,
  })
})
