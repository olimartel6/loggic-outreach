import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { render } from '../send-tick/templates.ts'

Deno.test('substitutes known variables', () => {
  const out = render('Salut {first_name}, j\'ai vu {company}.', {
    first_name: 'Sophie', company: 'Urbania', custom1: '', demo_link: '', last_name: '',
  })
  assertEquals(out, "Salut Sophie, j'ai vu Urbania.")
})

Deno.test('keeps unknown variables as-is', () => {
  const out = render('Salut {first_name}, {foo}.', {
    first_name: 'Bob', company: '', custom1: '', demo_link: '', last_name: '',
  })
  assertEquals(out, 'Salut Bob, {foo}.')
})

Deno.test('appends unsubscribe footer when missing', () => {
  const out = render('Hi.', { first_name: '', last_name: '', company: '', demo_link: '', custom1: '' }, { footer: '\n\n--\nUnsub: mailto:olivier+unsub@logiccsupplies.ca' })
  assertEquals(out.endsWith('Unsub: mailto:olivier+unsub@logiccsupplies.ca'), true)
})
