import { PerformanceProfiler } from '../performance-profiler';

// Mock Prisma
jest.mock('../../app/lib/db', () => ({
  __esModule: true,
  default: {
    performanceMetric: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import prisma from '../../app/lib/db';

describe('PerformanceProfiler', () => {
  let profiler: PerformanceProfiler;

  beforeEach(() => {
    profiler = new PerformanceProfiler();
    jest.clearAllMocks();
  });

  describe('recordMetric', () => {
    it('records a performance metric', async () => {
      (prisma.performanceMetric.create as jest.Mock).mockResolvedValue({
        id: 'metric-1',
      });

      await profiler.recordMetric({
        metricType: 'api_latency',
        metricName: '/api/test',
        value: 150,
        unit: 'ms',
        endpoint: '/api/test',
        projectId: 'project-1',
      });

      expect(prisma.performanceMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metricType: 'api_latency',
          metricName: '/api/test',
          value: 150,
          unit: 'ms',
          endpoint: '/api/test',
          projectId: 'project-1',
        }),
      });
    });

    it('handles errors gracefully', async () => {
      (prisma.performanceMetric.create as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      // Should not throw
      await expect(
        profiler.recordMetric({
          metricType: 'api_latency',
          metricName: '/api/test',
          value: 150,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('getMetricStats', () => {
    it('calculates statistics correctly', async () => {
      const metrics = [
        { value: 100, unit: 'ms' },
        { value: 150, unit: 'ms' },
        { value: 200, unit: 'ms' },
        { value: 250, unit: 'ms' },
        { value: 300, unit: 'ms' },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue(metrics);

      const stats = await profiler.getMetricStats('api_latency', '/api/test');

      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(5);
      expect(stats!.average).toBe(200); // (100 + 150 + 200 + 250 + 300) / 5
      expect(stats!.min).toBe(100);
      expect(stats!.max).toBe(300);
      expect(stats!.p50).toBe(200);
    });

    it('returns null when no metrics found', async () => {
      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await profiler.getMetricStats('api_latency', '/api/test');

      expect(stats).toBeNull();
    });

    it('filters by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([
        { value: 100, unit: 'ms' },
      ]);

      await profiler.getMetricStats(
        'api_latency',
        undefined,
        startDate,
        endDate,
        'project-1'
      );

      expect(prisma.performanceMetric.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          timestamp: { gte: startDate, lte: endDate },
          projectId: 'project-1',
        }),
        select: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });
  });

  describe('identifyBottlenecks', () => {
    it('identifies slow endpoints', async () => {
      const metrics = [
        { endpoint: '/api/slow', operation: 'GET', value: 5000 },
        { endpoint: '/api/slow', operation: 'GET', value: 5500 },
        { endpoint: '/api/slow', operation: 'GET', value: 6000 },
        { endpoint: '/api/fast', operation: 'GET', value: 100 },
        { endpoint: '/api/fast', operation: 'GET', value: 150 },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue(metrics);

      const bottlenecks = await profiler.identifyBottlenecks('project-1');

      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].endpoint).toBe('/api/slow');
      expect(bottlenecks[0].severity).toBe('critical');
    });

    it('categorizes severity correctly', async () => {
      const metrics = [
        { endpoint: '/api/test', operation: 'GET', value: 1500 },
        { endpoint: '/api/test', operation: 'GET', value: 1600 },
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue(metrics);

      const bottlenecks = await profiler.identifyBottlenecks('project-1');

      // P95 is ~1600ms, should be 'medium' severity
      expect(bottlenecks[0].severity).toBe('medium');
    });
  });

  describe('getCachePerformance', () => {
    it('calculates cache hit rate correctly', async () => {
      const metrics = [
        { value: 1, durationMs: 10, metadata: {} }, // hit
        { value: 1, durationMs: 12, metadata: {} }, // hit
        { value: 0, durationMs: 100, metadata: {} }, // miss
        { value: 0, durationMs: 110, metadata: {} }, // miss
        { value: 1, durationMs: 11, metadata: {} }, // hit
      ];

      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue(metrics);

      const cachePerf = await profiler.getCachePerformance('project-1');

      expect(cachePerf).not.toBeNull();
      expect(cachePerf!.totalRequests).toBe(5);
      expect(cachePerf!.hits).toBe(3);
      expect(cachePerf!.misses).toBe(2);
      expect(cachePerf!.hitRate).toBe(60);
      expect(cachePerf!.avgHitLatency).toBe(11); // (10 + 12 + 11) / 3
      expect(cachePerf!.avgMissLatency).toBe(105); // (100 + 110) / 2
    });

    it('returns null when no metrics found', async () => {
      (prisma.performanceMetric.findMany as jest.Mock).mockResolvedValue([]);

      const cachePerf = await profiler.getCachePerformance('project-1');

      expect(cachePerf).toBeNull();
    });
  });

  describe('createTimer', () => {
    it('tracks elapsed time correctly', async () => {
      (prisma.performanceMetric.create as jest.Mock).mockResolvedValue({
        id: 'metric-1',
      });

      const timer = profiler.createTimer('test-operation', {
        metricType: 'api_latency',
        endpoint: '/api/test',
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const duration = await timer.end();

      expect(duration).toBeGreaterThanOrEqual(50);
      expect(prisma.performanceMetric.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metricName: 'test-operation',
          value: expect.any(Number),
        }),
      });
    });
  });

  describe('trackEndpoint', () => {
    it('tracks endpoint execution', async () => {
      (prisma.performanceMetric.create as jest.Mock).mockResolvedValue({
        id: 'metric-1',
      });

      const testFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'result';
      };

      const result = await profiler.trackEndpoint(
        '/api/test',
        'GET',
        testFn,
        'project-1'
      );

      expect(result).toBe('result');
      expect(prisma.performanceMetric.create).toHaveBeenCalled();
    });

    it('tracks endpoint even on error', async () => {
      (prisma.performanceMetric.create as jest.Mock).mockResolvedValue({
        id: 'metric-1',
      });

      const testFn = async () => {
        throw new Error('Test error');
      };

      await expect(
        profiler.trackEndpoint('/api/test', 'GET', testFn, 'project-1')
      ).rejects.toThrow('Test error');

      expect(prisma.performanceMetric.create).toHaveBeenCalled();
    });
  });

  describe('cleanupOldMetrics', () => {
    it('deletes old metrics', async () => {
      (prisma.performanceMetric.deleteMany as jest.Mock).mockResolvedValue({
        count: 100,
      });

      const deleted = await profiler.cleanupOldMetrics(90);

      expect(deleted).toBe(100);
      expect(prisma.performanceMetric.deleteMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            lt: expect.any(Date),
          },
        },
      });
    });
  });
});
