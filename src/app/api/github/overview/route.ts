import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '../../../../lib/auth-server';
import prisma from '../../../lib/db';
import { createApiSuccess, createApiError } from '../../../../types';

// Aggregated endpoint to reduce client waterfall: returns recent issues + pull requests in one round trip.
export async function GET(request: NextRequest) {
  const t0 = Date.now();
  try {
    const userId = await getUserId(request);
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json(createApiError('Project ID is required', 'VALIDATION_ERROR'), { status: 400 });
    }

    // Validate project access (owner check optional if dev fallback sets userId)
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(userId && { ownerId: userId }),
      },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json(createApiError('Project not found', 'RESOURCE_NOT_FOUND'), { status: 404 });
    }

    // Parallel fetch issues & PRs
    const [issues, pullRequests] = await Promise.all([
      prisma.issue.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.pullRequest.findMany({
        where: { projectId },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);

    const duration = Date.now() - t0;
    return NextResponse.json(createApiSuccess({
      issues,
      pullRequests,
      counts: { issues: issues.length, pullRequests: pullRequests.length },
      meta: { durationMs: duration },
    }));
  } catch (error) {
    console.error('Error in overview API:', error);
    return NextResponse.json(createApiError('Failed to fetch GitHub overview', 'INTERNAL_ERROR'), { status: 500 });
  }
}
