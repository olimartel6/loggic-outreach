import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mailboxesApi, settingsApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Mailbox } from '../types'

type FormState = {
  id?: string
  display_name: string
  email: string
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_pass: string
  imap_host: string
  imap_port: number
  imap_user: string
  imap_pass: string
  daily_limit: number
}

function emptyForm(defaultEmail = ''): FormState {
  return {
    id: undefined,
    display_name: '',
    email: defaultEmail,
    smtp_host: 'mail.spacemail.com',
    smtp_port: 587,
    smtp_user: defaultEmail,
    smtp_pass: '',
    imap_host: 'mail.spacemail.com',
    imap_port: 993,
    imap_user: defaultEmail,
    imap_pass: '',
    daily_limit: 20,
  }
}

export default function Settings() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const { data: mailboxes } = useQuery({
    queryKey: ['mailboxes', session?.user.id],
    queryFn: () => mailboxesApi.mine(session!.user.id),
    enabled: !!session,
  })
  const [editing, setEditing] = useState<FormState | null>(null)

  const save = useMutation({
    mutationFn: (form: FormState) =>
      settingsApi.upsertMailbox({
        mailbox_id: form.id,
        display_name: form.display_name,
        email: form.email,
        smtp_host: form.smtp_host,
        smtp_port: form.smtp_port,
        smtp_user: form.smtp_user,
        smtp_pass: form.smtp_pass,
        imap_host: form.imap_host,
        imap_port: form.imap_port,
        imap_user: form.imap_user,
        imap_pass: form.imap_pass,
        daily_limit: form.daily_limit,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mailboxes'] })
      setEditing(null)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => settingsApi.deleteMailbox(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mailboxes'] }),
  })

  function startAdd() {
    setEditing(emptyForm(session?.user.email ?? ''))
  }

  function startEdit(mb: Mailbox) {
    setEditing({
      id: mb.id,
      display_name: mb.display_name,
      email: mb.email,
      smtp_host: mb.smtp_host,
      smtp_port: mb.smtp_port,
      smtp_user: mb.smtp_user,
      smtp_pass: '', // blank means "keep existing"
      imap_host: mb.imap_host,
      imap_port: mb.imap_port,
      imap_user: mb.imap_user,
      imap_pass: '',
      daily_limit: (mb as unknown as { daily_limit?: number }).daily_limit ?? 20,
    })
  }

  function confirmDelete(mb: Mailbox) {
    if (!confirm(`Supprimer ${mb.email} ?`)) return
    remove.mutate(mb.id)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <section className="bg-white border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Mailboxes d'envoi</h2>
          <button
            onClick={startAdd}
            className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded"
          >+ Ajouter une mailbox</button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Tu peux configurer plusieurs mailboxes — le cron alterne automatiquement entre elles à chaque tick. Chacune respecte sa propre limite quotidienne.
        </p>

        {(!mailboxes || mailboxes.length === 0) && (
          <p className="text-sm text-slate-500">Aucune mailbox configurée. Clique "Ajouter une mailbox".</p>
        )}

        <div className="space-y-2">
          {mailboxes?.map(mb => {
            const dailyLimit = (mb as unknown as { daily_limit?: number }).daily_limit ?? 20
            return (
              <div key={mb.id} className="border rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{mb.display_name} <span className="text-slate-500 font-normal">&lt;{mb.email}&gt;</span></div>
                  <div className="text-xs text-slate-500">Limite: {dailyLimit}/jour · SMTP {mb.smtp_host}:{mb.smtp_port} · IMAP {mb.imap_host}:{mb.imap_port}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(mb)} className="text-xs bg-slate-100 px-3 py-1.5 rounded">Modifier</button>
                  <button onClick={() => confirmDelete(mb)} disabled={remove.isPending} className="text-xs text-red-700 bg-red-50 px-3 py-1.5 rounded disabled:opacity-40">Supprimer</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {editing && (
        <section className="bg-white border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-3">{editing.id ? 'Modifier mailbox' : 'Nouvelle mailbox'}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label>Nom affiché<input className="border w-full rounded px-2 py-1.5 mt-1" value={editing.display_name} onChange={e => setEditing({...editing, display_name: e.target.value})} placeholder="Olivier Martel"/></label>
            <label>Email<input className="border w-full rounded px-2 py-1.5 mt-1" value={editing.email} onChange={e => setEditing({...editing, email: e.target.value})} type="email"/></label>
            <label className="col-span-2">
              Limite quotidienne d'emails
              <input className="border w-full rounded px-2 py-1.5 mt-1" type="number" min={1} max={500} value={editing.daily_limit} onChange={e => setEditing({...editing, daily_limit: Number(e.target.value)})}/>
              <p className="text-xs text-slate-500 mt-1">Recommandé: démarrer à 5/jour, ramp progressif sur 2 semaines, max 50/jour pour une bonne deliverability.</p>
            </label>
            <label>SMTP host<input className="border w-full rounded px-2 py-1.5 mt-1" value={editing.smtp_host} onChange={e => setEditing({...editing, smtp_host: e.target.value})}/></label>
            <label>SMTP port<input className="border w-full rounded px-2 py-1.5 mt-1" type="number" value={editing.smtp_port} onChange={e => setEditing({...editing, smtp_port: Number(e.target.value)})}/></label>
            <label>SMTP user<input className="border w-full rounded px-2 py-1.5 mt-1" value={editing.smtp_user} onChange={e => setEditing({...editing, smtp_user: e.target.value})}/></label>
            <label>SMTP password
              <input className="border w-full rounded px-2 py-1.5 mt-1" type="password" value={editing.smtp_pass} onChange={e => setEditing({...editing, smtp_pass: e.target.value})} placeholder={editing.id ? 'Laisse vide pour garder l\'existant' : ''}/>
            </label>
            <label>IMAP host<input className="border w-full rounded px-2 py-1.5 mt-1" value={editing.imap_host} onChange={e => setEditing({...editing, imap_host: e.target.value})}/></label>
            <label>IMAP port<input className="border w-full rounded px-2 py-1.5 mt-1" type="number" value={editing.imap_port} onChange={e => setEditing({...editing, imap_port: Number(e.target.value)})}/></label>
            <label>IMAP user<input className="border w-full rounded px-2 py-1.5 mt-1" value={editing.imap_user} onChange={e => setEditing({...editing, imap_user: e.target.value})}/></label>
            <label>IMAP password
              <input className="border w-full rounded px-2 py-1.5 mt-1" type="password" value={editing.imap_pass} onChange={e => setEditing({...editing, imap_pass: e.target.value})} placeholder={editing.id ? 'Laisse vide pour garder l\'existant' : ''}/>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => save.mutate(editing)} disabled={save.isPending} className="bg-slate-900 text-white text-sm px-4 py-2 rounded">
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button onClick={() => setEditing(null)} className="bg-slate-100 text-sm px-4 py-2 rounded">Annuler</button>
          </div>
          {save.isError && <p className="text-red-600 text-xs mt-2">{String(save.error)}</p>}
          {remove.isError && <p className="text-red-600 text-xs mt-2">{String(remove.error)}</p>}
        </section>
      )}
    </div>
  )
}
