import { NextRequest, NextResponse } from 'next/server';
import { GitHubWebhookPayload } from '@/types/github-webhook';
import { CodeReviewer } from '@/lib/code-review/code-reviewer';
import { GitHubFetcher } from '@/lib/code-review/github-fetcher';
import { ReviewStorage } from '@/lib/code-review/review-storage';
import { CodeReviewResult, ReviewComment } from '@/types/code-review';
import crypto from 'crypto';

/**
 * POST /api/webhooks/github
 * Handle GitHub webhook events
 * 
 * Supported events:
 * - pull_request.opened - Trigger automatic code review
 * - pull_request.synchronize - Re-analyze on new commits
 * - pull_request.closed - Update review status
 * - pull_request.reopened - Re-activate review
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const event = request.headers.get('x-github-event');

    // Verify webhook signature
    if (!signature || !event) {
      return NextResponse.json(
        { error: 'Missing webhook headers' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook] GITHUB_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    // Verify signature using crypto
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Only process pull_request events
    if (event !== 'pull_request') {
      console.log(`[Webhook] Ignoring non-PR event: ${event}`);
      return NextResponse.json({ message: 'Event ignored' });
    }

  const payload: GitHubWebhookPayload = JSON.parse(body);
    const { action, pull_request, repository } = payload;

    console.log(
      `[Webhook] Received PR event: ${action} for ${repository.full_name}#${pull_request.number}`
    );

    // Handle different PR actions
    switch (action) {
      case 'opened':
        await handlePRAnalysis(payload, false);
        break;
      case 'synchronize':
        await handlePRAnalysis(payload, true);
        break;

      case 'closed':
        // Update review status (handled by the frontend if needed)
        console.log(`[Webhook] PR #${pull_request.number} closed`);
        break;

      case 'reopened':
        // Re-activate review (handled by the frontend if needed)
        console.log(`[Webhook] PR #${pull_request.number} reopened`);
        break;

      default:
        console.log(`[Webhook] Ignoring PR action: ${action}`);
    }

    return NextResponse.json({ 
      message: 'Webhook processed successfully',
      action,
      prNumber: pull_request.number 
    });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle PR analysis for opened or updated PRs
 */
async function handlePRAnalysis(payload: GitHubWebhookPayload, incremental: boolean) {
  const { pull_request, repository } = payload;
  const [owner, repo] = repository.full_name.split('/');

  try {
    console.log(`[Webhook] Starting analysis for PR #${pull_request.number}`);

    // Fetch PR data from GitHub
    const fetcher = new GitHubFetcher();
    const prAnalysis = await fetcher.fetchPRDetails(owner, repo, pull_request.number);

    // Analyze the PR
    const reviewer = new CodeReviewer();
    const reviewResult = incremental
      ? await reviewer.analyzeChangedFiles(prAnalysis)
      : await reviewer.analyzePR(prAnalysis);

    // Store the review results (using repository full_name as projectId for now)
    const storage = new ReviewStorage();
    await storage.saveReview(
      repository.full_name,
      pull_request.number,
      reviewResult
    );

  // Post review summary as comment on GitHub (if token available)
  await postReviewComment(fetcher, owner, repo, pull_request.number, reviewResult);

    console.log(
      `[Webhook] ${incremental ? 'Incremental' : 'Full'} analysis complete for PR #${pull_request.number}. Risk: ${reviewResult.riskScore.level}`
    );
  } catch (error) {
    console.error(`[Webhook] Error analyzing PR #${pull_request.number}:`, error);
    throw error;
  }
}

/**
 * Post review summary as a comment on GitHub PR
 */
async function postReviewComment(
  fetcher: GitHubFetcher,
  owner: string,
  repo: string,
  prNumber: number,
  reviewResult: CodeReviewResult
) {
  try {
    const { riskScore, summary, comments } = reviewResult;

    // Build comment markdown
    const criticalComments = comments.filter((c: ReviewComment) => c.severity === 'critical');
    const highComments = comments.filter((c: ReviewComment) => c.severity === 'high');

  let commentBody = `## 🤖 Code Review Summary\n\n`;
    commentBody += `**Risk Level:** ${getRiskEmoji(riskScore.level)} ${riskScore.level.toUpperCase()} (${riskScore.overall}/100)\n\n`;
    commentBody += `**Approval Recommendation:** ${summary.approvalRecommendation.toUpperCase()}\n\n`;
    
    commentBody += `### 📊 Risk Breakdown\n\n`;
    for (const factor of riskScore.factors) {
      commentBody += `- **${factor.factor}**: ${factor.score}/100 (weight: ${factor.weight}) - ${factor.description}\n`;
    }

    commentBody += `\n### 🔍 Key Findings\n\n`;
    
    if (criticalComments.length > 0) {
      commentBody += `**🚨 Critical Issues (${criticalComments.length}):**\n`;
      for (const comment of criticalComments.slice(0, 3)) {
        commentBody += `- ${comment.message} (${comment.file}:${comment.line})\n`;
      }
      if (criticalComments.length > 3) {
        commentBody += `- ... and ${criticalComments.length - 3} more\n`;
      }
      commentBody += `\n`;
    }

    if (highComments.length > 0) {
      commentBody += `**⚠️ High Priority Issues (${highComments.length}):**\n`;
      for (const comment of highComments.slice(0, 3)) {
        commentBody += `- ${comment.message} (${comment.file}:${comment.line})\n`;
      }
      if (highComments.length > 3) {
        commentBody += `- ... and ${highComments.length - 3} more\n`;
      }
      commentBody += `\n`;
    }

    commentBody += `\n📝 **Total Issues:** ${comments.length}\n`;
    commentBody += `⏱️ **Estimated Review Time:** ${reviewResult.estimatedReviewTime} minutes\n\n`;
  commentBody += `---\n*This review was generated automatically by AI. Please review all suggestions carefully.*`;

    const posted = await fetcher.postComment(owner, repo, prNumber, commentBody);
    if (posted) {
      console.log(`[Webhook] Posted review summary comment id=${posted.id} url=${posted.url}`);
    } else {
      console.log(`[Webhook] Skipped posting comment (no token or error)`);
    }
  } catch (error) {
    console.error(`[Webhook] Error posting review comment:`, error);
    // Don't throw - posting comment failure shouldn't fail the webhook
  }
}

/**
 * Get emoji for risk level
 */
function getRiskEmoji(level: string): string {
  switch (level.toLowerCase()) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

export const dynamic = 'force-dynamic';
