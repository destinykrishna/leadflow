import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'neutral' | 'success' | 'warning' | 'danger' | 'outline'
  size?: 'sm' | 'md'
}

export function Badge({ className, variant = 'default', size = 'sm', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary/10 text-primary border-primary/20',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    outline: 'text-foreground border-border bg-transparent',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs tracking-wide',
    md: 'px-2.5 py-1 text-xs font-semibold',
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-colors select-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
}
