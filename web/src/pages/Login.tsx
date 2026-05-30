import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function send(e: React.FormEvent) {
    e.preventDefault()
    // NOTE: window.location.origin must be added to Supabase Auth → URL Configuration → Redirect URLs (Studio in dev, dashboard in prod). Otherwise magic links 404.
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) setError(error.message); else setSent(true)
  }
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={send} className="bg-white p-8 rounded-xl shadow-sm w-96">
        <h1 className="text-xl font-bold mb-1">Loggic Outreach</h1>
        <p className="text-sm text-slate-500 mb-6">Connecte-toi avec ton email Loggic.</p>
        {sent ? (
          <p className="text-green-600 text-sm">Vérifie ta boîte mail pour le lien.</p>
        ) : (
          <>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="toi@logiccsupplies.ca" className="w-full border rounded px-3 py-2 mb-3"/>
            <button className="w-full bg-slate-900 text-white py-2 rounded">Envoyer le lien</button>
            {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
          </>
        )}
      </form>
    </div>
  )
}
