import { NextRequest, NextResponse } from 'next/server';
import { ReviewStorage } from '@/lib/code-review/review-storage';

/**
 * GET /api/code-review/list?projectId=default&limit=50
 * Returns a list of recent code reviews for a project.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || 'default';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;

    const storage = new ReviewStorage();
    const reviews = await storage.getProjectReviews(projectId, { limit });

    const simplified = reviews.map(r => {
      // simulation is a JSON field; r as returned by Prisma includes it if selected.
      // We did not explicitly select it so TypeScript doesn't know; access via (r as { simulation?: any })
      const simulation: { estimatedImpact?: string } | undefined = (r as unknown as { simulation?: { estimatedImpact?: string } }).simulation;
      return {
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
      estimatedImpact: simulation?.estimatedImpact,
    };});

    return NextResponse.json({ projectId, reviews: simplified });
  } catch (error) {
    console.error('[Code Review] List endpoint error:', error);
    return NextResponse.json({ error: 'Failed to list reviews' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';