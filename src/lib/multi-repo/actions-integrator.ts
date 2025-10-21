/**
 * GitHub Actions Integration System
 * 
 * Integrates with GitHub Actions to fetch workflow runs, jobs, and logs
 * for repositories in a workspace. Provides real-time status monitoring
 * and historical analysis of CI/CD pipelines.
 * 
 * Features:
 * - Workflow run fetching with filtering
 * - Job-level log retrieval
 * - Step-level execution details
 * - Error detection and extraction
 * - Multi-repository scanning
 * - Real-time status updates
 * 
 * @module ActionsIntegrator
 */

import { Octokit } from '@octokit/rest';
import prisma from '@/lib/db';

/**
 * GitHub Actions workflow run status
 */
export type WorkflowStatus = 
  | 'queued' 
  | 'in_progress' 
  | 'completed' 
  | 'waiting' 
  | 'requested';

/**
 * GitHub Actions workflow run conclusion
 */
export type WorkflowConclusion = 
  | 'success' 
  | 'failure' 
  | 'cancelled' 
  | 'skipped' 
  | 'timed_out' 
  | 'action_required'
  | 'neutral'
  | 'startup_failure'
  | null;

/**
 * GitHub Actions job status
 */
export type JobStatus = 
  | 'queued' 
  | 'in_progress' 
  | 'completed' 
  | 'waiting';

/**
 * GitHub Actions job conclusion
 */
export type JobConclusion = 
  | 'success' 
  | 'failure' 
  | 'cancelled' 
  | 'skipped'
  | null;

/**
 * Workflow run information
 */
export interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: WorkflowStatus;
  conclusion: WorkflowConclusion;
  workflow_id: number;
  workflow_name: string;
  run_number: number;
  event: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  repository: {
    owner: string;
    name: string;
  };
}

/**
 * Job information within a workflow run
 */
export interface Job {
  id: number;
  run_id: number;
  name: string;
  status: JobStatus;
  conclusion: JobConclusion;
  started_at: string;
  completed_at: string | null;
  html_url: string | null;
  steps: JobStep[];
  runner_name: string | null;
  runner_group_name: string | null;
}

/**
 * Step within a job
 */
export interface JobStep {
  name: string;
  status: JobStatus;
  conclusion: JobConclusion;
  number: number;
  started_at: string;
  completed_at: string | null;
}

/**
 * Log entry from a job
 */
export interface JobLog {
  job_id: number;
  job_name: string;
  content: string;
  size: number;
  has_errors: boolean;
  error_lines: string[];
}

/**
 * Workspace-level workflow run summary
 */
export interface WorkspaceSummary {
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  in_progress_runs: number;
  recent_runs: WorkflowRun[];
  repositories: {
    owner: string;
    name: string;
    runs: number;
    failures: number;
  }[];
}

/**
 * Options for fetching workflow runs
 */
export interface FetchRunsOptions {
  status?: WorkflowStatus;
  branch?: string;
  event?: string;
  created?: string; // ISO 8601 format (e.g., ">=2024-01-01")
  per_page?: number;
  page?: number;
}

/**
 * GitHub Actions Integrator
 * 
 * Manages integration with GitHub Actions API to fetch workflow runs,
 * jobs, and logs for repositories in a workspace.
 */
export class ActionsIntegrator {
  private octokit: Octokit;

  constructor(githubToken: string) {
    this.octokit = new Octokit({
      auth: githubToken,
    });
  }

  /**
   * Fetch workflow runs for a repository
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param options - Filtering options
   * @returns Array of workflow runs
   */
  async fetchWorkflowRuns(
    owner: string,
    repo: string,
    options: FetchRunsOptions = {}
  ): Promise<WorkflowRun[]> {
    try {
      const response = await this.octokit.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        status: options.status,
        branch: options.branch,
        event: options.event,
        created: options.created,
        per_page: options.per_page || 30,
        page: options.page || 1,
      });

