import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import db from '@/lib/db'
import { Permission, hasPermission, ProjectRole } from './permissions'

/**
 * Error class for authorization failures
 */
export class AuthorizationError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

/**
 * Get the current authenticated user session
 */
export async function getCurrentUser() {
  const session = await auth()
  
  if (!session?.user?.id) {
    throw new AuthorizationError('Not authenticated', 401)
  }
  
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  }
}

/**
 * Get user's role in a project
 */
export async function getUserProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  // @ts-expect-error - Prisma client type may not be fully regenerated
  const member = await db.projectMember.findFirst({
    where: {
      userId,
      projectId,
    },
    select: {
      role: true,
    },
  })
  
  return member?.role || null
}

/**
 * Check if user is a member of a project
 */
export async function isProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId)
  return role !== null
}

/**
 * Check if user has a specific permission in a project
 */
export async function userHasPermission(
  userId: string,
  projectId: string,
  permission: Permission
): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId)
  
  if (!role) {
    return false
  }
  
  return hasPermission(role, permission)
}

/**
 * Require authentication (throws if not authenticated)
 */
export async function requireAuth() {
  return await getCurrentUser()
}

/**
 * Require specific project membership (throws if not a member)
 */
export async function requireProjectMember(projectId: string) {
  const user = await getCurrentUser()
  const role = await getUserProjectRole(user.id, projectId)
  
  if (!role) {
    throw new AuthorizationError('Not a member of this project', 403)
  }
  
  return { user, role }
}

/**
 * Require specific permission in a project (throws if permission denied)
 */
export async function requirePermission(
  projectId: string,
  permission: Permission
) {
  const { user, role } = await requireProjectMember(projectId)
  
  if (!hasPermission(role, permission)) {
    throw new AuthorizationError(
      `Permission denied: ${permission} required`,
      403
    )
  }
  
  return { user, role }
}

/**
 * Require specific role in a project (throws if role not met)
 */
export async function requireRole(
  projectId: string,
  requiredRole: ProjectRole
) {
  const { user, role } = await requireProjectMember(projectId)
  
  const roleHierarchy: Record<ProjectRole, number> = {
    VIEWER: 1,
    EDITOR: 2,
    OWNER: 3,
  }
  
  if (roleHierarchy[role] < roleHierarchy[requiredRole]) {
    throw new AuthorizationError(
      `Role ${requiredRole} or higher required`,
      403
    )
  }
  
  return { user, role }
}

/**
 * Check if user owns a project
 */
export async function isProjectOwner(
  userId: string,
  projectId: string
): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId)
  return role === 'OWNER'
}

/**
 * Require project ownership (throws if not owner)
 */
export async function requireProjectOwner(projectId: string) {
  const user = await getCurrentUser()
  const isOwner = await isProjectOwner(user.id, projectId)
  
  if (!isOwner) {
    throw new AuthorizationError('Project owner access required', 403)
  }
  
  return { user, role: 'OWNER' as ProjectRole }
}

/**
 * Get user's organization role (if organizations are implemented)
 */
export async function getUserOrgRole(
  userId: string,
  orgId: string
): Promise<'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'MEMBER' | null> {
  const member = await db.organizationMember.findFirst({
    where: {
      userId,
      organizationId: orgId,
    },
    select: {
      role: true,
    },
  })
  
  return member?.role || null
}

/**
 * Helper to handle authorization errors in API routes
 */
export function handleAuthError(error: unknown) {
  if (error instanceof AuthorizationError) {
    return Response.json(
      { error: error.message },
      { status: error.statusCode }
    )
  }
  
  console.error('Authorization error:', error)
  return Response.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}

/**
 * Middleware wrapper for API routes with authorization
 */
export function withAuth(
  handler: (req: NextRequest, context: { user: Awaited<ReturnType<typeof getCurrentUser>> }) => Promise<Response>
) {
  return async (req: NextRequest) => {
    try {
      const user = await getCurrentUser()
      return await handler(req, { user })
    } catch (error) {
      return handleAuthError(error)
    }
  }
}

/**
 * Middleware wrapper for API routes with project permission check
 */
export function withProjectPermission(
  projectIdParam: string,
  permission: Permission,
  handler: (
    req: NextRequest,
    context: {
      user: Awaited<ReturnType<typeof getCurrentUser>>
      role: ProjectRole
      projectId: string
    }
  ) => Promise<Response>
) {
  return async (req: NextRequest, routeContext?: { params?: Record<string, string> }) => {
    try {
      const projectId = routeContext?.params?.[projectIdParam]
      
      if (!projectId) {
        return Response.json(
          { error: 'Project ID is required' },
          { status: 400 }
        )
      }
      
      const { user, role } = await requirePermission(projectId, permission)
      
      return await handler(req, { user, role, projectId })
    } catch (error) {
      return handleAuthError(error)
    }
  }
}
