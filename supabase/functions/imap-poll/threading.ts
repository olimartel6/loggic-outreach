export type MessageHeaders = { inReplyTo: string | null, references: string[] }

export function extractThreadIds(h: MessageHeaders): string[] {
  const ids = new Set<string>()
  if (h.inReplyTo) ids.add(h.inReplyTo.trim())
  for (const r of h.references) if (r) ids.add(r.trim())
  return [...ids]
}

const BOUNCE_SUBJECTS = [
  'delivery status notification',
  'mail delivery failed',
  'undeliverable',
  'returned mail',
  'delivery failure',
]

const BOUNCE_FROMS = ['mailer-daemon', 'postmaster', 'no-reply', 'bounces']

export function isBounce(subject: string, from: string): boolean {
  const s = subject.toLowerCase()
  if (BOUNCE_SUBJECTS.some(b => s.includes(b))) return true
  const f = from.toLowerCase()
  if (BOUNCE_FROMS.some(b => f.startsWith(b))) return true
  return false
}
