import { cn } from '@/lib/utils'

export interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
  fullScreen?: boolean
}

export function Loader({ size = 'md', className, label, fullScreen = false }: LoaderProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-7 w-7 border-2',
    lg: 'h-10 w-10 border-3',
  }

  const spinner = (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-primary border-t-transparent',
          sizeClasses[size],
        )}
        role="status"
        aria-label="Loading"
      />
      {label && <p className="text-xs font-medium text-muted-foreground animate-pulse">{label}</p>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs">
        {spinner}
      </div>
    )
  }

  return spinner
}
