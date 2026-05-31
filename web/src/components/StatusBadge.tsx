import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

type Variant = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const styles: Record<Variant, string> = {
  success: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
  neutral: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-600/20',
  info: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20',
}

export function StatusBadge({
  variant,
  children,
  className,
}: { variant: Variant, children: ReactNode, className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
