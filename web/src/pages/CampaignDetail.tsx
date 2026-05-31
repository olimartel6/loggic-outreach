import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campaignsApi, stepsApi, leadsApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { SequenceStepCard } from '../components/SequenceStepCard'
import { CsvUploader } from '../components/CsvUploader'

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

  if (!camp) return <p>Chargement…</p>
  const nextOrder = steps && steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) + 1 : 0
  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{camp.name}</h1>
          <div className="text-xs text-slate-500">Status: {camp.status}</div>
        </div>
        <div className="flex gap-2 text-xs">
          {camp.status !== 'active' && <button onClick={async () => { await toggleStatus.mutateAsync('active'); try { await buildDemos.mutateAsync() } catch (e) { console.warn('build-demos failed during activate (campagne activée quand même):', e) } }} className="bg-green-600 text-white px-3 py-1.5 rounded">Activer</button>}
          {camp.status === 'active' && <button onClick={() => toggleStatus.mutate('paused')} className="bg-yellow-600 text-white px-3 py-1.5 rounded">Mettre en pause</button>}
        </div>
      </div>
      {(upsert.isError || remove.isError || toggleStatus.isError || importLeads.isError || approveDrafts.isError || rejectDraft.isError || buildDemos.isError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded mb-4">
          {(upsert.error || remove.error || toggleStatus.error || importLeads.error || approveDrafts.error || rejectDraft.error || buildDemos.error) instanceof Error
            ? ((upsert.error || remove.error || toggleStatus.error || importLeads.error || approveDrafts.error || rejectDraft.error || buildDemos.error) as Error).message
            : 'Erreur'}
        </div>
      )}
      <h2 className="text-lg font-semibold mb-3">Séquence</h2>
      {steps?.map(s => (
        <SequenceStepCard
          key={s.id}
          initial={s}
          onSave={d => upsert.mutateAsync({ ...d, campaign_id: id!, id: s.id })}
          onDelete={() => remove.mutateAsync(s.id)}
        />
      ))}
      <button
        disabled={upsert.isPending}
        onClick={() => upsert.mutate({ campaign_id: id!, step_order: nextOrder, delay_days: nextOrder === 0 ? 0 : 4, subject_template: '{custom_subject}', body_template: '{custom_body}' })}
        className="w-full border-2 border-dashed border-slate-300 text-slate-500 py-4 rounded-xl hover:border-slate-500 disabled:opacity-40"
      >
        + Ajouter une étape
      </button>

      {drafts && drafts.length > 0 && (
        <>
          <div className="mt-8 mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Brouillons ({drafts.length})</h2>
            <div className="flex gap-2">
              <button
                onClick={() => approveDrafts.mutate()}
                disabled={approveDrafts.isPending}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded disabled:opacity-40"
              >
                Tout activer ({drafts.length})
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Soumis par l&apos;IA d&apos;un cofondateur, en attente d&apos;activation. Une fois activés, ils entrent dans la queue d&apos;envoi et sont déjà comptés dans la liste de dedup.
          </p>
          <div className="bg-white border rounded-xl divide-y max-h-96 overflow-auto">
            {drafts.map((d) => (
              <div key={d.id} className="p-3 text-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">{d.email}</div>
                    <div className="text-xs text-slate-500">
                      {d.company} • {d.first_name} {d.last_name}
                      {d.custom1 ? ` • ${d.custom1}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => rejectDraft.mutate(d.id)}
                    disabled={rejectDraft.isPending}
                    className="text-xs text-red-600 ml-2 disabled:opacity-40"
                  >
                    Rejeter
                  </button>
                </div>
                {d.custom_subject && (
                  <div className="mt-2 text-xs">
                    <strong>Sujet:</strong> {d.custom_subject}
                  </div>
                )}
                {d.custom_body && (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-slate-600">Voir le corps</summary>
                    <pre className="whitespace-pre-wrap mt-1 bg-slate-50 p-2 rounded font-mono text-xs">{d.custom_body}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-lg font-semibold mt-8 mb-3">Leads ({leads?.length ?? 0})</h2>
      <CsvUploader onParsed={l => importLeads.mutate(l)} disabled={importLeads.isPending} />
      {importLeads.isSuccess && <p className="text-green-600 text-xs mt-2">{importLeads.data?.length ?? 0} leads importés (doublons ignorés).</p>}
      <div className="mt-4 bg-white border rounded-xl divide-y max-h-96 overflow-auto">
        {leads?.map(l => (
          <div key={l.id} className="flex justify-between p-3 text-sm">
            <div>
              <div className="font-medium">{l.email}</div>
              <div className="text-xs text-slate-500">{l.company} • {l.first_name} {l.last_name}</div>
            </div>
            <div className="text-xs text-slate-500">{l.status} • step {l.current_step}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => buildDemos.mutate()}
          disabled={buildDemos.isPending}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded disabled:opacity-40"
        >
          {buildDemos.isPending ? 'Construction des démos…' : '🚀 Construire les démos pour les leads sans demo_link'}
        </button>
      </div>
    </div>
  )
}
