# Loggic Outreach — Claude Code workflow

This project is an internal cold-email automation system used by Oli and his cofounder Charles-Antoine to sell loyalty apps. App lives at https://logiccsupplies.ca/outreach/. Backend: Supabase project `tytfjnlclvmsjaofpnmq`.

## When Oli or CA asks you to generate a lead CSV

The CSV needs:
- Standard columns: `email,first_name,last_name,company,demo_link,custom1`
- Personalization columns: `custom_subject` (one-line subject) and `custom_body` (full email body, multi-line)

The campaign's sequence step template will be just `{custom_subject}` and `{custom_body}`, so each row controls its own email content. Write each `custom_body` as if it's the email a human would send — short, specific to the business, no obvious template feel.

**`demo_link`: always leave empty.** Demo creation is a separate batch step Oli runs after receiving the CSV (the `logicsupplies` tenant-build pipeline lives on his Mac). The `custom_body` CTA should NOT reference a demo link — propose a short call or ask for a reply instead.

### Dedup workflow (CRITICAL — do NOT skip)

Before adding a prospect, fetch the dedup list:

```bash
curl -s 'https://tytfjnlclvmsjaofpnmq.supabase.co/rest/v1/contacted_domains?select=domain' \
  -H 'apikey: SB_ANON_KEY' \
  -H 'Authorization: Bearer SB_ANON_KEY'
```

(Get `SB_ANON_KEY` from `~/Desktop/loggic-outreach/.env.prod` line `SUPABASE_ANON_KEY=`.)

This returns JSON like `[{"domain":"urbania-beaute.com"}, ...]`. For each prospect you're about to add:
1. Extract domain from the prospect's email (or website)
2. Lowercase it
3. If it's in the dedup list → SKIP, do not add
4. If not → include in CSV

**Dedup is by domain**, not by exact email. If `info@urbania-beaute.com` was contacted, then `contact@urbania-beaute.com` is ALSO blocked.

### CSV file location

Save the CSV to `~/Desktop/leads-<topic>-<YYYY-MM-DD>.csv` so it shows up on Desktop and is easy to import via drag-drop in the Loggic Outreach UI.

## When Oli asks "send a test email"

The lead state in prod is in flux during testing. Use the `q()` Python helper pattern above to query/reset state. Common ops:
- Re-queue lead: `update leads set status='queued', current_step=0, next_send_at=now(), thread_message_id=null, last_subject=null, mailbox_id=null`
- Force send-tick: `curl -X POST https://tytfjnlclvmsjaofpnmq.supabase.co/functions/v1/send-tick -H "Authorization: Bearer $SRK"` (where SRK = `SUPABASE_SERVICE_ROLE_KEY` from `.env.prod`)
- Logs: query the `function_logs` table via the Management API analytics endpoint (see `supabase/functions/` README if written).

## Schedule

Production default: Mon-Fri 8h-17h America/Toronto, 20 emails/day per user. For dev/test, the schedule may be opened to 7/7 — check `campaigns.schedule` before assuming.

## Deliverability ramp guidance

Fresh outreach setups land in spam by default until the sender domain builds reputation with Gmail/Outlook. The 5-week ramp:

| Week | Daily limit per user | Notes |
|---|---|---|
| 1 | 5 | Send to people who already know Oli first if possible; ask them to mark Not Spam and reply |
| 2 | 10 | Watch inbox vs spam ratio in Gmail Postmaster Tools (postmaster.google.com) |
| 3 | 20 | Tighten DMARC from p=none to p=quarantine if no SPF/DKIM failures in postmaster reports |
| 4 | 35 | Continue monitoring |
| 5+ | 50 max | Don't go above 50 without serious reputation built; cap is mostly per-mailbox not per-domain |

If you (Claude) are asked to bump the limit early, push back: "the cron / mailbox limit isn't the bottleneck — Gmail spam classification is. Ramp slowly."

## When Hermes/CA's agent submits drafts via /submit-leads

