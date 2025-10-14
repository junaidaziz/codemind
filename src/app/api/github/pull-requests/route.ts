import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../lib/auth-utils';
// import { GitHubService } from '../../../../lib/github-service'; // Unused import
import prisma from '../../../lib/db';
import { createApiSuccess, createApiError } from '../../../../types';
import { getGitHubToken } from '../../../../lib/config-helper';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(createApiError('Unauthorized', 'UNAUTHORIZED'), { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(createApiError('Project ID is required', 'VALIDATION_ERROR'), { status: 400 });
    }

    // Verify user has access to the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: user.id,
      },
    });

    if (!project) {
      return NextResponse.json(createApiError('Project not found', 'RESOURCE_NOT_FOUND'), { status: 404 });
    }

    // Get pull requests from database (temporarily commented out due to schema migration pending)
    // const pullRequests = await prisma.pullRequest.findMany({
    //   where: { projectId },
    //   orderBy: { updatedAt: 'desc' },
    //   take: 50, // Limit to recent PRs
    // });

    // Return empty array for now until schema is migrated
    const pullRequests: Array<Record<string, unknown>> = [];

    return NextResponse.json(createApiSuccess({ pullRequests }));
  } catch (error) {
    console.error('Error fetching pull requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pull requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(createApiError('Unauthorized', 'UNAUTHORIZED'), { status: 401 });
    }

    const body = await request.json();
    const { projectId, sync = false } = body;

    if (!projectId) {
      return NextResponse.json(createApiError('Project ID is required', 'VALIDATION_ERROR'), { status: 400 });
    }

    // Verify user has access to the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: user.id,
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

      // const githubService = new GitHubService(githubToken); // Unused variable

      // Extract owner and repo from GitHub URL
      const repoMatch = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!repoMatch) {
        return NextResponse.json(createApiError('Invalid GitHub URL format', 'VALIDATION_ERROR'), { status: 400 });
      }

      // const [, owner, repo] = repoMatch; // Unused variables
      // const repoName = repo.replace('.git', ''); // Unused variable

      // Sync pull requests (temporarily disabled due to schema migration pending)
      // const syncResult = await githubService.syncPullRequests(projectId, owner, repoName);
      const syncResult = { successful: 0, failed: 0, total: 0, message: 'Schema migration pending' };

      return NextResponse.json(createApiSuccess({
        message: 'Pull requests sync initiated (pending schema migration)',
        result: syncResult,
      }));
    }

    return NextResponse.json(createApiError('Invalid action', 'VALIDATION_ERROR'), { status: 400 });
  } catch (error) {
    console.error('Error in pull requests API:', error);
    return NextResponse.json(
      createApiError('Failed to process pull requests request', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}