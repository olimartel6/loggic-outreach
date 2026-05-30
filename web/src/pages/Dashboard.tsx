import { useQuery } from '@tanstack/react-query'
import { statsApi } from '../lib/api'

const cards = [
  { key: 'sentToday', label: 'Envoyés aujourd\'hui', fmt: (n: number) => String(n) },
  { key: 'repliesWeek', label: 'Réponses 7j', fmt: (n: number) => String(n), color: 'text-green-600' },
  { key: 'queue', label: 'En queue', fmt: (n: number) => String(n) },
  { key: 'replyRate', label: 'Taux de réponse', fmt: (n: number) => `${n.toFixed(1)}%` },
] as const

export default function Dashboard() {
  const { data } = useQuery({ queryKey: ['stats'], queryFn: statsApi.overview, refetchInterval: 30000 })
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Vue d'ensemble</h1>
      <div className="grid grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.key} className="bg-white border rounded-xl p-4">
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className={`text-2xl font-bold mt-1 ${'color' in c ? (c.color as string) : ''}`}>{data ? c.fmt(data[c.key]) : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
