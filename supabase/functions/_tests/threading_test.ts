import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { extractThreadIds, isBounce } from '../imap-poll/threading.ts'

Deno.test('extracts thread message ids from In-Reply-To + References', () => {
  const ids = extractThreadIds({ inReplyTo: '<abc@logiccsupplies.ca>', references: ['<def@x.com>', '<abc@logiccsupplies.ca>'] })
  assertEquals(ids.includes('<abc@logiccsupplies.ca>'), true)
})

Deno.test('detects bounce by subject', () => {
  assertEquals(isBounce('Delivery Status Notification (Failure)', ''), true)
  assertEquals(isBounce('Mail Delivery Failed', ''), true)
  assertEquals(isBounce('Hey there', ''), false)
})

Deno.test('detects bounce by from address', () => {
  assertEquals(isBounce('Re: foo', 'mailer-daemon@spacemail.com'), true)
})
