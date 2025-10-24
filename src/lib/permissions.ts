// Project role type
export type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER'

/**
 * Permission actions that can be performed on projects
 */
export enum Permission {
  // Project permissions
  PROJECT_VIEW = 'project:view',
  PROJECT_EDIT = 'project:edit',
  PROJECT_DELETE = 'project:delete',
  PROJECT_SETTINGS = 'project:settings',
  
  // Member permissions
  MEMBER_VIEW = 'member:view',
  MEMBER_INVITE = 'member:invite',
  MEMBER_REMOVE = 'member:remove',
  MEMBER_EDIT_ROLE = 'member:edit_role',
  
  // Content permissions
  CONTENT_VIEW = 'content:view',
  CONTENT_CREATE = 'content:create',
  CONTENT_EDIT = 'content:edit',
  CONTENT_DELETE = 'content:delete',
  
  // Invitation permissions
  INVITATION_CREATE = 'invitation:create',
  INVITATION_REVOKE = 'invitation:revoke',
  INVITATION_RESEND = 'invitation:resend',
  
  // Analytics permissions
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',
}

/**
 * Role hierarchy and permission mapping
 */
export const ROLE_PERMISSIONS: Record<ProjectRole, Permission[]> = {
  OWNER: [
    // Owner has all permissions
    Permission.PROJECT_VIEW,
    Permission.PROJECT_EDIT,
    Permission.PROJECT_DELETE,
    Permission.PROJECT_SETTINGS,
    Permission.MEMBER_VIEW,
    Permission.MEMBER_INVITE,
    Permission.MEMBER_REMOVE,
    Permission.MEMBER_EDIT_ROLE,
    Permission.CONTENT_VIEW,
    Permission.CONTENT_CREATE,
    Permission.CONTENT_EDIT,
    Permission.CONTENT_DELETE,
    Permission.INVITATION_CREATE,
    Permission.INVITATION_REVOKE,
    Permission.INVITATION_RESEND,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_EXPORT,
  ],
  EDITOR: [
    // Editor can view and edit, but not manage members or delete
    Permission.PROJECT_VIEW,
    Permission.PROJECT_EDIT,
    Permission.MEMBER_VIEW,
    Permission.CONTENT_VIEW,
    Permission.CONTENT_CREATE,
    Permission.CONTENT_EDIT,
    Permission.CONTENT_DELETE,
    Permission.ANALYTICS_VIEW,
  ],
  VIEWER: [
    // Viewer can only view
    Permission.PROJECT_VIEW,
    Permission.MEMBER_VIEW,
    Permission.CONTENT_VIEW,
    Permission.ANALYTICS_VIEW,
  ],
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: ProjectRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission)
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: ProjectRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission))
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: ProjectRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission))
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: ProjectRole): Permission[] {
  return ROLE_PERMISSIONS[role]
}

/**
 * Check if a role can perform an action on another role
 * (e.g., only owners can remove other owners)
 */
export function canManageRole(managerRole: ProjectRole, targetRole: ProjectRole): boolean {
  // Only owners can manage owners
  if (targetRole === 'OWNER') {
    return managerRole === 'OWNER'
  }
  
  // Owners and editors can manage viewers and editors
  if (managerRole === 'OWNER') {
    return true
  }
  
  return false
}

/**
 * Role hierarchy levels (higher number = more permissions)
 */
export const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
}

/**
 * Check if one role is higher than another in the hierarchy
 */
export function isRoleHigher(role1: ProjectRole, role2: ProjectRole): boolean {
  return ROLE_HIERARCHY[role1] > ROLE_HIERARCHY[role2]
}

/**
 * Get the minimum role required for a permission
 */
export function getMinimumRoleForPermission(permission: Permission): ProjectRole {
  if (ROLE_PERMISSIONS.VIEWER.includes(permission)) {
    return 'VIEWER'
  }
  if (ROLE_PERMISSIONS.EDITOR.includes(permission)) {
    return 'EDITOR'
  }
  return 'OWNER'
}
