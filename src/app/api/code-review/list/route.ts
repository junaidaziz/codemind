import { NextRequest, NextResponse } from 'next/server';
import { ReviewStorage } from '@/lib/code-review/review-storage';
import { RiskLevel } from '@prisma/client';

/**
 * GET /api/code-review/list?projectId=default&limit=50&riskLevel=HIGH&impact=widespread
 * Returns a list of recent code reviews for a project with optional filters.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || 'default';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;
    const riskLevelParam = searchParams.get('riskLevel');
    const impactParam = searchParams.get('impact');

    const storage = new ReviewStorage();
    const riskLevel = riskLevelParam as RiskLevel | undefined;
    const reviews = await storage.getProjectReviews(projectId, { limit, riskLevel });

    const simplified = reviews.map(r => {
      // simulation is a JSON field; r as returned by Prisma includes it if selected.
      // We did not explicitly select it so TypeScript doesn't know; access via (r as { simulation?: any })
      const simulation: { estimatedImpact?: string } | undefined = (r as unknown as { simulation?: { estimatedImpact?: string } }).simulation;
      const docSuggestions = (r as unknown as { documentationSuggestions?: Array<{ type: string }> }).documentationSuggestions;
      const testSuggestions = (r as unknown as { testingSuggestions?: Array<{ type: string }> }).testingSuggestions;
      
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
        documentationSuggestions: docSuggestions,
        testingSuggestions: testSuggestions,
      };
    });

    // Client-side filter for impact (JSON field can't be efficiently filtered in DB)
    let filtered = simplified;
    if (impactParam) {
      filtered = simplified.filter(r => 
        r.estimatedImpact?.toLowerCase() === impactParam.toLowerCase()
      );
    }

    return NextResponse.json({ projectId, reviews: filtered });
  } catch (error) {
    console.error('[Code Review] List endpoint error:', error);
    return NextResponse.json({ error: 'Failed to list reviews' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';