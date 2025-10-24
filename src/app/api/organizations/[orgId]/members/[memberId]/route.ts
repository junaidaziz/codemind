import { NextRequest, NextResponse } from 'next/server'
import { OrganizationService } from '@/lib/organization-service'
import { getCurrentUser } from '@/lib/auth-guards'

type OrganizationRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'

/**
 * PATCH /api/organizations/[orgId]/members/[memberId]
 * Update a member's role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; memberId: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { orgId, memberId } = await params
    const body = await request.json()
    const { role } = body

    if (!role) {
      return NextResponse.json(
        { error: 'Role is required' },
        { status: 400 }
      )
    }

    // Check if user has permission to change roles
    const requesterMember = await OrganizationService.getOrganizationMember(orgId, user.id)
    if (!requesterMember || (requesterMember.role !== 'OWNER' && requesterMember.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Not authorized to change member roles' },
        { status: 403 }
      )
    }

    await OrganizationService.updateMemberRole(orgId, memberId, role as OrganizationRole, user.id)

    return NextResponse.json({ message: 'Member role updated successfully' })
  } catch (error) {
    console.error('Error updating member role:', error)

    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update member role' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/organizations/[orgId]/members/[memberId]
 * Remove a member from the organization
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; memberId: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { orgId, memberId } = await params

    // Check if user has permission to remove members
    const requesterMember = await OrganizationService.getOrganizationMember(orgId, user.id)
    if (!requesterMember || (requesterMember.role !== 'OWNER' && requesterMember.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Not authorized to remove members' },
        { status: 403 }
      )
    }

    await OrganizationService.removeMember(orgId, memberId, user.id)

    return NextResponse.json({ message: 'Member removed successfully' })
  } catch (error) {
    console.error('Error removing member:', error)

    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to remove member' },
      { status: 500 }
    )
  }
}
