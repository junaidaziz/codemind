// Auto Fix API Endpoint - /api/github/auto-fix
import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';
import prisma from '@/lib/db';
import { logger } from '@/lib/logger';
import { 
  createApiError,
  createApiSuccess,
  type ApiResponse 
} from '../../../../types';
import { analyzeAndAutoFix } from '../../../../lib/analyzeLogs';
import { testGitHubAuth } from '../../../../lib/autoFix';
import { getAutoFixService } from '../../../../lib/autoFix';
import {
  DetectedIssueSchema,
  FileChangeSchema,

} from '../../../../types/github';

// Request schemas
const AutoFixRequestSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  logContent: z.string().min(1, 'Log content is required'),
  userId: z.string().optional(),
  triggerType: z.enum(['manual', 'webhook', 'ci_failure']).default('manual'),
  options: z.object({
    requireApproval: z.boolean().default(true),
    maxFixesPerHour: z.number().min(1).max(10).default(3),
    branchPrefix: z.string().default('codemind/auto-fix'),
  }).optional(),
});

const ManualFixRequestSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  issues: z.array(DetectedIssueSchema).min(1, 'At least one issue is required'),
  fixes: z.array(FileChangeSchema).min(1, 'At least one fix is required'),
  userId: z.string().optional(),
});

const TestAuthRequestSchema = z.object({
  authType: z.enum(['current', 'test']).default('current'),
});

// Response types
interface AutoFixResponse {
  analysis: {
    issues: unknown[];
    summary: string;
    confidence: number;
    recommendedActions: string[];
    fixableIssues: unknown[];
  };
  autoFixResult?: {
    success: boolean;
    message: string;
    prUrl?: string;
    prNumber?: number;
    branchName?: string;
    filesChanged: string[];
    error?: string;
  };
  sessionId?: string;
}

interface ManualFixResponse {
  success: boolean;
  message: string;
  prUrl?: string;
  prNumber?: number;
  branchName?: string;
  filesChanged: string[];
  sessionId?: string;
}

interface AuthTestResponse {
  success: boolean;
  user?: string;
  permissions?: string[];
  error?: string;
  rateLimit?: {
    core: { limit: number; used: number; remaining: number; reset: Date };
    search: { limit: number; used: number; remaining: number; reset: Date };
  };
}

/**
 * Validate user permissions for project
 */
async function validateProjectAccess(projectId: string, userId?: string): Promise<{
  project: { id: string; githubUrl: string; name: string; ownerId: string } | null;
  hasAccess: boolean;
  error?: string;
}> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        githubUrl: true,
        name: true,
        ownerId: true,
      },
    });

    if (!project) {
      return { project: null, hasAccess: false, error: 'Project not found' };
    }

    // Check if user has access (owner or organization member)
    if (userId) {
      if (project.ownerId === userId) {
        return { project, hasAccess: true };
      }

      // TODO: Add organization support when ready
      // if (project.organizationId) {
      //   const membership = await prisma.organizationMember.findUnique({
      //     where: {
      //       organizationId_userId: {
      //         organizationId: project.organizationId,
      //         userId,
      //       },
      //     },
      //   });

      //   if (membership && ['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      //     return { project, hasAccess: true };
      //   }
      // }

      return { project: null, hasAccess: false, error: 'Access denied' };
    }

    // If no userId provided, allow for webhook/CI triggers (validation handled elsewhere)
    return { project, hasAccess: true };
  } catch (error) {
    logger.error('Failed to validate project access', {
      projectId,
      userId,
    }, error as Error);

    return { 
      project: null, 
      hasAccess: false, 
      error: 'Database error during access validation' 
    };
  }
}

/**
 * Create auto-fix session record
 */
type TriggerInput = 'manual' | 'webhook' | 'ci_failure';
type TriggerEnum = 'MANUAL' | 'WEBHOOK' | 'CI_FAILURE';

function mapTrigger(t: TriggerInput): TriggerEnum {
  switch (t) {
    case 'manual': return 'MANUAL';
    case 'webhook': return 'WEBHOOK';
    case 'ci_failure': return 'CI_FAILURE';
  }
}

