import { z } from 'zod';
import { logger } from './logger';
import prisma from './db';

// Schemas for agent memory tracking
export const AgentMemorySnapshotSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  userId: z.string(),
  command: z.string(),
  memorySnapshot: z.record(z.string(), z.unknown()),
  tokenUsage: z.number(),
  memorySize: z.number(),
  contextRelevance: z.number().min(0).max(1).optional(),
  responseQuality: z.number().min(0).max(1).optional(),
  executionTimeMs: z.number(),
  toolsUsed: z.array(z.string()),
  summary: z.string().optional(),
});

export const MemoryAnalyticsSchema = z.object({
  sessionId: z.string(),
  projectId: z.string().optional(),
  userId: z.string().optional(),
  timeRange: z.object({
    start: z.date(),
    end: z.date(),
  }),
  metrics: z.object({
    totalInteractions: z.number(),
    averageMemorySize: z.number(),
    averageTokenUsage: z.number(),
    averageExecutionTime: z.number(),
    averageContextRelevance: z.number(),
    averageResponseQuality: z.number(),
    memoryEfficiency: z.number(), // response quality / memory size ratio
  }),
  memoryGrowth: z.array(z.object({
    timestamp: z.date(),
    memorySize: z.number(),
    tokenUsage: z.number(),
  })),
  commandBreakdown: z.array(z.object({
    command: z.string(),
    count: z.number(),
    avgExecutionTime: z.number(),
    avgMemorySize: z.number(),
  })),
});

export type AgentMemorySnapshot = z.infer<typeof AgentMemorySnapshotSchema>;
export type MemoryAnalytics = z.infer<typeof MemoryAnalyticsSchema>;

/**
 * Agent Memory Persistence Service
 * Tracks agent performance and memory efficiency
 */
export class AgentMemoryTracker {
  /**
   * Record an agent memory snapshot
   */
  async recordMemorySnapshot(snapshot: AgentMemorySnapshot): Promise<void> {
    const validatedSnapshot = AgentMemorySnapshotSchema.parse(snapshot);

    try {
      await prisma.agentMemory.create({
        data: {
          sessionId: validatedSnapshot.sessionId,
          projectId: validatedSnapshot.projectId,
          userId: validatedSnapshot.userId,
          command: validatedSnapshot.command,
          memorySnapshot: JSON.stringify(validatedSnapshot.memorySnapshot),
          tokenUsage: validatedSnapshot.tokenUsage,
          memorySize: validatedSnapshot.memorySize,
          contextRelevance: validatedSnapshot.contextRelevance,
          responseQuality: validatedSnapshot.responseQuality,
          executionTimeMs: validatedSnapshot.executionTimeMs,
          toolsUsed: JSON.stringify(validatedSnapshot.toolsUsed),
          summary: validatedSnapshot.summary,
        },
      });

      logger.info('Agent memory snapshot recorded', {
        sessionId: validatedSnapshot.sessionId,
        command: validatedSnapshot.command,
        memorySize: validatedSnapshot.memorySize,
        tokenUsage: validatedSnapshot.tokenUsage,
      });

    } catch (error) {
      logger.error('Failed to record agent memory snapshot', {
        sessionId: validatedSnapshot.sessionId,
        command: validatedSnapshot.command,
      }, error as Error);
      throw error;
    }
  }

