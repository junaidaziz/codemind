// CI Integration service for automated code analysis and PR feedback
import { logger } from '../app/lib/logger';
import { jobQueue, JobType, type CodeAnalysisJobData, type PRCommentJobData } from './job-queue';
import prisma from '../app/lib/db';
import { 
  type GitHubWebhookEvent, 
  type GitHubPullRequestEvent,
  type GitHubPushEvent 
} from '../types/github';

// Analysis results structure
export interface CodeAnalysisResult {
  projectId: string;
  commitSha: string;
  analysisId: string;
  metrics: {
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    complexity: number;
    testCoverage?: number;
  };
  findings: {
    critical: CodeFinding[];
    warnings: CodeFinding[];
    suggestions: CodeFinding[];
  };
  summary: string;
  completedAt: string;
  processingTime: number;
}

export interface CodeFinding {
  type: 'security' | 'performance' | 'maintainability' | 'bug' | 'style';
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
  rule?: string;
}

// CI Integration service class
export class CIIntegrationService {
  private static instance: CIIntegrationService;

  public static getInstance(): CIIntegrationService {
    if (!CIIntegrationService.instance) {
      CIIntegrationService.instance = new CIIntegrationService();
    }
    return CIIntegrationService.instance;
  }

  // Process GitHub webhook event for CI integration
  public async processWebhookEvent(
    event: GitHubWebhookEvent,
    projectId: string
  ): Promise<{ success: boolean; jobId?: string; message: string }> {
    try {
      logger.info('Processing CI webhook event', {
        eventType: event.event_type,
        projectId,
      });

      // Determine if this event should trigger analysis
      if (!this.shouldTriggerAnalysis(event)) {
        return {
          success: true,
          message: 'Event received but does not require analysis',
        };
      }

      // Create analysis job based on event type
      const job = await this.createAnalysisJob(event, projectId);
      
      // Queue the job for processing
      const jobId = await jobQueue.addJob(job);
      
      logger.info('CI analysis job queued', {
        jobId,
        projectId,
        eventType: event.event_type,
      });

      return {
        success: true,
        jobId,
        message: 'Analysis job queued successfully',
      };

    } catch (error) {
      logger.error('Failed to process CI webhook event', {
        eventType: event.event_type,
        projectId,
      }, error as Error);

      return {
        success: false,
        message: `Failed to process event: ${(error as Error).message}`,
      };
    }
  }

  // Determine if webhook event should trigger analysis
  private shouldTriggerAnalysis(event: GitHubWebhookEvent): boolean {
    switch (event.event_type) {
      case 'push':
        // Analyze pushes to main branches or with significant changes
        const pushEvent = event as GitHubPushEvent;
        return (
          pushEvent.ref === `refs/heads/${pushEvent.repository.default_branch}` ||
          pushEvent.commits.some(commit => 
            commit.added.length + commit.modified.length + commit.removed.length > 0
          )
        );

      case 'pull_request':
        // Analyze PR opens, updates, and synchronizations
        const prEvent = event as GitHubPullRequestEvent;
        return ['opened', 'synchronize', 'reopened'].includes(prEvent.action);

      default:
        return false;
    }
  }

  // Create analysis job from webhook event
  private async createAnalysisJob(
    event: GitHubWebhookEvent,
    projectId: string
  ): Promise<CodeAnalysisJobData> {
    const now = new Date();
    const baseJob = {
      type: JobType.CODE_ANALYSIS,
      projectId,
      repositoryUrl: event.repository.html_url,
      createdAt: now,
      updatedAt: now,
      metadata: {
        eventData: event as Record<string, unknown>,
        triggeredAt: now.toISOString(),
        triggeredBy: event.sender.login,
      },
    };

    switch (event.event_type) {
      case 'push':
        const pushEvent = event as GitHubPushEvent;
        return {
          ...baseJob,
          type: JobType.CODE_ANALYSIS,
          branch: pushEvent.ref.replace('refs/heads/', ''),
          commitSha: pushEvent.after,
          eventType: 'push' as const,
        };

      case 'pull_request':
        const prEvent = event as GitHubPullRequestEvent;
        return {
          ...baseJob,
          type: JobType.CODE_ANALYSIS,
          branch: prEvent.pull_request.head.ref,
          commitSha: prEvent.pull_request.head.sha,
          pullRequestNumber: prEvent.number,
          eventType: 'pull_request',
        };

      default:
        throw new Error(`Unsupported event type: ${event.event_type}`);
    }
  }

