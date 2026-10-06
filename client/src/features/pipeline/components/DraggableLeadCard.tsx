import * as React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'motion/react'
import { usePrefersReducedMotion } from '@/lib/motion'
import type { Lead } from '@/types/pipeline.types'
import { LeadCard } from './LeadCard'

interface DraggableLeadCardProps {
  lead: Lead
  onClick?: () => void
  disabled?: boolean
  isHighlighted?: boolean
}

export function DraggableLeadCard({
  lead,
  onClick,
  disabled = false,
  isHighlighted = false,
}: DraggableLeadCardProps) {
  const reducedMotion = usePrefersReducedMotion()
  const isTerminal = lead.status === 'WON' || lead.status === 'LOST'
  const [isReadyForLayout, setIsReadyForLayout] = React.useState(false)

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setIsReadyForLayout(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead._id,
    data: {
      type: 'LEAD',
      lead,
    },
    disabled: disabled || isTerminal,
  })

  return (
    <motion.div
      ref={setNodeRef}
      layout={!isReadyForLayout || reducedMotion || isDragging ? false : 'position'}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 30,
        mass: 0.8,
      }}
      {...attributes}
      {...listeners}
      className={`touch-none transition-shadow ${
        isDragging ? 'opacity-30 pointer-events-none' : 'opacity-100'
      } ${isTerminal ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
    >
      <LeadCard lead={lead} onClick={onClick} isHighlighted={isHighlighted} />
    </motion.div>
  )
}