async function createAutoFixSession(
  projectId: string,
  userId: string | undefined,
  issues: unknown[],
  triggerType: TriggerInput
): Promise<string> {
  try {
    const session = await prisma.autoFixSession.create({
      data: {
        projectId,
        userId: userId || null,
        status: 'ANALYZING',
  triggerType: mapTrigger(triggerType),
        issuesDetected: JSON.stringify(issues || []),
        analysisResult: 'Analyzing build / log content...'
      }
    });
    // Activity log
    await prisma.activityLog.create({
      data: {
        projectId,
        userId: userId || null,
        activityType: 'AI_FIX_STARTED',
        entityType: 'ai_fix',
        entityId: session.id,
        description: `AutoFix session started (trigger=${triggerType})`,
        impact: 'LOW',
        metadata: JSON.stringify({ triggerType })
      }
    }).catch(()=>{});
    return session.id;
  } catch (e) {
    logger.error('Failed to create AutoFixSession', { projectId, error: (e as Error).message });
    throw e;
  }
}

/**
 * Update auto-fix session status
 */
interface AnalysisShape { summary?: string; recommendedActions?: string[]; [k: string]: unknown }
interface AutoFixResultShape { prUrl?: string; branchName?: string; commitSha?: string; filesChanged?: string[]; error?: string; success?: boolean; message?: string }

async function finalizeAutoFixSession(
  sessionId: string,
  success: boolean,
  analysis: AnalysisShape,
  autoFixResult?: AutoFixResultShape
) {
  try {
    await prisma.autoFixSession.update({
      where: { id: sessionId },
      data: {
        status: success ? 'COMPLETED' : 'FAILED',
        analysisResult: JSON.stringify({ summary: analysis?.summary, recommended: analysis?.recommendedActions }),
        fixesGenerated: autoFixResult ? JSON.stringify(autoFixResult.filesChanged || []) : undefined,
        completedAt: new Date(),
        prUrl: autoFixResult?.prUrl || undefined,
        branchName: autoFixResult?.branchName || undefined,
        commitSha: autoFixResult?.commitSha || undefined,
      }
    });
    await prisma.activityLog.create({
      data: {
        projectId: (await prisma.autoFixSession.findUnique({ where: { id: sessionId }, select: { projectId: true } }))!.projectId,
        activityType: success ? 'AI_FIX_COMPLETED' : 'AI_FIX_FAILED',
        entityType: 'ai_fix',
        entityId: sessionId,
        description: success ? 'AutoFix session completed' : 'AutoFix session failed',
        impact: success ? 'LOW' : 'MEDIUM',
        metadata: JSON.stringify({ prUrl: autoFixResult?.prUrl })
      }
    }).catch(()=>{});
  } catch (e) {
    logger.warn('Failed to finalize AutoFixSession', { sessionId, error: (e as Error).message });
  }
}

/**
 * POST /api/github/auto-fix
 * Trigger automatic fix process from log analysis
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AutoFixResponse>>> {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { projectId, logContent, userId, triggerType, options } = AutoFixRequestSchema.parse(body);

    logger.info('Auto-fix request received', {
      projectId,
      logLength: logContent.length,
      userId,
      triggerType,
    });

    // Validate project access
    const { project, hasAccess, error: accessError } = await validateProjectAccess(projectId, userId);
    
    if (!hasAccess || !project) {
      return NextResponse.json(
        createApiError(accessError || 'Access denied', 'ACCESS_DENIED'),
        { status: 403 }
      );
    }

    // Create auto-fix session
  const sessionId = await createAutoFixSession(projectId, userId, [], triggerType);

    try {
  // (status already ANALYZING in real session)

      // Configure auto-fix service with options
      getAutoFixService(options);

      // Analyze logs and apply auto-fix
      const { analysis, autoFixResult } = await analyzeAndAutoFix(
        logContent,
        projectId,
        project.githubUrl,
        userId,
        `Project: ${project.name}`
      );

      // Update session status based on result
      await finalizeAutoFixSession(sessionId, !!autoFixResult?.success, analysis, autoFixResult);

      // Update project status if auto-fix was successful
      if (autoFixResult?.success) {
        await prisma.project.update({
          where: { id: projectId },
          data: { 
            status: 'fixed',
            updatedAt: new Date(),
          },
        });
      }

      const processingTime = Date.now() - startTime;

      logger.info('Auto-fix request completed', {
        projectId,
        sessionId,
        success: autoFixResult?.success,
        issuesFound: analysis.issues.length,
        fixableIssues: analysis.fixableIssues.length,
        prUrl: autoFixResult?.prUrl,
        processingTime,
      });

      const response: AutoFixResponse = {
        analysis: {
          issues: analysis.issues,
          summary: analysis.summary,
          confidence: analysis.confidence,
          recommendedActions: analysis.recommendedActions,
          fixableIssues: analysis.fixableIssues,
        },
        autoFixResult: autoFixResult ? {
          success: autoFixResult.success,
          message: autoFixResult.message,
          prUrl: autoFixResult.prUrl,
          filesChanged: [],
          error: autoFixResult.error,
        } : undefined,
        sessionId,
      };

      return NextResponse.json(createApiSuccess(response));

    } catch (processingError) {
      await finalizeAutoFixSession(sessionId, false, { summary: 'Processing error' }, { error: (processingError as Error).message });
      throw processingError;
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Auto-fix request failed', {
      processingTime,
    }, error as Error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('Invalid request data', 'VALIDATION_ERROR', {
          details: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createApiError('Auto-fix request failed', 'PROCESSING_ERROR'),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/github/auto-fix
 * Apply manual fixes (bypass log analysis)
 */
