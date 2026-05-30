import { useEffect, useState } from 'react'
import type { SequenceStep } from '../types'

type Draft = Pick<SequenceStep, 'step_order' | 'delay_days' | 'subject_template' | 'body_template'>

export function SequenceStepCard({ initial, onSave, onDelete }: {
  initial: Draft,
  onSave: (d: Draft) => Promise<void>,
  onDelete?: () => Promise<void>,
}) {
  const [draft, setDraft] = useState(initial)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setDraft(initial)
    setDirty(false)
  }, [initial])

  function set<K extends keyof Draft>(k: K, v: Draft[K]) { setDraft({ ...draft, [k]: v }); setDirty(true) }
  return (
    <div className="bg-white border rounded-xl p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <div className="font-semibold text-sm">📧 Étape {draft.step_order + 1}</div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Délai:</span>
          <input type="number" min={0} value={draft.delay_days} onChange={e => set('delay_days', Number(e.target.value))} className="border rounded w-16 px-2 py-0.5"/>
          <span>jours après l'étape précédente</span>
        </div>
      </div>
      <input value={draft.subject_template} onChange={e => set('subject_template', e.target.value)} placeholder="Sujet (utilise {first_name}, {company}, etc.)" className="w-full border rounded px-3 py-1.5 text-sm mb-2"/>
      <textarea value={draft.body_template} onChange={e => set('body_template', e.target.value)} rows={6} placeholder="Corps de l'email" className="w-full border rounded px-3 py-2 text-sm font-mono"/>
      <button
        type="button"
        onClick={() => { setDraft({ ...draft, subject_template: '{custom_subject}', body_template: '{custom_body}' }); setDirty(true) }}
        className="mt-2 text-xs text-slate-500 hover:text-slate-900 underline decoration-dotted"
      >
        Utiliser les emails personnalisés par lead ({'{custom_subject}'} + {'{custom_body}'})
      </button>
      <div className="flex justify-between mt-3">
        {onDelete && <button onClick={() => { if (confirm('Supprimer cette étape ?')) void onDelete() }} className="text-xs text-red-600">Supprimer</button>}
        <button disabled={!dirty} onClick={async () => { await onSave(draft); setDirty(false) }} className="ml-auto text-xs bg-slate-900 text-white px-3 py-1 rounded disabled:opacity-30">{dirty ? 'Enregistrer' : 'À jour'}</button>
      </div>
    </div>
  )
}
