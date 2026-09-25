import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSocketEvent } from '@/lib/socket'
import { PIPELINE_QUERY_KEY } from '../api/pipeline.api'
import type {
  PipelineGroupedData,
  PipelineStageChangedBroadcastPayload,
  Lead,
} from '@/types/pipeline.types'

export function usePipelineSocket(enabled: boolean = true) {
  const queryClient = useQueryClient()

  const handleStageChanged = React.useCallback(
    (payload: PipelineStageChangedBroadcastPayload) => {
      queryClient.setQueriesData<PipelineGroupedData>(
        { queryKey: PIPELINE_QUERY_KEY },
        (oldData) => {
          if (!oldData || !oldData.pipeline) {
            return oldData
          }

          const { leadId, previousStage, newStage, version } = payload

          // 1. Locate the lead across current pipeline stages
          let foundLead: Lead | null = null
          let sourceStage = previousStage

          for (const [stg, list] of Object.entries(oldData.pipeline)) {
            const idx = list.findIndex((l) => l._id === leadId)
            if (idx !== -1) {
              foundLead = list[idx]
              sourceStage = stg as typeof previousStage
              break
            }
          }

          // If lead not in cache (e.g. new lead or different filter), invalidate to refetch cleanly
          if (!foundLead) {
            queryClient.invalidateQueries({ queryKey: PIPELINE_QUERY_KEY })
            return oldData
          }

          // If lead already in target stage with matching or higher version, no change needed
          if (foundLead.status === newStage && (foundLead.__v ?? 0) >= version) {
            return oldData
          }

          // 2. Clone stages and counts immutably
          const updatedPipeline = { ...oldData.pipeline }
          const updatedCounts = { ...oldData.counts }

          // Remove from source stage
          updatedPipeline[sourceStage] = (updatedPipeline[sourceStage] || []).filter(
            (l) => l._id !== leadId,
          )
          if (updatedCounts[sourceStage] !== undefined && updatedCounts[sourceStage] > 0) {
            updatedCounts[sourceStage]--
          }

          // Add to new stage with updated version and status
          const updatedLead: Lead = {
            ...foundLead,
            status: newStage,
            __v: version,
            updatedAt: payload.timestamp || new Date().toISOString(),
          }

          // Ensure no duplicate in target stage
          updatedPipeline[newStage] = [
            ...(updatedPipeline[newStage] || []).filter((l) => l._id !== leadId),
            updatedLead,
          ]
          updatedCounts[newStage] = (updatedCounts[newStage] || 0) + 1

          return {
            ...oldData,
            pipeline: updatedPipeline,
            counts: updatedCounts,
          }
        },
      )
    },
    [queryClient],
  )

  useSocketEvent<PipelineStageChangedBroadcastPayload>(
    'pipeline:stage_changed',
    handleStageChanged,
    enabled,
  )

  useSocketEvent<PipelineStageChangedBroadcastPayload>(
    'lead:stage_changed',
    handleStageChanged,
    enabled,
  )
}
