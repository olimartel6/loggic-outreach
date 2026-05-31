import type { ReactNode } from 'react'
import { TopNav } from './TopNav'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />
      <main className="flex-1 px-6 py-8 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  )
}
