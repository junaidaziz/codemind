import { NextRequest, NextResponse } from 'next/server'
import { OrganizationService } from '@/lib/organization-service'
import { getCurrentUser } from '@/lib/auth-guards'

/**
 * GET /api/organizations/[orgId]/members
 * Get all members of an organization
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
        { error: 'Not authorized to view organization members' },
        { status: 403 }
      )
    }

    const members = await OrganizationService.getOrganizationMembers(orgId)

    return NextResponse.json(members)
  } catch (error) {
    console.error('Error fetching organization members:', error)

    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch organization members' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organizations/[orgId]/members
 * Invite a new member to the organization
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { orgId } = await params
    const body = await request.json()
    const { email, role = 'MEMBER' } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if user has permission to invite members
    const member = await OrganizationService.getOrganizationMember(orgId, user.id)
    if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Not authorized to invite members' },
        { status: 403 }
      )
    }

    // Create invitation (using invitation service)
    // For now, just return success
    // TODO: Integrate with InvitationService

    return NextResponse.json(
      { message: 'Invitation sent successfully', email, role },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error inviting organization member:', error)

    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    )
  }
}
