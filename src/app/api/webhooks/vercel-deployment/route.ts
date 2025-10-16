import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { createApiError, createApiSuccess } from '@/types';
import crypto from 'crypto';

/**
 * Vercel Deployment Webhook Handler
 * 
 * Receives webhook events from Vercel for deployment status changes
 * and triggers auto-fix for failed builds.
 * 
 * Webhook Configuration in Vercel:
 * - URL: https://your-domain.com/api/webhooks/vercel-deployment
 * - Events: deployment.created, deployment.succeeded, deployment.failed, deployment.error
 * - Secret: Set in VERCEL_WEBHOOK_SECRET environment variable
 */

interface VercelDeploymentEvent {
  id: string;
  type: 'deployment' | 'deployment.succeeded' | 'deployment.failed' | 'deployment.error' | 'deployment.created';
  createdAt: number;
  payload: {
    deployment: {
      id: string;
      name: string;
      url: string;
      state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
      target: 'production' | 'staging' | 'development';
      meta?: {
        githubCommitRef?: string;
        githubCommitSha?: string;
        githubCommitMessage?: string;
        githubCommitOrg?: string;
        githubCommitRepo?: string;
      };
      creator: {
        uid: string;
        username: string;
      };
      createdAt: number;
      buildingAt?: number;
      ready?: number;
    };
    project: {
      id: string;
      name: string;
    };
    team?: {
      id: string;
      name: string;
    };
  };
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    logger.warn('No webhook signature provided');
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(body).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  } catch (error) {
    logger.error('Webhook signature verification failed', {}, error as Error);
    return false;
  }
}

/**
 * Fetch deployment logs from Vercel API
 */
async function fetchDeploymentLogs(deploymentId: string): Promise<string> {
  const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
  const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

  if (!VERCEL_TOKEN) {
    throw new Error('VERCEL_TOKEN environment variable not set');
  }

  try {
    const url = new URL(`https://api.vercel.com/v2/deployments/${deploymentId}/events`);
    if (VERCEL_TEAM_ID) {
      url.searchParams.append('teamId', VERCEL_TEAM_ID);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status}`);
    }

    const logs = await response.json();
    
    // Extract error messages from logs
    const errorLogs = logs
      .filter((log: { type: string; payload?: { type?: string } }) => 
        log.type === 'stderr' || log.payload?.type === 'error'
      )
      .map((log: { payload?: { text?: string }; text?: string; createdAt?: string; date?: string }) => 
        `[${log.createdAt || log.date}] ${log.payload?.text || log.text || ''}`
      )
      .join('\n');

    return errorLogs || 'No detailed error logs available';
  } catch (error) {
    logger.error('Failed to fetch deployment logs', { deploymentId }, error as Error);
    return 'Failed to fetch deployment logs';
  }
}

/**
 * Trigger auto-fix for failed deployment
 */
async function triggerAutoFix(
  projectId: string,
  deploymentId: string,
  logContent: string,
  meta?: VercelDeploymentEvent['payload']['deployment']['meta']
) {
  try {
    logger.info('Triggering auto-fix for failed deployment', {
      projectId,
      deploymentId,
      branch: meta?.githubCommitRef,
      commit: meta?.githubCommitSha,
    });

    // Call internal auto-fix API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/github/auto-fix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        logContent,
        triggerType: 'ci_failure',
        options: {
          requireApproval: false,
          maxFixesPerHour: 5,
          branchPrefix: 'codemind/auto-fix-deployment',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Auto-fix API returned ${response.status}`);
    }

    const result = await response.json();
    
    logger.info('Auto-fix triggered successfully', {
      projectId,
      deploymentId,
      sessionId: result.data?.sessionId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to trigger auto-fix', {
      projectId,
      deploymentId,
    }, error as Error);
    throw error;
  }
}

/**
 * POST /api/webhooks/vercel-deployment
 * Handle Vercel deployment webhook events
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Read raw body for signature verification
    const bodyText = await req.text();
    const signature = req.headers.get('x-vercel-signature');
    const webhookSecret = process.env.VERCEL_WEBHOOK_SECRET || process.env.GITHUB_WEBHOOK_SECRET;

    // Verify webhook signature
    if (webhookSecret && !verifyWebhookSignature(bodyText, signature, webhookSecret)) {
      logger.warn('Invalid webhook signature', {
        hasSignature: !!signature,
        hasSecret: !!webhookSecret,
      });
      
      return NextResponse.json(
        createApiError('Invalid webhook signature', 'UNAUTHORIZED'),
        { status: 401 }
      );
    }

    // Parse event
    const event: VercelDeploymentEvent = JSON.parse(bodyText);

    logger.info('Vercel webhook received', {
      eventId: event.id,
      eventType: event.type,
      deploymentId: event.payload.deployment.id,
      deploymentState: event.payload.deployment.state,
      projectId: event.payload.project.id,
      target: event.payload.deployment.target,
    });

    // Only process failed deployments
    if (
      event.type === 'deployment.failed' ||
      event.type === 'deployment.error' ||
      event.payload.deployment.state === 'ERROR'
    ) {
      const { deployment, project } = event.payload;

      // Fetch deployment logs
      const logContent = await fetchDeploymentLogs(deployment.id);

      // Find matching project in our database
      // Note: You might need to map Vercel project ID to your internal project ID
      const projectId = project.id; // Or use a mapping service

      // Trigger auto-fix
      try {
        await triggerAutoFix(
          projectId,
          deployment.id,
          logContent,
          deployment.meta
        );

        const processingTime = Date.now() - startTime;

        return NextResponse.json(
          createApiSuccess({
            message: 'Auto-fix triggered for failed deployment',
            deploymentId: deployment.id,
            projectId,
            processingTime,
          })
        );
      } catch (autoFixError) {
        logger.error('Auto-fix trigger failed', {
          deploymentId: deployment.id,
          projectId,
        }, autoFixError as Error);

        // Return success anyway - webhook processed even if auto-fix failed
        return NextResponse.json(
          createApiSuccess({
            message: 'Webhook processed but auto-fix failed',
            deploymentId: deployment.id,
            error: (autoFixError as Error).message,
          })
        );
      }
    }

    // For successful or in-progress deployments, just acknowledge
    const processingTime = Date.now() - startTime;

    logger.info('Vercel webhook processed', {
      eventType: event.type,
      deploymentState: event.payload.deployment.state,
      processingTime,
    });

    return NextResponse.json(
      createApiSuccess({
        message: 'Webhook processed',
        eventType: event.type,
        deploymentState: event.payload.deployment.state,
      })
    );

  } catch (error) {
    const processingTime = Date.now() - startTime;

    logger.error('Vercel webhook processing failed', {
      processingTime,
    }, error as Error);

    return NextResponse.json(
      createApiError('Webhook processing failed', 'PROCESSING_ERROR'),
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/vercel-deployment
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json(
    createApiSuccess({
      message: 'Vercel deployment webhook endpoint is active',
      timestamp: new Date().toISOString(),
    })
  );
}
