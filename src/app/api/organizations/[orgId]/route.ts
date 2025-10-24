import { NextRequest, NextResponse } from 'next/server'
import { OrganizationService } from '@/lib/organization-service'
import { getCurrentUser } from '@/lib/auth-guards'

/**
 * GET /api/organizations/[orgId]
 * Get organization details
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
        { error: 'Not authorized to view organization' },
        { status: 403 }
      )
    }

    const organization = await OrganizationService.getOrganization(orgId)

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(organization)
  } catch (error) {
    console.error('Error fetching organization:', error)

    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/organizations/[orgId]
 * Update organization details
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { orgId } = await params
    const body = await request.json()
    const { name, description } = body

    // Check if user has permission to update organization
    const member = await OrganizationService.getOrganizationMember(orgId, user.id)
    if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Not authorized to update organization' },
        { status: 403 }
      )
    }

    const updated = await OrganizationService.updateOrganization(orgId, {
      name,
      description,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating organization:', error)

    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update organization' },
      { status: 500 }
    )
  }
}
