import { adminClient } from '../_shared/db.ts'

Deno.serve(async () => {
  const db = adminClient()
  const issues: string[] = []
  let lastSuccessAt: string | null = null
  let mailboxErrorRatio = 0

  try {
    // 1. Last successful send-tick fire within 5 min? Read the heartbeat from app_secrets.
    const { data: heartbeat } = await db.from('app_secrets').select('value').eq('key', 'last_send_tick_at').maybeSingle()
    if (heartbeat?.value) {
      lastSuccessAt = heartbeat.value
      const lastTime = new Date(heartbeat.value).getTime()
      if (Date.now() - lastTime > 5 * 60 * 1000) issues.push(`Last send-tick was ${Math.round((Date.now() - lastTime) / 60000)}m ago (>5min)`)
    } else {
      issues.push('No send-tick heartbeat found')
    }

    // 2. Mailbox error ratio
    const { data: mailboxes } = await db.from('mailboxes').select('email, status')
    if (mailboxes && mailboxes.length > 0) {
      const errored = mailboxes.filter((m) => m.status === 'error').length
      mailboxErrorRatio = errored / mailboxes.length
      if (mailboxErrorRatio >= 0.5) issues.push(`${errored}/${mailboxes.length} mailboxes in error state`)
    }
  } catch (e) {
    issues.push(`healthcheck query crashed: ${e instanceof Error ? e.message : String(e)}`)
  }

  const ok = issues.length === 0
  return new Response(JSON.stringify({
    ok,
    last_send_tick_at: lastSuccessAt,
    mailbox_error_ratio: mailboxErrorRatio,
    issues,
    timestamp: new Date().toISOString(),
  }), {
    status: ok ? 200 : 503,
    headers: { 'content-type': 'application/json' },
  })
})
