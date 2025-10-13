import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../../lib/auth-utils';
import { AIFixService } from '../../../../lib/ai-fix-service';
import prisma from '../../../lib/db';
import { createApiSuccess, createApiError } from '../../../../types';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(createApiError('Unauthorized', 'UNAUTHORIZED'), { status: 401 });
    }

    const body = await request.json();
    const { issueId, action } = body;

    if (!issueId) {
      return NextResponse.json(createApiError('Issue ID is required', 'VALIDATION_ERROR'), { status: 400 });
    }

    // Get issue and verify user has access to it
    // const issue = await prisma.issue.findFirst({
    //   where: {
    //     id: issueId,
    //     project: {
    //       ownerId: user.id,
    //     },
    //   },
    //   include: {
    //     project: true,
    //   },
    // });

    // Temporarily return error until schema is migrated
    return NextResponse.json(
      createApiError('AI resolution temporarily unavailable - database schema migration pending', 'CONFIGURATION_ERROR'),
      { status: 503 }
    );

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