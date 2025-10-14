// GitHub webhook handler - /api/github/webhook
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import prisma from '@/lib/db';
import { logger } from '@/lib/logger';
import { CacheService } from '@/lib/cache-service';
import { getRealTimeAnalyticsService } from '@/lib/realtime-analytics';
import { 
  createApiError,
  createApiSuccess 
} from '../../../../types';
import {
  GitHubPushEventSchema,
  GitHubPullRequestEventSchema,
  GitHubIssuesEventSchema,
  GitHubReleaseEventSchema,
  WorkflowRunEventSchema,
  CheckSuiteEventSchema,
  shouldReindexProject,
  getEventDescription,
  type GitHubWebhookEvent,
  type WorkflowRunEvent,
  type CheckSuiteEvent,
  GITHUB_EVENTS,
  AUTO_FIX_TRIGGERS,
} from '../../../../types/github';
import { ciIntegration } from '../../../../lib/ci-integration';
import { jobQueue, JobType, type PRAnalysisJobData } from '../../../../lib/job-queue';
import { JobType as FullIndexJobType, type FullIndexJobData } from '../../../../lib/job-processors';
import { analyzeAndAutoFix } from '../../../../lib/analyzeLogs';
import { Octokit } from '@octokit/rest';
import { env } from '../../../../types/env';
/**
 * Fetch workflow run logs from GitHub API
 */
async function fetchWorkflowRunLogs(
  repository: { owner: { login: string }; name: string },
  runId: number
): Promise<string | null> {
  try {
    // Create GitHub client
    const octokit = new Octokit({
      auth: env.GITHUB_PRIVATE_KEY ? undefined : env.GITHUB_TOKEN,
    });

    // Get workflow run jobs
    const { data: jobs } = await octokit.rest.actions.listJobsForWorkflowRun({
      owner: repository.owner.login,
      repo: repository.name,
      run_id: runId,
    });

    // Collect logs from all failed jobs
    const logContents: string[] = [];

    for (const job of jobs.jobs) {
      if (job.conclusion === 'failure') {
        try {
          // Get job logs
          const { data: logData } = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
            owner: repository.owner.login,
            repo: repository.name,
            job_id: job.id,
          });

          if (logData && typeof logData === 'string') {
            logContents.push(`=== Job: ${job.name} ===\n${logData}\n`);
          }
        } catch {
          logger.warn('Failed to fetch job logs', {
            jobId: job.id,
            jobName: job.name,
          });
        }
      }
    }

    return logContents.length > 0 ? logContents.join('\n') : null;

  } catch (error) {
    logger.error('Failed to fetch workflow run logs', {
      owner: repository.owner.login,
      repo: repository.name,
      runId,
    }, error as Error);
    
    return null;
  }
}

/**
 * Fetch check suite logs from GitHub API
 */
async function fetchCheckSuiteLogs(
  repository: { owner: { login: string }; name: string },
  checkSuiteId: number
): Promise<string | null> {
  try {
    // Create GitHub client
    const octokit = new Octokit({
      auth: env.GITHUB_PRIVATE_KEY ? undefined : env.GITHUB_TOKEN,
    });

    // Get check runs for the check suite
    const { data: checkRuns } = await octokit.rest.checks.listForSuite({
      owner: repository.owner.login,
      repo: repository.name,
      check_suite_id: checkSuiteId,
    });

    // Collect logs from all failed check runs
    const logContents: string[] = [];

    for (const checkRun of checkRuns.check_runs) {
      if (checkRun.conclusion === 'failure') {
        try {
          // Get check run details which may include logs in output
          const { data: checkRunDetails } = await octokit.rest.checks.get({
            owner: repository.owner.login,
            repo: repository.name,
            check_run_id: checkRun.id,
          });

          if (checkRunDetails.output?.text) {
            logContents.push(`=== Check: ${checkRun.name} ===\n${checkRunDetails.output.text}\n`);
          } else if (checkRunDetails.output?.summary) {
            logContents.push(`=== Check: ${checkRun.name} ===\n${checkRunDetails.output.summary}\n`);
          }
        } catch {
          logger.warn('Failed to fetch check run details', {
            checkRunId: checkRun.id,
            checkRunName: checkRun.name,
          });
        }
      }
    }

    return logContents.length > 0 ? logContents.join('\n') : null;

  } catch (error) {
    logger.error('Failed to fetch check suite logs', {
      owner: repository.owner.login,
      repo: repository.name,
      checkSuiteId,
    }, error as Error);
    
    return null;
  }
}

