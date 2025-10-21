/**
 * GitHub Actions Analyzer with AI-Powered Error Summarization
 * 
 * Analyzes GitHub Actions workflow runs, jobs, and logs to provide
 * intelligent error detection, categorization, and AI-powered summaries.
 * Integrates with OpenAI to generate human-readable error explanations
 * and suggested fixes.
 * 
 * Features:
 * - Error pattern detection and categorization
 * - AI-powered error summarization
 * - Root cause analysis
 * - Fix suggestions
 * - Failure trend analysis
 * - Build health metrics
 * 
 * @module ActionsAnalyzer
 */

import OpenAI from 'openai';
import type {
  WorkflowRun,
  Job,
  JobLog,
} from './actions-integrator';

/**
 * Error category types
 */
export type ErrorCategory =
  | 'build'
  | 'test'
  | 'lint'
  | 'deployment'
  | 'dependency'
  | 'timeout'
  | 'infrastructure'
  | 'permission'
  | 'configuration'
  | 'unknown';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Detected error information
 */
export interface DetectedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  location: {
    job_name: string;
    step_name?: string;
    line_number?: number;
  };
  context: string[]; // Surrounding log lines
  patterns_matched: string[];
}

/**
 * AI-generated error summary
 */
export interface ErrorSummary {
  title: string;
  description: string;
  root_cause: string;
  suggested_fixes: string[];
  related_errors: number;
  confidence: number; // 0-1
}

/**
 * Analyzed workflow run
 */
export interface AnalyzedRun {
  run: WorkflowRun;
  jobs: Job[];
  errors: DetectedError[];
  summary: ErrorSummary | null;
  metrics: {
    total_duration: number; // seconds
    failed_jobs: number;
    total_jobs: number;
    error_count: number;
    critical_errors: number;
  };
}

/**
 * Failure trend data
 */
export interface FailureTrend {
  date: string;
  failures: number;
  total_runs: number;
  failure_rate: number;
  common_errors: {
    category: ErrorCategory;
    count: number;
  }[];
}

/**
 * Build health metrics
 */
export interface BuildHealth {
  overall_status: 'healthy' | 'warning' | 'critical';
  success_rate: number;
  average_duration: number;
  failure_trends: FailureTrend[];
  most_common_failures: {
    category: ErrorCategory;
    count: number;
    percentage: number;
  }[];
  recommendations: string[];
}

/**
 * GitHub Actions Analyzer
 * 
 * Analyzes GitHub Actions data with AI-powered error detection
 * and summarization capabilities.
 */
export class ActionsAnalyzer {
  private openai: OpenAI | null = null;