  // Execute code analysis job
  public async executeAnalysisJob(job: CodeAnalysisJobData): Promise<CodeAnalysisResult> {
    const startTime = Date.now();
    const analysisId = `analysis_${job.commitSha}_${startTime}`;

    try {
      logger.info('Starting code analysis', {
        analysisId,
        projectId: job.projectId,
        commitSha: job.commitSha,
      });

      // Step 1: Trigger project reindexing if needed
      await this.triggerReindexing(job.projectId, job.commitSha);

      // Step 2: Perform code analysis
      const analysisResult = await this.performCodeAnalysis(job);

      // Step 3: Store analysis results
      await this.storeAnalysisResults(analysisResult);

      // Step 4: Queue PR comment job if needed
      if (job.pullRequestNumber) {
        await this.queuePRCommentJob(job, analysisResult);
      }

      const processingTime = Date.now() - startTime;
      
      logger.info('Code analysis completed', {
        analysisId,
        projectId: job.projectId,
        processingTime,
      });

      return {
        ...analysisResult,
        processingTime,
        completedAt: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('Code analysis failed', {
        analysisId,
        projectId: job.projectId,
      }, error as Error);

      throw error;
    }
  }

  // Trigger project reindexing
  private async triggerReindexing(projectId: string, commitSha: string): Promise<void> {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'indexing',
        lastIndexedAt: null,
      },
    });

    logger.info('Project reindexing triggered', {
      projectId,
      commitSha,
    });
  }

  // Perform actual code analysis
  private async performCodeAnalysis(job: CodeAnalysisJobData): Promise<CodeAnalysisResult> {
    // Mock analysis for now - in production this would:
    // 1. Clone/pull the repository
    // 2. Run static analysis tools (ESLint, Prettier, etc.)
    // 3. Calculate complexity metrics
    // 4. Run security scans
    // 5. Generate embeddings for new/changed code

    const mockFindings: CodeFinding[] = [
      {
        type: 'security',
        severity: 'medium',
        file: 'src/api/auth.ts',
        line: 42,
        message: 'Potential security vulnerability in JWT handling',
        suggestion: 'Use more secure JWT validation',
        rule: 'security/jwt-validation',
      },
      {
        type: 'performance',
        severity: 'low',
        file: 'src/components/Dashboard.tsx',
        line: 18,
        message: 'Large component could benefit from memoization',
        suggestion: 'Consider using React.memo or useMemo',
        rule: 'performance/react-memo',
      },
    ];

    return {
      projectId: job.projectId,
      commitSha: job.commitSha,
      analysisId: `analysis_${job.commitSha}_${Date.now()}`,
      metrics: {
        filesChanged: 5,
        linesAdded: 127,
        linesRemoved: 43,
        complexity: 8.2,
        testCoverage: 78.5,
      },
      findings: {
        critical: [],
        warnings: mockFindings.filter(f => f.severity === 'high'),
        suggestions: mockFindings.filter(f => f.severity === 'medium' || f.severity === 'low'),
      },
      summary: `Analysis completed for commit ${job.commitSha.slice(0, 7)}. Found ${mockFindings.length} items for review.`,
      completedAt: new Date().toISOString(),
      processingTime: 0, // Will be set by caller
    };
  }

  // Store analysis results in database
  private async storeAnalysisResults(result: CodeAnalysisResult): Promise<void> {
    // Store in messages table for now - in production you'd have a dedicated analysis table
    await prisma.message.create({
      data: {
        sessionId: `analysis-${result.projectId}`,
        role: 'system',
        content: JSON.stringify({
          type: 'code_analysis_result',
          analysisId: result.analysisId,
          commitSha: result.commitSha,
          metrics: result.metrics,
          findings: result.findings,
          summary: result.summary,
          completedAt: result.completedAt,
        }),
      },
    });

    logger.info('Analysis results stored', {
      analysisId: result.analysisId,
      projectId: result.projectId,
    });
  }

  // Queue PR comment job
  private async queuePRCommentJob(
    analysisJob: CodeAnalysisJobData,
    analysisResult: CodeAnalysisResult
  ): Promise<void> {
    if (!analysisJob.pullRequestNumber) return;

    const now = new Date();
    const commentJob: PRCommentJobData = {
      type: JobType.PR_COMMENT,
      projectId: analysisJob.projectId,
      repositoryUrl: analysisJob.repositoryUrl,
      pullRequestNumber: analysisJob.pullRequestNumber,
      createdAt: now,
      updatedAt: now,
      analysisResult: {
        projectId: analysisResult.projectId,
        commitSha: analysisResult.commitSha,
        analysisId: analysisResult.analysisId,
        metrics: analysisResult.metrics as Record<string, number>,
        findings: analysisResult.findings as unknown as Record<string, Array<Record<string, unknown>>>,
        summary: analysisResult.summary,
        completedAt: analysisResult.completedAt,
        processingTime: analysisResult.processingTime,
      },
      metadata: {
        commitSha: analysisJob.commitSha,
        triggeredAt: now.toISOString(),
      },
    };

    await jobQueue.addJob(commentJob);
    
    logger.info('PR comment job queued', {
      projectId: analysisJob.projectId,
      pullRequestNumber: analysisJob.pullRequestNumber,
      analysisId: analysisResult.analysisId,
    });
  }

  // Get analysis history for a project
  public async getAnalysisHistory(
    projectId: string,
    limit: number = 20
  ): Promise<CodeAnalysisResult[]> {
    const messages = await prisma.message.findMany({
      where: {
        sessionId: `analysis-${projectId}`,
        role: 'system',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages
      .map((msg: { content: string }) => {
        try {
          const parsed = JSON.parse(msg.content) as Record<string, unknown>;
          return parsed.type === 'code_analysis_result' ? (parsed as unknown as CodeAnalysisResult) : null;
        } catch {
          return null;
        }
      })
      .filter((result: CodeAnalysisResult | null): result is CodeAnalysisResult => result !== null);
  }
}

// Export singleton instance
export const ciIntegration = CIIntegrationService.getInstance();