export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse<ManualFixResponse>>> {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { projectId, issues, fixes, userId } = ManualFixRequestSchema.parse(body);

    logger.info('Manual fix request received', {
      projectId,
      issuesCount: issues.length,
      fixesCount: fixes.length,
      userId,
    });

    // Validate project access
    const { project, hasAccess, error: accessError } = await validateProjectAccess(projectId, userId);
    
    if (!hasAccess || !project) {
      return NextResponse.json(
        createApiError(accessError || 'Access denied', 'ACCESS_DENIED'),
        { status: 403 }
      );
    }

    // Create auto-fix session (manual trigger)
    const sessionId = await createAutoFixSession(projectId, userId, issues, 'manual');

    try {
      // Apply manual fixes using auto-fix service
      const autoFixService = getAutoFixService();
      const result = await autoFixService.applyAutoFix(
        projectId,
        project.githubUrl,
        issues,
        fixes,
        userId
      );

      // Finalize session directly (no separate update phases for manual path)
      await finalizeAutoFixSession(
        sessionId,
        !!result.success,
        { summary: 'Manual fix applied' },
        result
      );

      const processingTime = Date.now() - startTime;

      logger.info('Manual fix request completed', {
        projectId,
        sessionId,
        success: result.success,
        prUrl: result.prUrl,
        processingTime,
      });

      const response: ManualFixResponse = {
        success: result.success,
        message: result.message,
        prUrl: result.prUrl,
        prNumber: result.prNumber,
        branchName: result.branchName,
        filesChanged: result.filesChanged,
        sessionId,
      };

      return NextResponse.json(createApiSuccess(response));

    } catch (processingError) {
      await finalizeAutoFixSession(sessionId, false, { summary: 'Processing error' }, { error: (processingError as Error).message });
      throw processingError;
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Manual fix request failed', {
      processingTime,
    }, error as Error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('Invalid request data', 'VALIDATION_ERROR', {
          details: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createApiError('Manual fix request failed', 'PROCESSING_ERROR'),
      { status: 500 }
    );
  }
}

/**
 * GET /api/github/auto-fix
 * Test GitHub authentication and get rate limit info
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<AuthTestResponse>>> {
  try {
    const { searchParams } = new URL(req.url);
    const authType = searchParams.get('test') || 'current';
    
    const { authType: requestAuthType } = TestAuthRequestSchema.parse({ authType });

    logger.info('GitHub auth test requested', { authType: requestAuthType });

    // Test GitHub authentication
    const authResult = await testGitHubAuth();
    
    let rateLimit;
    if (authResult.success) {
      try {
        const autoFixService = getAutoFixService();
        rateLimit = await autoFixService.getRateLimit();
      } catch (error) {
        logger.warn('Failed to get rate limit info', {}, error as Error);
      }
    }

    const response: AuthTestResponse = {
      success: authResult.success,
      user: authResult.user,
      permissions: authResult.permissions,
      error: authResult.error,
      rateLimit,
    };

    logger.info('GitHub auth test completed', {
      success: authResult.success,
      user: authResult.user,
      rateLimitRemaining: rateLimit?.core.remaining,
    });

    return NextResponse.json(createApiSuccess(response));

  } catch (error) {
    logger.error('GitHub auth test failed', {}, error as Error);

    return NextResponse.json(
      createApiError('Auth test failed', 'PROCESSING_ERROR'),
      { status: 500 }
    );
  }
}

/**
 * Handle unsupported methods
 */
export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json(
    createApiError('Method not allowed', 'METHOD_NOT_ALLOWED'),
    { status: 405 }
  );
}