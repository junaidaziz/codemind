import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Define types locally since they may not be in Prisma yet
type ActivityEventType =
  | 'INDEXING_STARTED'
  | 'INDEXING_PROGRESS'
  | 'INDEXING_COMPLETED'
  | 'INDEXING_FAILED'
  | 'APR_SESSION_CREATED'
  | 'APR_ANALYZING'
  | 'APR_CODE_GENERATION'
  | 'APR_VALIDATION'
  | 'APR_REVIEW'
  | 'APR_PR_CREATED'
  | 'APR_COMPLETED'
  | 'APR_FAILED'
  | 'CHAT_MESSAGE_SENT'
  | 'CHAT_MESSAGE_RECEIVED'
  | 'AUTO_FIX_STARTED'
  | 'AUTO_FIX_COMPLETED'
  | 'AUTO_FIX_FAILED'
  | 'CODE_SCAFFOLDING'
  | 'TEST_GENERATION';

type ActivityEventStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const eventType = searchParams.get('eventType') as ActivityEventType | null;
    const status = searchParams.get('status') as ActivityEventStatus | null;
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query filters
    const where: Prisma.ActivityEventWhereInput = {};

    if (projectId) {
      // Verify user has access to this project
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          ownerId: user.id,
        },
      });

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      where.projectId = projectId;
    } else {
      // Show events from all user's projects
      where.project = {
        ownerId: user.id,
      };
    }

    if (eventType) {
      where.eventType = eventType;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.activityEvent.count({ where });

    // Fetch activity events
    const events = await prisma.activityEvent.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Parse metadata for each event (metadata is already JSON from Prisma)
    const eventsWithMetadata = events.map((event: typeof events[0]) => ({
      ...event,
      metadata: event.metadata,
    }));

    return NextResponse.json({
      events: eventsWithMetadata,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[Activity Feed Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity feed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Create a new activity event
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectId,
      eventType,
      entityType,
      entityId,
      title,
      description,
      metadata,
      status = 'IN_PROGRESS',
      duration,
    } = body;

    // Validate required fields
    if (!projectId || !eventType || !entityType || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, eventType, entityType, title' },
        { status: 400 }
      );
    }

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: user.id,
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Create activity event
    const event = await prisma.activityEvent.create({
      data: {
        projectId,
        userId: user.id,
        eventType,
        entityType,
        entityId,
        title,
        description,
        metadata: metadata || undefined,
        status,
        duration,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      event: {
        ...event,
        metadata: event.metadata,
      },
    });
  } catch (error) {
    console.error('[Activity Event Creation Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create activity event', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Update an existing activity event (e.g., mark as completed)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, status, duration, metadata } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    // Verify event exists and user has access
    const existingEvent = await prisma.activityEvent.findFirst({
      where: {
        id: eventId,
        project: {
          ownerId: user.id,
        },
      },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: 'Activity event not found' }, { status: 404 });
    }

    // Update event
    const updatedEvent = await prisma.activityEvent.update({
      where: { id: eventId },
      data: {
        ...(status && { status }),
        ...(duration !== undefined && { duration }),
        ...(metadata && { metadata: JSON.stringify(metadata) }),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      event: {
        ...updatedEvent,
        metadata: updatedEvent.metadata,
      },
    });
  } catch (error) {
    console.error('[Activity Event Update Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update activity event', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
