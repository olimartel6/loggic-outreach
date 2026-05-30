import type { Lead } from '../types'

const statusLabel: Record<Lead['status'], string> = {
  queued: 'En queue',
  in_progress: 'En cours',
  replied: '✓ Réponse',
  bounced: 'Bounced',
  completed: 'Fini',
  unsubscribed: 'Unsubscribe',
  failed: 'Échec',
}

const statusColor: Record<Lead['status'], string> = {
  queued: 'text-slate-500',
  in_progress: 'text-blue-600',
  replied: 'text-green-600 font-semibold',
  bounced: 'text-red-600',
  completed: 'text-slate-400',
  unsubscribed: 'text-slate-400',
  failed: 'text-red-600',
}

export function LeadsTable({ leads }: { leads: (Lead & { campaigns?: { name: string } | null })[] }) {
  return (
    <table className="w-full text-sm bg-white border rounded-xl overflow-hidden">
      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
        <tr>
          <th className="p-3">Email</th><th className="p-3">Entreprise</th><th className="p-3">Campagne</th><th className="p-3">Status</th><th className="p-3">Étape</th>
        </tr>
      </thead>
      <tbody>
        {leads.map(l => (
          <tr key={l.id} className="border-t">
            <td className="p-3">{l.email}</td>
            <td className="p-3">{l.company ?? '—'}</td>
            <td className="p-3">{l.campaigns?.name ?? '—'}</td>
            <td className={`p-3 ${statusColor[l.status]}`}>{statusLabel[l.status]}</td>
            <td className="p-3 text-xs text-slate-500">{l.current_step}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
