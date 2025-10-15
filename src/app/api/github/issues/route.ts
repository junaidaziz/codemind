import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '../../../../lib/auth-server';
// import { GitHubService } from '../../../../lib/github-service'; // Unused import
import prisma from '../../../lib/db';
import { createApiSuccess, createApiError } from '../../../../types';
import { getGitHubToken } from '../../../../lib/config-helper';

export async function GET(request: NextRequest) {
  try {
    console.log('GitHub Issues API called');

    // Get authenticated user - uses development fallback if needed
    const userId = await getUserId(request);
    console.log('Authenticated user ID:', userId);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(createApiError('Project ID is required', 'VALIDATION_ERROR'), { status: 400 });
    }

    // Get issues from database
    const issues = await prisma.issue.findMany({
      where: {
        projectId: projectId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Define shape with backward compatible field
    type IssueWithCompatibility = typeof issues[number] & { aiFixAttempt?: string | null };
    const enhanced: IssueWithCompatibility[] = issues.map(issue => {
      // Prefer new persistent field aiFixPrUrl; fall back to legacy aiFixAttempt if it somehow exists
      const aiFixAttempt = (issue as unknown as { aiFixPrUrl?: string | null }).aiFixPrUrl ?? (issue as unknown as { aiFixAttempt?: string | null }).aiFixAttempt ?? null;
      return { ...issue, aiFixAttempt };
    });
    return NextResponse.json(createApiSuccess({
      issues: enhanced,
      count: enhanced.length,
    }));
  } catch (error) {
    console.error('Error in GET issues API:', error);
    return NextResponse.json(
      createApiError('Failed to fetch issues', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    console.log('POST Authenticated user ID:', userId);

    const body = await request.json();
    const { projectId, sync = false } = body;

    if (!projectId) {
      return NextResponse.json(createApiError('Project ID is required', 'VALIDATION_ERROR'), { status: 400 });
    }

    // Verify user has access to the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        // Include owner filter only when we actually have a user id (getUserId may return null in dev fallback)
        ...(userId && { ownerId: userId }),
      },
    });

    if (!project) {
      return NextResponse.json(createApiError('Project not found', 'RESOURCE_NOT_FOUND'), { status: 404 });
    }

    if (sync) {
      // Get GitHub token from project configuration
      const githubToken = await getGitHubToken(projectId);
      if (!githubToken) {
        return NextResponse.json(createApiError('GitHub token not configured for this project', 'CONFIGURATION_ERROR'), { status: 500 });
      }

      // const githubService = new GitHubService(githubToken);

      // Extract owner and repo from GitHub URL
      const repoMatch = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!repoMatch) {
        return NextResponse.json(createApiError('Invalid GitHub URL format', 'VALIDATION_ERROR'), { status: 400 });
      }

      // const [, owner, repo] = repoMatch;
      // const repoName = repo.replace('.git', '');

      // Sync issues (temporarily disabled due to schema migration pending)
      // const syncResult = await githubService.syncIssues(projectId, owner, repoName);
      const syncResult = { successful: 0, failed: 0, total: 0, message: 'Schema migration pending' };

      return NextResponse.json(createApiSuccess({
        message: 'Issues sync initiated (pending schema migration)',
        result: syncResult,
      }));
    }

    return NextResponse.json(createApiError('Invalid action', 'VALIDATION_ERROR'), { status: 400 });
  } catch (error) {
    console.error('Error in issues API:', error);
    return NextResponse.json(
      createApiError('Failed to process issues request', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}