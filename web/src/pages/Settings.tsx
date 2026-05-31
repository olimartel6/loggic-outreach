import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mailboxesApi, settingsApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button } from '../components/Button'
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

const inputCls =
  'w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500'

const labelCls = 'block text-xs font-medium text-slate-700 mb-1.5'

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Mailboxes d'envoi et configuration.</p>
      </div>

      <section className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900">Mailboxes d'envoi</h2>
            <p className="text-xs text-slate-500 mt-1">
              Configure plusieurs mailboxes — le cron alterne automatiquement. Chacune respecte sa propre limite quotidienne.
            </p>
          </div>
          <Button onClick={startAdd}>Ajouter une mailbox</Button>
        </div>

        {(!mailboxes || mailboxes.length === 0) && (
          <p className="text-sm text-slate-500 mt-2">Aucune mailbox configurée. Clique "Ajouter une mailbox".</p>
        )}

        <div className="space-y-2 mt-2">
          {mailboxes?.map(mb => {
            const dailyLimit = (mb as unknown as { daily_limit?: number }).daily_limit ?? 20
            return (
              <div
                key={mb.id}
                className="rounded-lg px-4 py-3 flex items-center justify-between text-sm bg-slate-50/60 ring-1 ring-slate-200/60"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">
                    {mb.display_name} <span className="text-slate-500 font-normal">&lt;{mb.email}&gt;</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    Limite: {dailyLimit}/jour · SMTP {mb.smtp_host}:{mb.smtp_port} · IMAP {mb.imap_host}:{mb.imap_port}
                  </div>
                </div>
                <div className="flex gap-2 ml-3">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(mb)}>Modifier</Button>
                  <Button variant="danger" size="sm" onClick={() => confirmDelete(mb)} disabled={remove.isPending}>Supprimer</Button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {editing && (
        <section className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">
            {editing.id ? 'Modifier mailbox' : 'Nouvelle mailbox'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nom affiché</label>
              <input className={inputCls} value={editing.display_name} onChange={e => setEditing({ ...editing, display_name: e.target.value })} placeholder="Olivier Martel" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} type="email" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Limite quotidienne d'emails</label>
              <input className={inputCls} type="number" min={1} max={500} value={editing.daily_limit} onChange={e => setEditing({ ...editing, daily_limit: Number(e.target.value) })} />
              <p className="text-xs text-slate-500 mt-1.5">Recommandé: démarrer à 5/jour, ramp progressif sur 2 semaines, max 50/jour pour une bonne deliverability.</p>
            </div>
            <div>
              <label className={labelCls}>SMTP host</label>
              <input className={inputCls} value={editing.smtp_host} onChange={e => setEditing({ ...editing, smtp_host: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>SMTP port</label>
              <input className={inputCls} type="number" value={editing.smtp_port} onChange={e => setEditing({ ...editing, smtp_port: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>SMTP user</label>
              <input className={inputCls} value={editing.smtp_user} onChange={e => setEditing({ ...editing, smtp_user: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>SMTP password</label>
              <input
                className={inputCls}
                type="password"
                value={editing.smtp_pass}
                onChange={e => setEditing({ ...editing, smtp_pass: e.target.value })}
                placeholder={editing.id ? 'Laisse vide pour garder l\'existant' : ''}
              />
            </div>
            <div>
              <label className={labelCls}>IMAP host</label>
              <input className={inputCls} value={editing.imap_host} onChange={e => setEditing({ ...editing, imap_host: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>IMAP port</label>
              <input className={inputCls} type="number" value={editing.imap_port} onChange={e => setEditing({ ...editing, imap_port: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>IMAP user</label>
              <input className={inputCls} value={editing.imap_user} onChange={e => setEditing({ ...editing, imap_user: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>IMAP password</label>
              <input
                className={inputCls}
                type="password"
                value={editing.imap_pass}
                onChange={e => setEditing({ ...editing, imap_pass: e.target.value })}
                placeholder={editing.id ? 'Laisse vide pour garder l\'existant' : ''}
              />
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={() => save.mutate(editing)} disabled={save.isPending}>
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>Annuler</Button>
          </div>
          {save.isError && <p className="text-red-600 text-xs mt-3">{String(save.error)}</p>}
          {remove.isError && <p className="text-red-600 text-xs mt-3">{String(remove.error)}</p>}
        </section>
      )}
    </div>
  )
}
