import { z } from 'zod';
import { logger } from './logger';
import prisma from './db';

// Schemas for analytics data
export const ToolExecutionEventSchema = z.object({
  toolName: z.string(),
  projectId: z.string(),
  userId: z.string(),
  sessionId: z.string().optional(),
  input: z.string(),
  output: z.string(),
  success: z.boolean(),
  executionTimeMs: z.number(),
  error: z.string().optional(),
  timestamp: z.date(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ToolUsageAnalyticsSchema = z.object({
  toolName: z.string(),
  projectId: z.string().optional(),
  userId: z.string().optional(),
  timeRange: z.object({
    start: z.date(),
    end: z.date(),
  }),
  metrics: z.object({
    totalExecutions: z.number(),
    successfulExecutions: z.number(),
    failedExecutions: z.number(),
    successRate: z.number(),
    averageExecutionTime: z.number(),
    medianExecutionTime: z.number(),
    totalExecutionTime: z.number(),
  }),
  hourlyBreakdown: z.array(z.object({
    hour: z.number(),
    executions: z.number(),
    successRate: z.number(),
    averageTime: z.number(),
  })),
  errorBreakdown: z.array(z.object({
    error: z.string(),
    count: z.number(),
    percentage: z.number(),
  })),
});

export type ToolExecutionEvent = z.infer<typeof ToolExecutionEventSchema>;
export type ToolUsageAnalytics = z.infer<typeof ToolUsageAnalyticsSchema>;

/**
 * Tool Analytics Tracker - Collects and analyzes tool usage data
 */
export class ToolAnalyticsTracker {
  private events: ToolExecutionEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 30000; // Flush every 30 seconds
  private readonly MAX_EVENTS_BEFORE_FLUSH = 100;

  constructor() {
    // Start periodic flushing
    this.startPeriodicFlush();
  }

  /**
   * Record a tool execution event
   */
  recordExecution(event: Omit<ToolExecutionEvent, 'timestamp'>): void {
    const fullEvent: ToolExecutionEvent = {
      ...event,
      timestamp: new Date(),
    };

    // Validate the event
    const validatedEvent = ToolExecutionEventSchema.parse(fullEvent);
    
    // Add to in-memory storage
    this.events.push(validatedEvent);

    // Log the event
    logger.info('Tool execution recorded', {
      toolName: validatedEvent.toolName,
      success: validatedEvent.success,
      executionTimeMs: validatedEvent.executionTimeMs,
      projectId: validatedEvent.projectId,
    });

    // Flush if we have too many events
    if (this.events.length >= this.MAX_EVENTS_BEFORE_FLUSH) {
      this.flushEvents().catch(error => {
        logger.error('Failed to flush tool events', {}, error as Error);
      });
    }
  }

  /**
   * Get analytics for a specific tool
   */
  async getToolAnalytics(
    toolName: string,
    options: {
      projectId?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<ToolUsageAnalytics> {
    const {
      projectId,
      userId,
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      endDate = new Date(),
    } = options;

    try {
      // Build where clause
      const whereClause: {
        toolName: string;
        timestamp: { gte: Date; lte: Date };
        projectId?: string;
        userId?: string;
      } = {
        toolName,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      };

      if (projectId) {
        whereClause.projectId = projectId;
      }

      if (userId) {
        whereClause.userId = userId;
      }

      // Get tool execution events from database
      const events = await prisma.toolExecution.findMany({
        where: whereClause,
        orderBy: { timestamp: 'asc' },
      });

      // Calculate metrics
      const totalExecutions = events.length;
      const successfulExecutions = events.filter(e => e.success).length;
      const failedExecutions = totalExecutions - successfulExecutions;
      const successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0;

      const executionTimes = events.map(e => e.executionTimeMs);
      const averageExecutionTime = executionTimes.length > 0 
        ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
        : 0;
      
      const sortedTimes = [...executionTimes].sort((a, b) => a - b);
      const medianExecutionTime = sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length / 2)]
        : 0;

      const totalExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0);

      // Calculate hourly breakdown
      const hourlyMap = new Map<number, { executions: number; successful: number; totalTime: number }>();
      
      for (const event of events) {
        const hour = event.timestamp.getHours();
        const current = hourlyMap.get(hour) || { executions: 0, successful: 0, totalTime: 0 };
        
        current.executions++;
        current.totalTime += event.executionTimeMs;
        if (event.success) {
          current.successful++;
        }
        
        hourlyMap.set(hour, current);
      }

      const hourlyBreakdown = Array.from(hourlyMap.entries()).map(([hour, data]: [number, { executions: number; successful: number; totalTime: number }]) => ({
        hour,
        executions: data.executions,
        successRate: data.executions > 0 ? data.successful / data.executions : 0,
        averageTime: data.executions > 0 ? data.totalTime / data.executions : 0,
      }));

      // Calculate error breakdown
      const errorMap = new Map<string, number>();
      const failedEvents = events.filter(e => !e.success);
      
      for (const event of failedEvents) {
        const error = event.error || 'Unknown error';
        errorMap.set(error, (errorMap.get(error) || 0) + 1);
      }

      const errorBreakdown = Array.from(errorMap.entries()).map(([error, count]: [string, number]) => ({
        error,
        count,
        percentage: failedExecutions > 0 ? count / failedExecutions : 0,
      }));

      const analytics: ToolUsageAnalytics = {
        toolName,
        projectId,
        userId,
        timeRange: { start: startDate, end: endDate },
        metrics: {
          totalExecutions,
          successfulExecutions,
          failedExecutions,
          successRate,
          averageExecutionTime,
          medianExecutionTime,
          totalExecutionTime,
        },
        hourlyBreakdown,
        errorBreakdown,
      };

      return ToolUsageAnalyticsSchema.parse(analytics);

    } catch (error) {
      logger.error('Failed to get tool analytics', {
        toolName,
        projectId,
        userId,
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get summary analytics for all tools
   */
  async getAllToolsAnalytics(options: {
    projectId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}) {
    const {
      projectId,
      userId,
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
    } = options;

    try {
      // Get distinct tool names
      const distinctTools = await prisma.toolExecution.findMany({
        where: {
          timestamp: { gte: startDate, lte: endDate },
          ...(projectId && { projectId }),
          ...(userId && { userId }),
        },
        select: { toolName: true },
        distinct: ['toolName'],
      });

      // Get analytics for each tool
      const toolAnalytics = await Promise.all(
        distinctTools.map(({ toolName }: { toolName: string }) =>
          this.getToolAnalytics(toolName, { projectId, userId, startDate, endDate })
        )
      );

      // Calculate overall summary
      const totalExecutions = toolAnalytics.reduce((sum, analytics) => 
        sum + analytics.metrics.totalExecutions, 0);
      const totalSuccessful = toolAnalytics.reduce((sum, analytics) => 
        sum + analytics.metrics.successfulExecutions, 0);
      const overallSuccessRate = totalExecutions > 0 ? totalSuccessful / totalExecutions : 0;

      return {
        summary: {
          totalTools: toolAnalytics.length,
          totalExecutions,
          overallSuccessRate,
          timeRange: { start: startDate, end: endDate },
        },
        toolBreakdown: toolAnalytics,
        topPerformingTools: toolAnalytics
          .sort((a, b) => b.metrics.successRate - a.metrics.successRate)
          .slice(0, 5),
        mostUsedTools: toolAnalytics
          .sort((a, b) => b.metrics.totalExecutions - a.metrics.totalExecutions)
          .slice(0, 5),
      };

    } catch (error) {
      logger.error('Failed to get all tools analytics', options, error as Error);
      throw error;
    }
  }

  /**
   * Flush events to persistent storage
   */
  private async flushEvents(): Promise<void> {
    if (this.events.length === 0) {
      return;
    }

    const eventsToFlush = [...this.events];
    this.events = [];

    try {
      // Save events to database
      await prisma.toolExecution.createMany({
        data: eventsToFlush.map(event => ({
          toolName: event.toolName,
          projectId: event.projectId,
          userId: event.userId,
          sessionId: event.sessionId,
          input: event.input,
          output: event.output,
          success: event.success,
          executionTimeMs: event.executionTimeMs,
          error: event.error,
          timestamp: event.timestamp,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        })),
      });

      logger.info('Flushed tool execution events', {
        eventCount: eventsToFlush.length,
      });

    } catch (error) {
      logger.error('Failed to flush tool execution events', {
        eventCount: eventsToFlush.length,
      }, error as Error);
      
      // Re-add events back to queue for retry
      this.events.unshift(...eventsToFlush);
    }
  }

  /**
   * Start periodic flushing of events
   */
  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushEvents().catch(error => {
        logger.error('Periodic flush failed', {}, error as Error);
      });
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Stop the analytics tracker and flush remaining events
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    await this.flushEvents();
  }

  /**
   * Get recent tool activity (last 24 hours)
   */
  async getRecentActivity(limit: number = 50) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    try {
      const recentEvents = await prisma.toolExecution.findMany({
        where: {
          timestamp: { gte: oneDayAgo },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          toolName: true,
          success: true,
          executionTimeMs: true,
          timestamp: true,
          error: true,
        },
      });

      return recentEvents;

    } catch (error) {
      logger.error('Failed to get recent activity', { limit }, error as Error);
      throw error;
    }
  }
}

// Global analytics tracker instance
export const toolAnalytics = new ToolAnalyticsTracker();

// Graceful shutdown
process.on('SIGINT', async () => {
  await toolAnalytics.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await toolAnalytics.stop();
  process.exit(0);
});