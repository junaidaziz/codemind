import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from './supabase';
import { UserRole, type SessionUser } from '../../types';
import prisma from './db';

// Auth result types
export interface AuthResult {
  success: true;
  user: SessionUser;
}

export interface AuthError {
  success: false;
  error: string;
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_TOKEN';
  status: number;
}

export type AuthenticationResult = AuthResult | AuthError;

// Authorization options
export interface AuthOptions {
  requiredRole?: UserRole;
  requireAuth?: boolean;
}

/**
 * Middleware to authenticate and authorize requests
 * @param request - Next.js request object
 * @param options - Authentication and authorization options
 * @returns Authentication result with user data or error
 */
export async function authenticateRequest(
  request: NextRequest,
  options: AuthOptions = { requireAuth: true }
): Promise<AuthenticationResult> {
  try {
    const supabase = createServerClient();
    
    // Get session from Supabase
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return {
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        status: 401,
      };
    }

    // Get user from our database to include role
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
      },
    });

    if (!dbUser) {
      return {
        success: false,
        error: 'User not found in database',
        code: 'UNAUTHORIZED',
        status: 401,
      };
    }

    // Create typed session user - simplify to avoid complex type conflicts
    const sessionUser = {
      ...session.user,
      email: session.user.email || '',
      role: dbUser.role as UserRole,
    } as SessionUser;

    // Check role-based authorization
    if (options.requiredRole && dbUser.role !== options.requiredRole) {
      return {
        success: false,
        error: `Access denied. Required role: ${options.requiredRole}`,
        code: 'FORBIDDEN',
        status: 403,
      };
    }

    return {
      success: true,
      user: sessionUser,
    };
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      code: 'INVALID_TOKEN',
      status: 500,
    };
  }
}

/**
 * Higher-order function to protect API routes with authentication
 * @param handler - The API route handler function
 * @param options - Authentication options
 * @returns Protected API route handler
 */
export function withAuth<T extends NextRequest>(
  handler: (req: T, user: SessionUser) => Promise<NextResponse>,
  options: AuthOptions = {}
) {
  return async (req: T): Promise<NextResponse> => {
    const authResult = await authenticateRequest(req, options);
    
    if (!authResult.success) {
      const error = authResult as AuthError;
      return NextResponse.json(
        {
          success: false,
          error: error.error,
          code: error.code,
        },
        { status: error.status }
      );
    }

    return handler(req, authResult.user);
  };
}

/**
 * Middleware to check if user owns a project
 * @param projectId - Project ID to check ownership
 * @param userId - User ID to verify ownership
 * @returns True if user owns the project or is admin
 */
export async function checkProjectOwnership(
  projectId: string,
  userId: string,
  userRole: UserRole
): Promise<boolean> {
  // Admins can access any project
  if (userRole === 'admin') {
    return true;
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    return project?.ownerId === userId;
  } catch (error) {
    console.error('Error checking project ownership:', error);
    return false;
  }
}

/**
 * Middleware to check if user can access a chat session
 * @param sessionId - Chat session ID to check access
 * @param userId - User ID to verify access
 * @returns True if user can access the session
 */
export async function checkSessionAccess(
  sessionId: string,
  userId: string,
  userRole: UserRole
): Promise<boolean> {
  // Admins can access any session
  if (userRole === 'admin') {
    return true;
  }

  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    return session?.userId === userId;
  } catch (error) {
    console.error('Error checking session access:', error);
    return false;
  }
}