/**
 * Cross-Repository Links API
 * 
 * GET /api/workspaces/[workspaceId]/cross-repo-links
 * - Get all cross-repository links in workspace
 * 
 * POST /api/workspaces/[workspaceId]/cross-repo-links
 * - Analyze cross-repo relationships
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { CrossRepoLinker } from '@/lib/multi-repo/cross-repo-linker';

/**
 * GET - Scan workspace for cross-repo links
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const params = await context.params;
    const { workspaceId } = params;

    // Verify workspace belongs to user
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Parse optional parameters
    const state = (searchParams.get('state') as 'open' | 'closed' | 'all') || 'all';
    const sinceParam = searchParams.get('since');
    const since = sinceParam ? new Date(sinceParam) : undefined;

    // Get repositories from workspace
    const repositories = (workspace.repositories as Array<{
      owner: string;
      name: string;
    }>) || [];

    if (repositories.length === 0) {
      return NextResponse.json({
        error: 'No repositories in workspace',
      }, { status: 400 });
    }

    // Get GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    
    if (!githubToken) {
      return NextResponse.json({
        error: 'GitHub token not configured',
      }, { status: 400 });
    }

    // Scan workspace for cross-repo links
    const linker = new CrossRepoLinker(githubToken, workspaceId);
    const workspaceLinks = await linker.scanWorkspace(repositories, { state, since });

    return NextResponse.json(workspaceLinks);
  } catch (error) {
    console.error('Error scanning cross-repo links:', error);
    return NextResponse.json(
      { error: 'Failed to scan cross-repo links' },
      { status: 500 }
    );
  }
}

/**
 * POST - Analyze specific cross-repo relationships
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const body = await request.json();
    const { userId, analysisType, owner, repo, number } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const params = await context.params;
    const { workspaceId } = params;

    // Verify workspace belongs to user
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get repositories from workspace
    const repositories = (workspace.repositories as Array<{
      owner: string;
      name: string;
    }>) || [];

    if (repositories.length === 0) {
      return NextResponse.json({
        error: 'No repositories in workspace',
      }, { status: 400 });
    }

    // Get GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    
    if (!githubToken) {
      return NextResponse.json({
        error: 'GitHub token not configured',
      }, { status: 400 });
    }

    const linker = new CrossRepoLinker(githubToken, workspaceId);

    switch (analysisType) {
      case 'blockers':
        if (!owner || !repo || !number) {
          return NextResponse.json(
            { error: 'owner, repo, and number required for blockers analysis' },
            { status: 400 }
          );
        }
        const blockers = await linker.findBlockers(owner, repo, number);
        return NextResponse.json({ blockers });

      case 'dependents':
        if (!owner || !repo || !number) {
          return NextResponse.json(
            { error: 'owner, repo, and number required for dependents analysis' },
            { status: 400 }
          );
        }
        const dependents = await linker.findDependents(owner, repo, number, repositories);
        return NextResponse.json({ dependents });

      case 'visualization': {
        // Get all links first
        const workspaceLinks = await linker.scanWorkspace(repositories, { state: 'all' });
        const vizData = linker.generateDependencyMap(workspaceLinks.recentLinks);
        return NextResponse.json({ visualization: vizData });
      }

      case 'create-link': {
        const { source, target, relationship } = body;
        if (!source || !target || !relationship) {
          return NextResponse.json(
            { error: 'source, target, and relationship required' },
            { status: 400 }
          );
        }
        const success = await linker.createCrossRepoLink(source, target, relationship);
        return NextResponse.json({ success });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid analysis type. Supported: blockers, dependents, visualization, create-link' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error analyzing cross-repo relationships:', error);
    return NextResponse.json(
      { error: 'Failed to analyze cross-repo relationships' },
      { status: 500 }
    );
  }
}
