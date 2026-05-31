import { useEffect, useState } from 'react'
import type { SequenceStep } from '../types'
import { Button } from './Button'

type Draft = Pick<SequenceStep, 'step_order' | 'delay_days' | 'subject_template' | 'body_template'>

const inputCls =
  'w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500'

const inlineNumCls =
  'rounded-md border-0 px-2 py-1 text-xs text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-500 w-16'

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
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-5">
      <div className="flex justify-between items-center mb-4">
        <div className="font-semibold text-sm text-slate-900">Étape {draft.step_order + 1}</div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Délai:</span>
          <input
            type="number"
            min={0}
            value={draft.delay_days}
            onChange={e => set('delay_days', Number(e.target.value))}
            className={inlineNumCls}
          />
          <span>jours après l'étape précédente</span>
        </div>
      </div>
      <input
        value={draft.subject_template}
        onChange={e => set('subject_template', e.target.value)}
        placeholder="Sujet (utilise {first_name}, {company}, etc.)"
        className={`${inputCls} mb-2`}
      />
      <textarea
        value={draft.body_template}
        onChange={e => set('body_template', e.target.value)}
        rows={6}
        placeholder="Corps de l'email"
        className={`${inputCls} font-mono`}
      />
      <button
        type="button"
        onClick={() => { setDraft({ ...draft, subject_template: '{custom_subject}', body_template: '{custom_body}' }); setDirty(true) }}
        className="mt-2 text-xs text-slate-500 hover:text-indigo-600 underline decoration-dotted transition"
      >
        Utiliser les emails personnalisés par lead ({'{custom_subject}'} + {'{custom_body}'})
      </button>
      <div className="flex justify-between items-center mt-4">
        {onDelete ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { if (confirm('Supprimer cette étape ?')) void onDelete() }}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            Supprimer
          </Button>
        ) : <span />}
        <Button
          size="sm"
          disabled={!dirty}
          onClick={async () => { await onSave(draft); setDirty(false) }}
        >
          {dirty ? 'Enregistrer' : 'À jour'}
        </Button>
      </div>
    </div>
  )
}
