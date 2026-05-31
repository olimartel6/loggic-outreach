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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Leads</h1>
        <p className="text-sm text-slate-500 mt-1">Vue globale de tous les leads à travers les campagnes.</p>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(t => {
          const active = filter === t.key
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 ring-1 ring-inset ring-slate-200'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <LeadsTable leads={data ?? []} />
    </div>
  )
}
