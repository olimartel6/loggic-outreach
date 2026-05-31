import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campaignsApi, stepsApi, leadsApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { SequenceStepCard } from '../components/SequenceStepCard'
import { CsvUploader } from '../components/CsvUploader'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'
import type { Lead } from '../types'

function campaignStatusBadge(status: string) {
  if (status === 'active') return <StatusBadge variant="success">Actif</StatusBadge>
  if (status === 'paused') return <StatusBadge variant="warning">Pause</StatusBadge>
  if (status === 'draft') return <StatusBadge variant="neutral">Brouillon</StatusBadge>
  return <StatusBadge variant="neutral">{status}</StatusBadge>
}

function leadStatusBadge(status: Lead['status']) {
  switch (status) {
    case 'queued': return <StatusBadge variant="neutral">En queue</StatusBadge>
    case 'in_progress': return <StatusBadge variant="info">En cours</StatusBadge>
    case 'replied': return <StatusBadge variant="success">Réponse</StatusBadge>
    case 'bounced': return <StatusBadge variant="danger">Bounced</StatusBadge>
    case 'failed': return <StatusBadge variant="danger">Échec</StatusBadge>
    case 'completed': return <StatusBadge variant="neutral">Fini</StatusBadge>
    case 'unsubscribed': return <StatusBadge variant="neutral">Unsub</StatusBadge>
    default: return <StatusBadge variant="neutral">{String(status)}</StatusBadge>
  }
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { data: camp } = useQuery({ queryKey: ['campaign', id], queryFn: () => campaignsApi.get(id!), enabled: !!id })
  const { data: steps } = useQuery({ queryKey: ['steps', id], queryFn: () => stepsApi.listByCampaign(id!), enabled: !!id })
  const upsert = useMutation({
    mutationFn: stepsApi.upsert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', id] }),
  })
  const remove = useMutation({
    mutationFn: stepsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', id] }),
  })
  const toggleStatus = useMutation({
    mutationFn: (status: 'active' | 'paused' | 'draft') => campaignsApi.update(id!, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign', id] }),
  })
  const { data: leads } = useQuery({ queryKey: ['leads', id], queryFn: () => leadsApi.listByCampaign(id!), enabled: !!id })
  const importLeads = useMutation({
    mutationFn: (l: Parameters<typeof leadsApi.bulkInsert>[1]) => leadsApi.bulkInsert(id!, l),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads', id] }),
  })

  const { data: drafts } = useQuery({
    queryKey: ['drafts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('campaign_id', id!)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!id,
    refetchInterval: 30000,
  })

  const approveDrafts = useMutation({
    mutationFn: async () => {
      const ids = drafts?.map((d) => d.id) ?? []
      if (ids.length === 0) return
      const { error } = await supabase
        .from('leads')
        .update({ status: 'queued', next_send_at: new Date().toISOString() })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drafts', id] })
      qc.invalidateQueries({ queryKey: ['leads', id] })
    },
  })

  const rejectDraft = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', leadId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drafts', id] }),
  })

  const buildDemos = useMutation({
    mutationFn: async () => {
      let token = localStorage.getItem('loggic_submission_token')
      if (!token) {
        token = prompt('Token de soumission (one-time, sera mémorisé dans le navigateur):')
        if (!token) throw new Error('cancelled')
        localStorage.setItem('loggic_submission_token', token)
      }
      const url = (import.meta.env.VITE_SUPABASE_URL as string) + '/functions/v1/build-demos'
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: id }),
      })
      if (resp.status === 401) {
        localStorage.removeItem('loggic_submission_token')
        throw new Error('token invalide, ré-essaie')
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
      return resp.json() as Promise<{ built: number, reused_existing: number, total_considered: number }>
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['leads', id] })
      qc.invalidateQueries({ queryKey: ['drafts', id] })
      alert(`${r.built} démos créées, ${r.reused_existing} existaient déjà, ${r.total_considered} leads considérés.`)
    },
  })

  if (!camp) return <p className="text-sm text-slate-500">Chargement…</p>
  const nextOrder = steps && steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) + 1 : 0
  const anyError = upsert.error || remove.error || toggleStatus.error || importLeads.error || approveDrafts.error || rejectDraft.error || buildDemos.error
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap gap-4 justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{camp.name}</h1>
            {campaignStatusBadge(camp.status)}
          </div>
          <p className="text-sm text-slate-500 mt-1">Séquence, brouillons et leads de la campagne.</p>
        </div>
        <div className="flex gap-2">
          {camp.status !== 'active' && (
            <Button
              onClick={async () => {
                await toggleStatus.mutateAsync('active')
                try { await buildDemos.mutateAsync() } catch (e) { console.warn('build-demos failed during activate (campagne activée quand même):', e) }
              }}
            >
              Activer
            </Button>
          )}
          {camp.status === 'active' && (
            <Button variant="secondary" onClick={() => toggleStatus.mutate('paused')}>
              Mettre en pause
            </Button>
          )}
        </div>
      </div>

      {anyError && (
        <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-md ring-1 ring-inset ring-red-600/20">
          {anyError instanceof Error ? anyError.message : 'Erreur'}
        </div>
      )}

      <section>
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <h2 className="text-base font-semibold text-slate-900">Séquence</h2>
          <span className="text-xs text-slate-500">{steps?.length ?? 0} étape{(steps?.length ?? 0) > 1 ? 's' : ''}</span>
        </div>
        <div className="space-y-3">
          {steps?.map(s => (
            <SequenceStepCard
              key={s.id}
              initial={s}
              onSave={d => upsert.mutateAsync({ ...d, campaign_id: id!, id: s.id })}
              onDelete={() => remove.mutateAsync(s.id)}
            />
          ))}
        </div>
        <button
          disabled={upsert.isPending}
          onClick={() => upsert.mutate({ campaign_id: id!, step_order: nextOrder, delay_days: nextOrder === 0 ? 0 : 4, subject_template: '{custom_subject}', body_template: '{custom_body}' })}
          className="mt-3 w-full border-2 border-dashed border-slate-300 text-slate-500 py-4 rounded-xl hover:border-indigo-400 hover:text-indigo-600 transition disabled:opacity-40"
        >
          Ajouter une étape
        </button>
      </section>

      {drafts && drafts.length > 0 && (
        <section>
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-900">Brouillons</h2>
              <StatusBadge variant="info">{drafts.length}</StatusBadge>
            </div>
            <Button
              size="sm"
              onClick={() => approveDrafts.mutate()}
              disabled={approveDrafts.isPending}
            >
              Tout activer ({drafts.length})
            </Button>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Soumis par l&apos;IA d&apos;un cofondateur, en attente d&apos;activation. Une fois activés, ils entrent dans la queue d&apos;envoi et sont déjà comptés dans la liste de dedup.
          </p>
          <div className="bg-indigo-50/40 rounded-xl ring-1 ring-indigo-100 divide-y divide-indigo-100 max-h-96 overflow-auto">
            {drafts.map((d) => (
              <div key={d.id} className="p-4 text-sm">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{d.email}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {d.company} • {d.first_name} {d.last_name}
                      {d.custom1 ? ` • ${d.custom1}` : ''}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rejectDraft.mutate(d.id)}
                    disabled={rejectDraft.isPending}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    Rejeter
                  </Button>
                </div>
                {d.custom_subject && (
                  <div className="mt-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Sujet:</span> {d.custom_subject}
                  </div>
                )}
                {d.custom_body && (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-slate-600 hover:text-slate-900">Voir le corps</summary>
                    <pre className="whitespace-pre-wrap mt-2 bg-white p-3 rounded-md ring-1 ring-slate-200 font-mono text-xs text-slate-700">{d.custom_body}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-slate-900">Leads</h2>
            <StatusBadge variant="neutral">{leads?.length ?? 0}</StatusBadge>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => buildDemos.mutate()}
            disabled={buildDemos.isPending}
          >
            {buildDemos.isPending ? 'Construction des démos…' : 'Construire les démos'}
          </Button>
        </div>
        <CsvUploader onParsed={l => importLeads.mutate(l)} disabled={importLeads.isPending} />
        {importLeads.isSuccess && (
          <p className="text-green-700 text-xs mt-2">{importLeads.data?.length ?? 0} leads importés (doublons ignorés).</p>
        )}
        <div className="mt-4 bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 divide-y divide-slate-100 max-h-96 overflow-auto">
          {leads?.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-500">Aucun lead pour le moment.</div>
          )}
          {leads?.map(l => (
            <div key={l.id} className="flex justify-between items-center px-4 py-3 text-sm hover:bg-slate-50 transition">
              <div className="min-w-0">
                <div className="font-medium text-slate-900 truncate">{l.email}</div>
                <div className="text-xs text-slate-500 mt-0.5">{l.company} • {l.first_name} {l.last_name}</div>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="text-xs text-slate-500">étape {l.current_step}</span>
                {leadStatusBadge(l.status)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
