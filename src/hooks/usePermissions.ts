'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { Permission, ProjectRole, hasPermission, getRolePermissions } from '@/lib/permissions'

/**
 * Hook to get user's role in a project
 */
export function useProjectRole(projectId: string | null) {
  const { data: session, status } = useSession()
  const [role, setRole] = useState<ProjectRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If no projectId or still loading session, don't fetch
    if (!projectId) {
      setLoading(false)
      return
    }
    
    if (status === 'loading') {
      setLoading(true)
      return
    }
    
    // If not authenticated, user has no role
    if (!session?.user?.id) {
      setLoading(false)
      setRole(null)
      return
    }

    async function fetchRole() {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(`/api/projects/${projectId}/members/me`)
        
        if (!response.ok) {
          if (response.status === 404) {
            setRole(null)
            return
          }
          throw new Error('Failed to fetch role')
        }
        
        const data = await response.json()
        setRole(data.role)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch role')
        setRole(null)
      } finally {
        setLoading(false)
      }
    }

    fetchRole()
  }, [projectId, session?.user?.id, status])

  return { role, loading, error, isAuthenticated: !!session }
}

/**
 * Hook to check if user has a specific permission in a project
 */
export function useProjectPermission(projectId: string | null, permission: Permission) {
  const { role, loading, error } = useProjectRole(projectId)
  
  const hasAccess = role ? hasPermission(role, permission) : false
  
  return { hasAccess, loading, error, role }
}

/**
 * Hook to check if user is a project owner
 */
export function useIsProjectOwner(projectId: string | null) {
  const { role, loading, error } = useProjectRole(projectId)
  
  return {
    isOwner: role === 'OWNER',
    loading,
    error,
    role,
  }
}

/**
 * Hook to check if user is a project member
 */
export function useIsProjectMember(projectId: string | null) {
  const { role, loading, error } = useProjectRole(projectId)
  
  return {
    isMember: role !== null,
    loading,
    error,
    role,
  }
}

/**
 * Hook to get all permissions for user's role
 */
export function useProjectPermissions(projectId: string | null) {
  const { role, loading, error } = useProjectRole(projectId)
  
  return {
    permissions: role ? getRolePermissions(role) : [],
    loading,
    error,
    role,
  }
}
