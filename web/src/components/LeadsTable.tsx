import type { Lead } from '../types'
import { StatusBadge } from './StatusBadge'

function badgeFor(status: Lead['status']) {
  switch (status) {
    case 'queued': return <StatusBadge variant="neutral">En queue</StatusBadge>
    case 'in_progress': return <StatusBadge variant="info">En cours</StatusBadge>
    case 'replied': return <StatusBadge variant="success">Réponse</StatusBadge>
    case 'bounced': return <StatusBadge variant="danger">Bounced</StatusBadge>
    case 'failed': return <StatusBadge variant="danger">Échec</StatusBadge>
    case 'completed': return <StatusBadge variant="neutral">Fini</StatusBadge>
    case 'unsubscribed': return <StatusBadge variant="neutral">Unsub</StatusBadge>
    default: return <StatusBadge variant="neutral">{String(status)}</StatusBadge>
  }
}

export function LeadsTable({ leads }: { leads: (Lead & { campaigns: { name: string } | null })[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Entreprise</th>
            <th className="px-4 py-3">Campagne</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Étape</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucun lead dans cette catégorie.</td>
            </tr>
          )}
          {leads.map(l => (
            <tr key={l.id} className="hover:bg-slate-50 transition">
              <td className="px-4 py-3 text-slate-900 font-medium">{l.email}</td>
              <td className="px-4 py-3 text-slate-600">{l.company ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">{l.campaigns?.name ?? '—'}</td>
              <td className="px-4 py-3">{badgeFor(l.status)}</td>
              <td className="px-4 py-3 text-right text-xs text-slate-500">{l.current_step}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
