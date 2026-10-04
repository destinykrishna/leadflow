import { Types } from 'mongoose';
import { Lead, Client, Task, type LeadStatus } from '../models/index.js';
import type { AuthUserContext } from '../middleware/auth.middleware.js';
import { BrokerageIsolationError } from '../utils/errors.js';

const ORDERED_STAGES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
];

const STAGE_LABELS: Record<LeadStatus, { label: string; badgeVariant: 'neutral' | 'default' | 'success' | 'warning' | 'danger' }> = {
  NEW: { label: 'New Lead', badgeVariant: 'neutral' },
  CONTACTED: { label: 'Contacted', badgeVariant: 'default' },
  QUALIFIED: { label: 'Pre-Qualified', badgeVariant: 'default' },
  PROPOSAL: { label: 'Proposal Sent', badgeVariant: 'warning' },
  NEGOTIATION: { label: 'Negotiation', badgeVariant: 'warning' },
  WON: { label: 'Approved & Won', badgeVariant: 'success' },
  LOST: { label: 'Closed / Lost', badgeVariant: 'danger' },
};

export interface DashboardSummaryResponse {
  metrics: {
    totalLeads: number;
    activePipelineCount: number;
    activePipelineValue: number;
    wonPipelineValue: number;
    avgLoanAmount: number;
    qualifiedLeadsCount: number;
    wonCasesCount: number;
    activeClientsCount: number;
    totalPipelineValue: number;
    conversionRate: number;
    stageBreakdown: Array<{
      stage: LeadStatus;
      label: string;
      count: number;
      percentage: number;
      totalVolume: number;
      avgVolume: number;
      badgeVariant: 'neutral' | 'default' | 'success' | 'warning' | 'danger';
    }>;
    recentLeads: any[];
    staleLeadsCount: number;
    sourceBreakdown: Array<{
      source: string;
      count: number;
      wonCount: number;
      conversionRate: number;
      totalVolume: number;
    }>;
  };
  tasks: any[];
}

