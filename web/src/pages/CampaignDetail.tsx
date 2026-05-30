import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campaignsApi, stepsApi } from '../lib/api'
import { SequenceStepCard } from '../components/SequenceStepCard'

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

  if (!camp) return <p>Chargement…</p>
  const nextOrder = steps ? steps.length : 0
  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">{camp.name}</h1>
          <div className="text-xs text-slate-500">Status: {camp.status}</div>
        </div>
        <div className="flex gap-2 text-xs">
          {camp.status !== 'active' && <button onClick={() => toggleStatus.mutate('active')} className="bg-green-600 text-white px-3 py-1.5 rounded">Activer</button>}
          {camp.status === 'active' && <button onClick={() => toggleStatus.mutate('paused')} className="bg-yellow-600 text-white px-3 py-1.5 rounded">Mettre en pause</button>}
        </div>
      </div>
      {(upsert.isError || remove.isError || toggleStatus.isError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded mb-4">
          {(upsert.error || remove.error || toggleStatus.error) instanceof Error
            ? ((upsert.error || remove.error || toggleStatus.error) as Error).message
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
        onClick={() => upsert.mutate({ campaign_id: id!, step_order: nextOrder, delay_days: nextOrder === 0 ? 0 : 4, subject_template: '', body_template: '' })}
        className="w-full border-2 border-dashed border-slate-300 text-slate-500 py-4 rounded-xl hover:border-slate-500"
      >
        + Ajouter une étape
      </button>
    </div>
  )
}
