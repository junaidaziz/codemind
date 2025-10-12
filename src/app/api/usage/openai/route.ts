// Cost monitoring API endpoint - /api/usage/openai
import { NextResponse } from 'next/server';
import { usageTracker } from '../../../lib/openai-usage-tracker';
import { createApiSuccess, createApiError } from '../../../../types';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const timeframe = url.searchParams.get('timeframe') as 'hour' | 'day' | 'week' || 'day';
    
    const stats = usageTracker.getUsageStats(timeframe);
    
    return NextResponse.json(createApiSuccess({
      usage: stats,
      recommendations: generateRecommendations(stats),
      limits: {
        daily: timeframe === 'day' ? 100000 : undefined,
        hourly: timeframe === 'hour' ? 10000 : undefined,
      }
    }));
    
  } catch (error) {
    console.error('Usage API error:', error);
    return NextResponse.json(
      createApiError('Failed to get usage statistics', 'USAGE_ERROR'),
      { status: 500 }
    );
  }
}

function generateRecommendations(stats: ReturnType<typeof usageTracker.getUsageStats>) {
  const recommendations = [];
  
  if (stats.totalCost > 1.0) {
    recommendations.push({
      type: 'warning',
      message: `High cost detected: $${stats.totalCost.toFixed(2)} in ${stats.timeframe}`,
      action: 'Consider using gpt-4o-mini instead of gpt-4o for non-critical tasks'
    });
  }
  
  if (stats.totalTokens > 50000) {
    recommendations.push({
      type: 'info',
      message: `High token usage: ${stats.totalTokens.toLocaleString()} tokens`,
      action: 'Implement response caching or reduce context length'
    });
  }
  
  if (stats.averageTokensPerRequest > 5000) {
    recommendations.push({
      type: 'optimization',
      message: `Large requests detected: ${Math.round(stats.averageTokensPerRequest)} tokens per request`,
      action: 'Consider breaking down large prompts or reducing context'
    });
  }
  
  return recommendations;
}