The submission flow is preferred over CSV-import for cross-session dedup. Drafts:
- Land in `leads` with `status='draft'` → immediately count in `contacted_domains` (other Claude sessions won't re-pitch them)
- Are visible in CampaignDetail under a "Brouillons" section above the regular leads
- Become real queued leads only after Oli (or CA) clicks "Tout activer"
- Carry a `custom1` field with provenance info like `[via Hermes (CA)]` so you know who proposed them

Edge function: `POST https://tytfjnlclvmsjaofpnmq.supabase.co/functions/v1/submit-leads`
Auth: `Authorization: Bearer <submission_token>` (token is in `private.app_secrets.value where key='submission_token'`, also mirrored in `~/Desktop/loggic-outreach/.env.prod` as `SUBMISSION_TOKEN=`)
Body: `{ campaign_id: uuid, leads: [{email, first_name?, last_name?, company?, custom_subject?, custom_body?, ...}], submitted_by?: "Hermes (CA)" }`
Response: `{ ok, inserted, skipped_duplicates }`

Drafts that share `(campaign_id, email)` with an existing lead are silently skipped via `ignoreDuplicates`. The send-tick cron only picks up `status in ('queued', 'in_progress')`, so drafts are never sent until approved.

## Auto-demo creation via /build-demos

Once leads are queued (or still in draft), Oli/CA can click "Construire les démos" in CampaignDetail to auto-create personalized demos. The Edge function:
- Reads loggic-outreach leads with `demo_link IS NULL` (optionally filtered by `campaign_id`)
- Slugifies each `company` field (NFKD normalize, lowercase, ASCII, hyphens)
- Checks if `slug` already exists in the loyalty SaaS project (`kptphghxhexirezukarr.loyalty_businesses`); if not, INSERTs a fresh row with default tiers/colors
- Updates the lead's `demo_link` to `https://demo.logiccsupplies.ca/?tenant=<slug>`

The function uses the **same submission_token** as /submit-leads. Authenticate with `Authorization: Bearer <token>`.

Loyalty SaaS connection details live in `private.app_secrets` keys `loyalty_url` and `loyalty_service_role_key`. Rotate by updating those rows.

## DM Drafts via /submit-dm-drafts

Hermes can submit DM drafts (Instagram / Messenger / LinkedIn) in parallel with email leads. Endpoint:
- `POST /functions/v1/submit-dm-drafts` with same submission_token auth
- Body: `{drafts: [{business_name, channel, draft_text, business_handle?, business_email?, business_url?, ...}], submitted_by?}`
- Drafts land in `dm_drafts` table with status='pending'

UI: "DMs" tab in app lists pending drafts with Copy button + "Marqué envoyé"/"Skip" actions. Marking sent updates `status` and contributes to `contacted_domains` (the view UNIONs sent DM drafts' business_email and business_url domain).

Mailbox rotation: multiple mailboxes per user now supported. Send-tick iterates ALL active mailboxes per tick, each respects its own `daily_limit`. Add new mailboxes from Settings.

## DNS records (manual, do NOT auto-change)

- SPF: `v=spf1 include:spf.spacemail.com ~all` (on logiccsupplies.ca) — correct
- DKIM: `spacemail._domainkey.logiccsupplies.ca` (Spacemail manages)
- DMARC: `_dmarc.logiccsupplies.ca` — currently `p=none`. To tighten later: `v=DMARC1; p=quarantine; rua=mailto:olivier@logiccsupplies.ca`. Only do this AFTER 2 weeks of clean `p=none` reports (no SPF/DKIM failures from real sends).

## Don't touch

- Production Supabase project (3 OTHER projects exist: `bulk-coach`, `roulette`, `SkillForge` — NOT this one. Only `loggic-outreach` is in scope here).
- The `private.app_secrets` table values. Rotate via re-encryption migration if needed.
- Live `mailboxes` rows other than your own (each user owns their own row).
