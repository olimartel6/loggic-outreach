import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

export type SmtpCreds = {
  host: string
  port: number
  username: string
  password: string
  fromEmail: string
  fromName: string
}

export type SendOptions = {
  to: string
  subject: string
  body: string
  inReplyTo?: string  // Message-ID of previous email in thread
  references?: string  // chain of Message-IDs
}

export type SendResult = { messageId: string }

export async function sendEmail(creds: SmtpCreds, opts: SendOptions): Promise<SendResult> {
  const client = new SMTPClient({
    connection: {
      hostname: creds.host,
      port: creds.port,
      tls: creds.port === 465,
      auth: { username: creds.username, password: creds.password },
    },
  })

  const messageId = `<${crypto.randomUUID()}@${creds.fromEmail.split('@')[1]}>`
  const headers: Record<string, string> = { 'Message-ID': messageId }
  // Cold outreach: on évite les signaux "bulk" qui poussent vers l'onglet Promotions de Gmail.
  // Pas de `Precedence: bulk` ni `List-Unsubscribe-Post: One-Click` (trop "marketing").
  // On garde un List-Unsubscribe minimal (mailto seulement) — assez pour compliance + ranking,
  // sans crier "this is bulk" comme la version One-Click.
  const unsubMailto = `mailto:${creds.fromEmail.replace('@', '+unsub@')}?subject=unsubscribe`
  headers['List-Unsubscribe'] = `<${unsubMailto}>`
  if (opts.inReplyTo) headers['In-Reply-To'] = opts.inReplyTo
  if (opts.references) headers['References'] = opts.references

  try {
    await client.send({
      from: `${creds.fromName} <${creds.fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      content: opts.body,
      headers,
    })
    return { messageId }
  } finally {
    await client.close()
  }
}
