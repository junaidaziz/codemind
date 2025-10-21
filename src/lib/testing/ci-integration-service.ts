/**
 * CI/CD Integration Service
 * 
 * Integrates testing automation with CI/CD pipelines.
 * Supports GitHub Actions, GitLab CI, CircleCI, and Jenkins.
 * 
 * @module testing/ci-integration-service
 */

import { GitHubChecksService, type TestExecutionResult, type CoverageData } from './github-checks-service';
import { TestGenerationOrchestrator, type BatchGenerationResult } from './test-generation-orchestrator';
import { CoverageAnalyzer, type CoverageReport } from './coverage-analyzer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Jest output types
 */
interface JestOutput {
  success: boolean;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  testResults?: TestResult[];
  coverageMap?: Record<string, CoverageFile>;
}

interface TestResult {
  name: string;
  assertionResults?: AssertionResult[];
  perfStats?: { runtime: number };
}

interface AssertionResult {
  title: string;
  status: 'passed' | 'failed' | 'pending';
  failureMessages?: string[];
}

interface CoverageFile {
  lines?: { total: number; covered: number };
  functions?: { total: number; covered: number };
  branches?: { total: number; covered: number };
  statements?: { total: number; covered: number };
}

/**
 * CI environment detection
 */
export interface CIEnvironment {
  name: 'github' | 'gitlab' | 'circle' | 'jenkins' | 'unknown';
  isCI: boolean;
  branch?: string;
  commit?: string;
  prNumber?: number;
  buildId?: string;
}

/**
 * CI integration options
 */
export interface CIIntegrationOptions {
  projectRoot?: string;
  openAIKey?: string;
  githubToken?: string;
  owner?: string;
  repo?: string;
  runTests?: boolean;
  generateTests?: boolean;
  analyzeCoverage?: boolean;
  commentOnPR?: boolean;
  updateChecks?: boolean;
  failOnTestFailure?: boolean;
  failOnLowCoverage?: boolean;
  coverageThreshold?: number;
}

/**
 * CI Integration Service
 */
export class CIIntegrationService {
  private checksService?: GitHubChecksService;
  private orchestrator: TestGenerationOrchestrator;
  private analyzer: CoverageAnalyzer;

  constructor(private options: CIIntegrationOptions = {}) {
    // Initialize orchestrator with project root
    const projectRoot = options.projectRoot || process.cwd();
    this.orchestrator = new TestGenerationOrchestrator(projectRoot, options.openAIKey);
    this.analyzer = new CoverageAnalyzer(projectRoot);

    if (options.githubToken && options.owner && options.repo) {
      this.checksService = new GitHubChecksService(
        options.githubToken,
        options.owner,
        options.repo
      );
    }
  }

  /**
   * Detect current CI environment
   */
  detectEnvironment(): CIEnvironment {
    // GitHub Actions
    if (process.env.GITHUB_ACTIONS === 'true') {
      return {
        name: 'github',
        isCI: true,
        branch: process.env.GITHUB_REF?.replace('refs/heads/', ''),
        commit: process.env.GITHUB_SHA,
        prNumber: this.extractPRNumber(process.env.GITHUB_REF),
        buildId: process.env.GITHUB_RUN_ID,
      };
    }

    // GitLab CI
    if (process.env.GITLAB_CI === 'true') {
      return {
        name: 'gitlab',
        isCI: true,
        branch: process.env.CI_COMMIT_REF_NAME,
        commit: process.env.CI_COMMIT_SHA,
        prNumber: parseInt(process.env.CI_MERGE_REQUEST_IID || '0') || undefined,
        buildId: process.env.CI_JOB_ID,
      };
    }

    // CircleCI
    if (process.env.CIRCLECI === 'true') {
      return {
        name: 'circle',
        isCI: true,
        branch: process.env.CIRCLE_BRANCH,
        commit: process.env.CIRCLE_SHA1,
        prNumber: parseInt(process.env.CIRCLE_PR_NUMBER || '0') || undefined,
        buildId: process.env.CIRCLE_BUILD_NUM,
      };
    }

    // Jenkins
    if (process.env.JENKINS_HOME) {
      return {
        name: 'jenkins',
        isCI: true,
        branch: process.env.GIT_BRANCH,
        commit: process.env.GIT_COMMIT,
        buildId: process.env.BUILD_ID,
      };
    }

    return { name: 'unknown', isCI: false };
  }

  /**
   * Extract PR number from GitHub ref
   */
  private extractPRNumber(ref?: string): number | undefined {
    if (!ref) return undefined;
    const match = ref.match(/refs\/pull\/(\d+)\/merge/);
    return match ? parseInt(match[1]) : undefined;
  }

