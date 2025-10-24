'use client'

import { ReactNode } from 'react'
import { Permission, ProjectRole } from '@/lib/permissions'
import { useProjectPermission, useProjectRole, useIsProjectOwner } from '@/hooks/usePermissions'

interface RequirePermissionProps {
  projectId: string
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
  loadingFallback?: ReactNode
}

/**
 * Component that only renders children if user has the required permission
 */
export function RequirePermission({
  projectId,
  permission,
  children,
  fallback = null,
  loadingFallback = null,
}: RequirePermissionProps) {
  const { hasAccess, loading } = useProjectPermission(projectId, permission)

  if (loading) {
    return <>{loadingFallback}</>
  }

  return <>{hasAccess ? children : fallback}</>
}

interface RequireRoleProps {
  projectId: string
  role: ProjectRole
  children: ReactNode
  fallback?: ReactNode
  loadingFallback?: ReactNode
}

/**
 * Component that only renders children if user has the required role or higher
 */
export function RequireRole({
  projectId,
  role: requiredRole,
  children,
  fallback = null,
  loadingFallback = null,
}: RequireRoleProps) {
  const { role, loading } = useProjectRole(projectId)

  if (loading) {
    return <>{loadingFallback}</>
  }

  const roleHierarchy: Record<ProjectRole, number> = {
    VIEWER: 1,
    EDITOR: 2,
    OWNER: 3,
  }

  const hasRequiredRole = role && roleHierarchy[role] >= roleHierarchy[requiredRole]

  return <>{hasRequiredRole ? children : fallback}</>
}

interface RequireOwnerProps {
  projectId: string
  children: ReactNode
  fallback?: ReactNode
  loadingFallback?: ReactNode
}

/**
 * Component that only renders children if user is project owner
 */
export function RequireOwner({
  projectId,
  children,
  fallback = null,
  loadingFallback = null,
}: RequireOwnerProps) {
  const { isOwner, loading } = useIsProjectOwner(projectId)

  if (loading) {
    return <>{loadingFallback}</>
  }

  return <>{isOwner ? children : fallback}</>
}

interface ShowForRoleProps {
  projectId: string
  roles: ProjectRole[]
  children: ReactNode
  fallback?: ReactNode
  loadingFallback?: ReactNode
}

/**
 * Component that renders children only for specific roles
 */
export function ShowForRole({
  projectId,
  roles,
  children,
  fallback = null,
  loadingFallback = null,
}: ShowForRoleProps) {
  const { role, loading } = useProjectRole(projectId)

  if (loading) {
    return <>{loadingFallback}</>
  }

  const hasRole = role && roles.includes(role)

  return <>{hasRole ? children : fallback}</>
}
