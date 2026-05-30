import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { render } from '../send-tick/templates.ts'

Deno.test('substitutes known variables', () => {
  const out = render('Salut {first_name}, j\'ai vu {company}.', {
    first_name: 'Sophie', company: 'Urbania', custom1: '', demo_link: '', last_name: '', custom_subject: '', custom_body: '',
  })
  assertEquals(out, "Salut Sophie, j'ai vu Urbania.")
})

Deno.test('keeps unknown variables as-is', () => {
  const out = render('Salut {first_name}, {foo}.', {
    first_name: 'Bob', company: '', custom1: '', demo_link: '', last_name: '', custom_subject: '', custom_body: '',
  })
  assertEquals(out, 'Salut Bob, {foo}.')
})

Deno.test('appends unsubscribe footer when missing', () => {
  const out = render('Hi.', { first_name: '', last_name: '', company: '', demo_link: '', custom1: '', custom_subject: '', custom_body: '' }, { footer: '\n\n--\nUnsub: mailto:olivier+unsub@logiccsupplies.ca' })
  assertEquals(out.endsWith('Unsub: mailto:olivier+unsub@logiccsupplies.ca'), true)
})

Deno.test('substitutes multi-line custom_body', () => {
  const body = 'Bonjour Sophie,\n\nJ\'ai testé votre salon hier — superbe ambiance.\n\nJe vous laisse un lien de démo: https://x.y/z\n\n— Olivier'
  const out = render('{custom_body}', {
    first_name: 'Sophie', last_name: 'Tremblay', company: 'Urbania Beauté',
    demo_link: 'https://x.y/z', custom1: '',
    custom_subject: 'Salut Sophie, quick question',
    custom_body: body,
  })
  assertEquals(out, body)
})
