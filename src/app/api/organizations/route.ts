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
        },
        projects: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            status: true,
          },
        },
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch organizations where user is a member (but not owner)
    const memberOrganizations = await prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
        ownerId: { not: userId },
      },
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
        },
        projects: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            status: true,
          },
        },
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const userOrganizations: UserOrganizations = {
      owned: ownedOrganizations,
      member: memberOrganizations,
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
        name: body.name,
        description: body.description,
        slug: body.slug,
        ownerId: userId,
      },
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
        },
        projects: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            status: true,
          },
        },
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });

    // Create owner membership
    await prisma.organizationMember.create({
      data: {
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