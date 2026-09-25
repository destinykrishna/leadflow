import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Lead } from '@/types/pipeline.types'
import { LeadCard } from './LeadCard'

interface DraggableLeadCardProps {
  lead: Lead
  onClick?: () => void
  disabled?: boolean
}

export function DraggableLeadCard({ lead, onClick, disabled = false }: DraggableLeadCardProps) {
  const isTerminal = lead.status === 'WON' || lead.status === 'LOST'

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead._id,
    data: {
      type: 'LEAD',
      lead,
    },
    disabled: disabled || isTerminal,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-none ${
        isDragging ? 'opacity-30 pointer-events-none' : 'opacity-100'
      } ${isTerminal ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <LeadCard lead={lead} onClick={onClick} />
    </div>
  )
}
