import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { leadsApi } from '../lib/api'
import { LeadsTable } from '../components/LeadsTable'
import type { LeadStatus } from '../types'

const tabs: { key: LeadStatus | 'all', label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'queued', label: 'En queue' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'replied', label: 'Réponses' },
  { key: 'bounced', label: 'Bounced' },
]

export default function Leads() {
  const [filter, setFilter] = useState<typeof tabs[number]['key']>('all')
  const { data } = useQuery({
    queryKey: ['leads-global', filter],
    queryFn: () => leadsApi.listAll(filter === 'all' ? undefined : filter),
  })
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Leads</h1>
      <div className="flex gap-2 mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} className={`text-xs px-3 py-1.5 rounded ${filter === t.key ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>{t.label}</button>
        ))}
      </div>
      <LeadsTable leads={data ?? []} />
    </div>
  )
}