  /**
 * Run full CI pipeline
 */
async runPipeline(): Promise<{
    success: boolean;
    testResults?: TestExecutionResult;
    coverage?: CoverageReport;
    generationResults?: BatchGenerationResult;
  }> {
    const env = this.detectEnvironment();
    
    console.log(`🚀 Running CI pipeline in ${env.name} environment`);
    console.log(`Branch: ${env.branch}, Commit: ${env.commit?.substring(0, 7)}`);

    const results: {
      success: boolean;
      testResults?: TestExecutionResult;
      coverage?: CoverageReport;
      generationResults?: BatchGenerationResult;
    } = { success: true };

    try {
      // Generate tests if enabled
      if (this.options.generateTests) {
        console.log('📝 Generating tests...');
        results.generationResults = await this.orchestrator.generateForHighPriority(
          { batchSize: 10 }
        );

        if (this.checksService && env.commit && this.options.updateChecks) {
          await this.checksService.createTestGenerationCheck(
            env.commit,
            results.generationResults
          );
        }
      }

      // Analyze coverage if enabled
      if (this.options.analyzeCoverage) {
        console.log('📊 Analyzing coverage...');
        const report = await this.analyzer.analyze();
        results.coverage = report;

        const coveragePercentage = this.calculateOverallCoverage(report);
        console.log(`Coverage: ${coveragePercentage.toFixed(1)}%`);

        if (
          this.options.failOnLowCoverage &&
          this.options.coverageThreshold &&
          coveragePercentage < this.options.coverageThreshold
        ) {
          console.error(`❌ Coverage ${coveragePercentage.toFixed(1)}% is below threshold ${this.options.coverageThreshold}%`);
          results.success = false;
        }
      }

      // Run tests if enabled
      if (this.options.runTests) {
        console.log('🧪 Running tests...');
        results.testResults = await this.runTests();

        if (this.checksService && env.commit && this.options.updateChecks) {
          await this.checksService.createTestExecutionCheck(
            env.commit,
            results.testResults
          );
        }

        if (this.options.commentOnPR && env.prNumber) {
          await this.checksService?.commentTestResults(
            env.prNumber,
            results.testResults
          );
        }

        if (!results.testResults.success && this.options.failOnTestFailure) {
          console.error(`❌ ${results.testResults.failedTests} tests failed`);
          results.success = false;
        }
      }

      if (results.success) {
        console.log('✅ CI pipeline completed successfully');
      } else {
        console.error('❌ CI pipeline failed');
      }

      return results;
    } catch (error) {
      console.error('❌ CI pipeline error:', error);
      results.success = false;
      return results;
    }
  }

