import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

type DmDraft = {
  id: string
  business_name: string
  business_email: string | null
  business_handle: string | null
  business_url: string | null
  channel: 'instagram' | 'messenger' | 'linkedin' | 'other'
  draft_text: string
  status: 'pending' | 'sent' | 'skipped'
  submitted_by: string | null
  created_at: string
}

const channelLabel: Record<DmDraft['channel'], string> = {
  instagram: 'IG',
  messenger: 'Messenger',
  linkedin: 'LinkedIn',
  other: 'Autre',
}

export default function DMs() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<DmDraft['status'] | 'all'>('pending')

  const { data: drafts } = useQuery({
    queryKey: ['dm_drafts', filter],
    queryFn: async () => {
      let qb = supabase.from('dm_drafts').select('*').order('created_at', { ascending: false })
      if (filter !== 'all') qb = qb.eq('status', filter)
      const { data, error } = await qb
      if (error) throw error
      return data as DmDraft[]
    },
    refetchInterval: 30000,
  })

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: DmDraft['status'] }) => {
      const patch: Record<string, unknown> = { status }
      if (status === 'sent') patch.sent_at = new Date().toISOString()
      const { error } = await supabase.from('dm_drafts').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dm_drafts'] }),
  })

  async function copyToClipboard(text: string) {
    try { await navigator.clipboard.writeText(text) } catch { alert('Copie échouée — tu peux sélectionner manuellement') }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">DM Drafts</h1>
      <p className="text-sm text-slate-500 mb-4">
        Drafts générés par l'IA. Workflow: copie le texte → colle dans IG/Messenger/LinkedIn manuellement → clique "Marqué envoyé" pour ajouter à la dedup list.
      </p>
      <div className="flex gap-2 mb-4 text-xs">
        {(['pending', 'sent', 'skipped', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
          >{f === 'pending' ? 'En attente' : f === 'sent' ? 'Envoyés' : f === 'skipped' ? 'Skippés' : 'Tous'}</button>
        ))}
      </div>

      {(!drafts || drafts.length === 0) && <p className="text-slate-500 text-sm">Aucun draft dans cette catégorie.</p>}

      <div className="space-y-3">
        {drafts?.map(d => (
          <div key={d.id} className="bg-white border rounded-xl p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold">{channelLabel[d.channel]} — {d.business_name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {d.business_handle ?? ''} {d.business_handle && d.business_email ? '•' : ''} {d.business_email ?? ''}
                  {d.submitted_by && <span className="ml-2">• via {d.submitted_by}</span>}
                </div>
              </div>
              <div className="text-xs text-slate-400">{new Date(d.created_at).toLocaleString('fr-CA')}</div>
            </div>
            <pre className="whitespace-pre-wrap text-sm font-mono bg-slate-50 p-3 rounded border border-slate-100">{d.draft_text}</pre>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button onClick={() => copyToClipboard(d.draft_text)} className="text-xs bg-slate-100 px-3 py-1.5 rounded">Copier</button>
              {d.business_url && <a href={d.business_url} target="_blank" rel="noreferrer" className="text-xs bg-slate-100 px-3 py-1.5 rounded">Ouvrir profil</a>}
              {d.status === 'pending' && (
                <>
                  <button onClick={() => setStatus.mutate({ id: d.id, status: 'sent' })} disabled={setStatus.isPending} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded disabled:opacity-40">Marqué envoyé</button>
                  <button onClick={() => setStatus.mutate({ id: d.id, status: 'skipped' })} disabled={setStatus.isPending} className="text-xs bg-slate-200 px-3 py-1.5 rounded">Skip</button>
                </>
              )}
              {d.status !== 'pending' && (
                <span className={`text-xs px-3 py-1.5 rounded ${d.status === 'sent' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{d.status === 'sent' ? 'Envoyé' : 'Skippé'}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
