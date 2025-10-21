// Organizations API - GET /api/organizations and POST /api/organizations
import { NextRequest, NextResponse } from 'next/server';
import { createApiError, createApiSuccess } from '../../../types';
import prisma from '@/lib/db';
import { logger } from '@/lib/logger';
import type { CreateOrganizationData, UserOrganizations } from '../../../types/organization';

// GET /api/organizations - List user's organizations
export async function GET() {
  try {
    // TODO: Get user ID from authentication
    // For now, using a placeholder - this should be replaced with actual auth
    const userId = 'placeholder-user-id';

    if (!userId) {
      return NextResponse.json(
        createApiError('Authentication required', 'UNAUTHORIZED'),
        { status: 401 }
      );
    }

    logger.info('Fetching organizations for user', { userId });

    // Fetch organizations owned by user
    const ownedOrganizations = await prisma.organization.findMany({
      where: { ownerId: userId },
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
      orderBy: { createdAt: 'desc' },
    });

    // Fetch organizations where user is a member (but not owner)
    const memberOrganizations = await prisma.organization.findMany({
      where: {
        OrganizationMember: {
          some: {
            userId,
          },
        },
        ownerId: { not: userId },
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
      orderBy: { createdAt: 'desc' },
    });

    // Transform the data to match the expected type
    const transformedOwned = ownedOrganizations.map((org) => ({
      ...org,
      members: org.OrganizationMember.map((member) => ({
        ...member,
        user: member.User_OrganizationMember_userIdToUser,
      })),
      projects: org.Project,
      _count: {
        members: org._count.OrganizationMember,
        projects: org._count.Project,
      },
    }));

    const transformedMember = memberOrganizations.map((org) => ({
      ...org,
      members: org.OrganizationMember.map((member) => ({
        ...member,
        user: member.User_OrganizationMember_userIdToUser,
      })),
      projects: org.Project,
      _count: {
        members: org._count.OrganizationMember,
        projects: org._count.Project,
      },
    }));

    const userOrganizations: UserOrganizations = {
      owned: transformedOwned,
      member: transformedMember,
    };

    logger.info('Organizations fetched successfully', {
      userId,
      ownedCount: ownedOrganizations.length,
      memberCount: memberOrganizations.length,
    });

    return NextResponse.json(
      createApiSuccess({
        organizations: userOrganizations,
        total: ownedOrganizations.length + memberOrganizations.length,
      })
    );

  } catch (error) {
    logger.error('Failed to fetch organizations', {}, error as Error);
    return NextResponse.json(
      createApiError('Failed to fetch organizations', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// POST /api/organizations - Create new organization
export async function POST(req: NextRequest) {
  try {
    // TODO: Get user ID from authentication
    const userId = 'placeholder-user-id';

    if (!userId) {
      return NextResponse.json(
        createApiError('Authentication required', 'UNAUTHORIZED'),
        { status: 401 }
      );
    }

    const body = await req.json() as CreateOrganizationData;

    logger.info('Creating organization', { userId, name: body.name, slug: body.slug });

    // Validate required fields
    if (!body.name || !body.slug) {
      return NextResponse.json(
        createApiError('Organization name and slug are required', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: body.slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        createApiError('Organization slug is already taken', 'SLUG_TAKEN'),
        { status: 409 }
      );
    }

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        id: `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: body.name,
        description: body.description,
        slug: body.slug,
        ownerId: userId,
        updatedAt: new Date(),
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

    // Create owner membership
    await prisma.organizationMember.create({
      data: {
        id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organizationId: organization.id,
        userId,
        role: 'OWNER',
      },
    });

    logger.info('Organization created successfully', {
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      ownerId: userId,
    });

    return NextResponse.json(
      createApiSuccess({
        organization,
        message: 'Organization created successfully',
      }),
      { status: 201 }
    );

  } catch (error) {
    logger.error('Failed to create organization', {}, error as Error);
    return NextResponse.json(
      createApiError('Failed to create organization', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}