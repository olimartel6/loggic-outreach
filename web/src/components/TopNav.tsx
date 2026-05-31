import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button } from './Button'

const tabs = [
  { to: '/', label: 'Dashboard' },
  { to: '/campaigns', label: 'Campagnes' },
  { to: '/leads', label: 'Leads' },
  { to: '/dms', label: 'DMs' },
  { to: '/settings', label: 'Settings' },
]

function initialsFromEmail(email?: string | null) {
  if (!email) return '?'
  const local = email.split('@')[0]
  const parts = local.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return local.slice(0, 2).toUpperCase()
}

export function TopNav() {
  const { session } = useAuth()
  const email = session?.user.email
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-6 flex items-center h-14">
        <div className="font-semibold text-slate-900 tracking-tight mr-10">Loggic Outreach</div>
        <div className="flex gap-7 flex-1 h-full items-center">
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `relative h-full flex items-center text-sm font-medium transition ${
                  isActive
                    ? 'text-slate-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-indigo-600 after:rounded-full'
                    : 'text-slate-500 hover:text-slate-900'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center">
              {initialsFromEmail(email)}
            </div>
            <div className="text-xs text-slate-500 hidden sm:block">{email}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>Logout</Button>
        </div>
      </div>
    </nav>
  )
}
