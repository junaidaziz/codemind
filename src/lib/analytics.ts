// Analytics Service for CodeMind
// Provides typed methods for collecting, aggregating, and retrieving analytics data

import { 
  TimePeriod, 
  MetricType, 
  AnalyticsData, 
  DashboardOverview,
  UserActivityMetric,
  ProjectUsageMetric,
  ApiRequestMetric,
  SystemPerformanceMetric,
  AnalyticsEvent,
  AnalyticsConfig,
  DEFAULT_ANALYTICS_CONFIG,
} from '../types/analytics';
import { logger, withDatabaseTiming } from '../app/lib/logger';
import prisma from '../app/lib/db';

class AnalyticsService {
  private config: AnalyticsConfig;
  private eventBuffer: AnalyticsEvent[] = [];
  private flushInterval?: NodeJS.Timeout;

  constructor(config: AnalyticsConfig = DEFAULT_ANALYTICS_CONFIG) {
    this.config = config;
    if (config.enableRealTime) {
      this.startEventProcessing();
    }
  }

  // Track user activity
  async trackUserActivity(
    userId: string,
    action: string,
    projectId?: string,
    metadata?: Record<string, unknown>,
    duration?: number
  ): Promise<void> {
    const metric: UserActivityMetric = {
      timestamp: new Date(),
      userId,
      action,
      projectId,
      metadata,
      duration,
      success: true,
    };

    await this.recordEvent({
      type: 'user_action',
      timestamp: new Date(),
      data: metric,
    });

    logger.debug('User activity tracked', {
      userId,
      action,
      projectId,
      duration,
    });
  }

  // Track API requests
  async trackApiRequest(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
    projectId?: string,
    errorType?: string,
    userAgent?: string
  ): Promise<void> {
    const metric: ApiRequestMetric = {
      timestamp: new Date(),
      endpoint,
      method,
      statusCode,
      responseTime,
      userId,
      projectId,
      errorType,
      userAgent,
    };

    await this.recordEvent({
      type: 'api_request',
      timestamp: new Date(),
      data: metric,
    });

    logger.debug('API request tracked', {
      endpoint,
      method,
      statusCode,
      responseTime,
    });
  }

  // Track system performance
  async trackSystemPerformance(
    cpuUsage: number,
    memoryUsage: number,
    diskUsage: number,
    databaseConnections: number,
    queueSize: number,
    activeUsers: number,
    requestsPerMinute: number
  ): Promise<void> {
    const metric: SystemPerformanceMetric = {
      timestamp: new Date(),
      cpuUsage,
      memoryUsage,
      diskUsage,
      databaseConnections,
      queueSize,
      activeUsers,
      requestsPerMinute,
    };

    await this.recordEvent({
      type: 'system_metric',
      timestamp: new Date(),
      data: metric,
    });

    // Check for alerts
    await this.checkAlerts(metric);
  }

  // Get analytics data
  async getAnalyticsData(
    metric: MetricType,
    period: TimePeriod,
    startDate?: Date,
    endDate?: Date,
    projectId?: string,
    userId?: string
  ): Promise<AnalyticsData> {
    return withDatabaseTiming('getAnalyticsData', async () => {
      logger.info('Fetching analytics data', {
        metric,
        period,
        startDate,
        endDate,
        projectId,
        userId,
      });

      const data = await this.fetchMetricData(metric, period, startDate, endDate, projectId, userId);
      const summary = this.calculateSummary(data);

      return {
        metric,
        period,
        data,
        summary,
      };
    });
  }

