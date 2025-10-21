import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceManager } from '@/lib/multi-repo/workspace-manager';

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

/**
 * GET /api/workspaces/[workspaceId]/stats?userId=xxx
 * Get workspace statistics
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
    const stats = await manager.getWorkspaceStats(workspaceId);

    if (!stats) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Failed to get workspace stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get workspace stats' 
      },
      { status: 500 }
    );
  }
}
