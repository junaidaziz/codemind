// Organization management API - /api/organizations/[id]
import { NextRequest, NextResponse } from 'next/server';
import { createApiError, createApiSuccess } from '../../../../types';
import prisma from '@/lib/db';
import { logger } from '@/lib/logger';
import type { UpdateOrganizationData } from '../../../../types/organization';
import { getOrganizationPermissions } from '../../../../types/organization';

interface RouteParams {
  id: string;
}

// GET /api/organizations/[id] - Get organization details
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

    logger.info('Fetching organization details', { organizationId, userId });

    // Fetch organization with membership check
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        OrganizationMember: {
          include: {
            User_OrganizationMember_userIdToUser: {
              select: {
                id: true,
                email: true,
                name: true,
                image: true,
              },
            },
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            status: true,
            githubUrl: true,
          },
        },
        OrganizationInvite: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            OrganizationMember: true,
            Project: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        createApiError('Organization not found', 'NOT_FOUND'),
        { status: 404 }
      );
    }

    // Check if user is member or owner
    const userMembership = organization.OrganizationMember.find(
      (member: { userId: string }) => member.userId === userId
    );

    if (!userMembership && organization.ownerId !== userId) {
      return NextResponse.json(
        createApiError('Access denied', 'FORBIDDEN'),
        { status: 403 }
      );
    }

    const userRole = organization.ownerId === userId ? 'OWNER' : userMembership?.role || 'VIEWER';
    const permissions = getOrganizationPermissions(userRole);

    logger.info('Organization details fetched successfully', {
      organizationId,
      userId,
      memberCount: organization._count.OrganizationMember,
      projectCount: organization._count.Project,
    });

    return NextResponse.json(
      createApiSuccess({
        organization,
        userRole,
        permissions,
      })
    );

  } catch (error) {
    logger.error('Failed to fetch organization details', {}, error as Error);
    return NextResponse.json(
      createApiError('Failed to fetch organization', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/[id] - Update organization
export async function PATCH(
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

    const body = await req.json() as UpdateOrganizationData;

    logger.info('Updating organization', { organizationId, userId });

    // Check if user has permission to update organization
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        OrganizationMember: {
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

    const userMembership = organization.OrganizationMember[0];
    const userRole = organization.ownerId === userId ? 'OWNER' : userMembership?.role || null;

    if (!userRole) {
      return NextResponse.json(
        createApiError('Access denied', 'FORBIDDEN'),
        { status: 403 }
      );
    }

    const permissions = getOrganizationPermissions(userRole);
    if (!permissions.canManageSettings) {
      return NextResponse.json(
        createApiError('Insufficient permissions', 'FORBIDDEN'),
        { status: 403 }
      );
    }

    // Update organization
    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
      },
      include: {
        OrganizationMember: {
          include: {
            User_OrganizationMember_userIdToUser: {
              select: {
                id: true,
                email: true,
                name: true,
                image: true,
              },
            },
          },
        },
        Project: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            status: true,
          },
        },
        _count: {
          select: {
            OrganizationMember: true,
            Project: true,
          },
        },
      },
    });

    logger.info('Organization updated successfully', {
      organizationId,
      userId,
      updates: Object.keys(body),
    });

    return NextResponse.json(
      createApiSuccess({
        organization: updatedOrganization,
        message: 'Organization updated successfully',
      })
    );

  } catch (error) {
    logger.error('Failed to update organization', {}, error as Error);
    return NextResponse.json(
      createApiError('Failed to update organization', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id] - Delete organization
export async function DELETE(
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

    logger.info('Deleting organization', { organizationId, userId });

    // Check if user is owner
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        _count: {
          select: {
            Project: true,
            OrganizationMember: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        createApiError('Organization not found', 'NOT_FOUND'),
        { status: 404 }
      );
    }

    if (organization.ownerId !== userId) {
      return NextResponse.json(
        createApiError('Only organization owners can delete organizations', 'FORBIDDEN'),
        { status: 403 }
      );
    }

    // Check if there are projects that need to be handled
    if (organization._count.Project > 0) {
      return NextResponse.json(
        createApiError(
          'Cannot delete organization with projects. Please delete or transfer all projects first.',
          'HAS_PROJECTS'
        ),
        { status: 409 }
      );
    }

    // Delete organization (cascades will handle members and invites)
    await prisma.organization.delete({
      where: { id: organizationId },
    });

    logger.info('Organization deleted successfully', {
      organizationId,
      organizationName: organization.name,
      userId,
    });

    return NextResponse.json(
      createApiSuccess({
        message: 'Organization deleted successfully',
      })
    );

  } catch (error) {
    logger.error('Failed to delete organization', {}, error as Error);
    return NextResponse.json(
      createApiError('Failed to delete organization', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}