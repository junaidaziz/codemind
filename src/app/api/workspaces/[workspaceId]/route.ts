import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceManager } from '@/lib/multi-repo/workspace-manager';
import { getUserId } from '@/lib/auth-server';
import type { WorkspaceSettings } from '@/lib/multi-repo/types';

type RouteContext = {
  params: Promise<{ workspaceId: string }>;
};

/**
 * GET /api/workspaces/[workspaceId]
 * Get a specific workspace by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { workspaceId } = await context.params;
    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const manager = new WorkspaceManager(userId);
    const workspace = await manager.getWorkspace(workspaceId);

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      workspace: workspace,
    });
  } catch (error) {
    console.error('Failed to get workspace:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get workspace' 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspaces/[workspaceId]
 * Update a workspace
 * 
 * Body: {
 *   name?: string;
 *   description?: string;
 *   settings?: Partial<WorkspaceSettings>;
 * }
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { workspaceId } = await context.params;
    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, settings } = body;

    const manager = new WorkspaceManager(userId);
    const result = await manager.updateWorkspace(workspaceId, {
      name,
      description,
      settings: settings as Partial<WorkspaceSettings>,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to update workspace:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update workspace' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspaces/[workspaceId]
 * Delete a workspace
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { workspaceId } = await context.params;
    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const manager = new WorkspaceManager(userId);
    const result = await manager.deleteWorkspace(workspaceId);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to delete workspace:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete workspace' 
      },
      { status: 500 }
    );
  }
}
