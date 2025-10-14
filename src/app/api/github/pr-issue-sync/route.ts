import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '../../../lib/db';
import { GitHubService } from '../../../../lib/github-service';
import { AIFixService } from '../../../../lib/ai-fix-service';
import { createApiError, createApiSuccess } from '../../../../types';
import crypto from 'crypto';

// Verify GitHub webhook signature
async function verifyGitHubSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Define common repository type
interface RepositoryInfo {
  owner: { login: string };
  name: string;
  html_url?: string;
}

// Define types for webhook events
interface PullRequestWebhookEvent {
  action: string;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string;
    state: string;
  };
  repository: RepositoryInfo;
}

// Handle pull request webhook events
async function handlePullRequestEvent(
  projectId: string,
  eventData: PullRequestWebhookEvent
): Promise<{ success: boolean; message: string }> {
  try {
    const { action, pull_request, repository } = eventData;
    
    // Get GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    const githubService = new GitHubService(githubToken);
    const owner = repository.owner.login;
    const repo = repository.name;

    // Sync pull requests for this project
    const syncResult = await githubService.syncPullRequests(projectId, owner, repo);
    
    console.log(`PR webhook: ${action} on PR #${pull_request.number} in ${owner}/${repo}`);
    console.log(`Synced ${syncResult.successful} PRs, ${syncResult.failed} failed`);

    return {
      success: true,
      message: `PR ${action} event processed - synced ${syncResult.successful} PRs`,
    };
  } catch (error) {
    console.error('Error handling pull request webhook:', error);
    return {
      success: false,
      message: `Failed to handle PR event: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Define types for issue webhook events
interface IssueWebhookEvent {
  action: string;
  issue: {
    id: number;
    number: number;
    title: string;
    body: string;
    state: string;
    labels?: Array<{ name: string; color: string }>;
  };
  repository: RepositoryInfo;
}

// Handle issue webhook events
async function handleIssueEvent(
  projectId: string,
  eventData: IssueWebhookEvent
): Promise<{ success: boolean; message: string }> {
  try {
    const { action, issue, repository } = eventData;
    
    // Get GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    const githubService = new GitHubService(githubToken);
    const owner = repository.owner.login;
    const repo = repository.name;

    // Sync issues for this project
    const syncResult = await githubService.syncIssues(projectId, owner, repo);
    
    console.log(`Issue webhook: ${action} on issue #${issue.number} in ${owner}/${repo}`);
    console.log(`Synced ${syncResult.successful} issues, ${syncResult.failed} failed`);

    // Check if issue was labeled with 'ai-fix' for auto-resolution
    const labels = issue.labels?.map((label: string | { name: string }) => 
      typeof label === 'string' ? label : label.name
    ) || [];

    if (action === 'labeled' && labels.includes('ai-fix')) {
      try {
        console.log(`Auto-fix triggered for issue #${issue.number}`);
        
        // Find the issue in our database
        const dbIssue = await prisma.issue.findFirst({
          where: {
            number: issue.number,
            projectId,
          },
        });

        if (dbIssue) {
          const openaiApiKey = process.env.OPENAI_API_KEY;
          if (openaiApiKey) {
            const aiFixService = new AIFixService(openaiApiKey, githubToken);
            const fixResult = await aiFixService.generateAndApplyFix(dbIssue.id);
            
            return {
              success: true,
              message: `Issue ${action} event processed - auto-fix applied with ${(fixResult.confidence * 100).toFixed(1)}% confidence. PR: ${fixResult.pullRequestUrl}`,
            };
          }
        }
      } catch (autoFixError) {
        console.error('Auto-fix failed for issue:', autoFixError);
        // Continue with normal processing
      }
    }

    return {
      success: true,
      message: `Issue ${action} event processed - synced ${syncResult.successful} issues`,
    };
  } catch (error) {
    console.error('Error handling issue webhook:', error);
    return {
      success: false,
      message: `Failed to handle issue event: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const githubEvent = headersList.get('x-github-event');
    const githubSignature = headersList.get('x-hub-signature-256');
    const githubDelivery = headersList.get('x-github-delivery');

    if (!githubEvent) {
      return NextResponse.json(
        createApiError('Missing GitHub event type header', 'MISSING_HEADER'),
        { status: 400 }
      );
    }

    // Get raw body for signature validation
    const body = await req.text();
    let eventData: PullRequestWebhookEvent | IssueWebhookEvent;
    
    try {
      eventData = JSON.parse(body) as PullRequestWebhookEvent | IssueWebhookEvent;
    } catch {
      return NextResponse.json(
        createApiError('Invalid JSON payload', 'INVALID_PAYLOAD'),
        { status: 400 }
      );
    }

    // Extract repository info to find associated project
    const repository = eventData.repository;
    if (!repository?.html_url) {
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
            repository.html_url,
            repository.html_url.replace('.git', ''),
            repository.html_url + '.git',
          ]
        }
      }
    });

    if (!project) {
      console.warn(`Webhook received for unknown repository: ${repository.html_url}`);
      return NextResponse.json(
        createApiError('Project not found for repository', 'PROJECT_NOT_FOUND'),
        { status: 404 }
      );
    }

    // Verify webhook signature (optional for now)
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret && githubSignature) {
      const isValid = await verifyGitHubSignature(body, githubSignature, webhookSecret);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return NextResponse.json(
          createApiError('Invalid webhook signature', 'INVALID_SIGNATURE'),
          { status: 401 }
        );
      }
    }

    let result: { success: boolean; message: string } = { success: false, message: 'Event not processed' };

    // Process specific events for PR/Issue management
    switch (githubEvent) {
      case 'pull_request':
        result = await handlePullRequestEvent(project.id, eventData as PullRequestWebhookEvent);
        break;
      
      case 'issues':
        result = await handleIssueEvent(project.id, eventData as IssueWebhookEvent);
        break;
      
      default:
        result = {
          success: true,
          message: `Event ${githubEvent} received but not processed by PR/Issue sync`,
        };
        break;
    }

    console.log(`GitHub webhook processed: ${githubEvent} for project ${project.id}`);
    console.log(`Result: ${result.success ? 'SUCCESS' : 'FAILURE'} - ${result.message}`);

    return NextResponse.json(createApiSuccess({
      message: result.message,
      eventType: githubEvent,
      deliveryId: githubDelivery,
      projectId: project.id,
      success: result.success,
    }));

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      createApiError('Internal webhook processing error', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// Handle other HTTP methods
export async function GET() {
  return NextResponse.json(
    createApiError('Method not allowed - use POST for webhooks', 'METHOD_NOT_ALLOWED'),
    { status: 405 }
  );
}