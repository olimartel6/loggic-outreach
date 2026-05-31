import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../lib/api'

const cards = [
  { key: 'sentToday', label: 'Envoyés aujourd\'hui', fmt: (n: number) => String(n) },
  { key: 'repliesWeek', label: 'Réponses 7j', fmt: (n: number) => String(n), accent: 'text-green-700' },
  { key: 'queue', label: 'En queue', fmt: (n: number) => String(n) },
  { key: 'replyRate', label: 'Taux de réponse', fmt: (n: number) => `${n.toFixed(1)}%` },
] as const

export default function Dashboard() {
  const { data } = useQuery({ queryKey: ['stats'], queryFn: statsApi.overview, refetchInterval: 30000 })
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Vue d'ensemble</h1>
        <p className="text-sm text-slate-500 mt-1">Activité de la cadence d'envoi en temps réel.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div
            key={c.key}
            className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-6 transition hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</div>
            <div
              className={`text-3xl font-semibold mt-3 tracking-tight ${
                'accent' in c ? (c.accent as string) : 'text-slate-900'
              }`}
            >
              {data ? c.fmt(data[c.key]) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