  // Get dashboard overview
  async getDashboardOverview(): Promise<DashboardOverview> {
    return withDatabaseTiming('getDashboardOverview', async () => {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeUsers,
        totalProjects,
        activeProjects,
        totalSessions,
        totalQueries,
        avgResponseTime,
      ] = await Promise.all([
        this.getTotalUsers(),
        this.getActiveUsers(dayAgo),
        this.getTotalProjects(),
        this.getActiveProjects(dayAgo),
        this.getTotalSessions(dayAgo),
        this.getTotalQueries(dayAgo),
        this.getAverageResponseTime(dayAgo),
      ]);

      const systemHealth = this.calculateSystemHealth();
      const uptime = this.calculateUptime();

      return {
        totalUsers,
        activeUsers,
        totalProjects,
        activeProjects,
        totalSessions,
        totalQueries,
        avgResponseTime,
        systemHealth,
        uptime,
        lastUpdated: now,
      };
    });
  }

  // Get project usage metrics
  async getProjectUsageMetrics(projectId?: string): Promise<ProjectUsageMetric[]> {
    return withDatabaseTiming('getProjectUsageMetrics', async () => {
      const whereClause = projectId ? { id: projectId } : {};

      const projects = await prisma.project.findMany({
        where: whereClause,
        include: {
          ChatSession: {
            select: {
              id: true,
              createdAt: true,
              userId: true,
              Message: {
                select: { id: true },
              },
            },
          },
          ProjectFile: {
            select: {
              id: true,
              tokenCount: true,
            },
          },
        },
      });

      return projects.map((project: typeof projects[0]) => {
        const sessions = project.ChatSession;
        const uniqueUsers = new Set(sessions.map((s: { userId: string }) => s.userId)).size;
        const totalQueries = sessions.reduce((sum: number, s: { Message: { length: number } }) => sum + s.Message.length, 0);
        const lastActivity = sessions.length > 0 
          ? new Date(Math.max(...sessions.map((s: { createdAt: { getTime: () => number } }) => s.createdAt.getTime())))
          : project.updatedAt;

        return {
          projectId: project.id,
          projectName: project.name,
          totalSessions: sessions.length,
          totalQueries,
          totalUsers: uniqueUsers,
          avgSessionDuration: 0, // Would need session end times
          lastActivity,
          indexingStatus: project.status as 'pending' | 'running' | 'completed' | 'failed',
          chunksCount: project.ProjectFile.length,
          tokensCount: project.ProjectFile.reduce((sum: number, chunk: { tokenCount: number }) => sum + chunk.tokenCount, 0),
        };
      });
    });
  }

  // Private methods for data fetching
  private async fetchMetricData(
    metric: MetricType,
    period: TimePeriod,
    startDate?: Date,
    endDate?: Date,
    projectId?: string,
    userId?: string
  ): Promise<Array<{ timestamp: Date; value: number; label?: string; metadata?: Record<string, unknown> }>> {
    const now = new Date();
    const defaultStartDate = this.getDefaultStartDate(period, now);
    
    const queryStartDate = startDate || defaultStartDate;
    const queryEndDate = endDate || now;

    switch (metric) {
      case MetricType.USER_ACTIVITY:
        return this.fetchUserActivityData(period, queryStartDate, queryEndDate, userId);
      
      case MetricType.PROJECT_USAGE:
        return this.fetchProjectUsageData(period, queryStartDate, queryEndDate, projectId);
      
      case MetricType.CHAT_SESSIONS:
        return this.fetchChatSessionData(period, queryStartDate, queryEndDate, projectId, userId);
      
      case MetricType.API_REQUESTS:
        return this.fetchApiRequestData(period, queryStartDate, queryEndDate);
      
      case MetricType.INDEXING_JOBS:
        return this.fetchIndexingJobData(period, queryStartDate, queryEndDate, projectId);
      
      case MetricType.SYSTEM_PERFORMANCE:
        return this.fetchSystemPerformanceData(period, queryStartDate, queryEndDate);
      
      default:
        return [];
    }
  }

  private async fetchUserActivityData(
    period: TimePeriod,
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<Array<{ timestamp: Date; value: number; label?: string }>> {
    // This would typically query a dedicated analytics table
    // For now, we'll use chat sessions as a proxy for user activity
    const sessions = await prisma.chatSession.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(userId ? { userId } : {}),
      },
      select: {
        createdAt: true,
        userId: true,
      },
    });

    return this.aggregateByPeriod(
      sessions.map((s: typeof sessions[0]) => ({ timestamp: s.createdAt, value: 1 })),
      period
    );
  }

  private async fetchProjectUsageData(
    period: TimePeriod,
    startDate: Date,
    endDate: Date,
    projectId?: string
  ): Promise<Array<{ timestamp: Date; value: number; label?: string }>> {
    const sessions = await prisma.chatSession.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(projectId ? { projectId } : {}),
      },
      select: {
        createdAt: true,
        projectId: true,
      },
    });

    return this.aggregateByPeriod(
      sessions.map((s: typeof sessions[0]) => ({ timestamp: s.createdAt, value: 1 })),
      period
    );
  }

  private async fetchChatSessionData(
    period: TimePeriod,
    startDate: Date,
    endDate: Date,
    projectId?: string,
    userId?: string
  ): Promise<Array<{ timestamp: Date; value: number; label?: string }>> {
    const sessions = await prisma.chatSession.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(projectId ? { projectId } : {}),
        ...(userId ? { userId } : {}),
      },
      include: {
        messages: {
          select: { id: true },
        },
      },
    });

    return this.aggregateByPeriod(
      sessions.map((s: typeof sessions[0]) => ({ 
        timestamp: s.createdAt, 
        value: s.messages.length,
        label: `${s.messages.length} messages`,
      })),
      period
    );
  }

  private async fetchApiRequestData(
    period: TimePeriod,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ timestamp: Date; value: number; label?: string }>> {
    // This would typically query an API request log table
    // For now, we'll return stub data
    return this.generateStubData(period, startDate, endDate, 'API Requests');
  }

  private async fetchIndexingJobData(
    period: TimePeriod,
    startDate: Date,
    endDate: Date,
    projectId?: string
  ): Promise<Array<{ timestamp: Date; value: number; label?: string }>> {
    // This would query job history table when available
    logger.debug('Fetching indexing job data', { period, startDate, endDate, projectId });
    return this.generateStubData(period, startDate, endDate, 'Indexing Jobs');
  }

  private async fetchSystemPerformanceData(
    period: TimePeriod,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ timestamp: Date; value: number; label?: string }>> {
    // This would query system metrics table when available
    return this.generateStubData(period, startDate, endDate, 'Performance');
  }

  // Helper methods
  private aggregateByPeriod(
    data: Array<{ timestamp: Date; value: number; label?: string }>,
    period: TimePeriod
  ): Array<{ timestamp: Date; value: number; label?: string }> {
    const grouped = new Map<string, { timestamp: Date; value: number; count: number }>();

    data.forEach(item => {
      const key = this.getPeriodKey(item.timestamp, period);
      const existing = grouped.get(key);
      
      if (existing) {
        existing.value += item.value;
        existing.count += 1;
      } else {
        grouped.set(key, {
          timestamp: this.getPeriodStart(item.timestamp, period),
          value: item.value,
          count: 1,
        });
      }
    });

    return Array.from(grouped.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(item => ({
        timestamp: item.timestamp,
        value: item.value,
        label: `${item.value} (${item.count} events)`,
      }));
  }

  private getPeriodKey(date: Date, period: TimePeriod): string {
    switch (period) {
      case TimePeriod.HOUR:
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
      case TimePeriod.DAY:
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      case TimePeriod.WEEK:
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
      case TimePeriod.MONTH:
        return `${date.getFullYear()}-${date.getMonth()}`;
      case TimePeriod.QUARTER:
        return `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
      case TimePeriod.YEAR:
        return `${date.getFullYear()}`;
      default:
        return date.toISOString();
    }
  }

  private getPeriodStart(date: Date, period: TimePeriod): Date {
    const result = new Date(date);
    
    switch (period) {
      case TimePeriod.HOUR:
        result.setMinutes(0, 0, 0);
        break;
      case TimePeriod.DAY:
        result.setHours(0, 0, 0, 0);
        break;
      case TimePeriod.WEEK:
        result.setDate(date.getDate() - date.getDay());
        result.setHours(0, 0, 0, 0);
        break;
      case TimePeriod.MONTH:
        result.setDate(1);
        result.setHours(0, 0, 0, 0);
        break;
      case TimePeriod.QUARTER:
        const quarter = Math.ceil((date.getMonth() + 1) / 3);
        result.setMonth((quarter - 1) * 3, 1);
        result.setHours(0, 0, 0, 0);
        break;
      case TimePeriod.YEAR:
        result.setMonth(0, 1);
        result.setHours(0, 0, 0, 0);
        break;
    }
    
    return result;
  }

  private getDefaultStartDate(period: TimePeriod, endDate: Date): Date {
    const result = new Date(endDate);
    
    switch (period) {
      case TimePeriod.HOUR:
        result.setHours(result.getHours() - 24);
        break;
      case TimePeriod.DAY:
        result.setDate(result.getDate() - 30);
        break;
      case TimePeriod.WEEK:
        result.setDate(result.getDate() - 12 * 7);
        break;
      case TimePeriod.MONTH:
        result.setMonth(result.getMonth() - 12);
        break;
      case TimePeriod.QUARTER:
        result.setMonth(result.getMonth() - 8 * 3);
        break;
      case TimePeriod.YEAR:
        result.setFullYear(result.getFullYear() - 5);
        break;
    }
    
    return result;
  }

  private calculateSummary(data: Array<{ timestamp: Date; value: number }>): {
    total: number;
    average: number;
    max: number;
    min: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  } {
    if (data.length === 0) {
      return { total: 0, average: 0, max: 0, min: 0, change: 0, trend: 'stable' };
    }

    const values = data.map((d: { value: number }) => d.value);
    const total = values.reduce((sum: number, val: number) => sum + val, 0);
    const average = total / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);

    // Calculate trend (simple: compare first half to second half)
    const midpoint = Math.floor(data.length / 2);
    const firstHalf = values.slice(0, midpoint);
    const secondHalf = values.slice(midpoint);
    
    const firstAvg = firstHalf.reduce((sum: number, val: number) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum: number, val: number) => sum + val, 0) / secondHalf.length;
    
    const change = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    const trend = Math.abs(change) < 5 ? 'stable' : change > 0 ? 'up' : 'down';

    return { total, average, max, min, change, trend };
  }

  // Dashboard helper methods
  private async getTotalUsers(): Promise<number> {
    // This would query a users table when auth is fully implemented
    const sessions = await prisma.chatSession.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });
    return sessions.length;
  }

  private async getActiveUsers(since: Date): Promise<number> {
    const sessions = await prisma.chatSession.findMany({
      where: { createdAt: { gte: since } },
      select: { userId: true },
      distinct: ['userId'],
    });
    return sessions.length;
  }

  private async getTotalProjects(): Promise<number> {
    return prisma.project.count();
  }

  private async getActiveProjects(since: Date): Promise<number> {
    const sessions = await prisma.chatSession.findMany({
      where: { createdAt: { gte: since } },
      select: { projectId: true },
      distinct: ['projectId'],
    });
    return sessions.length;
  }

  private async getTotalSessions(since: Date): Promise<number> {
    return prisma.chatSession.count({
      where: { createdAt: { gte: since } },
    });
  }

  private async getTotalQueries(since: Date): Promise<number> {
    const result = await prisma.message.count({
      where: {
        session: {
          createdAt: { gte: since },
        },
      },
    });
    return result;
  }

  private async getAverageResponseTime(since: Date): Promise<number> {
    // This would calculate from API request logs when available
    // Using since parameter for future implementation
    logger.debug('Calculating average response time', { since });
    return 850; // Stub value in ms
  }

  private calculateSystemHealth(): 'healthy' | 'warning' | 'critical' {
    // This would check actual system metrics
    return 'healthy';
  }

  private calculateUptime(): number {
    // This would calculate actual uptime percentage
    return 99.9;
  }

  private generateStubData(
    period: TimePeriod,
    startDate: Date,
    endDate: Date,
    label: string
  ): Array<{ timestamp: Date; value: number; label?: string }> {
    const data: Array<{ timestamp: Date; value: number; label?: string }> = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      data.push({
        timestamp: new Date(current),
        value: Math.floor(Math.random() * 100) + 10,
        label,
      });
      
      // Increment by period
      switch (period) {
        case TimePeriod.HOUR:
          current.setHours(current.getHours() + 1);
          break;
        case TimePeriod.DAY:
          current.setDate(current.getDate() + 1);
          break;
        case TimePeriod.WEEK:
          current.setDate(current.getDate() + 7);
          break;
        case TimePeriod.MONTH:
          current.setMonth(current.getMonth() + 1);
          break;
        case TimePeriod.QUARTER:
          current.setMonth(current.getMonth() + 3);
          break;
        case TimePeriod.YEAR:
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
    }
    
    return data;
  }

  // Event processing methods
  private async recordEvent(event: AnalyticsEvent): Promise<void> {
    if (this.config.enableRealTime) {
      this.eventBuffer.push(event);
    } else {
      await this.persistEvent(event);
    }
  }

  private startEventProcessing(): void {
    this.flushInterval = setInterval(() => {
      this.flushEventBuffer().catch(error => {
        logger.error('Failed to flush analytics event buffer', {}, error);
      });
    }, 5000); // Flush every 5 seconds
  }

  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    await Promise.all(events.map(event => this.persistEvent(event)));
    
    logger.debug('Analytics events flushed', { count: events.length });
  }

  private async persistEvent(event: AnalyticsEvent): Promise<void> {
    // In a real implementation, this would write to a dedicated analytics table
    // For now, we'll just log it
    logger.debug('Analytics event recorded', {
      type: event.type,
      timestamp: event.timestamp,
    });
  }

  private async checkAlerts(metric: SystemPerformanceMetric): Promise<void> {
    const alerts: string[] = [];

    if (metric.memoryUsage > this.config.alertThresholds.memoryUsage) {
      alerts.push(`High memory usage: ${metric.memoryUsage}%`);
    }

    if (metric.diskUsage > this.config.alertThresholds.diskUsage) {
      alerts.push(`High disk usage: ${metric.diskUsage}%`);
    }

    if (alerts.length > 0) {
      logger.warn('System performance alerts', { alerts, metric });
    }
  }

  // Cleanup
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Flush remaining events
    this.flushEventBuffer().catch(error => {
      logger.error('Failed to flush events during cleanup', {}, error);
    });
  }
}

// Global analytics service instance
export const analyticsService = new AnalyticsService();

export default AnalyticsService;