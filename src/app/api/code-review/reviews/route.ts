import { NextRequest, NextResponse } from 'next/server';
import { ReviewStorage } from '@/lib/code-review/review-storage';
import type { CodeReviewStatus, RiskLevel } from '@prisma/client';

/**
 * GET /api/code-review/reviews?projectId=xxx&limit=50
 * List code reviews for a project
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const limitParam = searchParams.get('limit');
  const riskLevelParam = searchParams.get('riskLevel');
  const statusParam = searchParams.get('status');

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId parameter' }, { status: 400 });
    }

    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;

    // Narrow filters to valid enum values (uppercase in DB)
    const validRiskLevels: RiskLevel[] = ['LOW','MEDIUM','HIGH','CRITICAL'];
    const validStatuses: CodeReviewStatus[] = ['PENDING','IN_PROGRESS','COMPLETED','FAILED'];

    const riskLevel = riskLevelParam ? validRiskLevels.find(r => r === riskLevelParam.toUpperCase() as RiskLevel) : undefined;
    const status = statusParam ? validStatuses.find(s => s === statusParam.toUpperCase() as CodeReviewStatus) : undefined;

    const storage = new ReviewStorage();
    const reviews = await storage.getProjectReviews(projectId, {
      limit,
      riskLevel,
      status,
    });

    // Shape response for minimal UI consumption
    const list = reviews.map(r => ({
      id: r.id,
      prNumber: r.prNumber,
      riskLevel: r.riskLevel,
      riskScore: r.riskScore,
      overallScore: r.overallScore,
      approved: r.approved,
      requiresChanges: r.requiresChanges,
      filesAnalyzed: r.filesAnalyzed,
      linesAdded: r.linesAdded,
      linesRemoved: r.linesRemoved,
      createdAt: r.createdAt,
      topIssues: r.CodeReviewComment?.map(c => ({ file: c.filePath, severity: c.severity })) || [],
    }));

    return NextResponse.json({ success: true, reviews: list });
  } catch (error) {
    console.error('[Code Review] Error listing reviews:', error);
    return NextResponse.json({ error: 'Failed to list reviews', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
