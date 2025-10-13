// Organization member management API - /api/organizations/[id]/members
import { NextRequest, NextResponse } from 'next/server';
import { createApiError, createApiSuccess } from '../../../../../types';
import prisma from '@/lib/db';
import { logger } from '@/lib/logger';
import type { InviteMemberData } from '../../../../../types/organization';
import { getOrganizationPermissions } from '../../../../../types/organization';
import { randomBytes } from 'crypto';

interface RouteParams {
  id: string;
}

// GET /api/organizations/[id]/members - List organization members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { id: organizationId } = await params;
    
    // TODO: Get user ID from authentication
    const userId = 'placeholder-user-id';

    if (!userId) {
      return NextResponse.json(
        createApiError('Authentication required', 'UNAUTHORIZED'),
        { status: 401 }
      );
    }

    logger.info('Fetching organization members', { organizationId, userId });

    // Check if user has access to view members
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        createApiError('Organization not found', 'NOT_FOUND'),
        { status: 404 }
      );
    }

    // Check if user is member
    const userMembership = organization.members.find(
      (member: { userId: string }) => member.userId === userId
    );

    if (!userMembership && organization.ownerId !== userId) {
      return NextResponse.json(
        createApiError('Access denied', 'FORBIDDEN'),
        { status: 403 }
      );
    }

    logger.info('Organization members fetched successfully', {
      organizationId,
      memberCount: organization.members.length,
    });

    return NextResponse.json(
      createApiSuccess({
        members: organization.members,
        total: organization.members.length,
      })
    );

  } catch (error) {
    logger.error('Failed to fetch organization members', {}, error as Error);
    return NextResponse.json(
      createApiError('Failed to fetch members', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// POST /api/organizations/[id]/members - Invite new member
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { id: organizationId } = await params;
    
    // TODO: Get user ID from authentication
    const userId = 'placeholder-user-id';

    if (!userId) {
      return NextResponse.json(
        createApiError('Authentication required', 'UNAUTHORIZED'),
        { status: 401 }
      );
    }

    const body = await req.json() as InviteMemberData;

    logger.info('Inviting member to organization', {
      organizationId,
      inviterUserId: userId,
      inviteeEmail: body.email,
      role: body.role,
    });

    // Validate input
    if (!body.email || !body.role) {
      return NextResponse.json(
        createApiError('Email and role are required', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    // Check if user has permission to invite members
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          where: { userId },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        createApiError('Organization not found', 'NOT_FOUND'),
        { status: 404 }
      );
    }

    const userMembership = organization.members[0];
    const userRole = organization.ownerId === userId ? 'OWNER' : userMembership?.role || null;

    if (!userRole) {
      return NextResponse.json(
        createApiError('Access denied', 'FORBIDDEN'),
        { status: 403 }
      );
    }

    const permissions = getOrganizationPermissions(userRole);
    if (!permissions.canManageMembers) {
      return NextResponse.json(
        createApiError('Insufficient permissions to invite members', 'FORBIDDEN'),
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: body.email, // This should be resolved from email to user ID
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        createApiError('User is already a member', 'ALREADY_MEMBER'),
        { status: 409 }
      );
    }

    // Check if there's already a pending invite
    const existingInvite = await prisma.organizationInvite.findFirst({
      where: {
        organizationId,
        email: body.email,
        expiresAt: { gt: new Date() }, // Not expired
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        createApiError('Invite already sent', 'INVITE_PENDING'),
        { status: 409 }
      );
    }

    // Create invite token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create organization invite
    const invite = await prisma.organizationInvite.create({
      data: {
        organizationId,
        email: body.email,
        role: body.role,
        token,
        expiresAt,
        invitedBy: userId,
      },
      include: {
        organization: {
          select: {
            name: true,
            slug: true,
          },
        },
        inviter: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // TODO: Send email invitation
    // For now, just log the invite details
    logger.info('Organization invite created', {
      inviteId: invite.id,
      organizationId,
      email: body.email,
      role: body.role,
      token,
    });

    return NextResponse.json(
      createApiSuccess({
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
        },
        message: 'Invitation sent successfully',
      }),
      { status: 201 }
    );

  } catch (error) {
    logger.error('Failed to invite member', {}, error as Error);
    return NextResponse.json(
      createApiError('Failed to send invitation', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}