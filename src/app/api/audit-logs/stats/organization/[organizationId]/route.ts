import { NextRequest, NextResponse } from 'next/server';
import { AuditLogService } from '@/lib/audit-log-service';

/**
 * GET /api/audit-logs/stats/organization/[organizationId]
 * Get audit log statistics for an organization
 * Query params:
 *   - days: Number of days to include (default 30)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
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

    const { organizationId } = await params;
    const days = parseInt(request.nextUrl.searchParams.get('days') || '30');

    const stats = await AuditLogService.getOrganizationStats(
      organizationId,
      days
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching organization audit stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit statistics' },
      { status: 500 }
    );
  }
}
