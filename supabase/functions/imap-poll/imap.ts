// @ts-ignore
import { ImapFlow } from 'https://esm.sh/imapflow@1.0.158'

export type ImapCreds = {
  host: string
  port: number
  username: string
  password: string
}

export type NewMessage = {
  uid: number
  subject: string
  inReplyTo: string | null
  references: string[]
  from: string
  snippet: string
}

export async function fetchNewMessages(creds: ImapCreds, sinceUid: number): Promise<NewMessage[]> {
  const client = new ImapFlow({
    host: creds.host, port: creds.port, secure: creds.port === 993,
    auth: { user: creds.username, pass: creds.password },
    logger: false,
  })
  await client.connect()
  const lock = await client.getMailboxLock('INBOX')
  const results: NewMessage[] = []
  try {
    const range = `${sinceUid + 1}:*`
    for await (const msg of client.fetch(range, { envelope: true, source: false, bodyStructure: false, uid: true })) {
      if (!msg.envelope) continue
      results.push({
        uid: Number(msg.uid),
        subject: msg.envelope.subject ?? '',
        inReplyTo: msg.envelope.inReplyTo ?? null,
        references: (msg.envelope as any).references ?? [],
        from: msg.envelope.from?.[0]?.address ?? '',
        snippet: msg.envelope.subject ?? '',  // header-only for now
      })
    }
  } finally {
    lock.release()
    await client.logout()
  }
  return results
}
