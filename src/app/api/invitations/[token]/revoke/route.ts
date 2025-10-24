import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/lib/invitation-service';

/**
 * POST /api/invitations/[token]/revoke - Revoke an invitation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invitationId } = body;

    // TODO: Get actual authenticated user ID
    const userId = 'placeholder-user-id';

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      );
    }

    const result = await InvitationService.revokeInvitation(invitationId, userId);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke invitation' },
      { status: 400 }
    );
  }
}
