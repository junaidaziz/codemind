import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/lib/audit-log-service';

/**
 * GET /api/audit-logs
 * Get audit logs with optional filters
 * Query params:
 *   - organizationId: Filter by organization
 *   - projectId: Filter by project
 *   - userId: Filter by user
 *   - action: Filter by action type
 *   - entityType: Filter by entity type
 *   - startDate: Filter by start date (ISO string)
 *   - endDate: Filter by end date (ISO string)
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
    
    const filters = {
      organizationId: searchParams.get('organizationId') || undefined,
      projectId: searchParams.get('projectId') || undefined,
      userId: searchParams.get('userId') || undefined,
      action: searchParams.get('action') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      startDate: searchParams.get('startDate') 
        ? new Date(searchParams.get('startDate')!) 
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const result = await AuditLogService.getAuditLogs(filters);

    return NextResponse.json({
      logs: result.logs,
      total: result.total,
      hasMore: result.hasMore,
      filters,
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
