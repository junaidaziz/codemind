/**
 * GitHub Checks Service
 * 
 * Integrates test results with GitHub Checks API to display inline in PRs.
 * Provides automated test status badges and CI/CD integration.
 * 
 * @module testing/github-checks-service
 */

import { Octokit } from '@octokit/rest';
import type { GeneratedTestSuite } from './ai-test-generator';
import type { BatchGenerationResult } from './test-generation-orchestrator';

/**
 * Test execution result
 */
export interface TestExecutionResult {
  success: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
  failures: TestFailure[];
  coverage?: CoverageData;
}

/**
 * Test failure information
 */
export interface TestFailure {
  testName: string;
  filePath: string;
  line?: number;
  message: string;
  stack?: string;
  type: 'error' | 'failure' | 'timeout';
}

/**
 * Coverage data
 */
export interface CoverageData {
  lines: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  statements: { total: number; covered: number; percentage: number };
}

/**
 * GitHub check run status
 */
export type CheckStatus = 'queued' | 'in_progress' | 'completed';
export type CheckConclusion = 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'action_required';

/**
 * GitHub Checks Service
 */
export class GitHubChecksService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(githubToken: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: githubToken });
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Create a check run for test generation
   */
  async createTestGenerationCheck(
    headSha: string,
    result: BatchGenerationResult
  ): Promise<number> {
    const status: CheckStatus = 'completed';
    const conclusion: CheckConclusion = result.failureCount === 0 ? 'success' : 'neutral';

    const response = await this.octokit.checks.create({
      owner: this.owner,
      repo: this.repo,
      name: 'Test Generation',
      head_sha: headSha,
      status,
      conclusion,
      completed_at: new Date().toISOString(),
      output: {
        title: `Generated ${result.totalTests} tests for ${result.successCount} files`,
        summary: this.formatGenerationSummary(result),
        text: result.summary,
        annotations: this.createGenerationAnnotations(result),
      },
    });

    return response.data.id;
  }

  /**
   * Create a check run for test execution
   */
  async createTestExecutionCheck(
    headSha: string,
    result: TestExecutionResult
  ): Promise<number> {
    const status: CheckStatus = 'completed';
    const conclusion: CheckConclusion = result.success ? 'success' : 'failure';

    const response = await this.octokit.checks.create({
      owner: this.owner,
      repo: this.repo,
      name: 'Test Execution',
      head_sha: headSha,
      status,
      conclusion,
      completed_at: new Date().toISOString(),
      output: {
        title: this.formatTestTitle(result),
        summary: this.formatTestSummary(result),
        text: this.formatTestDetails(result),
        annotations: this.createTestAnnotations(result),
      },
    });

    return response.data.id;
  }

  /**
   * Update existing check run
   */
  async updateCheckRun(
    checkRunId: number,
    status: CheckStatus,
    conclusion?: CheckConclusion,
    output?: {
      title: string;
      summary: string;
      text?: string;
    }
  ): Promise<void> {
    await this.octokit.checks.update({
      owner: this.owner,
      repo: this.repo,
      check_run_id: checkRunId,
      status,
      conclusion,
      completed_at: status === 'completed' ? new Date().toISOString() : undefined,
      output,
    });
  }

  /**
   * Create check run for coverage report
   */
  async createCoverageCheck(
    headSha: string,
    coverage: CoverageData
  ): Promise<number> {
    const conclusion: CheckConclusion = 
      coverage.lines.percentage >= 80 ? 'success' : 
      coverage.lines.percentage >= 60 ? 'neutral' : 'failure';

    const response = await this.octokit.checks.create({
      owner: this.owner,
      repo: this.repo,
      name: 'Test Coverage',
      head_sha: headSha,
      status: 'completed',
      conclusion,
      completed_at: new Date().toISOString(),
      output: {
        title: `Coverage: ${coverage.lines.percentage.toFixed(1)}%`,
        summary: this.formatCoverageSummary(coverage),
        text: this.formatCoverageDetails(coverage),
      },
    });

    return response.data.id;
  }

  /**
   * Add test badge to PR description
   */
  async addTestBadgeToPR(prNumber: number, result: TestExecutionResult): Promise<void> {
    const pr = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    const badge = this.generateTestBadge(result);
    const existingBody = pr.data.body || '';
    
    // Remove existing test badge if present
    const withoutBadge = existingBody.replace(/<!-- TEST-BADGE-START -->[\s\S]*?<!-- TEST-BADGE-END -->/g, '');
    
    // Add new badge
    const newBody = `${withoutBadge}\n\n<!-- TEST-BADGE-START -->\n${badge}\n<!-- TEST-BADGE-END -->`;

    await this.octokit.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      body: newBody.trim(),
    });
  }

  /**
   * Comment on PR with test results
   */
  async commentTestResults(prNumber: number, result: TestExecutionResult): Promise<void> {
    const comment = this.formatTestComment(result);

    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body: comment,
    });
  }

  /**
   * Format generation summary
   */
  private formatGenerationSummary(result: BatchGenerationResult): string {
    let summary = `### Test Generation Results\n\n`;
    summary += `✅ **Successfully generated ${result.totalTests} tests across ${result.successCount} files**\n\n`;
    
    if (result.failureCount > 0) {
      summary += `⚠️ ${result.failureCount} files failed to generate\n\n`;
    }

    summary += `**Statistics:**\n`;
    summary += `- Total files processed: ${result.totalFiles}\n`;
    summary += `- Success rate: ${((result.successCount / result.totalFiles) * 100).toFixed(1)}%\n`;
    summary += `- Total tests generated: ${result.totalTests}\n`;
    summary += `- Duration: ${(result.duration / 1000).toFixed(2)}s\n`;

    return summary;
  }

  /**
   * Create annotations for generation results
   */
  private createGenerationAnnotations(result: BatchGenerationResult): Array<{
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: 'notice' | 'warning' | 'failure';
    message: string;
  }> {
    const annotations: Array<{
      path: string;
      start_line: number;
      end_line: number;
      annotation_level: 'notice' | 'warning' | 'failure';
      message: string;
    }> = [];

    // Add annotations for successful generations
    result.results
      .filter(r => r.success && r.testSuite)
      .slice(0, 50) // GitHub limits to 50 annotations
      .forEach(r => {
        if (r.testSuite) {
          annotations.push({
            path: r.file.relativePath,
            start_line: 1,
            end_line: 1,
            annotation_level: 'notice',
            message: `✅ Generated ${r.testSuite.testCount} tests in ${(r.duration / 1000).toFixed(2)}s`,
          });
        }
      });

    // Add annotations for failures
    result.results
      .filter(r => !r.success)
      .slice(0, 50 - annotations.length)
      .forEach(r => {
        annotations.push({
          path: r.file.relativePath || 'unknown',
          start_line: 1,
          end_line: 1,
          annotation_level: 'warning',
          message: `⚠️ Test generation failed: ${r.error}`,
        });
      });

    return annotations;
  }

  /**
   * Format test execution title
   */
  private formatTestTitle(result: TestExecutionResult): string {
    if (result.success) {
      return `✅ All ${result.totalTests} tests passed`;
    } else {
      return `❌ ${result.failedTests} of ${result.totalTests} tests failed`;
    }
  }

  /**
   * Format test execution summary
   */
  private formatTestSummary(result: TestExecutionResult): string {
    let summary = `### Test Results\n\n`;
    
    const emoji = result.success ? '✅' : '❌';
    summary += `${emoji} **${result.passedTests}/${result.totalTests} tests passed**\n\n`;

    summary += `**Breakdown:**\n`;
    summary += `- ✅ Passed: ${result.passedTests}\n`;
    summary += `- ❌ Failed: ${result.failedTests}\n`;
    summary += `- ⏭️ Skipped: ${result.skippedTests}\n`;
    summary += `- ⏱️ Duration: ${(result.duration / 1000).toFixed(2)}s\n`;

    if (result.coverage) {
      summary += `\n**Coverage:**\n`;
      summary += `- Lines: ${result.coverage.lines.percentage.toFixed(1)}%\n`;
      summary += `- Functions: ${result.coverage.functions.percentage.toFixed(1)}%\n`;
      summary += `- Branches: ${result.coverage.branches.percentage.toFixed(1)}%\n`;
    }

    return summary;
  }

  /**
   * Format test execution details
   */
  private formatTestDetails(result: TestExecutionResult): string {
    if (result.failures.length === 0) {
      return '🎉 All tests passed successfully!';
    }

    let details = `### Failed Tests\n\n`;
    
    result.failures.forEach((failure, index) => {
      details += `#### ${index + 1}. ${failure.testName}\n\n`;
      details += `**File:** \`${failure.filePath}\`\n`;
      if (failure.line) {
        details += `**Line:** ${failure.line}\n`;
      }
      details += `**Type:** ${failure.type}\n\n`;
      details += `**Message:**\n\`\`\`\n${failure.message}\n\`\`\`\n\n`;
      
      if (failure.stack) {
        details += `**Stack Trace:**\n\`\`\`\n${failure.stack.split('\n').slice(0, 10).join('\n')}\n\`\`\`\n\n`;
      }
    });

    return details;
  }

  /**
   * Create annotations for test failures
   */
  private createTestAnnotations(result: TestExecutionResult): Array<{
    path: string;
    start_line: number;
    end_line: number;
    annotation_level: 'notice' | 'warning' | 'failure';
    message: string;
  }> {
    return result.failures.slice(0, 50).map(failure => ({
      path: failure.filePath,
      start_line: failure.line || 1,
      end_line: failure.line || 1,
      annotation_level: 'failure' as const,
      message: `${failure.testName}\n${failure.message}`,
    }));
  }

  /**
   * Format coverage summary
   */
  private formatCoverageSummary(coverage: CoverageData): string {
    let summary = `### Code Coverage Report\n\n`;
    
    const emoji = coverage.lines.percentage >= 80 ? '✅' : coverage.lines.percentage >= 60 ? '⚠️' : '❌';
    summary += `${emoji} **Overall Coverage: ${coverage.lines.percentage.toFixed(1)}%**\n\n`;

    summary += `| Metric | Covered | Total | Percentage |\n`;
    summary += `|--------|---------|-------|------------|\n`;
    summary += `| Lines | ${coverage.lines.covered} | ${coverage.lines.total} | ${coverage.lines.percentage.toFixed(1)}% |\n`;
    summary += `| Functions | ${coverage.functions.covered} | ${coverage.functions.total} | ${coverage.functions.percentage.toFixed(1)}% |\n`;
    summary += `| Branches | ${coverage.branches.covered} | ${coverage.branches.total} | ${coverage.branches.percentage.toFixed(1)}% |\n`;
    summary += `| Statements | ${coverage.statements.covered} | ${coverage.statements.total} | ${coverage.statements.percentage.toFixed(1)}% |\n`;

    return summary;
  }

  /**
   * Format coverage details
   */
  private formatCoverageDetails(coverage: CoverageData): string {
    let details = `### Coverage Breakdown\n\n`;

    const getStatus = (percentage: number): string => {
      if (percentage >= 80) return '✅ Excellent';
      if (percentage >= 60) return '⚠️ Good';
      if (percentage >= 40) return '⚠️ Fair';
      return '❌ Poor';
    };

    details += `**Lines:** ${getStatus(coverage.lines.percentage)}\n`;
    details += `- ${coverage.lines.covered} of ${coverage.lines.total} lines covered\n\n`;

    details += `**Functions:** ${getStatus(coverage.functions.percentage)}\n`;
    details += `- ${coverage.functions.covered} of ${coverage.functions.total} functions covered\n\n`;

    details += `**Branches:** ${getStatus(coverage.branches.percentage)}\n`;
    details += `- ${coverage.branches.covered} of ${coverage.branches.total} branches covered\n\n`;

    details += `**Statements:** ${getStatus(coverage.statements.percentage)}\n`;
    details += `- ${coverage.statements.covered} of ${coverage.statements.total} statements covered\n`;

    return details;
  }

  /**
   * Generate test badge markdown
   */
  private generateTestBadge(result: TestExecutionResult): string {
    const status = result.success ? 'passing' : 'failing';
    const color = result.success ? 'brightgreen' : 'red';
    const badge = `![Tests](https://img.shields.io/badge/tests-${status}-${color})`;
    
    let markdown = `## 🧪 Test Results\n\n`;
    markdown += `${badge}\n\n`;
    markdown += `- **Total:** ${result.totalTests} tests\n`;
    markdown += `- **Passed:** ${result.passedTests} ✅\n`;
    markdown += `- **Failed:** ${result.failedTests} ❌\n`;
    markdown += `- **Duration:** ${(result.duration / 1000).toFixed(2)}s\n`;

    if (result.coverage) {
      const coverageColor = result.coverage.lines.percentage >= 80 ? 'brightgreen' : 
                           result.coverage.lines.percentage >= 60 ? 'yellow' : 'red';
      const coverageBadge = `![Coverage](https://img.shields.io/badge/coverage-${result.coverage.lines.percentage.toFixed(0)}%25-${coverageColor})`;
      markdown += `\n${coverageBadge}\n`;
    }

    return markdown;
  }

  /**
   * Format test results as PR comment
   */
  private formatTestComment(result: TestExecutionResult): string {
    const emoji = result.success ? '✅' : '❌';
    
    let comment = `## ${emoji} Test Results\n\n`;
    comment += `**Status:** ${result.success ? 'All tests passed!' : 'Some tests failed'}\n\n`;
    
    comment += `| Metric | Value |\n`;
    comment += `|--------|-------|\n`;
    comment += `| Total Tests | ${result.totalTests} |\n`;
    comment += `| Passed | ${result.passedTests} ✅ |\n`;
    comment += `| Failed | ${result.failedTests} ❌ |\n`;
    comment += `| Skipped | ${result.skippedTests} ⏭️ |\n`;
    comment += `| Duration | ${(result.duration / 1000).toFixed(2)}s |\n`;

    if (result.coverage) {
      comment += `\n### 📊 Coverage\n\n`;
      comment += `| Type | Coverage |\n`;
      comment += `|------|----------|\n`;
      comment += `| Lines | ${result.coverage.lines.percentage.toFixed(1)}% |\n`;
      comment += `| Functions | ${result.coverage.functions.percentage.toFixed(1)}% |\n`;
      comment += `| Branches | ${result.coverage.branches.percentage.toFixed(1)}% |\n`;
    }

    if (result.failures.length > 0) {
      comment += `\n### ❌ Failed Tests\n\n`;
      result.failures.slice(0, 10).forEach((failure, index) => {
        comment += `${index + 1}. **${failure.testName}** (\`${failure.filePath}\`)\n`;
        comment += `   - ${failure.message}\n\n`;
      });

      if (result.failures.length > 10) {
        comment += `\n*... and ${result.failures.length - 10} more failures*\n`;
      }
    }

    comment += `\n---\n*Generated by CodeMind Testing Automation* 🤖`;

    return comment;
  }

  /**
   * List check runs for a commit
   */
  async listCheckRuns(ref: string): Promise<Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
  }>> {
    const response = await this.octokit.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref,
    });

    return response.data.check_runs.map(run => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
    }));
  }
}
