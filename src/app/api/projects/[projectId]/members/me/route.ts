import { NextRequest } from 'next/server'
import { getCurrentUser, getUserProjectRole } from '@/lib/auth-guards'

/**
 * GET /api/projects/[projectId]/members/me
 * Get current user's membership info in a project
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await getCurrentUser()
    const { projectId } = await params

    if (!projectId) {
      return Response.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const role = await getUserProjectRole(user.id, projectId)

    if (!role) {
      return Response.json(
        { error: 'Not a member of this project' },
        { status: 404 }
      )
    }

    return Response.json({
      userId: user.id,
      projectId,
      role,
    })
  } catch (error) {
    console.error('Error getting project membership:', error)
    
    if (error instanceof Error && error.message === 'Not authenticated') {
      return Response.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
