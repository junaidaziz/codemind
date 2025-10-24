import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/lib/audit-log-service';

/**
 * GET /api/audit-logs/search
 * Search audit logs
 * Query params:
 *   - q: Search query
 *   - organizationId: Filter by organization
 *   - projectId: Filter by project
 *   - userId: Filter by user
 *   - limit: Number of results (default 50)
 *   - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get user ID from authentication
    const userId = 'placeholder-user-id';
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    
    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const filters = {
      organizationId: searchParams.get('organizationId') || undefined,
      projectId: searchParams.get('projectId') || undefined,
      userId: searchParams.get('userId') || undefined,
    };

    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await AuditLogService.searchLogs(
      query,
      filters,
      limit,
      offset
    );

    return NextResponse.json({
      logs: result.logs,
      total: result.total,
      hasMore: result.hasMore,
      query,
      filters,
    });
  } catch (error) {
    console.error('Error searching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to search audit logs' },
      { status: 500 }
    );
  }
}