export class DashboardService {
  /**
   * Generates a high-performance consolidated operational dashboard summary.
   * Replaces 3 separate heavy API queries with a single MongoDB aggregation round-trip.
   */
  async getDashboardSummary(userContext: AuthUserContext): Promise<DashboardSummaryResponse> {
    if (userContext.role !== 'PLATFORM_ADMIN' && !userContext.brokerageId) {
      throw new BrokerageIsolationError('Brokerage context missing for tenant user');
    }

    const leadFilter: Record<string, any> = {
      isArchived: { $ne: true },
    };
    if (userContext.role !== 'PLATFORM_ADMIN') {
      leadFilter.brokerageId = new Types.ObjectId(userContext.brokerageId!);
    }

    const clientFilter: Record<string, any> = {
      status: 'ACTIVE',
    };
    if (userContext.role !== 'PLATFORM_ADMIN') {
      clientFilter.brokerageId = new Types.ObjectId(userContext.brokerageId!);
    }

    const taskFilter: Record<string, any> = {
      status: { $in: ['PENDING', 'IN_PROGRESS'] },
    };
    if (userContext.role !== 'PLATFORM_ADMIN') {
      taskFilter.brokerageId = new Types.ObjectId(userContext.brokerageId!);
    }

    // Run parallel covered queries
    const [leadAggResult, activeClientsCount, pendingTasks] = await Promise.all([
      Lead.aggregate([
        { $match: leadFilter },
        {
          $facet: {
            stageStats: [
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 },
                  totalVolume: {
                    $sum: {
                      $ifNull: ['$customFields.loanAmount', 0],
                    },
                  },
                },
              },
            ],
            recentLeads: [
              { $sort: { createdAt: -1 } },
              { $limit: 7 },
              {
                $lookup: {
                  from: 'users',
                  localField: 'assignedTo',
                  foreignField: '_id',
                  as: 'assignedAdvisor',
                  pipeline: [
                    {
                      $project: {
                        _id: 1,
                        name: 1,
                        email: 1,
                        role: 1,
                      },
                    },
                  ],
                },
              },
              {
                $addFields: {
                  assignedTo: { $arrayElemAt: ['$assignedAdvisor', 0] },
                },
              },
              {
                $project: {
                  assignedAdvisor: 0,
                },
              },
            ],
            sourceStats: [
              {
                $group: {
                  _id: '$source',
                  count: { $sum: 1 },
                  wonCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'WON'] }, 1, 0] },
                  },
                  totalVolume: {
                    $sum: { $ifNull: ['$customFields.loanAmount', 0] },
                  },
                },
              },
              { $sort: { count: -1 } },
            ],
            staleLeadsStats: [
              {
                $match: {
                  status: { $in: ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'] },
                  updatedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                },
              },
              {
                $count: 'staleCount',
              },
            ],
          },
        },
      ]),
      Client.countDocuments(clientFilter),
      Task.find(taskFilter)
        .sort({ dueDate: 1, createdAt: -1 })
        .limit(10)
        .populate('assignedTo', '_id name email role'),
    ]);

    const stageStats: Array<{ _id: LeadStatus; count: number; totalVolume: number }> =
      leadAggResult[0]?.stageStats || [];
    const recentLeads = leadAggResult[0]?.recentLeads || [];
    const staleLeadsCount = leadAggResult[0]?.staleLeadsStats?.[0]?.staleCount || 0;
    const rawSourceStats = leadAggResult[0]?.sourceStats || [];

    const sourceBreakdown = rawSourceStats.map((s: any) => ({
      source: s._id || 'OTHER',
      count: s.count,
      wonCount: s.wonCount,
      conversionRate: s.count > 0 ? Math.round((s.wonCount / s.count) * 100) : 0,
      totalVolume: s.totalVolume,
    }));

    // Map stats by stage
    const statsByStage: Partial<Record<LeadStatus, { count: number; totalVolume: number }>> = {};
    let totalLeads = 0;
    let totalPipelineValue = 0;
    let totalLoansCount = 0;

    for (const stat of stageStats) {
      statsByStage[stat._id] = {
        count: stat.count,
        totalVolume: stat.totalVolume,
      };
      totalLeads += stat.count;
      totalPipelineValue += stat.totalVolume;
      if (stat.totalVolume > 0) {
        totalLoansCount += stat.count;
      }
    }

    const counts: Record<LeadStatus, number> = {
      NEW: statsByStage.NEW?.count || 0,
      CONTACTED: statsByStage.CONTACTED?.count || 0,
      QUALIFIED: statsByStage.QUALIFIED?.count || 0,
      PROPOSAL: statsByStage.PROPOSAL?.count || 0,
      NEGOTIATION: statsByStage.NEGOTIATION?.count || 0,
      WON: statsByStage.WON?.count || 0,
      LOST: statsByStage.LOST?.count || 0,
    };

    const activePipelineCount =
      counts.NEW + counts.CONTACTED + counts.QUALIFIED + counts.PROPOSAL + counts.NEGOTIATION;

    const activePipelineValue =
      (statsByStage.NEW?.totalVolume || 0) +
      (statsByStage.CONTACTED?.totalVolume || 0) +
      (statsByStage.QUALIFIED?.totalVolume || 0) +
      (statsByStage.PROPOSAL?.totalVolume || 0) +
      (statsByStage.NEGOTIATION?.totalVolume || 0);

    const wonPipelineValue = statsByStage.WON?.totalVolume || 0;
    const qualifiedLeadsCount = counts.QUALIFIED;
    const wonCasesCount = counts.WON;

    const resolvedCount = wonCasesCount + counts.LOST;
    const conversionRate = resolvedCount > 0 ? Math.round((wonCasesCount / resolvedCount) * 100) : 0;
    const avgLoanAmount = totalLoansCount > 0 ? Math.round(totalPipelineValue / totalLoansCount) : 0;

    const stageBreakdown = ORDERED_STAGES.map((stage) => {
      const stageStat = statsByStage[stage] || { count: 0, totalVolume: 0 };
      const percentage = totalLeads > 0 ? Math.round((stageStat.count / totalLeads) * 100) : 0;
      const avgVolume = stageStat.count > 0 ? Math.round(stageStat.totalVolume / stageStat.count) : 0;

      return {
        stage,
        label: STAGE_LABELS[stage].label,
        count: stageStat.count,
        percentage,
        totalVolume: stageStat.totalVolume,
        avgVolume,
        badgeVariant: STAGE_LABELS[stage].badgeVariant,
      };
    });

    return {
      metrics: {
        totalLeads,
        activePipelineCount,
        activePipelineValue,
        wonPipelineValue,
        avgLoanAmount,
        qualifiedLeadsCount,
        wonCasesCount,
        activeClientsCount,
        totalPipelineValue,
        conversionRate,
        stageBreakdown,
        recentLeads,
        staleLeadsCount,
        sourceBreakdown,
      },
      tasks: pendingTasks,
    };
  }
}

export const dashboardService = new DashboardService();
