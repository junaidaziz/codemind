import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * GET /api/deployments/list?projectId=default&status=READY&environment=production&limit=50
 * Returns a list of deployments with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || 'default';
    const status = searchParams.get('status');
    const environment = searchParams.get('environment');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { projectId };
    if (status) {
      where.status = status;
    }
    if (environment) {
      where.environment = environment;
    }

    const deployments = await prisma.deployment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        projectId: true,
        commitSha: true,
        branch: true,
        status: true,
        url: true,
        deploymentUrl: true,
        environment: true,
        provider: true,
        buildDuration: true,
        healthCheckResult: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Correlate with code reviews if commitSha matches
    const deploymentsWithReviews = await Promise.all(
      deployments.map(async (deployment) => {
        let review = null;
        if (deployment.commitSha) {
          review = await prisma.codeReview.findFirst({
            where: {
              projectId: deployment.projectId,
              commitSha: deployment.commitSha,
            },
            select: {
              id: true,
              prNumber: true,
              riskLevel: true,
              overallScore: true,
              approved: true,
            },
          });
        }
        return {
          ...deployment,
          codeReview: review,
        };
      })
    );

    return NextResponse.json({
      projectId,
      deployments: deploymentsWithReviews,
      total: deploymentsWithReviews.length,
    });
  } catch (error) {
    console.error('[Deployments] List endpoint error:', error);
    return NextResponse.json({ error: 'Failed to list deployments' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
