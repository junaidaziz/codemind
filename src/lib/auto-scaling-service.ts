import prisma from '../app/lib/db';
import { logger } from '../app/lib/logger';
import { performanceProfiler } from './performance-profiler';
import { costBudgetService } from './cost-budget-service';

// Configuration constants
const EXPENSIVE_MODELS = ['gpt-4', 'gpt-4-turbo-preview', 'claude-3-opus-20240229'];
const COST_THRESHOLD_USD = 50; // Minimum total cost to trigger model optimization recommendations
const EXPENSIVE_MODEL_RATIO_THRESHOLD = 0.6; // 60% of costs from expensive models
const POTENTIAL_SAVINGS_RATIO = 0.7; // Estimate 70% savings by using cheaper models
const CACHE_HIT_RATE_THRESHOLD = 50; // Minimum acceptable cache hit rate percentage
const MIN_REQUESTS_FOR_CACHE_ANALYSIS = 100; // Minimum requests before analyzing cache performance

export type RecommendationType =
  | 'scale_up'
  | 'scale_down'
  | 'optimize_cache'
  | 'reduce_model_usage'
  | 'upgrade_model'
  | 'downgrade_model'
  | 'add_indexes'
  | 'optimize_queries';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface RecommendationData {
  projectId: string;
  type: RecommendationType;
  priority: Priority;
  title: string;
  description: string;
  currentMetrics: Record<string, unknown>;
  recommendation: Record<string, unknown>;
  estimatedSavings?: number;
  estimatedImpact?: string;
}

export class AutoScalingService {
  /**
   * Generate scaling recommendations based on current metrics
   */
  async generateRecommendations(projectId: string): Promise<void> {
    try {
      logger.info('Generating auto-scaling recommendations', { projectId });

      const recommendations: RecommendationData[] = [];

      // Analyze performance metrics
      const performanceRecs = await this.analyzePerformance(projectId);
      recommendations.push(...performanceRecs);

      // Analyze cost efficiency
      const costRecs = await this.analyzeCostEfficiency(projectId);
      recommendations.push(...costRecs);

      // Analyze cache effectiveness
      const cacheRecs = await this.analyzeCacheEffectiveness(projectId);
      recommendations.push(...cacheRecs);

      // Store recommendations
      for (const rec of recommendations) {
        await this.createRecommendation(rec);
      }

      logger.info('Generated recommendations', {
        projectId,
        count: recommendations.length,
      });
    } catch (error) {
      logger.error('Failed to generate recommendations', { projectId }, error as Error);
    }
  }

  /**
   * Get active recommendations for a project
   */
  async getRecommendations(
    projectId: string,
    includeImplemented: boolean = false
  ): Promise<unknown[]> {
    const where: {
      projectId: string;
      dismissedAt: null;
      implemented?: boolean;
    } = {
      projectId,
      dismissedAt: null,
    };

    if (!includeImplemented) {
      where.implemented = false;
    }

    return await prisma.autoScalingRecommendation.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Mark a recommendation as implemented
   */
  async markImplemented(recommendationId: string): Promise<void> {
    await prisma.autoScalingRecommendation.update({
      where: { id: recommendationId },
      data: {
        implemented: true,
        implementedAt: new Date(),
      },
    });
  }

  /**
   * Dismiss a recommendation
   */
  async dismissRecommendation(recommendationId: string): Promise<void> {
    await prisma.autoScalingRecommendation.update({
      where: { id: recommendationId },
      data: {
        dismissedAt: new Date(),
      },
    });
  }

  // Private analysis methods

  private async analyzePerformance(
    projectId: string
  ): Promise<RecommendationData[]> {
    const recommendations: RecommendationData[] = [];
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    // Check for slow endpoints
    const bottlenecks = await performanceProfiler.identifyBottlenecks(
      projectId,
      startDate,
      endDate
    );

    for (const bottleneck of bottlenecks) {
      if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
        recommendations.push({
          projectId,
          type: 'optimize_queries',
          priority: bottleneck.severity === 'critical' ? 'critical' : 'high',
          title: `Optimize slow endpoint: ${bottleneck.endpoint}`,
          description: bottleneck.recommendation,
          currentMetrics: {
            endpoint: bottleneck.endpoint,
            avgLatency: bottleneck.avgLatency,
            p95Latency: bottleneck.p95Latency,
            requestCount: bottleneck.requestCount,
          },
          recommendation: {
            actions: [
              'Add database indexes for frequently queried fields',
              'Implement query result caching',
              'Consider pagination for large result sets',
              'Review and optimize N+1 query patterns',
            ],
          },
          estimatedImpact: `Reduce P95 latency from ${Math.round(bottleneck.p95Latency)}ms to <1000ms`,
        });
      }
    }

    // Check AI model performance
    const aiStats = await performanceProfiler.getMetricStats(
      'ai_response_time',
      undefined,
      startDate,
      endDate,
      projectId
    );

    if (aiStats && aiStats.p95 > 10000) {
      // >10s for AI responses
      recommendations.push({
        projectId,
        type: 'optimize_cache',
        priority: 'high',
        title: 'AI responses are slow - improve caching',
        description:
          'AI model response times are high. Implementing aggressive caching for common queries can significantly improve performance.',
        currentMetrics: {
          avgResponseTime: Math.round(aiStats.average),
          p95ResponseTime: Math.round(aiStats.p95),
          requestCount: aiStats.count,
        },
        recommendation: {
          actions: [
            'Enable AI prompt caching for deterministic queries',
            'Increase cache TTL for stable responses',
            'Pre-warm cache for common queries',
            'Consider using faster models for simple queries',
          ],
        },
        estimatedImpact: '60-80% reduction in AI API costs and 3-5x faster response times',
      });
    }

    return recommendations;
  }

