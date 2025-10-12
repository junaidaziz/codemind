import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../lib/logger';

// TypeScript interfaces for type safety
interface VercelWebhookPayload {
  id: string;
  type: string;
  createdAt: number;
  data: {
    deployment?: {
      id: string;
      url: string;
      name: string;
      source: string;
      state: string;
      type: string;
      target?: string;
      projectId: string;
      org: {
        id: string;
        name: string;
      };
      createdAt: number;
      buildingAt?: number;
      readyAt?: number;
    };
    project?: {
      id: string;
      name: string;
    };
    user?: {
      id: string;
      username: string;
    };
  };
}

interface GitHubDispatchPayload {
  event_type: string;
  client_payload?: {
    deployment_id?: string;
    project_id?: string;
    timestamp?: number;
  };
}

interface ApiResponse {
  ok: boolean;
  message?: string;
  error?: string;
  dispatched?: boolean;
}

/**
 * Vercel Webhook Relay API Endpoint
 * 
 * Receives webhook events from Vercel and relays deployment errors
 * to GitHub Actions via repository_dispatch API.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  const startTime = Date.now();
  
  try {
    // Parse the request body
    let payload: VercelWebhookPayload;
    
    try {
      payload = await request.json() as VercelWebhookPayload;
    } catch (parseError) {
      logger.error('Failed to parse webhook payload', { error: parseError });
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Log the incoming webhook event
    logger.info('Received Vercel webhook', {
      type: payload.type,
      id: payload.id,
      timestamp: payload.createdAt,
      deploymentId: payload.data.deployment?.id,
      projectId: payload.data.project?.id || payload.data.deployment?.projectId,
      deploymentState: payload.data.deployment?.state
    });

    // Validate required fields
    if (!payload.type || !payload.id) {
      logger.error('Invalid webhook payload - missing required fields', { payload });
      return NextResponse.json(
        { ok: false, error: 'Invalid payload: missing type or id' },
        { status: 400 }
      );
    }

    // TODO: Add Vercel signature verification here
    // This would validate that the request actually came from Vercel
    // using the x-vercel-signature header and webhook secret
    
    // Process deployment error events
    if (payload.type === 'deployment.error' || payload.type === 'deployment-error') {
      logger.warn('Deployment error detected - triggering GitHub Actions', {
        deploymentId: payload.data.deployment?.id,
        projectId: payload.data.project?.id || payload.data.deployment?.projectId,
        deploymentUrl: payload.data.deployment?.url
      });

      // Trigger GitHub Actions workflow
      const dispatched = await triggerGitHubWorkflow(payload);
      
      if (dispatched) {
        logger.info('Successfully triggered GitHub Actions workflow', {
          deploymentId: payload.data.deployment?.id,
          duration: Date.now() - startTime
        });
        
        return NextResponse.json({
          ok: true,
          message: 'Deployment error relayed to GitHub Actions',
          dispatched: true
        });
      } else {
        logger.error('Failed to trigger GitHub Actions workflow', {
          deploymentId: payload.data.deployment?.id
        });
        
        return NextResponse.json(
          { ok: false, error: 'Failed to trigger GitHub workflow' },
          { status: 500 }
        );
      }
    }

    // For non-error events, just acknowledge receipt
    logger.info('Webhook processed successfully', {
      type: payload.type,
      id: payload.id,
      duration: Date.now() - startTime
    });

    return NextResponse.json({
      ok: true,
      message: `Webhook event '${payload.type}' processed`,
      dispatched: false
    });

  } catch (error) {
    logger.error('Unexpected error in webhook handler', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: Date.now() - startTime
    });

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Trigger GitHub Actions workflow via repository_dispatch API
 */
async function triggerGitHubWorkflow(payload: VercelWebhookPayload): Promise<boolean> {
  const githubToken = process.env.GITHUB_TOKEN;
  
  if (!githubToken) {
    logger.error('GitHub token not configured - cannot trigger workflow');
    return false;
  }

  const dispatchPayload: GitHubDispatchPayload = {
    event_type: 'vercel-build-failed',
    client_payload: {
      deployment_id: payload.data.deployment?.id,
      project_id: payload.data.project?.id || payload.data.deployment?.projectId,
      timestamp: payload.createdAt
    }
  };

  try {
    const response = await fetch('https://api.github.com/repos/junaidaziz/codemind/dispatches', {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.everest-preview+json',
        'Authorization': `token ${githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CodeMind-Vercel-Webhook-Relay/1.0'
      },
      body: JSON.stringify(dispatchPayload)
    });

    if (response.ok) {
      logger.info('GitHub repository_dispatch sent successfully', {
        status: response.status,
        deploymentId: payload.data.deployment?.id
      });
      return true;
    } else {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.error('GitHub repository_dispatch failed', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        deploymentId: payload.data.deployment?.id
      });
      return false;
    }

  } catch (fetchError) {
    logger.error('Network error triggering GitHub workflow', {
      error: fetchError instanceof Error ? fetchError.message : String(fetchError),
      deploymentId: payload.data.deployment?.id
    });
    return false;
  }
}

/**
 * Handle unsupported HTTP methods
 */
export async function GET(): Promise<NextResponse<ApiResponse>> {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}

export async function PUT(): Promise<NextResponse<ApiResponse>> {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}

export async function DELETE(): Promise<NextResponse<ApiResponse>> {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}