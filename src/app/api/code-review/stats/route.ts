import { NextRequest, NextResponse } from 'next/server';
import { ReviewStorage } from '@/lib/code-review/review-storage';

/**
 * GET /api/code-review/stats?projectId=default
 * Aggregated statistics for code reviews (risk + impact + approval metrics).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || 'default';
    const storage = new ReviewStorage();
    const reviews = await storage.getProjectReviews(projectId, { limit: 500 });

    const total = reviews.length;
    let approved = 0;
    let requiresChanges = 0;
    let cumulativeScore = 0;
    const riskDistribution: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const impactDistribution: Record<string, number> = { minimal: 0, isolated: 0, moderate: 0, widespread: 0, unknown: 0 };

    for (const r of reviews) {
      riskDistribution[r.riskLevel] = (riskDistribution[r.riskLevel] || 0) + 1;
      if (r.approved) approved++;
      if (r.requiresChanges) requiresChanges++;
      cumulativeScore += r.overallScore;
      const sim: { estimatedImpact?: string } | undefined = (r as unknown as { simulation?: { estimatedImpact?: string } }).simulation;
      const impact = sim?.estimatedImpact?.toLowerCase() || 'unknown';
      if (impactDistribution[impact] !== undefined) {
        impactDistribution[impact]++;
      } else {
        impactDistribution.unknown++;
      }
    }

    const avgScore = total ? +(cumulativeScore / total).toFixed(2) : 0;
    const approvalRate = total ? +(approved / total * 100).toFixed(1) : 0;
    const changeRequestRate = total ? +(requiresChanges / total * 100).toFixed(1) : 0;

    return NextResponse.json({
      projectId,
      total,
      approved,
      requiresChanges,
      avgScore,
      riskDistribution,
      impactDistribution,
      approvalRate,
      changeRequestRate,
    });
  } catch (err) {
    console.error('[Code Review] Stats endpoint error', err);
    return NextResponse.json({ error: 'Failed to compute stats' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';