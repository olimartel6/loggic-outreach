export type Vars = {
  first_name: string
  last_name: string
  company: string
  demo_link: string
  custom1: string
}

const KNOWN: (keyof Vars)[] = ['first_name', 'last_name', 'company', 'demo_link', 'custom1']

export function render(template: string, vars: Vars, opts?: { footer?: string }): string {
  let out = template
  for (const k of KNOWN) {
    out = out.replaceAll(`{${k}}`, vars[k] ?? '')
  }
  if (opts?.footer && !out.includes(opts.footer.trim())) out += opts.footer
  return out
}
