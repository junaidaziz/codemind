import prisma from '../app/lib/db';
import { logger } from '../app/lib/logger';

export type MetricType =
  | 'api_latency'
  | 'db_query_time'
  | 'cache_hit_rate'
  | 'ai_response_time'
  | 'embedding_generation'
  | 'indexing_time'
  | 'search_time';

export interface PerformanceMetricData {
  metricType: MetricType;
  metricName: string;
  value: number;
  unit?: string;
  endpoint?: string;
  operation?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  projectId?: string;
  userId?: string;
}

export interface PerformanceStats {
  metricType: MetricType;
  metricName: string;
  count: number;
  average: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  unit: string;
}

export interface BottleneckAnalysis {
  endpoint: string;
  operation?: string;
  avgLatency: number;
  p95Latency: number;
  requestCount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

export class PerformanceProfiler {
  /**
   * Record a performance metric
   */
  async recordMetric(data: PerformanceMetricData): Promise<void> {
    try {
      await prisma.performanceMetric.create({
        data: {
          metricType: data.metricType,
          metricName: data.metricName,
          value: data.value,
          unit: data.unit || 'ms',
          endpoint: data.endpoint,
          operation: data.operation,
          durationMs: data.durationMs,
          metadata: data.metadata ? (data.metadata as object) : null,
          projectId: data.projectId,
          userId: data.userId,
        },
      });
    } catch (error) {
      // Don't throw - metrics recording failures shouldn't break main flow
      logger.error('Failed to record performance metric', data, error as Error);
    }
  }

  /**
   * Get performance statistics for a metric
   */
  async getMetricStats(
    metricType: MetricType,
    metricName?: string,
    startDate?: Date,
    endDate?: Date,
    projectId?: string
  ): Promise<PerformanceStats | null> {
    try {
      const whereClause: {
        metricType: MetricType;
        metricName?: string;
        projectId?: string;
        timestamp?: { gte: Date; lte: Date };
      } = { metricType };

      if (metricName) whereClause.metricName = metricName;
      if (projectId) whereClause.projectId = projectId;
      if (startDate && endDate) {
        whereClause.timestamp = { gte: startDate, lte: endDate };
      }

      const metrics = await prisma.performanceMetric.findMany({
        where: whereClause,
        select: { value: true, unit: true },
        orderBy: { value: 'asc' },
      });

      if (metrics.length === 0) return null;

      const values = metrics.map((m) => m.value);
      const sum = values.reduce((a, b) => a + b, 0);

      return {
        metricType,
        metricName: metricName || 'all',
        count: metrics.length,
        average: sum / metrics.length,
        min: values[0],
        max: values[values.length - 1],
        p50: this.percentile(values, 0.5),
        p95: this.percentile(values, 0.95),
        p99: this.percentile(values, 0.99),
        unit: metrics[0]?.unit || 'ms',
      };
    } catch (error) {
      logger.error('Failed to get metric stats', { metricType, metricName }, error as Error);
      return null;
    }
  }

