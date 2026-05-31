import { adminClient, decryptSecret } from '../_shared/db.ts'
import { notifyTelegram } from '../_shared/notify.ts'
import { sendEmail, type SmtpCreds } from './smtp.ts'
import { render, type Vars } from './templates.ts'

// Footer désactivé à la demande d'Oli (déliverabilité couverte par les headers List-Unsubscribe et List-Unsubscribe-Post envoyés par smtp.ts — Gmail/Outlook s'en servent pour le bouton unsub natif sans avoir besoin de texte visible).
const FOOTER = ''

Deno.serve(async () => {
  const db = adminClient()
  try {
    // Heartbeat for /healthcheck — best-effort, never fail the handler on its account.
    try { await db.rpc('heartbeat_send_tick') } catch { /* ignore */ }

    const startedAt = new Date()

    // 1. Fetch all active mailboxes
    const { data: mailboxes, error: mbErr } = await db.from('mailboxes').select('*').eq('status', 'active')
    if (mbErr) return new Response(`mailbox fetch: ${mbErr.message}`, { status: 500 })

    const results: Record<string, number> = {}

    for (const mb of mailboxes ?? []) {
      // 2. Daily limit check: count sends from this mailbox today
      const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0)
      const { count: sentToday } = await db.from('sends').select('id', { count: 'exact', head: true })
        .eq('mailbox_id', mb.id).gte('sent_at', todayStart.toISOString()).eq('status', 'sent')

      // Per-mailbox daily limit (configured from Settings). Falls back to 20 if column missing.
      // We still fetch anyActive campaign because the schedule window check below uses it.
      const { data: anyActive } = await db.from('campaigns').select('schedule').eq('status', 'active').limit(1).maybeSingle()
      const limit = (mb as any).daily_limit ?? 20
      if ((sentToday ?? 0) >= limit) { results[mb.email] = 0; continue }

      // 3. Schedule window check (hours/days)
      const schedule = (anyActive?.schedule as any) ?? { days: ['mon','tue','wed','thu','fri'], start_hour: 8, end_hour: 17, timezone: 'America/Toronto' }
      if (!isWithinSchedule(schedule)) { results[mb.email] = 0; continue }

      // 4. Atomically claim ONE lead via the RPC (FOR UPDATE SKIP LOCKED — concurrent ticks
      // can't grab the same lead).
      const { data: claimedRows, error: claimErr } = await db.rpc('claim_next_lead', {
        p_mailbox_id: mb.id,
        p_now: startedAt.toISOString(),
      })
      if (claimErr) {
        await notifyTelegram(db, `claim_next_lead RPC error for ${mb.email}: ${claimErr.message}`)
        results[mb.email] = -1
        continue
      }
      const lead = (claimedRows as unknown as Record<string, unknown>[] | null)?.[0] as any
      if (!lead) { results[mb.email] = 0; continue }

      // 5. Fetch the step to send
      const { data: step } = await db.from('sequence_steps').select('*')
        .eq('campaign_id', lead.campaign_id).eq('step_order', lead.current_step).single()
      if (!step) {
        await db.from('leads').update({ status: 'completed' }).eq('id', lead.id)
        continue
      }

      // 6. Decrypt SMTP creds (separate try since failure must not nuke the handler)
      let smtpPass: string
      try {
        smtpPass = await decryptSecret(db, mb.smtp_pass_encrypted as unknown as string)
      } catch (e) {
        const errMsg = String(e)
        await db.from('mailboxes').update({ status: 'error', last_error: `decrypt failed: ${errMsg}` }).eq('id', mb.id)
        await notifyTelegram(db, `Mailbox ${mb.email} mise en erreur (decrypt fail): ${errMsg.slice(0, 200)}`)
        results[mb.email] = -1
        continue
      }
      const creds: SmtpCreds = {
        host: mb.smtp_host, port: mb.smtp_port,
        username: mb.smtp_user, password: smtpPass,
        fromEmail: mb.email, fromName: mb.display_name,
      }

      const vars: Vars = {
        first_name: lead.first_name ?? '',
        last_name: lead.last_name ?? '',
        company: lead.company ?? '',
        demo_link: lead.demo_link ?? '',
        custom1: lead.custom1 ?? '',
        custom_subject: lead.custom_subject ?? '',
        custom_body: lead.custom_body ?? '',
      }
      const subject = render(step.subject_template, vars)
      const body = render(step.body_template, vars, { footer: FOOTER })

      // 7. Threading: if this is a follow-up, reuse prior subject and reference Message-ID.
      let finalSubject = subject
      let inReplyTo: string | undefined
      let references: string | undefined
      if (lead.current_step > 0 && lead.thread_message_id) {
        finalSubject = lead.last_subject?.startsWith('Re: ') ? lead.last_subject : `Re: ${lead.last_subject ?? subject}`
        inReplyTo = lead.thread_message_id
        references = lead.thread_message_id
      }

      // 8. Send.
      try {
        const { messageId } = await sendEmail(creds, { to: lead.email, subject: finalSubject, body, inReplyTo, references })
        await db.from('sends').insert({ lead_id: lead.id, step_id: step.id, mailbox_id: mb.id, smtp_message_id: messageId, status: 'sent' })

        // 9. Advance lead.
        const { data: nextStep } = await db.from('sequence_steps').select('delay_days').eq('campaign_id', lead.campaign_id).eq('step_order', lead.current_step + 1).maybeSingle()
        const jitter = (3 + Math.random() * 5) * 60 * 1000  // 3-8 min in ms
        const nextSendAt = nextStep ? new Date(Date.now() + nextStep.delay_days * 86400000 + jitter) : null
        await db.from('leads').update({
          status: nextStep ? 'in_progress' : 'completed',
          current_step: lead.current_step + 1,
          next_send_at: nextSendAt?.toISOString() ?? null,
          mailbox_id: mb.id,
          thread_message_id: lead.thread_message_id ?? messageId,
          last_subject: finalSubject,
          retry_count: 0,
        }).eq('id', lead.id)

        // 10. ALSO bump next_send_at on OTHER queued leads for this mailbox to jitter them.
        // (best effort — RPC builder isn't a real Promise so .catch() is not chainable)
        try {
          await db.rpc('jitter_next_for_mailbox', { p_mailbox_id: mb.id, p_jitter_seconds: 180 + Math.floor(Math.random() * 300) })
        } catch { /* ignore */ }

        results[mb.email] = 1
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e)
        // Check if a send already succeeded for this (lead, step) — if so, bookkeeping crashed post-send.
        const { data: lastSend } = await db.from('sends').select('status').eq('lead_id', lead.id).eq('step_id', step.id).order('sent_at', { ascending: false }).limit(1).maybeSingle()
        if (lastSend?.status === 'sent') {
          results[mb.email] = 1
          continue
        }

        const currentRetry = ((lead as any).retry_count as number | undefined) ?? 0
        const MAX_RETRIES = 3
        if (currentRetry < MAX_RETRIES) {
          // Reschedule with exponential backoff: 5 min, 15 min, 60 min
          const delayMin = currentRetry === 0 ? 5 : currentRetry === 1 ? 15 : 60
          const nextRetryAt = new Date(Date.now() + delayMin * 60 * 1000).toISOString()
          await db.from('leads').update({
            status: 'queued',
            next_send_at: nextRetryAt,
            retry_count: currentRetry + 1,
            last_retry_at: new Date().toISOString(),
          }).eq('id', lead.id)
          await db.from('sends').insert({ lead_id: lead.id, step_id: step.id, mailbox_id: mb.id, status: 'failed', error_text: `[retry ${currentRetry + 1}/${MAX_RETRIES}] ${errMsg}` })
          results[mb.email] = -1
        } else {
          // Final failure
          await db.from('sends').insert({ lead_id: lead.id, step_id: step.id, mailbox_id: mb.id, status: 'failed', error_text: `[final after ${MAX_RETRIES} retries] ${errMsg}` })
          await db.from('leads').update({ status: 'failed' }).eq('id', lead.id)
          await notifyTelegram(db, `Lead ${lead.email} marqué FAILED définitivement après ${MAX_RETRIES} retries.\nErreur: ${errMsg.slice(0, 200)}`)
          results[mb.email] = -1
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    await notifyTelegram(db, `send-tick CRASH: ${e instanceof Error ? e.message : String(e)}\n\nStack:\n${e instanceof Error ? (e.stack ?? 'no stack').slice(0, 1500) : ''}`)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})

function isWithinSchedule(s: { days: string[], start_hour: number, end_hour: number, timezone: string }): boolean {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: s.timezone, weekday: 'short', hour: 'numeric', hour12: false })
  const parts = fmt.formatToParts(now)
  const day = (parts.find(p => p.type === 'weekday')?.value ?? '').toLowerCase()
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
  if (!s.days.includes(day)) return false
  return hour >= s.start_hour && hour < s.end_hour
}
