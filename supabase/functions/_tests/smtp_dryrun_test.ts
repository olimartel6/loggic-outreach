import { sendEmail } from '../send-tick/smtp.ts'
Deno.test('sendEmail module imports', () => {
  if (typeof sendEmail !== 'function') throw new Error('sendEmail not exported')
})
