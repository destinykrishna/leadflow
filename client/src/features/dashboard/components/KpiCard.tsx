import * as React from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  badgeText?: string
  trend?: {
    positive?: boolean
    text: string
  }
  className?: string
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badgeText,
  trend,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn('overflow-hidden transition-all duration-150 hover:border-slate-300', className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 shadow-2xs">
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
          {badgeText && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {badgeText}
            </span>
          )}
        </div>

        {(subtitle || trend) && (
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
            {subtitle && <span>{subtitle}</span>}
            {trend && (
              <span
                className={cn(
                  'font-medium',
                  trend.positive ? 'text-emerald-600' : 'text-slate-500',
                )}
              >
                {trend.text}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
