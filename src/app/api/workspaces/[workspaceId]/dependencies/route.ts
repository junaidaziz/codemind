import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { DependencyGraphManager } from '@/lib/multi-repo/dependency-graph';
import { GraphAnalyzer } from '@/lib/multi-repo/graph-analyzer';
import { getUserId } from '@/lib/auth-server';

/**
 * GET - Build and return dependency graph for workspace
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
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

    // Parse URL search params
    const { searchParams } = new URL(request.url);
    const includeDevDeps = searchParams.get('includeDevDeps') === 'true';
    const includePeerDeps = searchParams.get('includePeerDeps') === 'true';
    const includeTransitive = searchParams.get('includeTransitive') === 'true';
    const maxDepth = parseInt(searchParams.get('maxDepth') || '3');

    // Get repositories from workspace
    const repositories = (workspace.repositories as Array<{
      owner: string;
      name: string;
      defaultBranch?: string;
    }>) || [];

    if (repositories.length === 0) {
      return NextResponse.json({
        error: 'No repositories in workspace',
      }, { status: 400 });
    }

    // GitHub token should be provided via environment variable or user settings
    // For now, use the environment variable GITHUB_TOKEN
    const githubToken = process.env.GITHUB_TOKEN;
    
    if (!githubToken) {
      return NextResponse.json({
        error: 'GitHub token not configured. Please set GITHUB_TOKEN environment variable.',
      }, { status: 400 });
    }

    // Build dependency graph
    const graphManager = new DependencyGraphManager(githubToken);
    const graph = await graphManager.buildDependencyGraph(
      workspaceId,
      repositories,
      {
        includeDevDependencies: includeDevDeps,
        includePeerDependencies: includePeerDeps,
        includeTransitiveDependencies: includeTransitive,
        maxDepth,
      }
    );

    // Convert Map to array for JSON serialization
    const nodes = Array.from(graph.nodes.values());

    return NextResponse.json({
      nodes,
      edges: graph.edges,
      metadata: {
        ...graph.metadata,
        generatedAt: graph.metadata.generatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error building dependency graph:', error);
    return NextResponse.json(
      { error: 'Failed to build dependency graph' },
      { status: 500 }
    );
  }
}

/**
 * POST - Analyze dependency graph and return insights
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const userId = await getUserId(request);

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { analysisType, targetNodeId } = body;

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
      defaultBranch?: string;
    }>) || [];

    if (repositories.length === 0) {
      return NextResponse.json({
        error: 'No repositories in workspace',
      }, { status: 400 });
    }

    // GitHub token should be provided via environment variable or user settings
    // For now, use the environment variable GITHUB_TOKEN
    const githubToken = process.env.GITHUB_TOKEN;
    
    if (!githubToken) {
      return NextResponse.json({
        error: 'GitHub token not configured. Please set GITHUB_TOKEN environment variable.',
      }, { status: 400 });
    }

    // Build dependency graph
    const graphManager = new DependencyGraphManager(githubToken);
    const graph = await graphManager.buildDependencyGraph(
      workspaceId,
      repositories,
      {
        includeDevDependencies: false,
        includePeerDependencies: true,
        includeTransitiveDependencies: false,
        maxDepth: 3,
      }
    );

    // Analyze graph
    const analyzer = new GraphAnalyzer(graph);

    switch (analysisType) {
      case 'cycles':
        const cycles = analyzer.detectCycles();
        return NextResponse.json({ cycles });

      case 'cross-repo':
        const crossRepoLinks = analyzer.findCrossRepoLinks();
        return NextResponse.json({ crossRepoLinks });

      case 'metrics':
        const metrics = analyzer.calculateRepositoryMetrics();
        return NextResponse.json({ metrics });

      case 'impact':
        if (!targetNodeId) {
          return NextResponse.json(
            { error: 'targetNodeId required for impact analysis' },
            { status: 400 }
          );
        }
        const impact = analyzer.analyzeImpact(targetNodeId);
        return NextResponse.json({ impact });

      case 'duplicates':
        const duplicates = analyzer.findDuplicateDependencies();
        const duplicatesArray = Array.from(duplicates.entries()).map(
          ([name, versions]) => ({ name, versions })
        );
        return NextResponse.json({ duplicates: duplicatesArray });

      case 'summary':
        const summary = analyzer.generateSummary();
        return NextResponse.json({ summary });

      case 'visualization':
        const vizData = analyzer.generateVisualizationData();
        return NextResponse.json({ visualization: vizData });

      default:
        return NextResponse.json(
          { error: 'Invalid analysis type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error analyzing dependency graph:', error);
    return NextResponse.json(
      { error: 'Failed to analyze dependency graph' },
      { status: 500 }
    );
  }
}
