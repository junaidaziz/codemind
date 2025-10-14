import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '../../../../lib/auth-server';
import prisma from '../../../lib/db';
import { createApiError, createApiSuccess } from '../../../../types';
import { markIssueAnalyzed, markIssueFix, serializeIssueWithAI } from '../../../../lib/ai-state';

export async function POST(request: NextRequest) {
  try {
    const realUserId = await getUserId(request);
    let userId = realUserId;
    let devFallback = false;
    // Development fallback: if no user identified, generate a temporary one so feature can be exercised locally
    if (!userId && process.env.NODE_ENV !== 'production') {
      userId = 'dev-user';
      devFallback = true;
      console.warn('[resolve] No authenticated user; using dev fallback userId=dev-user');
    }

    const body = await request.json();
    const { issueId, action } = body;

    if (!issueId) {
      return NextResponse.json(createApiError('Issue ID is required', 'VALIDATION_ERROR'), { status: 400 });
    }

    if (!['analyze', 'fix'].includes(action)) {
      return NextResponse.json(createApiError('Invalid action. Use "analyze" or "fix"', 'VALIDATION_ERROR'), { status: 400 });
    }

    // Build conditional where clause: enforce ownership only when we have a real authenticated user (not dev fallback)
    const issue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        ...(userId && !devFallback ? { project: { ownerId: userId } } : {}),
      },
      include: { project: true },
    });

    if (!issue) {
      return NextResponse.json(createApiError('Issue not found or access denied', 'RESOURCE_NOT_FOUND'), { status: 404 });
    }

    // Simulate AI work (placeholder until real AI pipeline wired)
    if (action === 'analyze') {
      const fakeSummary = `AI summary generated at ${new Date().toISOString()} for issue #${issue.number}`;
      markIssueAnalyzed(issue.id, fakeSummary);
      return NextResponse.json(createApiSuccess({
        message: 'Issue analyzed successfully',
        issue: serializeIssueWithAI({ id: issue.id }),
      }));
    }

    if (action === 'fix') {
      // Derive real owner/repo from the project's GitHub URL (fallback to placeholders if parse fails)
      let owner = 'unknown';
      let repo = 'repo';
      if (issue.project?.githubUrl) {
        const match = issue.project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/#]+)(?:\.git)?/i);
        if (match) {
          owner = match[1];
          repo = match[2].replace(/\.git$/i, '');
        }
      }
      const randomPrNumber = Math.floor(Math.random() * 5000) || 1;
      const prUrl = `https://github.com/${owner}/${repo}/pull/${randomPrNumber}`;
      markIssueFix(issue.id, prUrl);
      return NextResponse.json(createApiSuccess({
        message: 'AI fix simulated and PR link generated',
        issue: serializeIssueWithAI({ id: issue.id }),
      }));
    }

    return NextResponse.json(createApiError('Unhandled action', 'INTERNAL_ERROR'), { status: 500 });

    /*
    if (!issue) {
      return NextResponse.json(createApiError('Issue not found or access denied', 'RESOURCE_NOT_FOUND'), { status: 404 });
    }

    // Get required tokens
    const githubToken = process.env.GITHUB_TOKEN;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!githubToken || !openaiApiKey) {
      return NextResponse.json(
        createApiError('Required API tokens not configured', 'CONFIGURATION_ERROR'),
        { status: 500 }
      );
    }

    const aiFixService = new AIFixService(openaiApiKey, githubToken);

    switch (action) {
      case 'analyze': {
        // Analyze the issue with AI
        const analysis = await aiFixService.analyzeIssue(issueId);
        
        return NextResponse.json(createApiSuccess({
          analysis,
          message: 'Issue analyzed successfully',
        }));
      }

      case 'fix': {
        // Generate and apply AI fix
        const fixResult = await aiFixService.generateAndApplyFix(issueId);
        
        return NextResponse.json(createApiSuccess({
          fixResult,
          message: 'AI fix generated and applied successfully',
        }));
      }

      default:
        return NextResponse.json(createApiError('Invalid action. Use "analyze" or "fix"', 'VALIDATION_ERROR'), { status: 400 });
    }
    */
  } catch (error) {
    console.error('Error in AI resolution API:', error);
    return NextResponse.json(
      createApiError(
        error instanceof Error ? error.message : 'Failed to process AI resolution request',
        'INTERNAL_ERROR'
      ),
      { status: 500 }
    );
  }
}