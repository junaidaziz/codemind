/**
 * Example: Enhanced Chat API with Performance Monitoring and Cost Tracking
 * 
 * This file demonstrates how to integrate the new performance and cost
 * optimization features into an existing API endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiModelService } from '@/lib/ai-model-service';
import { performanceProfiler } from '@/lib/performance-profiler';
import { costBudgetService } from '@/lib/cost-budget-service';
import { enhancedCache } from '@/lib/enhanced-cache-service';
import { logger } from '@/app/lib/logger';

/**
 * Enhanced chat endpoint with automatic performance tracking,
 * cost monitoring, and intelligent caching
 */
export async function POST(req: NextRequest) {
  // Track overall API latency
  const apiTimer = performanceProfiler.createTimer('chat-api', {
    metricType: 'api_latency',
    endpoint: '/api/chat/enhanced-example',
  });

  try {
    const body = await req.json();
    const { projectId, userId, messages, useCache = true } = body;

    // Validate required fields
    if (!projectId || !messages) {
      return NextResponse.json(
        { error: 'projectId and messages are required' },
        { status: 400 }
      );
    }

    // Check budget before making expensive AI calls
    const isWithinBudget = await costBudgetService.isWithinBudget(projectId);
    if (!isWithinBudget) {
      return NextResponse.json(
        {
          error: 'Budget exceeded',
          message: 'Project budget has been exceeded. Please review spending or increase budget.',
        },
        { status: 429 } // Too Many Requests
      );
    }

    // Try to get from enhanced cache first (if enabled)
    // Use a hash of the messages for a reliable cache key
    const messagesHash = Buffer.from(JSON.stringify(messages))
      .toString('base64')
      .substring(0, 50);
    const cacheKey = `chat:${projectId}:${messagesHash}`;
    
    if (useCache) {
      const cached = await enhancedCache.get(cacheKey);
      if (cached) {
        // Track cache hit
        await performanceProfiler.recordMetric({
          metricType: 'cache_hit_rate',
          metricName: 'chat_cache_hit',
          value: 1,
          endpoint: '/api/chat/enhanced-example',
          projectId,
        });

        await apiTimer.end();
        
        return NextResponse.json({
          ...cached,
          cached: true,
          message: 'Response served from cache',
        });
      }

      // Track cache miss
      await performanceProfiler.recordMetric({
        metricType: 'cache_hit_rate',
        metricName: 'chat_cache_miss',
        value: 0,
        endpoint: '/api/chat/enhanced-example',
        projectId,
      });
    }

    // Make AI API call with automatic cost tracking
    const response = await aiModelService.chatCompletion({
      messages,
      projectId,
      userId,
      operation: 'chat',
    });

    // Cache the response for future requests
    if (useCache && response.content) {
      await enhancedCache.set(
        cacheKey,
        {
          content: response.content,
          model: response.model,
          tokens: response.totalTokens,
        },
        600 // 10 minutes TTL
      );
    }

    // Check if we're approaching budget limits
    const budgetStatus = await costBudgetService.getBudgetStatus(projectId);
    const monthlyBudget = budgetStatus.find((b) => b.budgetType === 'monthly');
    
    let budgetWarning;
    if (monthlyBudget && monthlyBudget.status === 'warning') {
      budgetWarning = {
        message: `You've used ${monthlyBudget.percentUsed.toFixed(1)}% of your monthly budget`,
        remainingUsd: monthlyBudget.remainingUsd,
        status: monthlyBudget.status,
      };
    }

    await apiTimer.end();

    return NextResponse.json({
      content: response.content,
      model: response.model,
      usage: {
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        costUsd: response.costUsd,
      },
      performance: {
        durationMs: response.durationMs,
      },
      budgetWarning,
      cached: false,
    });
  } catch (error) {
    await apiTimer.end();

    logger.error('Chat API error', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}

/**
 * Get chat performance analytics
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    // Get performance metrics
    const latencyStats = await performanceProfiler.getMetricStats(
      'api_latency',
      'chat-api',
      startDate,
      endDate,
      projectId
    );

    const aiResponseStats = await performanceProfiler.getMetricStats(
      'ai_response_time',
      undefined,
      startDate,
      endDate,
      projectId
    );

    const cachePerf = await performanceProfiler.getCachePerformance(
      projectId,
      startDate,
      endDate
    );

    // Get budget status
    const budgetStatus = await costBudgetService.getBudgetStatus(projectId);
    const forecast = await costBudgetService.getForecast(projectId, 'monthly');

    // Get cache statistics
    const cacheStats = enhancedCache.getStats();

    return NextResponse.json({
      performance: {
        api: latencyStats,
        aiResponse: aiResponseStats,
      },
      cache: {
        performance: cachePerf,
        stats: cacheStats,
      },
      budget: {
        status: budgetStatus,
        forecast,
      },
      period: {
        startDate,
        endDate,
      },
    });
  } catch (error) {
    logger.error('Analytics error', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

/**
 * Example usage from frontend:
 * 
 * // Send chat message with automatic cost tracking
 * const response = await fetch('/api/chat/enhanced-example', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     projectId: 'my-project-id',
 *     userId: 'user-123',
 *     messages: [
 *       { role: 'user', content: 'What is this code doing?' }
 *     ],
 *     useCache: true
 *   })
 * });
 * 
 * const data = await response.json();
 * 
 * if (data.budgetWarning) {
 *   console.warn('Budget warning:', data.budgetWarning.message);
 * }
 * 
 * if (data.cached) {
 *   console.log('Response served from cache - no AI cost!');
 * }
 * 
 * console.log('Response:', data.content);
 * console.log('Cost:', data.usage.costUsd);
 * console.log('Duration:', data.performance.durationMs, 'ms');
 * 
 * 
 * // Get analytics
 * const analytics = await fetch(
 *   '/api/chat/enhanced-example?projectId=my-project-id'
 * );
 * const analyticsData = await analytics.json();
 * 
 * console.log('Average API latency:', analyticsData.performance.api.average, 'ms');
 * console.log('Cache hit rate:', analyticsData.cache.performance.hitRate, '%');
 * console.log('Budget status:', analyticsData.budget.status);
 */
