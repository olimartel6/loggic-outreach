import { fetchNewMessages } from '../imap-poll/imap.ts'
Deno.test('imap module imports', () => {
  if (typeof fetchNewMessages !== 'function') throw new Error('not exported')
})
