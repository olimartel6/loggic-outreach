import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/Button'

const inputCls =
  'w-full rounded-md border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function send(e: React.FormEvent) {
    e.preventDefault()
    // NOTE: window.location.origin must be added to Supabase Auth → URL Configuration → Redirect URLs (Studio in dev, dashboard in prod). Otherwise magic links 404.
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } })
    if (error) setError(error.message); else setSent(true)
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-lg font-semibold tracking-tight text-slate-900">Loggic Outreach</div>
          <p className="text-sm text-slate-500 mt-1">Connecte-toi avec ton email Loggic.</p>
        </div>
        <form onSubmit={send} className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-6">
          {sent ? (
            <div className="text-center py-2">
              <p className="text-sm text-slate-700">Vérifie ta boîte mail pour le lien de connexion.</p>
            </div>
          ) : (
            <>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                required
                placeholder="toi@logiccsupplies.ca"
                className={inputCls}
              />
              <Button type="submit" className="w-full mt-4">Envoyer le lien</Button>
              {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
            </>
          )}
        </form>
      </div>
    </div>
  )
}
