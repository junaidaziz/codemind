/**
 * GitHub Checks API Route
 * 
 * POST /api/testing/checks - Create check run for test results
 * PUT /api/testing/checks/:id - Update existing check run
 * GET /api/testing/checks - List check runs for ref
 */

import { NextRequest, NextResponse } from 'next/server';
import { GitHubChecksService, type TestExecutionResult } from '@/lib/testing/github-checks-service';
import { type BatchGenerationResult } from '@/lib/testing/test-generation-orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      githubToken, 
      owner, 
      repo, 
      headSha, 
      type, 
      result 
    } = body;

    if (!githubToken || !owner || !repo || !headSha || !type || !result) {
      return NextResponse.json(
        { error: 'Missing required fields: githubToken, owner, repo, headSha, type, result' },
        { status: 400 }
      );
    }

    const checksService = new GitHubChecksService(githubToken, owner, repo);

    let checkRunId: number;

    switch (type) {
      case 'test-execution':
        checkRunId = await checksService.createTestExecutionCheck(
          headSha,
          result as TestExecutionResult
        );
        break;

      case 'test-generation':
        checkRunId = await checksService.createTestGenerationCheck(
          headSha,
          result as BatchGenerationResult
        );
        break;

      case 'coverage':
        checkRunId = await checksService.createCoverageCheck(
          headSha,
          result
        );
        break;

      default:
        return NextResponse.json(
          { error: `Invalid check type: ${type}. Must be one of: test-execution, test-generation, coverage` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      checkRunId,
      message: `${type} check created successfully`,
    });
  } catch (error) {
    console.error('GitHub checks creation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create GitHub check',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      githubToken,
      owner,
      repo,
      checkRunId,
      status,
      conclusion,
      output,
    } = body;

    if (!githubToken || !owner || !repo || !checkRunId) {
      return NextResponse.json(
        { error: 'Missing required fields: githubToken, owner, repo, checkRunId' },
        { status: 400 }
      );
    }

    const checksService = new GitHubChecksService(githubToken, owner, repo);

    await checksService.updateCheckRun(
      checkRunId,
      status,
      conclusion,
      output
    );

    return NextResponse.json({
      success: true,
      message: 'Check run updated successfully',
    });
  } catch (error) {
    console.error('GitHub checks update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update GitHub check',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const githubToken = searchParams.get('githubToken');
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const ref = searchParams.get('ref');

    if (!githubToken || !owner || !repo || !ref) {
      return NextResponse.json(
        { error: 'Missing required query parameters: githubToken, owner, repo, ref' },
        { status: 400 }
      );
    }

    const checksService = new GitHubChecksService(githubToken, owner, repo);

    const checkRuns = await checksService.listCheckRuns(ref);

    return NextResponse.json({
      success: true,
      checkRuns,
    });
  } catch (error) {
    console.error('GitHub checks list error:', error);
    return NextResponse.json(
      {
        error: 'Failed to list GitHub checks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