  constructor(openaiApiKey?: string) {
    if (openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: openaiApiKey,
      });
    }
  }

  /**
   * Analyze a workflow run with AI-powered error detection
   * 
   * @param run - Workflow run to analyze
   * @param jobs - Jobs in the workflow run
   * @param logs - Logs from failed jobs
   * @returns Analyzed run with errors and AI summary
   */
  async analyzeRun(
    run: WorkflowRun,
    jobs: Job[],
    logs: JobLog[]
  ): Promise<AnalyzedRun> {
    // Detect errors from logs
    const errors = this.detectErrors(logs, jobs);

    // Generate AI summary if OpenAI is configured
    let summary: ErrorSummary | null = null;
    if (this.openai && errors.length > 0) {
      summary = await this.generateErrorSummary(run, errors, logs);
    }

    // Calculate metrics
    const failedJobs = jobs.filter((job) => job.conclusion === 'failure').length;
    const criticalErrors = errors.filter((e) => e.severity === 'critical').length;

    // Calculate total duration
    const completedJobs = jobs.filter((job) => job.completed_at);
    const totalDuration = completedJobs.reduce((sum, job) => {
      const start = new Date(job.started_at).getTime();
      const end = new Date(job.completed_at!).getTime();
      return sum + (end - start) / 1000; // Convert to seconds
    }, 0);

    return {
      run,
      jobs,
      errors,
      summary,
      metrics: {
        total_duration: Math.round(totalDuration),
        failed_jobs: failedJobs,
        total_jobs: jobs.length,
        error_count: errors.length,
        critical_errors: criticalErrors,
      },
    };
  }

  /**
   * Detect errors from job logs
   * 
   * @param logs - Job logs to analyze
   * @param jobs - Jobs for context
   * @returns Array of detected errors
   */
  private detectErrors(logs: JobLog[], jobs: Job[]): DetectedError[] {
    const errors: DetectedError[] = [];

    for (const log of logs) {
      const job = jobs.find((j) => j.id === log.job_id);
      if (!job) continue;

      // Analyze error lines
      for (const errorLine of log.error_lines) {
        const error = this.categorizeError(errorLine, log, job);
        if (error) {
          errors.push(error);
        }
      }
    }

    // Deduplicate similar errors
    return this.deduplicateErrors(errors);
  }

  /**
   * Categorize an error based on its message
   * 
   * @param errorLine - Error line from logs
   * @param log - Full job log
   * @param job - Job information
   * @returns Detected error or null
   */
  private categorizeError(
    errorLine: string,
    log: JobLog,
    job: Job
  ): DetectedError | null {
    const patterns = {
      build: [
        /compilation error/i,
        /build failed/i,
        /cannot find module/i,
        /module not found/i,
        /syntax error/i,
        /parse error/i,
      ],
      test: [
        /test failed/i,
        /assertion error/i,
        /expected.*but got/i,
        /\d+ failing/i,
        /spec failed/i,
      ],
      lint: [
        /eslint/i,
        /prettier/i,
        /lint error/i,
        /style violation/i,
      ],
      deployment: [
        /deployment failed/i,
        /deploy error/i,
        /rollback/i,
        /publish failed/i,
      ],
      dependency: [
        /npm err!/i,
        /yarn error/i,
        /pnpm err!/i,
        /package.*not found/i,
        /dependency resolution/i,
        /peer dependency/i,
      ],
      timeout: [
        /timeout/i,
        /timed out/i,
        /exceeded.*time limit/i,
      ],
      infrastructure: [
        /runner.*error/i,
        /docker.*error/i,
        /network error/i,
        /connection refused/i,
        /econnrefused/i,
      ],
      permission: [
        /permission denied/i,
        /access denied/i,
        /unauthorized/i,
        /forbidden/i,
        /eacces/i,
      ],
      configuration: [
        /configuration error/i,
        /invalid configuration/i,
        /config.*not found/i,
        /environment variable.*not set/i,
      ],
    };

    // Find matching category
    let category: ErrorCategory = 'unknown';
    const matchedPatterns: string[] = [];

    for (const [cat, patternList] of Object.entries(patterns)) {
      for (const pattern of patternList) {
        if (pattern.test(errorLine)) {
          category = cat as ErrorCategory;
          matchedPatterns.push(pattern.source);
          break;
        }
      }
      if (category !== 'unknown') break;
    }

    // Determine severity
    const severity = this.determineSeverity(category, errorLine);

    // Extract context (lines around the error)
    const context = this.extractContext(errorLine, log.content);

    return {
      category,
      severity,
      message: errorLine,
      location: {
        job_name: job.name,
        step_name: this.findStepName(job),
      },
      context,
      patterns_matched: matchedPatterns,
    };
  }

  /**
   * Determine error severity
   * 
   * @param category - Error category
   * @param message - Error message
   * @returns Error severity
   */
  private determineSeverity(
    category: ErrorCategory,
    message: string
  ): ErrorSeverity {
    // Critical patterns
    if (
      /critical/i.test(message) ||
      /fatal/i.test(message) ||
      /security/i.test(message) ||
      category === 'deployment'
    ) {
      return 'critical';
    }

    // High severity
    if (
      /error/i.test(message) ||
      category === 'build' ||
      category === 'test' ||
      category === 'dependency'
    ) {
      return 'high';
    }

    // Medium severity
    if (
      /warning/i.test(message) ||
      category === 'lint' ||
      category === 'configuration'
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Extract context lines around an error
   * 
   * @param errorLine - Error line
   * @param fullContent - Full log content
   * @returns Array of context lines
   */
  private extractContext(errorLine: string, fullContent: string): string[] {
    const lines = fullContent.split('\n');
    const errorIndex = lines.findIndex((line) => line.includes(errorLine));

    if (errorIndex === -1) return [];

    // Get 2 lines before and after
    const start = Math.max(0, errorIndex - 2);
    const end = Math.min(lines.length, errorIndex + 3);

    return lines.slice(start, end).map((line) => line.trim());
  }

  /**
   * Find the step name where an error occurred
   * 
   * @param job - Job information
   * @returns Step name or undefined
   */
  private findStepName(job: Job): string | undefined {
    // Try to find a failed step
    const failedStep = job.steps.find((step) => step.conclusion === 'failure');
    return failedStep?.name;
  }

  /**
   * Deduplicate similar errors
   * 
   * @param errors - Array of detected errors
   * @returns Deduplicated errors
   */
  private deduplicateErrors(errors: DetectedError[]): DetectedError[] {
    const unique: Map<string, DetectedError> = new Map();

    for (const error of errors) {
      // Create a key based on category, severity, and message pattern
      const key = `${error.category}-${error.severity}-${error.message.slice(0, 100)}`;
      
      if (!unique.has(key)) {
        unique.set(key, error);
      }
    }

    return Array.from(unique.values());
  }

  /**
   * Generate AI-powered error summary
   * 
   * @param run - Workflow run
   * @param errors - Detected errors
   * @param logs - Job logs
   * @returns Error summary with AI insights
   */
  private async generateErrorSummary(
    run: WorkflowRun,
    errors: DetectedError[],
    logs: JobLog[]
  ): Promise<ErrorSummary> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Prepare context for AI
    const errorContext = errors.slice(0, 10).map((e) => ({
      category: e.category,
      severity: e.severity,
      message: e.message,
      job: e.location.job_name,
      step: e.location.step_name,
    }));

    const logSample = logs
      .flatMap((log) => log.error_lines.slice(0, 5))
      .slice(0, 20)
      .join('\n');

    const prompt = `Analyze this GitHub Actions workflow failure and provide a concise summary:

Workflow: ${run.workflow_name}
Run Number: ${run.run_number}
Branch: ${run.head_branch}
Event: ${run.event}

Detected Errors (${errors.length}):
${JSON.stringify(errorContext, null, 2)}

Sample Error Logs:
${logSample}

Please provide:
1. A brief title describing the main issue
2. A description of what went wrong
3. The likely root cause
4. 2-3 specific suggested fixes
5. A confidence score (0-1) for your analysis

Format your response as JSON:
{
  "title": "...",
  "description": "...",
  "root_cause": "...",
  "suggested_fixes": ["...", "..."],
  "confidence": 0.85
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing CI/CD failures and providing actionable insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse JSON response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        title: parsed.title || 'Workflow Failure',
        description: parsed.description || 'Unable to analyze',
        root_cause: parsed.root_cause || 'Unknown',
        suggested_fixes: parsed.suggested_fixes || [],
        related_errors: errors.length,
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.error('Error generating AI summary:', error);
      
      // Fallback to basic summary
      return this.generateBasicSummary(errors);
    }
  }

  /**
   * Generate basic error summary without AI
   * 
   * @param errors - Detected errors
   * @returns Basic error summary
   */
  private generateBasicSummary(errors: DetectedError[]): ErrorSummary {
    const categories = errors.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + 1;
      return acc;
    }, {} as Record<ErrorCategory, number>);

    const mainCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    return {
      title: `${mainCategory.charAt(0).toUpperCase() + mainCategory.slice(1)} Failure`,
      description: `Detected ${errors.length} error(s) in workflow execution.`,
      root_cause: `Multiple ${mainCategory} errors detected in the workflow.`,
      suggested_fixes: [
        'Review the error logs for detailed information',
        'Check recent code changes that may have introduced the issue',
        'Verify all dependencies and configurations are correct',
      ],
      related_errors: errors.length,
      confidence: 0.5,
    };
  }

  /**
   * Analyze failure trends over time
   * 
   * @param runs - Historical workflow runs
   * @returns Failure trend analysis
   */
  analyzeFailureTrends(runs: WorkflowRun[]): FailureTrend[] {
    // Group runs by date
    const runsByDate: Map<string, WorkflowRun[]> = new Map();

    for (const run of runs) {
      const date = new Date(run.created_at).toISOString().split('T')[0];
      if (!runsByDate.has(date)) {
        runsByDate.set(date, []);
      }
      runsByDate.get(date)!.push(run);
    }

    // Calculate trends
    return Array.from(runsByDate.entries())
      .map(([date, dateRuns]) => {
        const totalRuns = dateRuns.length;
        const failures = dateRuns.filter(
          (r) => r.conclusion === 'failure' || r.conclusion === 'timed_out'
        ).length;

        return {
          date,
          failures,
          total_runs: totalRuns,
          failure_rate: totalRuns > 0 ? failures / totalRuns : 0,
          common_errors: [], // Would need logs to determine
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Calculate build health metrics
   * 
   * @param runs - Historical workflow runs
   * @param analyzedRuns - Analyzed runs with error details
   * @returns Build health metrics
   */
  calculateBuildHealth(
    runs: WorkflowRun[],
    analyzedRuns: AnalyzedRun[]
  ): BuildHealth {
    const completedRuns = runs.filter((r) => r.status === 'completed');
    const successfulRuns = completedRuns.filter((r) => r.conclusion === 'success');
    const successRate = completedRuns.length > 0 
      ? successfulRuns.length / completedRuns.length 
      : 0;

    // Calculate average duration
    const totalDuration = analyzedRuns.reduce((sum, r) => sum + r.metrics.total_duration, 0);
    const averageDuration = analyzedRuns.length > 0 
      ? totalDuration / analyzedRuns.length 
      : 0;

    // Count error categories
    const errorCategories: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>;
    for (const analyzed of analyzedRuns) {
      for (const error of analyzed.errors) {
        errorCategories[error.category] = (errorCategories[error.category] || 0) + 1;
      }
    }

    const totalErrors = Object.values(errorCategories).reduce((sum, count) => sum + count, 0);
    const mostCommonFailures = Object.entries(errorCategories)
      .map(([category, count]) => ({
        category: category as ErrorCategory,
        count,
        percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Determine overall status
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (successRate < 0.5) {
      overallStatus = 'critical';
    } else if (successRate < 0.8) {
      overallStatus = 'warning';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (successRate < 0.8) {
      recommendations.push('Success rate is below 80%. Investigate recent failures.');
    }
    if (averageDuration > 600) {
      recommendations.push('Average build time exceeds 10 minutes. Consider optimization.');
    }
    if (mostCommonFailures[0]?.count > 5) {
      recommendations.push(`Recurring ${mostCommonFailures[0].category} errors detected. Address systematically.`);
    }

    return {
      overall_status: overallStatus,
      success_rate: successRate,
      average_duration: Math.round(averageDuration),
      failure_trends: this.analyzeFailureTrends(runs),
      most_common_failures: mostCommonFailures,
      recommendations,
    };
  }
}
