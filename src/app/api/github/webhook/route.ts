// GitHub webhook handler - /api/github/webhook
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/db';
import { logger } from '@/lib/logger';
import { 
  createApiError,
  createApiSuccess 
} from '../../../../types';
import {
  GitHubPushEventSchema,
  GitHubPullRequestEventSchema,
  GitHubIssuesEventSchema,
  GitHubReleaseEventSchema,
  shouldReindexProject,
  getEventDescription,
  type GitHubWebhookEvent,
  GITHUB_EVENTS,
} from '../../../../types/github';



// Process GitHub webhook event
async function processWebhookEvent(
  eventType: string,
  eventData: Record<string, unknown>,
  projectId: string
): Promise<{ success: boolean; message: string; shouldReindex?: boolean }> {
  logger.info('Processing GitHub webhook event', {
    eventType,
    projectId,
    action: eventData.action,
  });

  let parsedEvent: GitHubWebhookEvent;
  
  try {
    // Parse event based on type
    switch (eventType) {
      case GITHUB_EVENTS.PUSH:
        parsedEvent = { event_type: 'push', ...GitHubPushEventSchema.parse(eventData) };
        break;
      
      case GITHUB_EVENTS.PULL_REQUEST:
        parsedEvent = { event_type: 'pull_request', ...GitHubPullRequestEventSchema.parse(eventData) };
        break;
      
      case GITHUB_EVENTS.ISSUES:
        parsedEvent = { event_type: 'issues', ...GitHubIssuesEventSchema.parse(eventData) };
        break;
      
      case GITHUB_EVENTS.RELEASE:
        parsedEvent = { event_type: 'release', ...GitHubReleaseEventSchema.parse(eventData) };
        break;
      
      default:
        logger.warn('Unsupported GitHub webhook event type', { eventType });
        return {
          success: true,
          message: `Event type ${eventType} received but not processed`,
        };
    }

    // Store webhook log in database (using existing message table for now)
    // TODO: Create proper webhook_logs table in future migration
    const description = getEventDescription(parsedEvent);
    await prisma.message.create({
      data: {
        sessionId: `webhook-${projectId}`,
        role: 'system',
        content: `GitHub Webhook: ${description}`,
      }
    });

    // Check if project should be reindexed
    const shouldReindex = shouldReindexProject(parsedEvent);
    
    if (shouldReindex) {
      logger.info('Triggering project reindex due to webhook event', {
        projectId,
        eventType,
        description,
      });

      // Update project's lastIndexedAt to null to trigger reindexing
      await prisma.project.update({
        where: { id: projectId },
        data: { 
          lastIndexedAt: null,
          status: 'indexing' 
        },
      });

      // TODO: Trigger background job for reindexing
      // This would be handled by the job queue system
    }

    logger.info('GitHub webhook event processed successfully', {
      projectId,
      eventType,
      description,
      shouldReindex,
    });

    return {
      success: true,
      message: description,
      shouldReindex,
    };

  } catch (error) {
    logger.error('Failed to process GitHub webhook event', {
      eventType,
      projectId,
    }, error as Error);

    // Store failed webhook log
    await prisma.message.create({
      data: {
        sessionId: `webhook-error-${projectId}`,
        role: 'system',
        content: `GitHub Webhook Error: Failed to process ${eventType} event: ${(error as Error).message}`,
      }
    });

    return {
      success: false,
      message: `Failed to process ${eventType} event: ${(error as Error).message}`,
    };
  }
}

// Main webhook handler
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get headers
    const headersList = await headers();
    const githubEvent = headersList.get('x-github-event');
    const githubDelivery = headersList.get('x-github-delivery');

    if (!githubEvent) {
      return NextResponse.json(
        createApiError('Missing GitHub event type header', 'MISSING_HEADER'),
        { status: 400 }
      );
    }

    // Get raw body for signature validation
    const body = await req.text();
    let eventData: Record<string, unknown>;
    
    try {
      eventData = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        createApiError('Invalid JSON payload', 'INVALID_PAYLOAD'),
        { status: 400 }
      );
    }

    // Extract repository info to find associated project
    const repository = eventData.repository as { html_url?: string; clone_url?: string } || {};
    const repositoryUrl = repository.html_url || repository.clone_url;
    if (!repositoryUrl) {
      return NextResponse.json(
        createApiError('Repository information missing from webhook', 'MISSING_REPOSITORY'),
        { status: 400 }
      );
    }

    // Find project by repository URL
    const project = await prisma.project.findFirst({
      where: {
        githubUrl: {
          in: [
            repositoryUrl,
            repositoryUrl.replace('.git', ''),
            repositoryUrl + '.git',
          ]
        }
      }
    });

    if (!project) {
      logger.warn('Received GitHub webhook for unknown repository', {
        repositoryUrl,
        githubEvent,
        githubDelivery,
      });
      
      return NextResponse.json(
        createApiError('Project not found for repository', 'PROJECT_NOT_FOUND'),
        { status: 404 }
      );
    }

    // For now, skip signature validation since we don't have webhook secrets stored
    // In production, you would validate the signature against a stored secret
    // const isValidSignature = await validateWebhookSignature(body, githubSignature, webhookSecret);
    // if (!isValidSignature) {
    //   return NextResponse.json(
    //     createApiError('Invalid webhook signature', 'INVALID_SIGNATURE'),
    //     { status: 401 }
    //   );
    // }

    // Process the webhook event
    const result = await processWebhookEvent(githubEvent, eventData, project.id);
    
    const processingTime = Date.now() - startTime;
    
    logger.info('GitHub webhook processed', {
      projectId: project.id,
      eventType: githubEvent,
      deliveryId: githubDelivery,
      processingTime,
      success: result.success,
      shouldReindex: result.shouldReindex,
    });

    if (result.success) {
      return NextResponse.json(createApiSuccess({
        message: result.message,
        projectId: project.id,
        eventType: githubEvent,
        shouldReindex: result.shouldReindex,
        processingTime,
      }));
    } else {
      return NextResponse.json(
        createApiError(result.message, 'PROCESSING_ERROR'),
        { status: 500 }
      );
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('GitHub webhook handler error', {
      processingTime,
    }, error as Error);

    return NextResponse.json(
      createApiError('Internal webhook processing error', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// Handle other methods
export async function GET() {
  return NextResponse.json(
    createApiError('Method not allowed', 'METHOD_NOT_ALLOWED'),
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    createApiError('Method not allowed', 'METHOD_NOT_ALLOWED'),
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    createApiError('Method not allowed', 'METHOD_NOT_ALLOWED'),
    { status: 405 }
  );
}