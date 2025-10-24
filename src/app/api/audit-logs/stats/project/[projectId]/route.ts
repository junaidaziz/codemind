import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/lib/audit-log-service';

/**
 * GET /api/audit-logs/stats/project/[projectId]
 * Get audit log statistics for a project
 * Query params:
 *   - days: Number of days to include (default 30)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // TODO: Get user ID from authentication
    const userId = 'placeholder-user-id';
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { projectId } = params;
    const days = parseInt(request.nextUrl.searchParams.get('days') || '30');

    const stats = await AuditLogService.getProjectStats(projectId, days);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching project audit stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit statistics' },
      { status: 500 }
    );
  }
}
