# Permission System Usage Guide

This guide shows how to use the permission system in your application.

## Table of Contents

1. [Permission Types](#permission-types)
2. [Server-Side Usage](#server-side-usage)
3. [Client-Side Usage](#client-side-usage)
4. [API Route Protection](#api-route-protection)
5. [UI Component Guards](#ui-component-guards)

## Permission Types

The system supports three roles with hierarchical permissions:

### Roles
- **OWNER**: Full access to everything
- **EDITOR**: Can view and edit, but not manage members or delete
- **VIEWER**: Read-only access

### Permissions
```typescript
import { Permission } from '@/lib/permissions'

// Project permissions
Permission.PROJECT_VIEW
Permission.PROJECT_EDIT
Permission.PROJECT_DELETE
Permission.PROJECT_SETTINGS

// Member permissions
Permission.MEMBER_VIEW
Permission.MEMBER_INVITE
Permission.MEMBER_REMOVE
Permission.MEMBER_EDIT_ROLE

// Content permissions
Permission.CONTENT_VIEW
Permission.CONTENT_CREATE
Permission.CONTENT_EDIT
Permission.CONTENT_DELETE

// Invitation permissions
Permission.INVITATION_CREATE
Permission.INVITATION_REVOKE
Permission.INVITATION_RESEND

// Analytics permissions
Permission.ANALYTICS_VIEW
Permission.ANALYTICS_EXPORT
```

## Server-Side Usage

### Basic Authentication

```typescript
import { requireAuth, getCurrentUser } from '@/lib/auth-guards'

export async function GET(req: NextRequest) {
  try {
    // Just check if user is authenticated
    const user = await requireAuth()
    
    return Response.json({ user })
  } catch (error) {
    return handleAuthError(error)
  }
}
```

### Check Project Membership

```typescript
import { requireProjectMember } from '@/lib/auth-guards'

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Require user to be a member of the project
    const { user, role } = await requireProjectMember(params.projectId)
    
    return Response.json({ user, role })
  } catch (error) {
    return handleAuthError(error)
  }
}
```

### Check Specific Permission

```typescript
import { requirePermission, Permission } from '@/lib/auth-guards'

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Require user to have PROJECT_EDIT permission
    const { user, role } = await requirePermission(
      params.projectId,
      Permission.PROJECT_EDIT
    )
    
    // User has permission, proceed with edit
    // ...
    
    return Response.json({ success: true })
  } catch (error) {
    return handleAuthError(error)
  }
}
```

### Check Role

```typescript
import { requireRole } from '@/lib/auth-guards'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Require user to be at least an EDITOR
    const { user, role } = await requireRole(params.projectId, 'EDITOR')
    
    return Response.json({ success: true })
  } catch (error) {
    return handleAuthError(error)
  }
}
```

### Require Owner

```typescript
import { requireProjectOwner } from '@/lib/auth-guards'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Only owners can delete projects
    const { user } = await requireProjectOwner(params.projectId)
    
    // Delete project...
    
    return Response.json({ success: true })
  } catch (error) {
    return handleAuthError(error)
  }
}
```

### Using Middleware Wrappers

```typescript
import { withAuth, withProjectPermission, Permission } from '@/lib/auth-guards'

// Simple auth wrapper
export const GET = withAuth(async (req, { user }) => {
  return Response.json({ user })
})

// Permission-based wrapper
export const POST = withProjectPermission(
  'projectId', // param name
  Permission.PROJECT_EDIT,
  async (req, { user, role, projectId }) => {
    // User has permission
    return Response.json({ success: true, user, role })
  }
)
```

## Client-Side Usage

### Using Hooks

```typescript
import { useProjectRole, useProjectPermission, useIsProjectOwner } from '@/hooks/usePermissions'
import { Permission } from '@/lib/permissions'

function MyComponent({ projectId }: { projectId: string }) {
  // Get user's role
  const { role, loading, error } = useProjectRole(projectId)
  
  // Check specific permission
  const { hasAccess } = useProjectPermission(projectId, Permission.PROJECT_EDIT)
  
  // Check if owner
  const { isOwner } = useIsProjectOwner(projectId)
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      <p>Your role: {role}</p>
      {hasAccess && <button>Edit Project</button>}
      {isOwner && <button>Delete Project</button>}
    </div>
  )
}
```

## UI Component Guards

### RequirePermission Component

```tsx
import { RequirePermission } from '@/components/auth/PermissionGuards'
import { Permission } from '@/lib/permissions'

function ProjectSettings({ projectId }: { projectId: string }) {
  return (
    <RequirePermission
      projectId={projectId}
      permission={Permission.PROJECT_SETTINGS}
      fallback={<div>You don't have permission to view settings</div>}
      loadingFallback={<div>Loading...</div>}
    >
      <SettingsPanel projectId={projectId} />
    </RequirePermission>
  )
}
```

### RequireRole Component

```tsx
import { RequireRole } from '@/components/auth/PermissionGuards'

function EditorTools({ projectId }: { projectId: string }) {
  return (
    <RequireRole
      projectId={projectId}
      role="EDITOR"
      fallback={<div>Editor role required</div>}
    >
      <EditorToolbar projectId={projectId} />
    </RequireRole>
  )
}
```

### RequireOwner Component

```tsx
import { RequireOwner } from '@/components/auth/PermissionGuards'

function DangerZone({ projectId }: { projectId: string }) {
  return (
    <RequireOwner
      projectId={projectId}
      fallback={<div>Owner access only</div>}
    >
      <button className="danger">Delete Project</button>
    </RequireOwner>
  )
}
```

### ShowForRole Component

```tsx
import { ShowForRole } from '@/components/auth/PermissionGuards'

function ProjectHeader({ projectId }: { projectId: string }) {
  return (
    <div>
      <h1>Project</h1>
      
      {/* Show for owners only */}
      <ShowForRole projectId={projectId} roles={['OWNER']}>
        <button>Transfer Ownership</button>
      </ShowForRole>
      
      {/* Show for owners and editors */}
      <ShowForRole projectId={projectId} roles={['OWNER', 'EDITOR']}>
        <button>Edit Project</button>
      </ShowForRole>
      
      {/* Show for all members */}
      <ShowForRole projectId={projectId} roles={['OWNER', 'EDITOR', 'VIEWER']}>
        <p>You are a member of this project</p>
      </ShowForRole>
    </div>
  )
}
```

## API Route Protection

### Complete Example

```typescript
// src/app/api/projects/[projectId]/route.ts
import { NextRequest } from 'next/server'
import { requirePermission, requireProjectOwner, handleAuthError, Permission } from '@/lib/auth-guards'
import db from '@/lib/db'

// GET - View project (requires VIEW permission)
export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { user } = await requirePermission(
      params.projectId,
      Permission.PROJECT_VIEW
    )
    
    const project = await db.project.findUnique({
      where: { id: params.projectId },
    })
    
    return Response.json(project)
  } catch (error) {
    return handleAuthError(error)
  }
}

// PATCH - Edit project (requires EDIT permission)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { user } = await requirePermission(
      params.projectId,
      Permission.PROJECT_EDIT
    )
    
    const body = await req.json()
    
    const project = await db.project.update({
      where: { id: params.projectId },
      data: body,
    })
    
    return Response.json(project)
  } catch (error) {
    return handleAuthError(error)
  }
}

// DELETE - Delete project (requires OWNER role)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    await requireProjectOwner(params.projectId)
    
    await db.project.delete({
      where: { id: params.projectId },
    })
    
    return Response.json({ success: true })
  } catch (error) {
    return handleAuthError(error)
  }
}
```

## Error Handling

All authorization functions throw `AuthorizationError` with appropriate status codes:

- **401**: Not authenticated
- **403**: Authenticated but lacks permission
- **404**: Project not found or not a member

Use `handleAuthError()` to convert these to proper responses:

```typescript
import { handleAuthError } from '@/lib/auth-guards'

try {
  // ... protected code
} catch (error) {
  return handleAuthError(error) // Returns Response with proper status
}
```

## Best Practices

1. **Always use permission checks on API routes** - Never trust client-side checks alone
2. **Use the most specific check** - Prefer `requirePermission` over `requireRole` when checking for specific actions
3. **Provide meaningful fallbacks** - Show users why they can't access something
4. **Handle loading states** - Always show loading indicators while checking permissions
5. **Test all roles** - Ensure your permission checks work for all three roles

## Permission Matrix

| Action | Owner | Editor | Viewer |
|--------|-------|--------|--------|
| View project | ✅ | ✅ | ✅ |
| Edit project | ✅ | ✅ | ❌ |
| Delete project | ✅ | ❌ | ❌ |
| View members | ✅ | ✅ | ✅ |
| Invite members | ✅ | ❌ | ❌ |
| Remove members | ✅ | ❌ | ❌ |
| Edit roles | ✅ | ❌ | ❌ |
| View content | ✅ | ✅ | ✅ |
| Create content | ✅ | ✅ | ❌ |
| Edit content | ✅ | ✅ | ❌ |
| Delete content | ✅ | ✅ | ❌ |
| View analytics | ✅ | ✅ | ✅ |
| Export analytics | ✅ | ❌ | ❌ |
