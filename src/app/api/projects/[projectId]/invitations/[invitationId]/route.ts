import { NextRequest, NextResponse } from 'next/server'
import { InvitationService } from '@/lib/invitation-service'

// Revoke an invitation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; invitationId: string }> }
) {
  try {
    // TODO: Replace with actual authentication
    const userId = 'placeholder-user-id'
    const { invitationId } = await params

    await InvitationService.revokeInvitation(invitationId, userId)

    return NextResponse.json({ message: 'Invitation revoked successfully' })
  } catch (error) {
    console.error('Error revoking invitation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke invitation' },
      { status: 400 }
    )
  }
}

// Resend an invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; invitationId: string }> }
) {
  try {
    const body = await request.json()
    const expiresInDays = body.expiresInDays || 7
    const { invitationId } = await params

    const invitation = await InvitationService.resendInvitation(
      invitationId,
      expiresInDays
    )

    // In production, send email here
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invitations/${invitation.token}`

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        status: invitation.status,
      },
      inviteUrl,
      message: 'Invitation resent successfully',
    })
  } catch (error) {
    console.error('Error resending invitation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resend invitation' },
      { status: 400 }
    )
  }
}
