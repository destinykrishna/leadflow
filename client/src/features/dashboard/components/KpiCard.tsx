import * as React from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  secondaryValue?: string
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
  secondaryValue,
  subtitle,
  icon: Icon,
  badgeText,
  trend,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn('overflow-hidden border-border/80 bg-card transition-all duration-150 hover:border-slate-300 hover:shadow-2xs', className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          <div className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shadow-2xs">
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
          {secondaryValue && (
            <span className="text-xs font-semibold text-slate-700">
              {secondaryValue}
            </span>
          )}
          {badgeText && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              {badgeText}
            </span>
          )}
        </div>

        {(subtitle || trend) && (
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            {subtitle && <span className="truncate">{subtitle}</span>}
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
