import { NavLink } from 'react-router-dom'
import { Zap, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TriggerNavigationTabsProps {
  triggersCount?: number
  templatesCount?: number
}

export function TriggerNavigationTabs({
  triggersCount,
  templatesCount,
}: TriggerNavigationTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-border mb-6">
      <NavLink
        to="/app/triggers"
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px',
            isActive
              ? 'border-slate-900 text-slate-900 bg-slate-50/50'
              : 'border-transparent text-muted-foreground hover:text-slate-900 hover:border-slate-300',
          )
        }
      >
        <Zap className="h-4 w-4 text-amber-500" />
        <span>Stage Automations</span>
        {typeof triggersCount === 'number' && (
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200">
            {triggersCount}
          </span>
        )}
      </NavLink>

      <NavLink
        to="/app/templates"
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px',
            isActive
              ? 'border-slate-900 text-slate-900 bg-slate-50/50'
              : 'border-transparent text-muted-foreground hover:text-slate-900 hover:border-slate-300',
          )
        }
      >
        <Mail className="h-4 w-4 text-primary" />
        <span>Email Templates</span>
        {typeof templatesCount === 'number' && (
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200">
            {templatesCount}
          </span>
        )}
      </NavLink>
    </div>
  )
}
