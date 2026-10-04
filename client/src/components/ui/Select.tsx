import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, label, error, id, ...props }, ref) => {
    const generatedId = React.useId()
    const selectId = id || generatedId

    return (
      <div className="relative inline-flex items-center w-full">
        <select
          id={selectId}
          ref={ref}
          aria-label={props['aria-label'] || label}
          aria-invalid={Boolean(error)}
          className={cn(
            'h-9 w-full appearance-none rounded-md border border-input bg-card pl-3 pr-8 py-1.5 text-xs text-foreground shadow-2xs transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
            error && 'border-destructive focus-visible:ring-destructive',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>
    )
  },
)

Select.displayName = 'Select'
