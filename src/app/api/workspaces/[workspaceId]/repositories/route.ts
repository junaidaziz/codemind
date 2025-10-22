import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceManager } from '@/lib/multi-repo/workspace-manager';
import { getUserId } from '@/lib/auth-server';

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

/**
 * GET /api/workspaces/[workspaceId]/repositories
 * Get all repositories in a workspace
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { workspaceId } = await context.params;
    const manager = new WorkspaceManager(userId);
    const repositories = await manager.getWorkspaceRepositories(workspaceId);

    return NextResponse.json({
      success: true,
      data: repositories,
    });
  } catch (error) {
    console.error('Failed to get workspace repositories:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get workspace repositories' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces/[workspaceId]/repositories
 * Add, remove, or sync repositories in a workspace
 * 
 * Body: {
 *   action: 'add' | 'remove' | 'sync';
 *   owner: string; // For add/remove/sync
 *   name: string; // For add/remove/sync
 * }
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { workspaceId } = await context.params;
    const body = await request.json();
    const { action, owner, name } = body;

    if (!action || !['add', 'remove', 'sync'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Valid action is required (add, remove, or sync)' },
        { status: 400 }
      );
    }

    if (!owner || !name) {
      return NextResponse.json(
        { success: false, error: 'Owner and name are required' },
        { status: 400 }
      );
    }

    const manager = new WorkspaceManager(userId);
    let result;

    switch (action) {
      case 'add':
        // Add repository with format owner/name
        result = await manager.addRepositories(workspaceId, [`${owner}/${name}`]);
        break;
      case 'remove':
        // Remove repository - repositoryId is in format owner/name
        result = await manager.removeRepository(workspaceId, `${owner}/${name}`);
        break;
      case 'sync':
        // Sync repository data
        // For now, just return success - actual sync logic can be implemented later
        result = { success: true, message: 'Repository synced successfully' };
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to process repository action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process repository action' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]/repositories?repositoryId=xxx
 * Remove a repository from a workspace
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { workspaceId } = await context.params;
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get('repositoryId');

    if (!repositoryId) {
      return NextResponse.json(
        { success: false, error: 'Repository ID is required' },
        { status: 400 }
      );
    }

    const manager = new WorkspaceManager(userId);
    const result = await manager.removeRepository(workspaceId, repositoryId);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to remove repository:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to remove repository' 
      },
      { status: 500 }
    );
  }
}