  /**
   * Generate memory analytics for a session
   */
  async getMemoryAnalytics(options: {
    sessionId?: string;
    projectId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<MemoryAnalytics> {
    const {
      sessionId,
      projectId,
      userId,
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      endDate = new Date(),
    } = options;

    try {
      // Build where clause
      const whereClause: {
        createdAt: { gte: Date; lte: Date };
        sessionId?: string;
        projectId?: string;
        userId?: string;
      } = {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };

      if (sessionId) whereClause.sessionId = sessionId;
      if (projectId) whereClause.projectId = projectId;
      if (userId) whereClause.userId = userId;

      // Get agent memory records
      const memoryRecords = await prisma.agentMemory.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
      });

      if (memoryRecords.length === 0) {
        return {
          sessionId: sessionId || 'all',
          projectId,
          userId,
          timeRange: { start: startDate, end: endDate },
          metrics: {
            totalInteractions: 0,
            averageMemorySize: 0,
            averageTokenUsage: 0,
            averageExecutionTime: 0,
            averageContextRelevance: 0,
            averageResponseQuality: 0,
            memoryEfficiency: 0,
          },
          memoryGrowth: [],
          commandBreakdown: [],
        };
      }

      // Calculate metrics
      const totalInteractions = memoryRecords.length;
      const averageMemorySize = memoryRecords.reduce((sum: number, record) => sum + record.memorySize, 0) / totalInteractions;
      const averageTokenUsage = memoryRecords.reduce((sum: number, record) => sum + record.tokenUsage, 0) / totalInteractions;
      const averageExecutionTime = memoryRecords.reduce((sum: number, record) => sum + record.executionTimeMs, 0) / totalInteractions;

      // Calculate relevance and quality averages (only for records that have these metrics)
      const recordsWithRelevance = memoryRecords.filter(r => r.contextRelevance !== null);
      const recordsWithQuality = memoryRecords.filter(r => r.responseQuality !== null);
      
      const averageContextRelevance = recordsWithRelevance.length > 0
        ? recordsWithRelevance.reduce((sum: number, record) => sum + (record.contextRelevance || 0), 0) / recordsWithRelevance.length
        : 0;
      
      const averageResponseQuality = recordsWithQuality.length > 0
        ? recordsWithQuality.reduce((sum: number, record) => sum + (record.responseQuality || 0), 0) / recordsWithQuality.length
        : 0;

      // Calculate memory efficiency (response quality / memory size ratio)
      const memoryEfficiency = averageMemorySize > 0 ? averageResponseQuality / averageMemorySize * 1000 : 0;

      // Generate memory growth data
      const memoryGrowth = memoryRecords.map(record => ({
        timestamp: record.createdAt,
        memorySize: record.memorySize,
        tokenUsage: record.tokenUsage,
      }));

      // Generate command breakdown
      const commandMap = new Map<string, { count: number; totalTime: number; totalMemory: number }>();
      
      for (const record of memoryRecords) {
        const current = commandMap.get(record.command) || { count: 0, totalTime: 0, totalMemory: 0 };
        current.count++;
        current.totalTime += record.executionTimeMs;
        current.totalMemory += record.memorySize;
        commandMap.set(record.command, current);
      }

      const commandBreakdown = Array.from(commandMap.entries()).map(([command, data]) => ({
        command,
        count: data.count,
        avgExecutionTime: data.totalTime / data.count,
        avgMemorySize: data.totalMemory / data.count,
      }));

      const analytics: MemoryAnalytics = {
        sessionId: sessionId || 'all',
        projectId,
        userId,
        timeRange: { start: startDate, end: endDate },
        metrics: {
          totalInteractions,
          averageMemorySize,
          averageTokenUsage,
          averageExecutionTime,
          averageContextRelevance,
          averageResponseQuality,
          memoryEfficiency,
        },
        memoryGrowth,
        commandBreakdown,
      };

      return MemoryAnalyticsSchema.parse(analytics);

    } catch (error) {
      logger.error('Failed to get memory analytics', options, error as Error);
      throw error;
    }
  }

