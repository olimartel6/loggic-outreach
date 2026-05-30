import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { campaignsApi } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function Campaigns() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['campaigns'], queryFn: campaignsApi.list })
  const create = useMutation({
    mutationFn: () => campaignsApi.create(name, session!.user.id),
    onSuccess: () => { setName(''); qc.invalidateQueries({ queryKey: ['campaigns'] }) },
  })
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Campagnes</h1>
        <form onSubmit={e => { e.preventDefault(); if (name.trim()) create.mutate() }} className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom de la campagne" className="border rounded px-3 py-1.5 text-sm"/>
          <button className="bg-slate-900 text-white text-sm px-3 py-1.5 rounded">+ Nouvelle</button>
        </form>
      </div>
      {isLoading ? <p>Chargement…</p> : (
        <div className="bg-white rounded-xl border divide-y">
          {data?.length === 0 && <div className="p-6 text-slate-500">Aucune campagne. Crée la première ↑</div>}
          {data?.map(c => (
            <Link key={c.id} to={`/campaigns/${c.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-slate-500">Status: {c.status} • Créée {new Date(c.created_at).toLocaleDateString('fr-CA')}</div>
              </div>
              <span className="text-slate-400">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
