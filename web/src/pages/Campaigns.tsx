import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { campaignsApi } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'

const inputCls =
  'rounded-md border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500'

type CampaignStatus = 'active' | 'paused' | 'draft' | string

function statusBadge(status: CampaignStatus) {
  if (status === 'active') return <StatusBadge variant="success">Actif</StatusBadge>
  if (status === 'paused') return <StatusBadge variant="warning">Pause</StatusBadge>
  if (status === 'draft') return <StatusBadge variant="neutral">Brouillon</StatusBadge>
  return <StatusBadge variant="neutral">{String(status)}</StatusBadge>
}

export default function Campaigns() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['campaigns'], queryFn: campaignsApi.list })
  const create = useMutation({
    mutationFn: () => campaignsApi.create(name, session!.user.id),
    onSuccess: () => { setName(''); qc.invalidateQueries({ queryKey: ['campaigns'] }) },
  })
  const remove = useMutation({
    mutationFn: (id: string) => campaignsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
  return (
    <div>
      <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Campagnes</h1>
          <p className="text-sm text-slate-500 mt-1">Gère tes séquences cold-email.</p>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); if (name.trim()) create.mutate() }}
          className="flex gap-2"
        >
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nom de la campagne"
            className={inputCls}
          />
          <Button type="submit" disabled={create.isPending}>Nouvelle campagne</Button>
        </form>
      </div>
      {create.isError && <p className="text-red-600 text-xs mb-3">{(create.error as Error).message}</p>}
      {isLoading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 divide-y divide-slate-100 overflow-hidden">
          {data?.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">
              Aucune campagne. Crée la première en utilisant le formulaire ci-dessus.
            </div>
          )}
          {data?.map(c => (
            <div key={c.id} className="group flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition">
              <Link to={`/campaigns/${c.id}`} className="flex-1 flex items-center justify-between min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-slate-900 truncate">{c.name}</div>
                    {statusBadge(c.status)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Créée {new Date(c.created_at).toLocaleDateString('fr-CA')}
                  </div>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault(); e.stopPropagation()
                  if (confirm(`Supprimer définitivement la campagne "${c.name}" et tous ses leads + sends + replies ? Irréversible.`)) remove.mutate(c.id)
                }}
                disabled={remove.isPending}
                className="ml-3 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Supprimer
              </Button>
            </div>
          ))}
          {remove.isError && <div className="p-3 text-red-600 text-xs">{(remove.error as Error).message}</div>}
        </div>
      )}
    </div>
  )
}
