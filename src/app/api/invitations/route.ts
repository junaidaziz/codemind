import { NextRequest, NextResponse } from 'next/server';
import { InvitationService } from '@/lib/invitation-service';
import { ProjectRole } from '@prisma/client';

/**
 * GET /api/invitations - Get user's pending invitations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const invitations = await InvitationService.getUserInvitations(email);

    return NextResponse.json(invitations);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invitations - Create a new invitation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, email, role } = body;

    // TODO: Get actual authenticated user ID
    const userId = 'placeholder-user-id';

    if (!projectId || !email) {
      return NextResponse.json(
        { error: 'Project ID and email are required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = Object.values(ProjectRole);
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const invitation = await InvitationService.createInvitation({
      projectId,
      email,
      role: role || ProjectRole.VIEWER,
      invitedBy: userId,
    });

    // Generate shareable link
    const invitationLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invitations/accept?token=${invitation.token}`;

    return NextResponse.json({
      invitation,
      invitationLink,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invitation' },
      { status: 400 }
    );
  }
}
