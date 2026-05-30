import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const tabs = [
  { to: '/', label: 'Dashboard' },
  { to: '/campaigns', label: 'Campagnes' },
  { to: '/leads', label: 'Leads' },
  { to: '/settings', label: 'Settings' },
]

export function TopNav() {
  const { session } = useAuth()
  return (
    <nav className="border-b bg-white px-6 py-3 flex items-center text-sm">
      <div className="font-bold mr-8">⚡ Outreach</div>
      <div className="flex gap-6 flex-1">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({isActive}) => isActive ? 'font-semibold border-b-2 border-slate-900 pb-1' : 'text-slate-500'}>{t.label}</NavLink>
        ))}
      </div>
      <div className="text-xs text-slate-500 mr-4">{session?.user.email}</div>
      <button onClick={() => supabase.auth.signOut()} className="text-xs text-slate-500 hover:text-slate-900">Logout</button>
    </nav>
  )
}
