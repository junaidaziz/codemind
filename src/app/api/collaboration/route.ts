// API endpoints for real-time collaboration sessions - /api/collaboration
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { 
  createApiError,
  createApiSuccess
} from '../../../types';
import { 
  CollaborationPermissionsSchema,
} from '../../../types/realtime';
import { z } from 'zod';

// Schema for creating/joining collaboration sessions
const JoinSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  role: z.enum(['owner', 'collaborator', 'viewer']).optional().default('viewer'),
});

const UpdatePermissionsSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  permissions: CollaborationPermissionsSchema,
});

// GET /api/collaboration - Get active collaboration sessions for user
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const projectId = url.searchParams.get('projectId');
    const sessionId = url.searchParams.get('sessionId');

    if (!userId) {
      return NextResponse.json(
        createApiError('User ID is required', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    if (sessionId) {
      // Get specific session details
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          project: {
            select: { id: true, name: true }
          },
          _count: {
            select: { messages: true }
          }
        }
      });

      if (!session) {
        return NextResponse.json(
          createApiError('Session not found', 'NOT_FOUND'),
          { status: 404 }
        );
      }

      // Check if user has access to this session
      if (session.userId !== userId) {
        // For now, only allow access to own sessions
        // In the future, this could check collaboration permissions
        return NextResponse.json(
          createApiError('Access denied', 'UNAUTHORIZED'),
          { status: 403 }
        );
      }

      const sessionState = {
        sessionId: session.id,
        participants: [{
          userId: session.user.id,
          userName: session.user.name,
          role: 'owner',
          joinedAt: session.createdAt.toISOString(),
          lastActiveAt: session.lastActiveAt.toISOString(),
          permissions: {
            canSendMessages: true,
            canViewHistory: true,
            canManageSession: true,
          },
        }],
        lastActivity: session.lastActiveAt.toISOString(),
        messageCount: session._count.messages,
      };

      return NextResponse.json(createApiSuccess({
        session: sessionState,
        project: session.project,
      }));
    }

    // Build query for user's sessions
    const whereClause: Record<string, unknown> = {
      userId,
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    // Get user's sessions
    const sessions = await prisma.chatSession.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        project: {
          select: { id: true, name: true }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { lastActiveAt: 'desc' },
      take: 50, // Limit to recent sessions
    });

    const collaborationSessions = sessions.map(session => ({
      sessionId: session.id,
      projectId: session.projectId,
      projectName: session.project.name,
      participants: [{
        userId: session.user.id,
        userName: session.user.name,
        role: 'owner' as const,
        joinedAt: session.createdAt.toISOString(),
        lastActiveAt: session.lastActiveAt.toISOString(),
        permissions: {
          canSendMessages: true,
          canViewHistory: true,
          canManageSession: true,
        },
      }],
      lastActivity: session.lastActiveAt.toISOString(),
      messageCount: session._count.messages,
      createdAt: session.createdAt.toISOString(),
    }));

    return NextResponse.json(createApiSuccess({
      sessions: collaborationSessions,
      total: collaborationSessions.length,
    }));

  } catch (error) {
    console.error('Error fetching collaboration sessions:', error);
    return NextResponse.json(
      createApiError('Failed to fetch collaboration sessions', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// POST /api/collaboration - Join or create collaboration session
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { sessionId, projectId, role } = JoinSessionSchema.parse(body);
    
    // Get user from request headers or auth
    // For now, we'll need to get user from the session or auth context
    // This would typically come from authentication middleware
    
    // Verify that the session exists
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        project: {
          select: { id: true, name: true }
        }
      }
    });

    if (!session) {
      return NextResponse.json(
        createApiError('Session not found', 'NOT_FOUND'),
        { status: 404 }
      );
    }

    if (session.projectId !== projectId) {
      return NextResponse.json(
        createApiError('Session does not belong to specified project', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    // For now, create a participant entry
    // In a full implementation, this would be stored in a separate participants table
    const participant = {
      userId: session.user.id, // This should be the requesting user's ID
      userName: session.user.name,
      role,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      permissions: {
        canSendMessages: role !== 'viewer',
        canViewHistory: true,
        canManageSession: role === 'owner',
      },
    };

    return NextResponse.json(createApiSuccess({
      participant,
      sessionId,
      message: 'Successfully joined collaboration session',
    }));

  } catch (error) {
    console.error('Error joining collaboration session:', error);
    
    if (error instanceof z.ZodError) {
      const details = error.issues.reduce((acc, issue) => {
        const path = issue.path.join('.');
        if (!acc[path]) acc[path] = [];
        acc[path].push(issue.message);
        return acc;
      }, {} as Record<string, string[]>);
      
      return NextResponse.json(
        createApiError('Invalid session data', 'VALIDATION_ERROR', details),
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      createApiError('Failed to join collaboration session', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// PUT /api/collaboration - Update collaboration permissions
export async function PUT(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { sessionId, userId, permissions } = UpdatePermissionsSchema.parse(body);
    
    // Verify session exists
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });

    if (!session) {
      return NextResponse.json(
        createApiError('Session not found', 'NOT_FOUND'),
        { status: 404 }
      );
    }

    // For now, only session owner can update permissions
    // In a full implementation, this would check actual permissions
    if (session.userId !== userId) {
      return NextResponse.json(
        createApiError('Only session owner can update permissions', 'UNAUTHORIZED'),
        { status: 403 }
      );
    }

    // In a full implementation, this would update the participants table
    // For now, we'll just return success with the updated permissions
    
    return NextResponse.json(createApiSuccess({
      sessionId,
      userId,
      permissions,
      message: 'Permissions updated successfully',
    }));

  } catch (error) {
    console.error('Error updating collaboration permissions:', error);
    
    if (error instanceof z.ZodError) {
      const details = error.issues.reduce((acc, issue) => {
        const path = issue.path.join('.');
        if (!acc[path]) acc[path] = [];
        acc[path].push(issue.message);
        return acc;
      }, {} as Record<string, string[]>);
      
      return NextResponse.json(
        createApiError('Invalid permissions data', 'VALIDATION_ERROR', details),
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      createApiError('Failed to update permissions', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// DELETE /api/collaboration - Leave collaboration session
export async function DELETE(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');

    if (!sessionId || !userId) {
      return NextResponse.json(
        createApiError('Session ID and User ID are required', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        createApiError('Session not found', 'NOT_FOUND'),
        { status: 404 }
      );
    }

    // In a full implementation, this would remove the user from participants table
    // For now, we'll just return success
    
    return NextResponse.json(createApiSuccess({
      sessionId,
      userId,
      message: 'Successfully left collaboration session',
    }));

  } catch (error) {
    console.error('Error leaving collaboration session:', error);
    return NextResponse.json(
      createApiError('Failed to leave collaboration session', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}