  /**
   * Identify performance bottlenecks
   */
  async identifyBottlenecks(
    projectId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<BottleneckAnalysis[]> {
    try {
      const whereClause: {
        metricType: MetricType;
        projectId?: string;
        timestamp?: { gte: Date; lte: Date };
      } = {
        metricType: 'api_latency',
      };

      if (projectId) whereClause.projectId = projectId;
      if (startDate && endDate) {
        whereClause.timestamp = { gte: startDate, lte: endDate };
      }

      const metrics = await prisma.performanceMetric.findMany({
        where: whereClause,
        select: {
          endpoint: true,
          operation: true,
          value: true,
        },
      });

      // Group by endpoint
      const endpointGroups = new Map<
        string,
        { values: number[]; operation?: string }
      >();

      metrics.forEach((m) => {
        if (!m.endpoint) return;
        const key = m.endpoint;
        if (!endpointGroups.has(key)) {
          endpointGroups.set(key, { values: [], operation: m.operation || undefined });
        }
        endpointGroups.get(key)!.values.push(m.value);
      });

      // Analyze each endpoint
      const bottlenecks: BottleneckAnalysis[] = [];

      endpointGroups.forEach((data, endpoint) => {
        const values = data.values.sort((a, b) => a - b);
        const avgLatency = values.reduce((a, b) => a + b, 0) / values.length;
        const p95Latency = this.percentile(values, 0.95);

        // Determine severity
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
        let recommendation = 'Performance is acceptable.';

        if (p95Latency > 5000) {
          severity = 'critical';
          recommendation =
            'Critical: P95 latency >5s. Consider caching, query optimization, or infrastructure scaling.';
        } else if (p95Latency > 2000) {
          severity = 'high';
          recommendation =
            'High: P95 latency >2s. Review database queries and add caching where possible.';
        } else if (p95Latency > 1000) {
          severity = 'medium';
          recommendation =
            'Medium: P95 latency >1s. Consider optimizing slow operations.';
        } else if (avgLatency > 500) {
          severity = 'low';
          recommendation =
            'Low: Average latency >500ms. Monitor for trends and consider optimization.';
        }

        bottlenecks.push({
          endpoint,
          operation: data.operation,
          avgLatency,
          p95Latency,
          requestCount: values.length,
          severity,
          recommendation,
        });
      });

      // Sort by severity and latency
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      bottlenecks.sort(
        (a, b) =>
          severityOrder[a.severity] - severityOrder[b.severity] ||
          b.p95Latency - a.p95Latency
      );

      return bottlenecks;
    } catch (error) {
      logger.error('Failed to identify bottlenecks', { projectId }, error as Error);
      return [];
    }
  }

  /**
   * Get cache performance metrics
   */
  async getCachePerformance(
    projectId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    hitRate: number;
    totalRequests: number;
    hits: number;
    misses: number;
    avgHitLatency: number;
    avgMissLatency: number;
  } | null> {
    try {
      const whereClause: {
        metricType: MetricType;
        projectId?: string;
        timestamp?: { gte: Date; lte: Date };
      } = {
        metricType: 'cache_hit_rate',
      };

      if (projectId) whereClause.projectId = projectId;
      if (startDate && endDate) {
        whereClause.timestamp = { gte: startDate, lte: endDate };
      }

      const metrics = await prisma.performanceMetric.findMany({
        where: whereClause,
        select: {
          value: true,
          durationMs: true,
          metadata: true,
        },
      });

      if (metrics.length === 0) return null;

      let hits = 0;
      let misses = 0;
      let hitLatencySum = 0;
      let missLatencySum = 0;

      metrics.forEach((m) => {
        const isHit = m.value === 1; // 1 for hit, 0 for miss
        if (isHit) {
          hits++;
          hitLatencySum += m.durationMs || 0;
        } else {
          misses++;
          missLatencySum += m.durationMs || 0;
        }
      });

      const totalRequests = hits + misses;
      const hitRate = totalRequests > 0 ? (hits / totalRequests) * 100 : 0;

      return {
        hitRate,
        totalRequests,
        hits,
        misses,
        avgHitLatency: hits > 0 ? hitLatencySum / hits : 0,
        avgMissLatency: misses > 0 ? missLatencySum / misses : 0,
      };
    } catch (error) {
      logger.error('Failed to get cache performance', { projectId }, error as Error);
      return null;
    }
  }

  /**
   * Create a request timer for easy performance tracking
   */
  createTimer(
    metricName: string,
    options?: {
      metricType?: MetricType;
      endpoint?: string;
      operation?: string;
      projectId?: string;
      userId?: string;
    }
  ): { end: () => Promise<number> } {
    const startTime = Date.now();

    return {
      end: async () => {
        const durationMs = Date.now() - startTime;
        await this.recordMetric({
          metricType: options?.metricType || 'api_latency',
          metricName,
          value: durationMs,
          unit: 'ms',
          endpoint: options?.endpoint,
          operation: options?.operation,
          durationMs,
          projectId: options?.projectId,
          userId: options?.userId,
        });
        return durationMs;
      },
    };
  }

  /**
   * Middleware for automatic API endpoint timing
   */
  async trackEndpoint(
    endpoint: string,
    operation: string,
    fn: () => Promise<unknown>,
    projectId?: string,
    userId?: string
  ): Promise<unknown> {
    const timer = this.createTimer(endpoint, {
      metricType: 'api_latency',
      endpoint,
      operation,
      projectId,
      userId,
    });

    try {
      const result = await fn();
      await timer.end();
      return result;
    } catch (error) {
      await timer.end();
      throw error;
    }
  }

  /**
   * Clean up old metrics (retention policy)
   */
  async cleanupOldMetrics(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.performanceMetric.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info('Cleaned up old performance metrics', {
        deleted: result.count,
        retentionDays,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup old metrics', { retentionDays }, error as Error);
      return 0;
    }
  }

  // Helper methods

  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }
}

export const performanceProfiler = new PerformanceProfiler();