  private async analyzeCostEfficiency(
    projectId: string
  ): Promise<RecommendationData[]> {
    const recommendations: RecommendationData[] = [];
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    // Get AI model usage patterns
    const usage = await prisma.aIModelUsage.findMany({
      where: {
        projectId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        modelName: true,
        operation: true,
        costUsd: true,
        totalTokens: true,
        success: true,
      },
    });

    if (usage.length === 0) return recommendations;

    // Analyze model usage by type
    const modelCosts = new Map<string, { cost: number; tokens: number; count: number }>();

    usage.forEach((u) => {
      if (!modelCosts.has(u.modelName)) {
        modelCosts.set(u.modelName, { cost: 0, tokens: 0, count: 0 });
      }
      const stats = modelCosts.get(u.modelName)!;
      stats.cost += u.costUsd;
      stats.tokens += u.totalTokens;
      stats.count += 1;
    });

    // Check if using expensive models for simple tasks
    let expensiveCost = 0;

    modelCosts.forEach((stats, model) => {
      if (EXPENSIVE_MODELS.includes(model)) {
        expensiveCost += stats.cost;
      }
    });

    const totalCost = Array.from(modelCosts.values()).reduce(
      (sum, stats) => sum + stats.cost,
      0
    );

    // If >60% of costs are from expensive models, suggest optimization
    if (totalCost > COST_THRESHOLD_USD && expensiveCost / totalCost > EXPENSIVE_MODEL_RATIO_THRESHOLD) {
      const potentialSavings = expensiveCost * POTENTIAL_SAVINGS_RATIO;

      recommendations.push({
        projectId,
        type: 'downgrade_model',
        priority: 'high',
        title: 'Reduce costs by using more efficient AI models',
        description:
          'A significant portion of your AI costs comes from expensive models. Many tasks can be handled by faster, cheaper models without sacrificing quality.',
        currentMetrics: {
          totalCost: Math.round(totalCost * 100) / 100,
          expensiveModelCost: Math.round(expensiveCost * 100) / 100,
          expensivePercentage: Math.round((expensiveCost / totalCost) * 100),
        },
        recommendation: {
          actions: [
            'Use GPT-3.5-turbo or Claude-3-haiku for simple queries',
            'Reserve GPT-4 for complex reasoning tasks only',
            'Implement model routing based on query complexity',
            'Enable prompt caching to reduce token usage',
          ],
          suggestedModels: {
            simple: 'gpt-3.5-turbo (90% cheaper)',
            moderate: 'claude-3-sonnet (70% cheaper)',
            complex: 'gpt-4-turbo-preview (keep current)',
          },
        },
        estimatedSavings: potentialSavings,
        estimatedImpact: `Save approximately $${Math.round(potentialSavings * 100) / 100}/month`,
      });
    }

    // Check budget forecast
    const forecast = await costBudgetService.getForecast(projectId, 'monthly');
    if (forecast && forecast.projectedOverage > 0) {
      recommendations.push({
        projectId,
        type: 'reduce_model_usage',
        priority: 'critical',
        title: 'Budget overrun projected - reduce AI usage',
        description:
          'Current spending trends indicate you will exceed your monthly budget. Immediate action recommended.',
        currentMetrics: {
          currentSpend: Math.round(forecast.currentSpend * 100) / 100,
          averageDaily: Math.round(forecast.averageDaily * 100) / 100,
          projectedTotal: Math.round(forecast.projectedTotal * 100) / 100,
          projectedOverage: Math.round(forecast.projectedOverage * 100) / 100,
          daysRemaining: forecast.daysRemaining,
        },
        recommendation: {
          actions: [
            'Implement rate limiting for AI API calls',
            'Increase cache hit rates',
            'Review and optimize prompts to reduce token usage',
            'Consider using local models for development',
            'Set up usage alerts and quotas',
          ],
        },
        estimatedSavings: forecast.projectedOverage,
        estimatedImpact: 'Stay within budget',
      });
    }

    return recommendations;
  }