// Process GitHub webhook event
async function processWebhookEvent(
  eventType: string,
  eventData: Record<string, unknown>,
  projectId: string
): Promise<{ success: boolean; message: string; shouldReindex?: boolean; ciJobId?: string }> {
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
      
      case AUTO_FIX_TRIGGERS.WORKFLOW_RUN:
        parsedEvent = { event_type: 'workflow_run', ...WorkflowRunEventSchema.parse(eventData) };
        break;
      
      case AUTO_FIX_TRIGGERS.CHECK_SUITE:
        parsedEvent = { event_type: 'check_suite', ...CheckSuiteEventSchema.parse(eventData) };
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

    // Invalidate analytics cache for this project since data may have changed
    await CacheService.markProjectAsUpdated(projectId);
    
    // Notify real-time analytics service
    const realTimeService = getRealTimeAnalyticsService();
    await realTimeService.handleWebhookEvent(projectId, eventType, eventData);

    // Check if project should be reindexed
    const shouldReindex = shouldReindexProject(parsedEvent);
    
    // Process with CI integration system for automatic analysis
    const ciResult = await ciIntegration.processWebhookEvent(parsedEvent, projectId);
    
    // Handle pull request events with automated analysis
    if (eventType === GITHUB_EVENTS.PULL_REQUEST && parsedEvent.event_type === 'pull_request') {
      const prEvent = parsedEvent;
      const { action, pull_request, repository } = prEvent;
      
      // Analyze PR on open or synchronize (new commits)
      if (action === 'opened' || action === 'synchronize') {
        try {
          // Create PR analysis job data
          const prAnalysisJob: PRAnalysisJobData = {
            type: JobType.PR_ANALYSIS,
            projectId,
            repository: {
              owner: repository.owner.login,
              name: repository.name,
            },
            pullRequest: {
              number: pull_request.number,
              title: pull_request.title,
              sha: pull_request.head.sha,
            },
            priority: 5,
            maxRetries: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          // Queue PR analysis job
          const analysisJobId = await jobQueue.addJob(prAnalysisJob);
          
          logger.info('PR analysis job queued', {
            projectId,
            pullNumber: pull_request.number,
            jobId: analysisJobId,
          });
          
          return {
            success: true,
            message: `${description} - PR analysis queued: ${analysisJobId}`,
            shouldReindex,
            ciJobId: analysisJobId,
          };
        } catch (error) {
          logger.error('Failed to queue PR analysis', {
            projectId,
            pullNumber: pull_request.number,
          }, error as Error);
        }
      }
    }

    // Handle workflow_run events for auto-fix triggers
    if (eventType === AUTO_FIX_TRIGGERS.WORKFLOW_RUN && parsedEvent.event_type === 'workflow_run') {
      const workflowEvent = parsedEvent as WorkflowRunEvent;
      const { action, workflow_run, repository } = workflowEvent;
      
      // Trigger auto-fix on workflow failure
      if (action === 'completed' && workflow_run.conclusion === 'failure') {
        logger.info('Workflow run failed, triggering auto-fix analysis', {
          projectId,
          workflowName: workflow_run.name,
          runNumber: workflow_run.run_number,
          headSha: workflow_run.head_sha,
        });

        try {
          // Fetch workflow run logs for analysis
          const logs = await fetchWorkflowRunLogs(repository, workflow_run.id);
          
          if (logs) {
            // Trigger auto-fix analysis
            const autoFixResult = await analyzeAndAutoFix(
              logs,
              projectId,
              repository.html_url,
              undefined, // No specific user for webhook triggers
              `Repository: ${repository.full_name}, Workflow: ${workflow_run.name}`
            );

            logger.info('Auto-fix analysis completed for failed workflow', {
              projectId,
              workflowName: workflow_run.name,
              analysisSuccess: autoFixResult.analysis.confidence > 0.5,
              fixableIssues: autoFixResult.analysis.fixableIssues.length,
              autoFixSuccess: autoFixResult.autoFixResult?.success,
              prUrl: autoFixResult.autoFixResult?.prUrl,
            });

            return {
              success: true,
              message: `${description} - Auto-fix triggered: ${autoFixResult.analysis.fixableIssues.length} issues analyzed${autoFixResult.autoFixResult?.prUrl ? `, PR created: ${autoFixResult.autoFixResult.prUrl}` : ''}`,
              shouldReindex,
              ciJobId: ciResult.jobId,
            };
          } else {
            logger.warn('Could not fetch workflow run logs for auto-fix', {
              projectId,
              workflowRunId: workflow_run.id,
            });
          }
        } catch (error) {
          logger.error('Failed to process workflow failure for auto-fix', {
            projectId,
            workflowRunId: workflow_run.id,
          }, error as Error);
        }
      }
    }

    // Handle check_suite events for auto-fix triggers  
    if (eventType === AUTO_FIX_TRIGGERS.CHECK_SUITE && parsedEvent.event_type === 'check_suite') {
      const checkSuiteEvent = parsedEvent as CheckSuiteEvent;
      const { action, check_suite, repository } = checkSuiteEvent;
      
      // Trigger auto-fix on check suite failure
      if (action === 'completed' && check_suite.conclusion === 'failure') {
        logger.info('Check suite failed, triggering auto-fix analysis', {
          projectId,
          checkSuiteId: check_suite.id,
          headSha: check_suite.head_sha,
          pullRequests: check_suite.pull_requests.length,
        });

        try {
          // Fetch check suite logs for analysis
          const logs = await fetchCheckSuiteLogs(repository, check_suite.id);
          
          if (logs) {
            // Trigger auto-fix analysis
            const autoFixResult = await analyzeAndAutoFix(
              logs,
              projectId,
              repository.html_url,
              undefined, // No specific user for webhook triggers
              `Repository: ${repository.full_name}, Check Suite: ${check_suite.id}`
            );

            logger.info('Auto-fix analysis completed for failed check suite', {
              projectId,
              checkSuiteId: check_suite.id,
              analysisSuccess: autoFixResult.analysis.confidence > 0.5,
              fixableIssues: autoFixResult.analysis.fixableIssues.length,
              autoFixSuccess: autoFixResult.autoFixResult?.success,
              prUrl: autoFixResult.autoFixResult?.prUrl,
            });

            return {
              success: true,
              message: `${description} - Auto-fix triggered: ${autoFixResult.analysis.fixableIssues.length} issues analyzed${autoFixResult.autoFixResult?.prUrl ? `, PR created: ${autoFixResult.autoFixResult.prUrl}` : ''}`,
              shouldReindex,
              ciJobId: ciResult.jobId,
            };
          } else {
            logger.warn('Could not fetch check suite logs for auto-fix', {
              projectId,
              checkSuiteId: check_suite.id,
            });
          }
        } catch (error) {
          logger.error('Failed to process check suite failure for auto-fix', {
            projectId,
            checkSuiteId: check_suite.id,
          }, error as Error);
        }
      }
    }


    logger.info('GitHub webhook event processed successfully', {
      projectId,
      eventType,
      description,
      shouldReindex,
      ciJobId: ciResult.jobId,
    });

    return {
      success: true,
      message: `${description}${ciResult.jobId ? ` - Analysis job queued: ${ciResult.jobId}` : ''}`,
      shouldReindex,
      ciJobId: ciResult.jobId,
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
    
    // Trigger full repository indexing if needed
    if (result.shouldReindex) {
      logger.info('Triggering full repository reindex due to webhook event', {
        projectId: project.id,
        eventType: githubEvent,
        repositoryUrl,
      });

      try {
        // Create full index job data
        const fullIndexJob: FullIndexJobData = {
          type: FullIndexJobType.FULL_INDEX_PROJECT,
          projectId: project.id,
          githubUrl: project.githubUrl,
          forceReindex: false, // Only reindex changed files
          includeContent: true,
          chunkAndEmbed: true,
          priority: 7, // Higher priority for webhook triggers
          maxRetries: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Queue full indexing job using our enhanced job queue method
        const fullIndexJobResult = await jobQueue.addJobWithConfig({
          type: FullIndexJobType.FULL_INDEX_PROJECT,
          data: fullIndexJob as unknown as Record<string, unknown>,
          priority: 'high',
          retries: 2,
        });

        // Update project status
        await prisma.project.update({
          where: { id: project.id },
          data: { 
            status: 'indexing',
            lastFullScanAt: new Date(), // Track when we triggered full scan
          },
        });

        logger.info('Full repository indexing job queued', {
          projectId: project.id,
          jobId: fullIndexJobResult.id,
          eventType: githubEvent,
          repositoryUrl,
        });

        // Update the result message to include full indexing info
        result.message = `${result.message} - Full indexing queued: ${fullIndexJobResult.id}`;
        result.ciJobId = fullIndexJobResult.id;

      } catch (fullIndexError) {
        logger.error('Failed to queue full indexing job', {
          projectId: project.id,
          eventType: githubEvent,
        }, fullIndexError as Error);

        // Fall back to basic status update
        await prisma.project.update({
          where: { id: project.id },
          data: { 
            lastIndexedAt: null,
            status: 'indexing' 
          },
        });
      }
    }
    
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