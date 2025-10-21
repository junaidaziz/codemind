/**
 * GitHub Actions Integration API
 * 
 * REST API endpoints for GitHub Actions workflow integration,
 * including workflow run fetching, error analysis, and AI-powered
 * summarization.
 * 
 * Endpoints:
 * - GET: Fetch workflow runs for workspace
 * - POST: Analyze workflow runs with AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { ActionsIntegrator } from '@/lib/multi-repo/actions-integrator';
import { ActionsAnalyzer } from '@/lib/multi-repo/actions-analyzer';
import prisma from '@/lib/db';

/**
 * GET handler - Fetch workflow runs for workspace
 * 
 * Query Parameters:
 * - status: Filter by workflow status (queued, in_progress, completed)
 * - branch: Filter by branch name
 * - event: Filter by event type (push, pull_request, etc.)
 * - limit: Maximum number of runs to return (default: 20)
 * - failed_only: Only return failed runs (default: false)
 * 
 * @param request - Next.js request object
 * @param params - URL parameters with workspaceId
 * @returns Workflow runs and summary
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    // Extract user ID from request (you'll need to implement auth)
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 401 }
      );
    }

    // Verify workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    // Get GitHub token from environment
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    // Initialize integrator
    const integrator = new ActionsIntegrator(githubToken);

    // Parse query parameters
    const status = searchParams.get('status') as 'queued' | 'in_progress' | 'completed' | undefined;
    const branch = searchParams.get('branch') || undefined;
    const event = searchParams.get('event') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const failedOnly = searchParams.get('failed_only') === 'true';

    // Fetch workflow runs
    if (failedOnly) {
      const failedRuns = await integrator.getFailedRuns(workspaceId, limit);
      return NextResponse.json({
        runs: failedRuns,
        total: failedRuns.length,
        filtered: true,
      });
    } else {
      const summary = await integrator.scanWorkspace(workspaceId, {
        status,
        branch,
        event,
        per_page: limit,
      });

      return NextResponse.json(summary);
    }
  } catch (error) {
    console.error('Error fetching workflow runs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow runs', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST handler - Analyze workflow runs with AI
 * 
 * Request Body:
 * {
 *   "analysisType": "run" | "failed_runs" | "trends" | "health",
 *   "owner"?: string,          // Required for "run" analysis
 *   "repo"?: string,           // Required for "run" analysis
 *   "runId"?: number,          // Required for "run" analysis
 *   "limit"?: number           // For "failed_runs" analysis
 * }
 * 
 * Analysis Types:
 * - run: Analyze a specific workflow run with AI
 * - failed_runs: Analyze recent failed runs
 * - trends: Analyze failure trends over time
 * - health: Calculate build health metrics
 * 
 * @param request - Next.js request object
 * @param params - URL parameters with workspaceId
 * @returns Analysis results
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const body = await request.json();
    const { analysisType, owner, repo, runId, limit } = body;

    // Extract user ID from request
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 401 }
      );
    }

    // Verify workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    // Get tokens from environment
    const githubToken = process.env.GITHUB_TOKEN;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    // Initialize integrator and analyzer
    const integrator = new ActionsIntegrator(githubToken);
    const analyzer = new ActionsAnalyzer(openaiApiKey);

    switch (analysisType) {
      case 'run': {
        // Analyze a specific workflow run
        if (!owner || !repo || !runId) {
          return NextResponse.json(
            { error: 'owner, repo, and runId are required for run analysis' },
            { status: 400 }
          );
        }

        // Fetch run details
        const { run, jobs, logs } = await integrator.getRunDetails(
          owner,
          repo,
          runId
        );

        // Analyze with AI
        const analysis = await analyzer.analyzeRun(run, jobs, logs);

        return NextResponse.json({
          analysisType: 'run',
          result: analysis,
        });
      }

      case 'failed_runs': {
        // Analyze recent failed runs
        const runLimit = limit || 5;
        const failedRuns = await integrator.getFailedRuns(workspaceId, runLimit);

        const analyses = [];
        for (const run of failedRuns) {
          try {
            const { jobs, logs } = await integrator.getRunDetails(
              run.repository.owner,
              run.repository.name,
              run.id
            );
            const analysis = await analyzer.analyzeRun(run, jobs, logs);
            analyses.push(analysis);
          } catch (error) {
            console.error(`Error analyzing run ${run.id}:`, error);
          }
        }

        return NextResponse.json({
          analysisType: 'failed_runs',
          result: {
            total_analyzed: analyses.length,
            analyses,
          },
        });
      }

      case 'trends': {
        // Analyze failure trends
        const summary = await integrator.scanWorkspace(workspaceId, {
          per_page: 100,
        });

        const trends = analyzer.analyzeFailureTrends(summary.recent_runs);

        return NextResponse.json({
          analysisType: 'trends',
          result: {
            trends,
            summary: {
              total_runs: summary.total_runs,
              failed_runs: summary.failed_runs,
              success_rate: summary.total_runs > 0
                ? (summary.successful_runs / summary.total_runs) * 100
                : 0,
            },
          },
        });
      }

      case 'health': {
        // Calculate build health metrics
        const summary = await integrator.scanWorkspace(workspaceId, {
          per_page: 100,
        });

        // Analyze recent failed runs for error categorization
        const failedRuns = await integrator.getFailedRuns(workspaceId, 10);
        const analyzedRuns = [];

        for (const run of failedRuns) {
          try {
            const { jobs, logs } = await integrator.getRunDetails(
              run.repository.owner,
              run.repository.name,
              run.id
            );
            const analysis = await analyzer.analyzeRun(run, jobs, logs);
            analyzedRuns.push(analysis);
          } catch (error) {
            console.error(`Error analyzing run ${run.id}:`, error);
          }
        }

        const health = analyzer.calculateBuildHealth(
          summary.recent_runs,
          analyzedRuns
        );

        return NextResponse.json({
          analysisType: 'health',
          result: health,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown analysis type: ${analysisType}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error analyzing workflow runs:', error);
    return NextResponse.json(
      { error: 'Failed to analyze workflow runs', details: String(error) },
      { status: 500 }
    );
  }
}