  private async analyzeCacheEffectiveness(
    projectId: string
  ): Promise<RecommendationData[]> {
    const recommendations: RecommendationData[] = [];
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    const cachePerf = await performanceProfiler.getCachePerformance(
      projectId,
      startDate,
      endDate
    );

    if (!cachePerf) return recommendations;

    // If cache hit rate is low, recommend optimization
    if (cachePerf.hitRate < CACHE_HIT_RATE_THRESHOLD && cachePerf.totalRequests > MIN_REQUESTS_FOR_CACHE_ANALYSIS) {
      // Calculate total potential latency reduction by converting misses to hits
      const potentialLatencyReduction =
        cachePerf.misses * (cachePerf.avgMissLatency - cachePerf.avgHitLatency);

      recommendations.push({
        projectId,
        type: 'optimize_cache',
        priority: 'medium',
        title: 'Improve cache hit rate',
        description:
          'Your cache hit rate is below optimal levels. Improving caching strategy can significantly reduce latency and costs.',
        currentMetrics: {
          hitRate: Math.round(cachePerf.hitRate * 10) / 10,
          totalRequests: cachePerf.totalRequests,
          hits: cachePerf.hits,
          misses: cachePerf.misses,
          avgHitLatency: Math.round(cachePerf.avgHitLatency),
          avgMissLatency: Math.round(cachePerf.avgMissLatency),
        },
        recommendation: {
          actions: [
            'Increase cache TTL for stable data',
            'Implement cache warming for frequently accessed data',
            'Add Redis or similar distributed cache',
            'Review cache key strategy',
            'Consider LRU eviction policy',
          ],
          targetHitRate: '80%+',
        },
        estimatedImpact: `Potential total latency reduction: ${Math.round(potentialLatencyReduction)}ms`,
      });
    }

    return recommendations;
  }

  private async createRecommendation(data: RecommendationData): Promise<void> {
    try {
      // Check if similar recommendation already exists
      const existing = await prisma.autoScalingRecommendation.findFirst({
        where: {
          projectId: data.projectId,
          recommendationType: data.type,
          implemented: false,
          dismissedAt: null,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Within last 7 days
          },
        },
      });

      if (existing) {
        // Update existing recommendation
        await prisma.autoScalingRecommendation.update({
          where: { id: existing.id },
          data: {
            priority: data.priority,
            description: data.description,
            currentMetrics: data.currentMetrics as object,
            recommendation: data.recommendation as object,
            estimatedSavings: data.estimatedSavings,
            estimatedImpact: data.estimatedImpact,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new recommendation
        await prisma.autoScalingRecommendation.create({
          data: {
            projectId: data.projectId,
            recommendationType: data.type,
            priority: data.priority,
            title: data.title,
            description: data.description,
            currentMetrics: data.currentMetrics as object,
            recommendation: data.recommendation as object,
            estimatedSavings: data.estimatedSavings,
            estimatedImpact: data.estimatedImpact,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to create recommendation', data, error as Error);
    }
  }
}

export const autoScalingService = new AutoScalingService();
