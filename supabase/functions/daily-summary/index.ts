import { adminClient } from '../_shared/db.ts'
import { notifyTelegram } from '../_shared/notify.ts'

Deno.serve(async (_req) => {
  // Allow service_role bearer (cron calls with it) — no other auth needed.
  const db = adminClient()
  try {
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart); tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1)

    // Counts
    const { count: sentToday } = await db.from('sends').select('id', { count: 'exact', head: true })
      .gte('sent_at', todayStart.toISOString()).lt('sent_at', tomorrowStart.toISOString()).eq('status', 'sent')
    const { count: failedToday } = await db.from('sends').select('id', { count: 'exact', head: true })
      .gte('sent_at', todayStart.toISOString()).lt('sent_at', tomorrowStart.toISOString()).eq('status', 'failed')
    const { count: bouncedToday } = await db.from('leads').select('id', { count: 'exact', head: true })
      .eq('status', 'bounced').gte('updated_at', todayStart.toISOString())
    const { count: repliesToday } = await db.from('replies').select('id', { count: 'exact', head: true })
      .gte('detected_at', todayStart.toISOString())
    const { count: queuedNow } = await db.from('leads').select('id', { count: 'exact', head: true }).in('status', ['queued', 'in_progress'])

    // Mailbox health
    const { data: mailboxes } = await db.from('mailboxes').select('email, status, last_error, daily_limit')
    const mbLines = (mailboxes ?? []).map((m) => {
      const flag = m.status === 'error' ? '⚠️ ERROR' : '✓'
      return `${flag} ${m.email} (limite ${(m as { daily_limit?: number }).daily_limit ?? '?'}/jour)`
    }).join('\n')

    // Active campaigns
    const { data: activeCampaigns } = await db.from('campaigns').select('id, name').eq('status', 'active')

    const message = [
      `📊 Loggic Outreach — Résumé ${todayStart.toISOString().slice(0, 10)}`,
      '',
      `📨 Envoyés: ${sentToday ?? 0}`,
      `📬 Réponses: ${repliesToday ?? 0}`,
      `❌ Bounces: ${bouncedToday ?? 0}`,
      `⚠️ Failed: ${failedToday ?? 0}`,
      `📋 En queue: ${queuedNow ?? 0}`,
      '',
      `🎯 Campagnes actives: ${activeCampaigns?.length ?? 0}`,
      '',
      `📮 Mailboxes:`,
      mbLines || '(aucune)',
    ].join('\n')

    await notifyTelegram(db, message)
    return new Response(JSON.stringify({ ok: true, sent_to_telegram: true, summary: { sentToday, repliesToday, bouncedToday, failedToday, queuedNow } }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    await notifyTelegram(db, `daily-summary CRASH: ${e instanceof Error ? e.message : String(e)}`)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
