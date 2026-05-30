import { useState } from 'react'
import Papa from 'papaparse'

export type LeadDraft = {
  email: string
  first_name?: string
  last_name?: string
  company?: string
  demo_link?: string
  custom1?: string
}

export function CsvUploader({ onParsed }: { onParsed: (leads: LeadDraft[]) => void }) {
  const [error, setError] = useState<string | null>(null)
  return (
    <label className="block border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-slate-500">
      <input
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          if (!f) return
          setError(null)
          Papa.parse<Record<string, string>>(f, {
            header: true,
            skipEmptyLines: true,
            complete: r => {
              const leads: LeadDraft[] = []
              for (const row of r.data) {
                const email = row.email?.trim().toLowerCase()
                if (!email || !email.includes('@')) continue
                leads.push({
                  email,
                  first_name: row.first_name?.trim() || undefined,
                  last_name: row.last_name?.trim() || undefined,
                  company: row.company?.trim() || row.company_name?.trim() || undefined,
                  demo_link: row.demo_link?.trim() || undefined,
                  custom1: row.custom1?.trim() || undefined,
                })
              }
              if (leads.length === 0) setError('Aucun email valide trouvé.')
              else onParsed(leads)
            },
            error: e => setError(e.message),
          })
        }}
      />
      <div className="text-sm font-semibold">Glisse un CSV ici ou clique</div>
      <div className="text-xs text-slate-500 mt-1">Colonnes attendues: email, first_name, last_name, company, demo_link, custom1</div>
      {error && <div className="text-red-600 text-xs mt-2">{error}</div>}
    </label>
  )
}
