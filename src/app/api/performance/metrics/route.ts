import { NextRequest, NextResponse } from 'next/server';
import { performanceProfiler } from '@/lib/performance-profiler';

/**
 * Get performance metrics statistics
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const metricType = searchParams.get('metricType') as
      | 'api_latency'
      | 'db_query_time'
      | 'cache_hit_rate'
      | 'ai_response_time'
      | 'embedding_generation'
      | 'indexing_time'
      | 'search_time';
    const metricName = searchParams.get('metricName') || undefined;
    const projectId = searchParams.get('projectId') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!metricType) {
      return NextResponse.json(
        { error: 'metricType is required' },
        { status: 400 }
      );
    }

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const stats = await performanceProfiler.getMetricStats(
      metricType,
      metricName,
      startDate,
      endDate,
      projectId
    );

    if (!stats) {
      return NextResponse.json(
        { error: 'No metrics found for the specified criteria' },
        { status: 404 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    );
  }
}