      return response.data.workflow_runs.map((run) => ({
        id: run.id,
        name: run.name || 'Unnamed Workflow',
        head_branch: run.head_branch || '',
        head_sha: run.head_sha,
        status: run.status as WorkflowStatus,
        conclusion: run.conclusion as WorkflowConclusion,
        workflow_id: run.workflow_id,
        workflow_name: run.name || 'Unnamed Workflow',
        run_number: run.run_number,
        event: run.event,
        created_at: run.created_at,
        updated_at: run.updated_at,
        html_url: run.html_url,
        repository: {
          owner,
          name: repo,
        },
      }));
    } catch (error) {
      console.error(`Error fetching workflow runs for ${owner}/${repo}:`, error);
      throw error;
    }
  }

  /**
   * Fetch jobs for a specific workflow run
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param runId - Workflow run ID
   * @returns Array of jobs with steps
   */
  async fetchJobsForRun(
    owner: string,
    repo: string,
    runId: number
  ): Promise<Job[]> {
    try {
      const response = await this.octokit.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: runId,
      });

      return response.data.jobs.map((job) => ({
        id: job.id,
        run_id: job.run_id,
        name: job.name,
        status: job.status as JobStatus,
        conclusion: job.conclusion as JobConclusion,
        started_at: job.started_at || '',
        completed_at: job.completed_at,
        html_url: job.html_url,
        steps: job.steps?.map((step) => ({
          name: step.name,
          status: step.status as JobStatus,
          conclusion: step.conclusion as JobConclusion,
          number: step.number,
          started_at: step.started_at || '',
          completed_at: step.completed_at || null,
        })) || [],
        runner_name: job.runner_name,
        runner_group_name: job.runner_group_name,
      }));
    } catch (error) {
      console.error(`Error fetching jobs for run ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch logs for a specific job
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param jobId - Job ID
   * @returns Job log with error detection
   */
  async fetchJobLogs(
    owner: string,
    repo: string,
    jobId: number
  ): Promise<JobLog> {
    try {
      // Fetch the job details to get the job name
      const jobResponse = await this.octokit.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: 0, // We'll use a different approach
      });

      const job = jobResponse.data.jobs.find((j) => j.id === jobId);
      const jobName = job?.name || 'Unknown Job';

      // Fetch the logs
      const response = await this.octokit.actions.downloadJobLogsForWorkflowRun({
        owner,
        repo,
        job_id: jobId,
      });

      const content = typeof response.data === 'string' 
        ? response.data 
        : new TextDecoder().decode(response.data as ArrayBuffer);

      // Detect errors in logs
      const errorLines = this.extractErrorLines(content);

      return {
        job_id: jobId,
        job_name: jobName,
        content,
        size: content.length,
        has_errors: errorLines.length > 0,
        error_lines: errorLines,
      };
    } catch (error) {
      console.error(`Error fetching logs for job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Extract error lines from log content
   * 
   * @param content - Log content
   * @returns Array of error lines
   */
  private extractErrorLines(content: string): string[] {
    const lines = content.split('\n');
    const errorLines: string[] = [];
    
    // Common error patterns
    const errorPatterns = [
      /error:/i,
      /failed/i,
      /exception/i,
      /fatal:/i,
      /critical:/i,
      /\[ERROR\]/i,
      /❌/,
      /✗/,
      /build failed/i,
      /test failed/i,
      /compilation error/i,
      /syntax error/i,
      /cannot find/i,
      /undefined reference/i,
      /segmentation fault/i,
    ];

    for (const line of lines) {
      if (errorPatterns.some((pattern) => pattern.test(line))) {
        errorLines.push(line.trim());
      }
    }

    return errorLines.slice(0, 50); // Limit to first 50 error lines
  }

  /**
   * Scan all repositories in a workspace for workflow runs
   * 
   * @param workspaceId - Workspace ID
   * @param options - Filtering options
   * @returns Workspace summary with all runs
   */
  async scanWorkspace(
    workspaceId: string,
    options: FetchRunsOptions = {}
  ): Promise<WorkspaceSummary> {
    try {
      // Fetch workspace
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }

      // Parse repositories from JSON
      const repositories = Array.isArray(workspace.repositories)
        ? workspace.repositories
        : [];

      const allRuns: WorkflowRun[] = [];
      const repoStats: Map<string, { runs: number; failures: number }> = new Map();

      // Fetch runs for each repository
      for (const repo of repositories) {
        const fullName = typeof repo === 'string' ? repo : (repo as { fullName?: string }).fullName;
        if (!fullName || !fullName.includes('/')) continue;
        
        const [owner, name] = fullName.split('/');
        
        try {
          const runs = await this.fetchWorkflowRuns(owner, name, options);
          allRuns.push(...runs);

          // Calculate stats
          const failures = runs.filter(
            (r) => r.conclusion === 'failure' || r.conclusion === 'timed_out'
          ).length;

          repoStats.set(fullName, {
            runs: runs.length,
            failures,
          });
        } catch (error) {
          console.error(`Error fetching runs for ${fullName}:`, error);
          // Continue with other repositories
        }
      }

      // Sort runs by creation date (newest first)
      allRuns.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Calculate summary statistics
      const totalRuns = allRuns.length;
      const successfulRuns = allRuns.filter((r) => r.conclusion === 'success').length;
      const failedRuns = allRuns.filter(
        (r) => r.conclusion === 'failure' || r.conclusion === 'timed_out'
      ).length;
      const inProgressRuns = allRuns.filter(
        (r) => r.status === 'in_progress' || r.status === 'queued'
      ).length;

      return {
        total_runs: totalRuns,
        successful_runs: successfulRuns,
        failed_runs: failedRuns,
        in_progress_runs: inProgressRuns,
        recent_runs: allRuns.slice(0, 20), // Last 20 runs
        repositories: Array.from(repoStats.entries()).map(([fullName, stats]) => {
          const [owner, name] = fullName.split('/');
          return {
            owner,
            name,
            runs: stats.runs,
            failures: stats.failures,
          };
        }),
      };
    } catch (error) {
      console.error(`Error scanning workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Get failed runs for a workspace
   * 
   * @param workspaceId - Workspace ID
   * @param limit - Maximum number of failed runs to return
   * @returns Array of failed workflow runs
   */
  async getFailedRuns(
    workspaceId: string,
    limit: number = 10
  ): Promise<WorkflowRun[]> {
    const summary = await this.scanWorkspace(workspaceId, {
      status: 'completed',
      per_page: 100,
    });

    return summary.recent_runs
      .filter((run) => run.conclusion === 'failure' || run.conclusion === 'timed_out')
      .slice(0, limit);
  }

  /**
   * Get detailed information about a specific workflow run
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param runId - Workflow run ID
   * @returns Workflow run with jobs and logs
   */
  async getRunDetails(
    owner: string,
    repo: string,
    runId: number
  ): Promise<{
    run: WorkflowRun;
    jobs: Job[];
    logs: JobLog[];
  }> {
    try {
      // Fetch the run
      const runs = await this.fetchWorkflowRuns(owner, repo, { per_page: 100 });
      const run = runs.find((r) => r.id === runId);

      if (!run) {
        throw new Error(`Workflow run ${runId} not found`);
      }

      // Fetch jobs for the run
      const jobs = await this.fetchJobsForRun(owner, repo, runId);

      // Fetch logs for failed jobs
      const logs: JobLog[] = [];
      for (const job of jobs) {
        if (job.conclusion === 'failure') {
          try {
            const log = await this.fetchJobLogs(owner, repo, job.id);
            logs.push(log);
          } catch (error) {
            console.error(`Error fetching logs for job ${job.id}:`, error);
            // Continue with other jobs
          }
        }
      }

      return { run, jobs, logs };
    } catch (error) {
      console.error(`Error getting run details for ${runId}:`, error);
      throw error;
    }
  }
}