  /**
   * Run tests and parse results
   */
  private async runTests(): Promise<TestExecutionResult> {
    try {
      const { stdout, stderr } = await execAsync('npm test -- --json --coverage', {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      return this.parseTestOutput(stdout || stderr);
    } catch (error: unknown) {
      // Test command returns non-zero exit code on failure
      const execError = error as { stdout?: string };
      if (execError.stdout) {
        return this.parseTestOutput(execError.stdout);
      }
      throw error;
    }
  }

  /**
   * Parse Jest test output
   */
  private parseTestOutput(output: string): TestExecutionResult {
    try {
      const lines = output.split('\n');
      let jsonLine = lines.find(line => line.trim().startsWith('{'));
      
      if (!jsonLine) {
        // Try to find JSON in the entire output
        const jsonMatch = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
        if (jsonMatch) {
          jsonLine = jsonMatch[0];
        }
      }

      if (!jsonLine) {
        throw new Error('No JSON output found');
      }

      const result = JSON.parse(jsonLine) as JestOutput;

      const failures = result.testResults
        ?.flatMap((suite) =>
          suite.assertionResults
            ?.filter((test) => test.status === 'failed')
            .map((test) => ({
              testName: test.title,
              filePath: suite.name,
              message: test.failureMessages?.[0] || 'Test failed',
              stack: test.failureMessages?.join('\n'),
              type: 'failure' as const,
            }))
        )
        .filter((f): f is TestFailure => f !== undefined) || [];

      return {
        success: result.success,
        totalTests: result.numTotalTests,
        passedTests: result.numPassedTests,
        failedTests: result.numFailedTests,
        skippedTests: result.numPendingTests,
        duration: result.testResults?.reduce((sum: number, suite) => 
          sum + (suite.perfStats?.runtime || 0), 0
        ) || 0,
        failures,
        coverage: this.parseCoverageFromResult(result),
      };
    } catch (error) {
      console.error('Failed to parse test output:', error);
      
      // Return basic result from text parsing
      return {
        success: !output.includes('failed'),
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        duration: 0,
        failures: [],
      };
    }
  }

  /**
   * Parse coverage from test result
   */
  private parseCoverageFromResult(result: JestOutput): CoverageData | undefined {
    if (!result.coverageMap) return undefined;

    const coverage = result.coverageMap;
    const files = Object.values(coverage) as CoverageFile[];

    const totals = files.reduce(
      (acc, file) => ({
        lines: {
          total: (acc.lines?.total || 0) + (file.lines?.total || 0),
          covered: (acc.lines?.covered || 0) + (file.lines?.covered || 0),
        },
        functions: {
          total: (acc.functions?.total || 0) + (file.functions?.total || 0),
          covered: (acc.functions?.covered || 0) + (file.functions?.covered || 0),
        },
        branches: {
          total: (acc.branches?.total || 0) + (file.branches?.total || 0),
          covered: (acc.branches?.covered || 0) + (file.branches?.covered || 0),
        },
        statements: {
          total: (acc.statements?.total || 0) + (file.statements?.total || 0),
          covered: (acc.statements?.covered || 0) + (file.statements?.covered || 0),
        },
      }),
      {
        lines: { total: 0, covered: 0 },
        functions: { total: 0, covered: 0 },
        branches: { total: 0, covered: 0 },
        statements: { total: 0, covered: 0 },
      }
    );

    return {
      lines: {
        total: totals.lines?.total || 0,
        covered: totals.lines?.covered || 0,
        percentage: ((totals.lines?.covered || 0) / (totals.lines?.total || 1)) * 100,
      },
      functions: {
        total: totals.functions?.total || 0,
        covered: totals.functions?.covered || 0,
        percentage: ((totals.functions?.covered || 0) / (totals.functions?.total || 1)) * 100,
      },
      branches: {
        total: totals.branches?.total || 0,
        covered: totals.branches?.covered || 0,
        percentage: ((totals.branches?.covered || 0) / (totals.branches?.total || 1)) * 100,
      },
      statements: {
        total: totals.statements?.total || 0,
        covered: totals.statements?.covered || 0,
        percentage: ((totals.statements?.covered || 0) / (totals.statements?.total || 1)) * 100,
      },
    };
  }

  /**
   * Calculate overall coverage percentage
   */
  private calculateOverallCoverage(coverageReport: CoverageReport): number {
    if (!coverageReport?.files) return 0;

    const tested = coverageReport.files.filter((f) => f.isTested).length;
    const total = coverageReport.files.length;

    return (tested / total) * 100;
  }

  /**
   * Generate GitHub Actions workflow
   */
  static generateGitHubWorkflow(options: {
    runTests?: boolean;
    generateTests?: boolean;
    analyzeCoverage?: boolean;
    coverageThreshold?: number;
  } = {}): string {
    return `name: Testing Automation

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      ${options.generateTests ? `- name: Generate Tests
        run: pnpm test:generate
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
      ` : ''}
      ${options.analyzeCoverage ? `- name: Analyze Coverage
        run: pnpm test:coverage
      ` : ''}
      ${options.runTests ? `- name: Run Tests
        run: pnpm test
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      ` : ''}
      - name: Update PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
            
            const body = \`## 🧪 Test Results
            
            \${results.success ? '✅' : '❌'} **\${results.passedTests}/\${results.totalTests} tests passed**
            
            - Duration: \${(results.duration / 1000).toFixed(2)}s
            ${options.analyzeCoverage && options.coverageThreshold ? `- Coverage: \${results.coverage?.lines?.percentage.toFixed(1)}% (threshold: ${options.coverageThreshold}%)` : ''}
            \`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body
            });
`;
  }

  /**
   * Generate GitLab CI configuration
   */
  static generateGitLabCI(options: {
    runTests?: boolean;
    generateTests?: boolean;
    analyzeCoverage?: boolean;
  } = {}): string {
    return `stages:
  - test

test:
  stage: test
  image: node:20
  cache:
    paths:
      - node_modules/
  
  before_script:
    - npm install -g pnpm
    - pnpm install
  
  script:
    ${options.generateTests ? '- pnpm test:generate' : ''}
    ${options.analyzeCoverage ? '- pnpm test:coverage' : ''}
    ${options.runTests ? '- pnpm test' : ''}
  
  ${options.analyzeCoverage ? `coverage: '/Lines\\s*:\\s*([\\d.]+)%/'
  
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml` : ''}
`;
  }
}
