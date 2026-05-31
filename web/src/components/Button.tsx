import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300 shadow-sm',
  secondary: 'bg-white text-slate-900 hover:bg-slate-50 ring-1 ring-inset ring-slate-300 disabled:opacity-50 shadow-sm',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-inset ring-red-600/20 disabled:opacity-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50',
}

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant, size?: Size }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  )
}
