// API endpoints for collaboration session participants - /api/collaboration/participants
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { 
  createApiError,
  createApiSuccess
} from '../../../../types';
// Import types from realtime for type checking
import { z } from 'zod';

// Schema for inviting users to collaboration sessions
const InviteParticipantSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  email: z.string().email('Valid email is required'),
  role: z.enum(['collaborator', 'viewer']).default('viewer'),
  message: z.string().optional(),
});

// GET /api/collaboration/participants - Get session participants
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        createApiError('Session ID is required', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    // Get session with user info
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: { 
            id: true, 
            name: true, 
            email: true,
          }
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

    // For now, return the session owner as the only participant
    // In a full implementation, this would query a separate participants table
    const participants = [{
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      role: 'owner' as const,
      joinedAt: session.createdAt.toISOString(),
      lastActiveAt: session.lastActiveAt.toISOString(),
      permissions: {
        canSendMessages: true,
        canViewHistory: true,
        canManageSession: true,
      },
    }];

    return NextResponse.json(createApiSuccess({
      sessionId,
      participants,
      total: participants.length,
      project: session.project,
    }));

  } catch (error) {
    console.error('Error fetching session participants:', error);
    return NextResponse.json(
      createApiError('Failed to fetch session participants', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// POST /api/collaboration/participants - Invite user to collaboration session
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const { sessionId, email, role, message } = InviteParticipantSchema.parse(body);
    
    // Verify session exists
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

    // Find user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true }
    });

    if (!invitedUser) {
      return NextResponse.json(
        createApiError('User not found', 'NOT_FOUND'),
        { status: 404 }
      );
    }

    // Check if user is already the session owner
    if (invitedUser.id === session.userId) {
      return NextResponse.json(
        createApiError('Cannot invite session owner', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    // In a full implementation, this would:
    // 1. Create a participant record in a participants table
    // 2. Send an email invitation
    // 3. Create a notification for the invited user

    const participant = {
      userId: invitedUser.id,
      userName: invitedUser.name,
      userEmail: invitedUser.email,
      role,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      permissions: {
        canSendMessages: role !== 'viewer',
        canViewHistory: true,
        canManageSession: false,
      },
      invitedBy: session.user.name,
      inviteMessage: message,
    };

    return NextResponse.json(createApiSuccess({
      participant,
      sessionId,
      message: `Successfully invited ${invitedUser.name || email} to collaboration session`,
    }));

  } catch (error) {
    console.error('Error inviting participant:', error);
    
    if (error instanceof z.ZodError) {
      const details = error.issues.reduce((acc, issue) => {
        const path = issue.path.join('.');
        if (!acc[path]) acc[path] = [];
        acc[path].push(issue.message);
        return acc;
      }, {} as Record<string, string[]>);
      
      return NextResponse.json(
        createApiError('Invalid invitation data', 'VALIDATION_ERROR', details),
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      createApiError('Failed to invite participant', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// PUT /api/collaboration/participants - Update participant role/permissions
export async function PUT(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const UpdateParticipantSchema = z.object({
      sessionId: z.string().min(1, 'Session ID is required'),
      userId: z.string().min(1, 'User ID is required'),
      role: z.enum(['owner', 'collaborator', 'viewer']).optional(),
      permissions: z.object({
        canSendMessages: z.boolean().optional(),
        canViewHistory: z.boolean().optional(),
        canManageSession: z.boolean().optional(),
      }).optional(),
    });

    const { sessionId, userId, role, permissions } = UpdateParticipantSchema.parse(body);
    
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

    // Get target user info
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        createApiError('Target user not found', 'NOT_FOUND'),
        { status: 404 }
      );
    }

    // In a full implementation, this would update the participants table
    // For now, we'll return the updated participant info
    
    const updatedPermissions = {
      canSendMessages: permissions?.canSendMessages ?? (role !== 'viewer'),
      canViewHistory: permissions?.canViewHistory ?? true,
      canManageSession: permissions?.canManageSession ?? (role === 'owner'),
    };

    const updatedParticipant = {
      userId: targetUser.id,
      userName: targetUser.name,
      userEmail: targetUser.email,
      role: role || 'viewer',
      permissions: updatedPermissions,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(createApiSuccess({
      participant: updatedParticipant,
      sessionId,
      message: 'Participant updated successfully',
    }));

  } catch (error) {
    console.error('Error updating participant:', error);
    
    if (error instanceof z.ZodError) {
      const details = error.issues.reduce((acc, issue) => {
        const path = issue.path.join('.');
        if (!acc[path]) acc[path] = [];
        acc[path].push(issue.message);
        return acc;
      }, {} as Record<string, string[]>);
      
      return NextResponse.json(
        createApiError('Invalid participant data', 'VALIDATION_ERROR', details),
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      createApiError('Failed to update participant', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// DELETE /api/collaboration/participants - Remove participant from session
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

    // Cannot remove session owner
    if (session.userId === userId) {
      return NextResponse.json(
        createApiError('Cannot remove session owner', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    // In a full implementation, this would:
    // 1. Remove participant from participants table
    // 2. Send notification about removal
    // 3. Broadcast removal event to other participants
    
    return NextResponse.json(createApiSuccess({
      sessionId,
      userId,
      message: 'Participant removed successfully',
    }));

  } catch (error) {
    console.error('Error removing participant:', error);
    return NextResponse.json(
      createApiError('Failed to remove participant', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}