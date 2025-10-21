import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceManager } from '@/lib/multi-repo/workspace-manager';
import type { WorkspaceSettings } from '@/lib/multi-repo/types';

/**
 * GET /api/workspaces?userId=xxx
 * List all workspaces for the specified user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const manager = new WorkspaceManager(userId);
    const workspaces = await manager.listWorkspaces();

    return NextResponse.json({
      success: true,
      data: workspaces,
    });
  } catch (error) {
    console.error('Failed to list workspaces:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to list workspaces' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces
 * Create a new workspace
 * 
 * Body: {
 *   userId: string;
 *   name: string;
 *   description?: string;
 *   settings?: WorkspaceSettings;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, description, settings } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'User ID is required and must be a string' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Name is required and must be a string' },
        { status: 400 }
      );
    }

    const manager = new WorkspaceManager(userId);
    const workspace = await manager.createWorkspace(
      name,
      description,
      settings as WorkspaceSettings
    );

    return NextResponse.json({
      success: true,
      data: workspace,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create workspace:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create workspace' 
      },
      { status: 500 }
    );
  }
}
