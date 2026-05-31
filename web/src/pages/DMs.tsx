import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'

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
  instagram: 'Instagram',
  messenger: 'Messenger',
  linkedin: 'LinkedIn',
  other: 'Autre',
}

function channelBadge(channel: DmDraft['channel']) {
  switch (channel) {
    case 'instagram': return <StatusBadge variant="danger">{channelLabel[channel]}</StatusBadge>
    case 'messenger': return <StatusBadge variant="info">{channelLabel[channel]}</StatusBadge>
    case 'linkedin': return <StatusBadge variant="info">{channelLabel[channel]}</StatusBadge>
    default: return <StatusBadge variant="neutral">{channelLabel[channel]}</StatusBadge>
  }
}

const filterTabs: { key: DmDraft['status'] | 'all', label: string }[] = [
  { key: 'pending', label: 'En attente' },
  { key: 'sent', label: 'Envoyés' },
  { key: 'skipped', label: 'Skippés' },
  { key: 'all', label: 'Tous' },
]

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">DM Drafts</h1>
        <p className="text-sm text-slate-500 mt-1">
          Drafts générés par l'IA. Copie le texte, colle dans Instagram, Messenger ou LinkedIn, puis marque envoyé pour l'ajouter à la dedup.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {filterTabs.map(f => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 ring-1 ring-inset ring-slate-200'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {(!drafts || drafts.length === 0) && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-8 text-center text-sm text-slate-500">
          Aucun draft dans cette catégorie.
        </div>
      )}

      <div className="space-y-3">
        {drafts?.map(d => (
          <div key={d.id} className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-5">
            <div className="flex justify-between items-start gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {channelBadge(d.channel)}
                  <div className="font-semibold text-slate-900 truncate">{d.business_name}</div>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {d.business_handle ?? ''}
                  {d.business_handle && d.business_email ? ' • ' : ''}
                  {d.business_email ?? ''}
                  {d.submitted_by && <span className="ml-1">• via {d.submitted_by}</span>}
                </div>
              </div>
              <div className="text-xs text-slate-400 whitespace-nowrap">
                {new Date(d.created_at).toLocaleString('fr-CA')}
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm font-mono bg-slate-50 p-3 rounded-md ring-1 ring-slate-200/60 text-slate-800">{d.draft_text}</pre>
            <div className="mt-3 flex gap-2 flex-wrap items-center">
              <Button size="sm" variant="secondary" onClick={() => copyToClipboard(d.draft_text)}>Copier</Button>
              {d.business_url && (
                <a
                  href={d.business_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center font-medium rounded-md transition bg-white text-slate-900 hover:bg-slate-50 ring-1 ring-inset ring-slate-300 shadow-sm px-2.5 py-1.5 text-xs"
                >
                  Ouvrir profil
                </a>
              )}
              {d.status === 'pending' && (
                <>
                  <Button size="sm" onClick={() => setStatus.mutate({ id: d.id, status: 'sent' })} disabled={setStatus.isPending}>
                    Marqué envoyé
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: d.id, status: 'skipped' })} disabled={setStatus.isPending}>
                    Skip
                  </Button>
                </>
              )}
              {d.status === 'sent' && <StatusBadge variant="success">Envoyé</StatusBadge>}
              {d.status === 'skipped' && <StatusBadge variant="neutral">Skippé</StatusBadge>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
