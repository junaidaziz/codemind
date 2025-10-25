import { NextRequest, NextResponse } from 'next/server';
import { CodeReviewer } from '@/lib/code-review/code-reviewer';
import { GitHubFetcher } from '@/lib/code-review/github-fetcher';
import { ReviewStorage } from '@/lib/code-review/review-storage';

/**
 * POST /api/code-review/analyze
 * Analyze a pull request
 * 
 * Body: {
 *   owner: string (GitHub repo owner)
 *   repo: string (GitHub repo name)
 *   prNumber: number (PR number)
 *   projectId?: string (optional project ID to associate)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, prNumber, projectId } = body;

    // Validate input
    if (!owner || !repo || !prNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: owner, repo, prNumber' },
        { status: 400 }
      );
    }

    console.log(`[Code Review] Analyzing PR #${prNumber} from ${owner}/${repo}`);

    // Fetch PR data from GitHub
    const fetcher = new GitHubFetcher();
    const prAnalysis = await fetcher.fetchPRDetails(owner, repo, prNumber);

    // Analyze the PR
    const reviewer = new CodeReviewer();
    const reviewResult = await reviewer.analyzePR(prAnalysis);

    // Store the review results
    const storage = new ReviewStorage();
    const storedReview = await storage.saveReview(
      projectId || 'default',
      prNumber,
      reviewResult
    );

    console.log(`[Code Review] Analysis complete for PR #${prNumber}. Risk: ${reviewResult.riskScore.level}`);

    return NextResponse.json({
      success: true,
      reviewId: storedReview.id,
      review: {
        prNumber: reviewResult.prAnalysis.prNumber,
        repository: reviewResult.prAnalysis.repository,
        riskScore: reviewResult.riskScore,
        summary: reviewResult.summary,
        commentsCount: reviewResult.comments.length,
        criticalIssues: reviewResult.summary.criticalIssues,
        highPriorityIssues: reviewResult.summary.highPriorityIssues,
        recommendations: reviewResult.recommendations,
        estimatedReviewTime: reviewResult.estimatedReviewTime,
        documentationSuggestions: reviewResult.documentationSuggestions,
        testingSuggestions: reviewResult.testingSuggestions,
      },
    });
  } catch (error) {
    console.error('[Code Review] Error analyzing PR:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze PR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/code-review/analyze?reviewId=xxx
 * Get a stored review by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('reviewId');
    const projectId = searchParams.get('projectId');
    const prNumberParam = searchParams.get('prNumber');

    const storage = new ReviewStorage();

    let review = null;

    if (reviewId) {
      // Prefer direct lookup by review ID when provided
      review = await storage.getReviewById(reviewId);
    } else if (projectId && prNumberParam) {
      // Fallback composite lookup
      const prNumber = parseInt(prNumberParam, 10);
      if (Number.isNaN(prNumber)) {
        return NextResponse.json(
          { error: 'Invalid prNumber parameter' },
          { status: 400 }
        );
      }
      review = await storage.getReview(projectId, prNumber);
    } else {
      return NextResponse.json(
        { error: 'Missing parameters. Provide either reviewId or projectId & prNumber.' },
        { status: 400 }
      );
    }

    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(review);
  } catch (error) {
    console.error('[Code Review] Error fetching review:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch review',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
