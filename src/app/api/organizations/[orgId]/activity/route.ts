import { NextRequest, NextResponse } from 'next/server'
import { AuditLogService } from '@/lib/audit-log-service'
import { getCurrentUser } from '@/lib/auth-guards'
import { OrganizationService } from '@/lib/organization-service'

/**
 * GET /api/organizations/[orgId]/activity
 * Get recent activity for an organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { orgId } = await params

    // Check if user is a member of the organization
    const isMember = await OrganizationService.isOrganizationMember(orgId, user.id)
    if (!isMember) {
      return NextResponse.json(
        { error: 'Not authorized to view organization activity' },
        { status: 403 }
      )
    }

    // Get limit from query params (default: 50, max: 100)
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') || '50'),
      100
    )

    // Get activity logs for the organization
    const { logs } = await AuditLogService.getAuditLogs({
      organizationId: orgId,
      limit,
      offset: 0,
    })

    return NextResponse.json({ activities: logs })
  } catch (error) {
    console.error('Error fetching organization activity:', error)

    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch organization activity' },
      { status: 500 }
    )
  }
}
