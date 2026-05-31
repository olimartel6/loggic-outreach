import { adminClient, decryptSecret } from '../_shared/db.ts'
import { notifyTelegram } from '../_shared/notify.ts'
import { fetchNewMessages, type ImapCreds } from './imap.ts'
import { extractThreadIds, isBounce } from './threading.ts'

Deno.serve(async () => {
  const db = adminClient()
  try {
    const { data: mailboxes } = await db.from('mailboxes').select('*').eq('status', 'active')
    const summary: Record<string, { processed: number, replies: number, bounces: number, error?: string }> = {}

    for (const mb of mailboxes ?? []) {
      summary[mb.email] = { processed: 0, replies: 0, bounces: 0 }
      try {
        const pass = await decryptSecret(db, mb.imap_pass_encrypted as unknown as string)
        const creds: ImapCreds = { host: mb.imap_host, port: mb.imap_port, username: mb.imap_user, password: pass }
        const msgs = await fetchNewMessages(creds, Number(mb.last_imap_uid_seen))
        let maxUid = Number(mb.last_imap_uid_seen)
        for (const m of msgs) {
          maxUid = Math.max(maxUid, m.uid)
          summary[mb.email].processed++
          const threadIds = extractThreadIds({ inReplyTo: m.inReplyTo, references: m.references })
          if (threadIds.length === 0 && !isBounce(m.subject, m.from)) continue
          // Match to a lead.
          const { data: lead } = await db.from('leads')
            .select('id, status')
            .in('thread_message_id', threadIds.length > 0 ? threadIds : ['__none__'])
            .eq('mailbox_id', mb.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (lead && lead.status !== 'replied' && lead.status !== 'bounced') {
            if (isBounce(m.subject, m.from)) {
              await db.from('leads').update({ status: 'bounced' }).eq('id', lead.id)
              summary[mb.email].bounces++
            } else {
              await db.from('leads').update({ status: 'replied' }).eq('id', lead.id)
              summary[mb.email].replies++
            }
            await db.from('replies').insert({ lead_id: lead.id, mailbox_id: mb.id, imap_uid: m.uid, snippet: m.subject })
          }
        }
        await db.from('mailboxes').update({ last_imap_uid_seen: maxUid, last_error: null }).eq('id', mb.id)
      } catch (e) {
        const errMsg = String(e)
        summary[mb.email].error = errMsg
        await db.from('mailboxes').update({ last_error: errMsg }).eq('id', mb.id)
        await notifyTelegram(db, `imap-poll error pour ${mb.email}: ${errMsg.slice(0, 300)}`)
      }
    }
    return new Response(JSON.stringify({ ok: true, summary }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    await notifyTelegram(db, `imap-poll CRASH: ${e instanceof Error ? e.message : String(e)}\n\nStack:\n${e instanceof Error ? (e.stack ?? 'no stack').slice(0, 1500) : ''}`)
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
