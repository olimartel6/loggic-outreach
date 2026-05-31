import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mailboxesApi, settingsApi } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function Settings() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const { data: mb } = useQuery({ queryKey: ['mailbox', session?.user.id], queryFn: () => mailboxesApi.mine(session!.user.id), enabled: !!session })
  const [form, setForm] = useState({
    display_name: '', email: session?.user.email ?? '',
    smtp_host: 'mail.spacemail.com', smtp_port: 587, smtp_user: session?.user.email ?? '', smtp_pass: '',
    imap_host: 'mail.spacemail.com', imap_port: 993, imap_user: session?.user.email ?? '', imap_pass: '',
    daily_limit: 20,
  })
  useEffect(() => {
    if (mb) setForm(f => ({
      ...f,
      display_name: mb.display_name,
      email: mb.email,
      smtp_host: mb.smtp_host,
      smtp_port: mb.smtp_port,
      smtp_user: mb.smtp_user,
      imap_host: mb.imap_host,
      imap_port: mb.imap_port,
      imap_user: mb.imap_user,
      daily_limit: (mb as any).daily_limit ?? 20,
    }))
  }, [mb])
  const save = useMutation({
    mutationFn: () => settingsApi.upsertMailbox(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mailbox'] }),
  })
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <section className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Ta mailbox d'envoi</h2>
        {mb && <p className="text-xs text-green-600 mb-3">✓ Configurée: {mb.email}</p>}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label>Nom affiché<input className="border w-full rounded px-2 py-1.5 mt-1" value={form.display_name} onChange={e => setForm({...form, display_name: e.target.value})} placeholder="Olivier Martel"/></label>
          <label>Email<input className="border w-full rounded px-2 py-1.5 mt-1" value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email"/></label>
          <label className="col-span-2">
            Limite quotidienne d'emails
            <input className="border w-full rounded px-2 py-1.5 mt-1" type="number" min={1} max={500} value={form.daily_limit} onChange={e => setForm({...form, daily_limit: Number(e.target.value)})}/>
            <p className="text-xs text-slate-500 mt-1">Recommandé: démarrer à 5/jour, ramp progressif sur 2 semaines, max 50/jour pour une bonne deliverability.</p>
          </label>
          <label>SMTP host<input className="border w-full rounded px-2 py-1.5 mt-1" value={form.smtp_host} onChange={e => setForm({...form, smtp_host: e.target.value})}/></label>
          <label>SMTP port<input className="border w-full rounded px-2 py-1.5 mt-1" type="number" value={form.smtp_port} onChange={e => setForm({...form, smtp_port: Number(e.target.value)})}/></label>
          <label>SMTP user<input className="border w-full rounded px-2 py-1.5 mt-1" value={form.smtp_user} onChange={e => setForm({...form, smtp_user: e.target.value})}/></label>
          <label>SMTP password<input className="border w-full rounded px-2 py-1.5 mt-1" type="password" value={form.smtp_pass} onChange={e => setForm({...form, smtp_pass: e.target.value})}/></label>
          <label>IMAP host<input className="border w-full rounded px-2 py-1.5 mt-1" value={form.imap_host} onChange={e => setForm({...form, imap_host: e.target.value})}/></label>
          <label>IMAP port<input className="border w-full rounded px-2 py-1.5 mt-1" type="number" value={form.imap_port} onChange={e => setForm({...form, imap_port: Number(e.target.value)})}/></label>
          <label>IMAP user<input className="border w-full rounded px-2 py-1.5 mt-1" value={form.imap_user} onChange={e => setForm({...form, imap_user: e.target.value})}/></label>
          <label>IMAP password<input className="border w-full rounded px-2 py-1.5 mt-1" type="password" value={form.imap_pass} onChange={e => setForm({...form, imap_pass: e.target.value})}/></label>
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending} className="mt-4 bg-slate-900 text-white text-sm px-4 py-2 rounded">{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</button>
        {save.isError && <p className="text-red-600 text-xs mt-2">{String(save.error)}</p>}
        {save.isSuccess && <p className="text-green-600 text-xs mt-2">Sauvegardé ✓</p>}
      </section>
    </div>
  )
}