  /**
   * Get memory efficiency trends over time
   */
  async getMemoryEfficiencyTrends(options: {
    projectId?: string;
    userId?: string;
    days?: number;
  } = {}): Promise<{
    daily: Array<{
      date: string;
      memoryEfficiency: number;
      avgMemorySize: number;
      avgResponseQuality: number;
      interactionCount: number;
    }>;
    summary: {
      trend: 'improving' | 'declining' | 'stable';
      trendPercentage: number;
    };
  }> {
    const {
      projectId,
      userId,
      days = 30,
    } = options;

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    try {
      const whereClause: {
        createdAt: { gte: Date; lte: Date };
        projectId?: string;
        userId?: string;
        responseQuality: { not: null };
      } = {
        createdAt: { gte: startDate, lte: endDate },
        responseQuality: { not: null },
      };

      if (projectId) whereClause.projectId = projectId;
      if (userId) whereClause.userId = userId;

      const records = await prisma.agentMemory.findMany({
        where: whereClause,
        select: {
          createdAt: true,
          memorySize: true,
          responseQuality: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Group by day and calculate daily metrics
      const dailyMap = new Map<string, {
        memorySize: number[];
        responseQuality: number[];
      }>();

      for (const record of records) {
        const dateKey = record.createdAt.toISOString().split('T')[0];
        const current = dailyMap.get(dateKey) || { memorySize: [], responseQuality: [] };
        
        current.memorySize.push(record.memorySize);
        current.responseQuality.push(record.responseQuality || 0);
        
        dailyMap.set(dateKey, current);
      }

      // Calculate daily efficiency scores
      const daily = Array.from(dailyMap.entries()).map(([date, data]) => {
        const avgMemorySize = data.memorySize.reduce((sum: number, size) => sum + size, 0) / data.memorySize.length;
        const avgResponseQuality = data.responseQuality.reduce((sum: number, quality) => sum + quality, 0) / data.responseQuality.length;
        const memoryEfficiency = avgMemorySize > 0 ? (avgResponseQuality / avgMemorySize) * 1000 : 0;

        return {
          date,
          memoryEfficiency,
          avgMemorySize,
          avgResponseQuality,
          interactionCount: data.memorySize.length,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      // Calculate trend
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      let trendPercentage = 0;

      if (daily.length >= 2) {
        const firstHalf = daily.slice(0, Math.floor(daily.length / 2));
        const secondHalf = daily.slice(Math.floor(daily.length / 2));

        const firstHalfAvg = firstHalf.reduce((sum: number, day) => sum + day.memoryEfficiency, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum: number, day) => sum + day.memoryEfficiency, 0) / secondHalf.length;

        if (firstHalfAvg > 0) {
          trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
          
          if (Math.abs(trendPercentage) < 5) {
            trend = 'stable';
          } else if (trendPercentage > 0) {
            trend = 'improving';
          } else {
            trend = 'declining';
          }
        }
      }

      return {
        daily,
        summary: {
          trend,
          trendPercentage,
        },
      };

    } catch (error) {
      logger.error('Failed to get memory efficiency trends', options, error as Error);
      throw error;
    }
  }

  /**
   * Clean up old memory records (older than specified days)
   */
  async cleanupOldMemories(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    try {
      const result = await prisma.agentMemory.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      logger.info('Cleaned up old agent memories', {
        deletedCount: result.count,
        cutoffDate: cutoffDate.toISOString(),
      });

      return result.count;

    } catch (error) {
      logger.error('Failed to cleanup old memories', { retentionDays }, error as Error);
      throw error;
    }
  }

  /**
   * Get session memory summary
   */
  async getSessionMemorySummary(sessionId: string): Promise<{
    sessionId: string;
    totalInteractions: number;
    memoryGrowth: number; // percentage growth from first to last
    currentMemorySize: number;
    averageExecutionTime: number;
    mostUsedCommand: string;
    efficiencyTrend: 'improving' | 'declining' | 'stable';
  } | null> {
    try {
      const records = await prisma.agentMemory.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });

      if (records.length === 0) {
        return null;
      }

      const firstRecord = records[0];
      const lastRecord = records[records.length - 1];
      
      const memoryGrowth = firstRecord.memorySize > 0 
        ? ((lastRecord.memorySize - firstRecord.memorySize) / firstRecord.memorySize) * 100 
        : 0;

      const averageExecutionTime = records.reduce((sum: number, r) => sum + r.executionTimeMs, 0) / records.length;

      // Find most used command
      const commandCounts = new Map<string, number>();
      for (const record of records) {
        commandCounts.set(record.command, (commandCounts.get(record.command) || 0) + 1);
      }
      const mostUsedCommand = Array.from(commandCounts.entries())
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';

      // Calculate efficiency trend
      let efficiencyTrend: 'improving' | 'declining' | 'stable' = 'stable';
      const recordsWithQuality = records.filter(r => r.responseQuality !== null);
      
      if (recordsWithQuality.length >= 2) {
        const firstHalf = recordsWithQuality.slice(0, Math.floor(recordsWithQuality.length / 2));
        const secondHalf = recordsWithQuality.slice(Math.floor(recordsWithQuality.length / 2));

        const firstEfficiency = firstHalf.reduce((sum: number, r) => sum + ((r.responseQuality || 0) / r.memorySize), 0) / firstHalf.length;
        const secondEfficiency = secondHalf.reduce((sum: number, r) => sum + ((r.responseQuality || 0) / r.memorySize), 0) / secondHalf.length;

        const change = ((secondEfficiency - firstEfficiency) / firstEfficiency) * 100;
        
        if (Math.abs(change) > 10) {
          efficiencyTrend = change > 0 ? 'improving' : 'declining';
        }
      }

      return {
        sessionId,
        totalInteractions: records.length,
        memoryGrowth,
        currentMemorySize: lastRecord.memorySize,
        averageExecutionTime,
        mostUsedCommand,
        efficiencyTrend,
      };

    } catch (error) {
      logger.error('Failed to get session memory summary', { sessionId }, error as Error);
      throw error;
    }
  }
}

// Global memory tracker instance
export const agentMemoryTracker = new AgentMemoryTracker();