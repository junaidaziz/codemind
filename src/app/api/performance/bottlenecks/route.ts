import { NextRequest, NextResponse } from 'next/server';
import { performanceProfiler } from '@/lib/performance-profiler';
import { logger } from '@/app/lib/logger';

/**
 * Identify performance bottlenecks
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const projectId = searchParams.get('projectId') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const bottlenecks = await performanceProfiler.identifyBottlenecks(
      projectId,
      startDate,
      endDate
    );

    return NextResponse.json({ bottlenecks });
  } catch (error) {
    logger.error('Error identifying bottlenecks', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to identify bottlenecks' },
      { status: 500 }
    );
  }
}
