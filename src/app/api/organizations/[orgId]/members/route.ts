// Organization member management API - /api/organizations/[orgId]/members
import { NextRequest, NextResponse } from 'next/server';
import { createApiError, createApiSuccess } from '../../../../../types';
import prisma from '@/lib/db';
import { logger } from '@/lib/logger';
import type { InviteMemberData } from '../../../../../types/organization';
import { getOrganizationPermissions } from '../../../../../types/organization';
import { randomBytes } from 'crypto';

interface RouteParams {
  orgId: string;
}

// GET /api/organizations/[orgId]/members - List organization members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { orgId: organizationId } = await params;
    const userId = 'placeholder-user-id';
    if (!userId) {
      return NextResponse.json(
        createApiError('Authentication required', 'UNAUTHORIZED'),
        { status: 401 }
      );
    }
    logger.info('Fetching organization members', { organizationId, userId });
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        OrganizationMember: {
          include: {
            User_OrganizationMember_userIdToUser: {
              select: { id: true, email: true, name: true, image: true },
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
    const userMembership = organization.OrganizationMember.find(
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
      memberCount: organization.OrganizationMember.length,
    });
    return NextResponse.json(
      createApiSuccess({
        members: organization.OrganizationMember,
        total: organization.OrganizationMember.length,
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

// POST /api/organizations/[orgId]/members - Invite new member
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { orgId: organizationId } = await params;
    const userId = 'placeholder-user-id';
    if (!userId) {
      return NextResponse.json(
        createApiError('Authentication required', 'UNAUTHORIZED'),
        { status: 401 }
      );
    }
    const body = (await req.json()) as InviteMemberData;
    logger.info('Inviting member to organization', {
      organizationId,
      inviterUserId: userId,
      inviteeEmail: body.email,
      role: body.role,
    });
    if (!body.email || !body.role) {
      return NextResponse.json(
        createApiError('Email and role are required', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { OrganizationMember: { where: { userId } } },
    });
    if (!organization) {
      return NextResponse.json(
        createApiError('Organization not found', 'NOT_FOUND'),
        { status: 404 }
      );
    }
    const userMembership = organization.OrganizationMember[0];
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
    const existingMember = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: body.email } },
    });
    if (existingMember) {
      return NextResponse.json(
        createApiError('User is already a member', 'ALREADY_MEMBER'),
        { status: 409 }
      );
    }
    const existingInvite = await prisma.organizationInvite.findFirst({
      where: { organizationId, email: body.email, expiresAt: { gt: new Date() } },
    });
    if (existingInvite) {
      return NextResponse.json(
        createApiError('Invite already sent', 'INVITE_PENDING'),
        { status: 409 }
      );
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const invite = await prisma.organizationInvite.create({
      data: {
        id: `orginvite_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        organizationId,
        email: body.email,
        role: body.role,
        token,
        expiresAt,
        invitedBy: userId,
      },
      include: {
        Organization: { select: { name: true, slug: true } },
        User: { select: { name: true, email: true } },
      },
    });
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
