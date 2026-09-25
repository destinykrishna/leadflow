import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

interface FeatureShellProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  emptyTitle: string
  emptyDescription: string
  action?: React.ReactNode
}

export function FeatureShell({
  title,
  subtitle,
  icon,
  emptyTitle,
  emptyDescription,
  action,
}: FeatureShellProps) {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {action && <div>{action}</div>}
      </div>

      {/* Feature Content Area */}
      <Card className="border-border">
        <CardContent className="pt-6">
          <EmptyState
            icon={icon}
            title={emptyTitle}
            description={emptyDescription}
          />
        </CardContent>
      </Card>
    </div>
  )
}
