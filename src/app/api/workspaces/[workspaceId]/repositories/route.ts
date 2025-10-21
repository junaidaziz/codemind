import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceManager } from '@/lib/multi-repo/workspace-manager';

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

/**
 * GET /api/workspaces/[workspaceId]/repositories?userId=xxx
 * Get all repositories in a workspace
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { workspaceId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

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
 * Add repositories to a workspace
 * 
 * Body: {
 *   userId: string;
 *   repositories: string[]; // Array of repository full names
 * }
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { workspaceId } = await context.params;
    const body = await request.json();
    const { userId, repositories } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'User ID is required and must be a string' },
        { status: 400 }
      );
    }

    if (!repositories || !Array.isArray(repositories) || repositories.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Repositories array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!repositories.every((r: unknown) => typeof r === 'string')) {
      return NextResponse.json(
        { success: false, error: 'All repositories must be strings (repository full names)' },
        { status: 400 }
      );
    }

    const manager = new WorkspaceManager(userId);
    const result = await manager.addRepositories(workspaceId, repositories as string[]);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to add repositories:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add repositories' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]/repositories?userId=xxx&repositoryId=xxx
 * Remove a repository from a workspace
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { workspaceId } = await context.params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const repositoryId = searchParams.get('repositoryId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

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
