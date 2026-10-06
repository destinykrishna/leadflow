import * as React from 'react'
import gsap from 'gsap'
import { Card, CardContent } from '@/components/ui/Card'
import { prefersReducedMotion } from '@/lib/motion'
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

function parseNumericValue(val: string | number) {
  if (typeof val === 'number') {
    return { prefix: '', num: val, suffix: '', hasDecimals: !Number.isInteger(val), isNumeric: true }
  }
  const str = String(val).trim()
  const match = str.match(/^([^\d.-]*)([\d,.]+)(.*)$/)
  if (!match) {
    return { prefix: '', num: 0, suffix: '', hasDecimals: false, isNumeric: false }
  }
  const prefix = match[1]
  const rawNumStr = match[2].replace(/,/g, '')
  const suffix = match[3]
  const parsed = parseFloat(rawNumStr)
  if (isNaN(parsed)) {
    return { prefix: '', num: 0, suffix: '', hasDecimals: false, isNumeric: false }
  }
  return { prefix, num: parsed, suffix, hasDecimals: rawNumStr.includes('.'), isNumeric: true }
}

function formatValue(current: number, prefix: string, suffix: string, hasDecimals: boolean): string {
  let numFormatted = ''
  if (prefix.includes('₹')) {
    numFormatted = hasDecimals
      ? current.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : Math.round(current).toLocaleString('en-IN')
  } else {
    numFormatted = hasDecimals
      ? current.toFixed(1)
      : Math.round(current).toLocaleString('en-US')
  }
  return `${prefix}${numFormatted}${suffix}`
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
  const valueRef = React.useRef<HTMLSpanElement>(null)
  const parsed = parseNumericValue(value)
  const prevValueRef = React.useRef<number>(parsed.num)
  const hasMountedRef = React.useRef(false)

  React.useEffect(() => {
    if (!valueRef.current) return

    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      prevValueRef.current = parsed.num
      valueRef.current.textContent = String(value)
      return
    }

    if (!parsed.isNumeric || prefersReducedMotion()) {
      valueRef.current.textContent = String(value)
      prevValueRef.current = parsed.num
      return
    }

    if (prevValueRef.current === parsed.num) {
      valueRef.current.textContent = String(value)
      return
    }

    const startVal = prevValueRef.current
    const targetVal = parsed.num
    const targetObj = { val: startVal }

    const tween = gsap.to(targetObj, {
      val: targetVal,
      duration: 0.4,
      ease: 'power2.out',
      onUpdate: () => {
        if (valueRef.current) {
          valueRef.current.textContent = formatValue(
            targetObj.val,
            parsed.prefix,
            parsed.suffix,
            parsed.hasDecimals,
          )
        }
      },
      onComplete: () => {
        if (valueRef.current) {
          valueRef.current.textContent = String(value)
        }
        prevValueRef.current = targetVal
      },
    })

    return () => {
      tween.kill()
    }
  }, [value, parsed.isNumeric, parsed.num, parsed.prefix, parsed.suffix, parsed.hasDecimals])

  return (
    <Card className={cn('overflow-hidden border-border/80 bg-card transition-all duration-150 hover:border-slate-300 hover:shadow-2xs', className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 shadow-2xs">
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
          <span ref={valueRef} className="text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </span>
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
