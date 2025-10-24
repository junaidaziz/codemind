import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/lib/invitation-service';

/**
 * GET /api/invitations/[token] - Get invitation details by token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invitation = await InvitationService.getInvitationByToken(token);

    return NextResponse.json(invitation);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get invitation' },
      { status: 400 }
    );
  }
}

/**
 * POST /api/invitations/[token]/accept - Accept an invitation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    // TODO: Get actual authenticated user ID
    // For now using placeholder
    const userId = 'placeholder-user-id';

    const result = await InvitationService.acceptInvitation({ token, userId });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to accept invitation' },
      { status: 400 }
    );
  }
}
