import { NextRequest, NextResponse } from 'next/server'
import { InvitationService } from '@/lib/invitation-service'
import { ProjectRole } from '@prisma/client'

// Create a new invitation
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const body = await request.json()
    const { email, role } = body

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      )
    }

    // Validate role
    if (!Object.values(ProjectRole).includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // TODO: Replace with actual authentication
    const userId = 'placeholder-user-id'

    const invitation = await InvitationService.createInvitation({
      projectId: params.projectId,
      email,
      role,
      invitedBy: userId,
      expiresInDays: body.expiresInDays || 7,
    })

    // In production, send email here
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invitations/${invitation.token}`

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
        createdAt: invitation.createdAt,
      },
      inviteUrl,
      message: 'Invitation created successfully',
    })
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invitation' },
      { status: 400 }
    )
  }
}

// Get all invitations for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const invitations = await InvitationService.getProjectInvitations(params.projectId)

    return NextResponse.json(invitations)
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}
