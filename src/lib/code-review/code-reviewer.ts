/**
 * AI-Powered Code Reviewer Service
 * 
 * Analyzes pull requests and generates intelligent review comments
 */

import type {
  PRAnalysis,
  CodeReviewResult,
  ReviewComment,
  ReviewConfiguration,
  FileChange,
  RiskScore,
  DocumentationSuggestion,
  TestingSuggestion,
  ReviewSummary,
  ReviewSeverity,
  ReviewCategory,
} from '@/types/code-review';
import { DEFAULT_REVIEW_CONFIG } from '@/types/code-review';
import { createWorkerPool, type WorkerTask } from './worker-pool';

export interface CodeReviewerOptions extends Partial<ReviewConfiguration> {
  /**
   * Maximum number of concurrent workers for file analysis
   * Default: auto-detected based on CPU cores
   */
  maxWorkers?: number;
  
  /**
   * Enable parallel file analysis using worker pool
   * Default: true
   */
  enableParallelAnalysis?: boolean;
  
  /**
   * Progress callback for file analysis
   */
  onProgress?: (completed: number, total: number) => void;
}

export class CodeReviewer {
  private config: ReviewConfiguration;
  private maxWorkers: number;
  private enableParallelAnalysis: boolean;
  private onProgress?: (completed: number, total: number) => void;

  constructor(options?: CodeReviewerOptions) {
    this.config = { ...DEFAULT_REVIEW_CONFIG, ...options };
    
    // Read from environment variables with fallbacks
    const envMaxWorkers = process.env.CODE_REVIEW_MAX_WORKERS 
      ? parseInt(process.env.CODE_REVIEW_MAX_WORKERS, 10) 
      : undefined;
    
    const envParallelEnabled = process.env.CODE_REVIEW_PARALLEL_ANALYSIS !== 'false';
    
    this.maxWorkers = options?.maxWorkers ?? envMaxWorkers ?? 4;
    this.enableParallelAnalysis = options?.enableParallelAnalysis ?? envParallelEnabled;
    this.onProgress = options?.onProgress;
    
    console.log(
      `[CodeReviewer] Initialized with parallel analysis: ${this.enableParallelAnalysis}, ` +
      `max workers: ${this.maxWorkers}`
    );
  }

  /**
   * Analyze a pull request and generate comprehensive review
   */
  async analyzePR(prAnalysis: PRAnalysis): Promise<CodeReviewResult> {
    console.log(`[CodeReviewer] Analyzing PR #${prAnalysis.prNumber}...`);

    // Parallel analysis for better performance
    const [
      comments,
      riskScore,
      docSuggestions,
      testSuggestions,
    ] = await Promise.all([
      this.generateReviewComments(prAnalysis),
      this.calculateRiskScore(prAnalysis),
      this.analyzeDocumentation(prAnalysis),
      this.analyzeTestCoverage(prAnalysis),
    ]);

    const simulation = this.generateSimulation(prAnalysis, comments);
    const summary = this.generateSummary(
      comments,
      riskScore,
      prAnalysis,
      simulation,
      docSuggestions,
      testSuggestions
    );
    const recommendations = this.generateRecommendations(
      comments,
      riskScore,
      docSuggestions,
      testSuggestions
    );

    const estimatedReviewTime = this.estimateReviewTime(prAnalysis);

    return {
      prAnalysis,
      riskScore,
      comments,
      documentationSuggestions: docSuggestions,
      testingSuggestions: testSuggestions,
      summary,
      recommendations,
      estimatedReviewTime,
      simulation,
    };
  }

  /**
   * Incremental analysis for synchronize events: focuses only on changed files
   * and skips full test/documentation passes for speed.
   */
  async analyzeChangedFiles(prAnalysis: PRAnalysis): Promise<CodeReviewResult> {
    // Only consider modified/added files with patches; ignore removed for incremental pass
    const changedFiles = prAnalysis.filesChanged.filter(f => f.patch && (f.status === 'modified' || f.status === 'added'));
    const filtered: PRAnalysis = { ...prAnalysis, filesChanged: changedFiles };

    // If change size is minimal, skip deep analysis sections to save time
    const totalAdditions = changedFiles.reduce((s, f) => s + f.additions, 0);
    const minimalChange = totalAdditions < 20 && changedFiles.length < 5;

    // Core comments only for changed files
    const comments = await this.generateReviewComments(filtered);

    // Risk score recalculated but can apply dampening if minimal change
    let riskScore = await this.calculateRiskScore(filtered);
    if (minimalChange && riskScore.overall > 0) {
      // Apply a dampening factor to reflect limited scope
      riskScore = { ...riskScore, overall: Math.max(0, Math.round(riskScore.overall * 0.7)) };
    }

    // Lightweight doc/test suggestions only if significant net additions or critical/high issues present
    const highSeverityCount = comments.filter(c => c.severity === 'critical' || c.severity === 'high').length;
    const shouldSuggest = !minimalChange || highSeverityCount > 0 || changedFiles.some(f => f.additions > 30);
    const docSuggestions = shouldSuggest ? await this.analyzeDocumentation(filtered) : [];
    const testSuggestions = shouldSuggest ? await this.analyzeTestCoverage(filtered) : [];

    // Generate simulation based on affected subset only
    const simulation = this.generateSimulation(filtered, comments);

    const summary = this.generateSummary(
      comments,
      riskScore,
      filtered,
      simulation,
      docSuggestions,
      testSuggestions
    );
    const recommendations = this.generateRecommendations(
      comments,
      riskScore,
      docSuggestions,
      testSuggestions
    );
    const estimatedReviewTime = this.estimateReviewTime(filtered);
    return {
      prAnalysis: filtered,
      riskScore,
      comments,
      documentationSuggestions: docSuggestions,
      testingSuggestions: testSuggestions,
      summary,
      recommendations,
      estimatedReviewTime,
      simulation,
    };
  }

  /**
   * Generate AI-powered review comments for code changes
   */
  private async generateReviewComments(
    prAnalysis: PRAnalysis
  ): Promise<ReviewComment[]> {
    const filesToAnalyze = prAnalysis.filesChanged.filter(
      file => !this.shouldSkipFile(file)
    );

    if (filesToAnalyze.length === 0) {
      return [];
    }

    // Use parallel analysis if enabled and there are multiple files
    if (this.enableParallelAnalysis && filesToAnalyze.length > 1) {
      return this.generateReviewCommentsParallel(filesToAnalyze);
    }

    // Sequential analysis for single file or when parallel is disabled
    return this.generateReviewCommentsSequential(filesToAnalyze);
  }

  /**
   * Generate review comments using parallel worker pool
   */
  private async generateReviewCommentsParallel(
    files: FileChange[]
  ): Promise<ReviewComment[]> {
    const workerPool = createWorkerPool<FileChange, ReviewComment[]>({
      maxWorkers: this.maxWorkers,
      onProgress: this.onProgress,
      onError: (taskId, error) => {
        console.error(`[CodeReviewer] Error analyzing file ${taskId}:`, error.message);
      },
      continueOnError: true, // Continue analyzing other files even if one fails
    });

    // Create tasks for each file
    const tasks: WorkerTask<FileChange, ReviewComment[]>[] = files.map(file => ({
      id: file.filename,
      data: file,
      execute: async (fileData) => this.analyzeFile(fileData),
    }));

    console.log(`[CodeReviewer] Starting parallel analysis of ${files.length} files with ${this.maxWorkers} workers...`);
    const startTime = Date.now();

    // Execute all tasks in parallel
    const results = await workerPool.executeTasks(tasks);

    const stats = workerPool.getStats();
    const duration = Date.now() - startTime;
    
    console.log(
      `[CodeReviewer] Parallel analysis complete: ${stats.completedTasks}/${stats.totalTasks} files analyzed in ${duration}ms ` +
      `(${stats.failedTasks} failed)`
    );

    // Flatten all comments from all files
    const allComments: ReviewComment[] = [];
    results.forEach(comments => {
      allComments.push(...comments);
    });

    // Sort by severity
    return allComments.sort((a, b) => 
      this.severityWeight(b.severity) - this.severityWeight(a.severity)
    );
  }

  /**
   * Generate review comments sequentially (fallback/single file)
   */
  private async generateReviewCommentsSequential(
    files: FileChange[]
  ): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];

    for (const file of files) {
      const fileComments = await this.analyzeFile(file);
      comments.push(...fileComments);
      
      if (this.onProgress) {
        this.onProgress(comments.length, files.length);
      }
    }

    // Sort by severity
    return comments.sort((a, b) => 
      this.severityWeight(b.severity) - this.severityWeight(a.severity)
    );
  }

  /**
   * Analyze a single file for issues
   */
  private async analyzeFile(
    file: FileChange
  ): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];

    if (!file.patch) return comments;

    // Security check
    if (this.config.enableSecurityCheck) {
      comments.push(...this.checkSecurity(file));
    }

    // Performance check
    if (this.config.enablePerformanceCheck) {
      comments.push(...this.checkPerformance(file));
    }

    // Complexity check
    if (this.config.enableComplexityCheck) {
      comments.push(...this.checkComplexity(file));
    }

    // Best practices check
    if (this.config.checkBestPractices) {
      comments.push(...this.checkBestPractices(file));
    }

    return comments;
  }

  /**
   * Check for security vulnerabilities
   */
  private checkSecurity(file: FileChange): ReviewComment[] {
    const comments: ReviewComment[] = [];
    const patch = file.patch || '';

    // Common security patterns to check
    const securityPatterns = [
      {
        pattern: /eval\(/gi,
        category: 'security' as ReviewCategory,
        severity: 'critical' as ReviewSeverity,
        message: 'Avoid using eval() as it can execute arbitrary code and is a security risk',
        suggestion: 'Consider using safer alternatives like JSON.parse() for parsing data',
      },
      {
        pattern: /dangerouslySetInnerHTML/gi,
        category: 'security' as ReviewCategory,
        severity: 'high' as ReviewSeverity,
        message: 'dangerouslySetInnerHTML can lead to XSS attacks if not properly sanitized',
        suggestion: 'Ensure the HTML content is sanitized using a library like DOMPurify',
      },
      {
        pattern: /process\.env\.[A-Z_]+/g,
        category: 'security' as ReviewCategory,
        severity: 'medium' as ReviewSeverity,
        message: 'Ensure sensitive environment variables are not exposed to the client',
        suggestion: 'Use NEXT_PUBLIC_ prefix only for public variables',
      },
      {
        pattern: /localStorage\.setItem\([^,]+,\s*password/gi,
        category: 'security' as ReviewCategory,
        severity: 'critical' as ReviewSeverity,
        message: 'Never store passwords in localStorage',
        suggestion: 'Use secure authentication tokens and httpOnly cookies instead',
      },
    ];

    const lines = patch.split('\n');
    lines.forEach((line, idx) => {
      if (!line.startsWith('+')) return;

      securityPatterns.forEach((pattern) => {
        if (pattern.pattern.test(line)) {
          comments.push({
            id: `sec-${file.filename}-${idx}`,
            file: file.filename,
            line: idx + 1,
            severity: pattern.severity,
            category: pattern.category,
            message: pattern.message,
            suggestion: pattern.suggestion,
            codeSnippet: line.substring(1).trim(),
            aiGenerated: true,
            createdAt: new Date(),
          });
        }
      });
    });

    return comments;
  }

  /**
   * Check for performance issues
   */
  private checkPerformance(file: FileChange): ReviewComment[] {
    const comments: ReviewComment[] = [];
    const patch = file.patch || '';

    const performancePatterns = [
      {
        pattern: /console\.(log|debug|info|warn|error)/gi,
        category: 'performance' as ReviewCategory,
        severity: 'low' as ReviewSeverity,
        message: 'Console statements in production can impact performance',
        suggestion: 'Remove console logs or use a proper logging library',
      },
      {
        pattern: /\.forEach\(/gi,
        category: 'performance' as ReviewCategory,
        severity: 'info' as ReviewSeverity,
        message: 'Consider using for...of loop for better performance with large arrays',
        suggestion: 'for...of loops are generally faster than forEach for large datasets',
      },
      {
        pattern: /new Date\(\)/gi,
        category: 'performance' as ReviewCategory,
        severity: 'info' as ReviewSeverity,
        message: 'Multiple Date() calls in loops can be expensive',
        suggestion: 'Cache date objects when possible or use Date.now() for timestamps',
      },
    ];

    const lines = patch.split('\n');
    lines.forEach((line, idx) => {
      if (!line.startsWith('+')) return;

      performancePatterns.forEach((pattern) => {
        if (pattern.pattern.test(line)) {
          comments.push({
            id: `perf-${file.filename}-${idx}`,
            file: file.filename,
            line: idx + 1,
            severity: pattern.severity,
            category: pattern.category,
            message: pattern.message,
            suggestion: pattern.suggestion,
            codeSnippet: line.substring(1).trim(),
            aiGenerated: true,
            createdAt: new Date(),
          });
        }
      });
    });

    return comments;
  }

  /**
   * Check code complexity
   */
  private checkComplexity(file: FileChange): ReviewComment[] {
    const comments: ReviewComment[] = [];
    const patch = file.patch || '';

    const lines = patch.split('\n');
    let currentFunction = '';
    let functionComplexity = 0;
    let functionStartLine = 0;

    lines.forEach((line, idx) => {
      if (!line.startsWith('+')) return;

      const content = line.substring(1).trim();

      // Detect function start
      if (/^(function|const|let|var)\s+\w+\s*=\s*(\([^)]*\)|async)?\s*(=>|\{)/.test(content) ||
          /^(async\s+)?function\s+\w+/.test(content)) {
        currentFunction = content.split('(')[0];
        functionComplexity = 1;
        functionStartLine = idx + 1;
      }

      // Count complexity indicators
      if (currentFunction) {
        if (/\b(if|else|for|while|switch|catch|&&|\|\|)\b/.test(content)) {
          functionComplexity++;
        }
      }

      // Detect function end and check complexity
      if (content === '}' && currentFunction && functionComplexity > this.config.maxComplexity) {
        comments.push({
          id: `complex-${file.filename}-${functionStartLine}`,
          file: file.filename,
          line: functionStartLine,
          endLine: idx + 1,
          severity: 'high',
          category: 'complexity',
          message: `High cyclomatic complexity detected (${functionComplexity}). Consider refactoring.`,
          suggestion: 'Break down into smaller functions or use early returns to reduce nesting',
          reasoning: `Complexity score of ${functionComplexity} exceeds threshold of ${this.config.maxComplexity}`,
          aiGenerated: true,
          createdAt: new Date(),
        });
        currentFunction = '';
      }
    });

    return comments;
  }

  /**
   * Check best practices
   */
  private checkBestPractices(file: FileChange): ReviewComment[] {
    const comments: ReviewComment[] = [];
    const patch = file.patch || '';

    const bestPracticePatterns = [
      {
        pattern: /var\s+/g,
        category: 'best-practices' as ReviewCategory,
        severity: 'low' as ReviewSeverity,
        message: 'Use const or let instead of var',
        suggestion: 'const for immutable values, let for values that change',
      },
      {
        pattern: /==(?!=)/g,
        category: 'best-practices' as ReviewCategory,
        severity: 'medium' as ReviewSeverity,
        message: 'Use === instead of == for type-safe comparison',
        suggestion: 'Replace == with === to avoid type coercion issues',
      },
      {
        pattern: /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]{500,}/g,
        category: 'maintainability' as ReviewCategory,
        severity: 'medium' as ReviewSeverity,
        message: 'Function is too long and may be hard to maintain',
        suggestion: 'Consider breaking this function into smaller, focused functions',
      },
    ];

    const lines = patch.split('\n');
    lines.forEach((line, idx) => {
      if (!line.startsWith('+')) return;

      bestPracticePatterns.forEach((pattern) => {
        if (pattern.pattern.test(line)) {
          comments.push({
            id: `bp-${file.filename}-${idx}`,
            file: file.filename,
            line: idx + 1,
            severity: pattern.severity,
            category: pattern.category,
            message: pattern.message,
            suggestion: pattern.suggestion,
            codeSnippet: line.substring(1).trim(),
            aiGenerated: true,
            createdAt: new Date(),
          });
        }
      });
    });

    return comments;
  }

  /**
   * Calculate risk score for the PR
   */
  private async calculateRiskScore(prAnalysis: PRAnalysis): Promise<RiskScore> {
    // Import the risk scorer (we'll create this next)
    const { RiskScorer } = await import('./risk-scorer');
    const scorer = new RiskScorer();
    return scorer.calculateRisk(prAnalysis);
  }

  /**
   * Analyze documentation completeness
   */
  private async analyzeDocumentation(
    prAnalysis: PRAnalysis
  ): Promise<DocumentationSuggestion[]> {
    const suggestions: DocumentationSuggestion[] = [];

    for (const file of prAnalysis.filesChanged) {
      if (!file.patch) continue;

      const lines = file.patch.split('\n');
      let hasJSDoc = false;
      let hasExport = false;

      lines.forEach((line) => {
        if (line.includes('/**') || line.includes('//')) hasJSDoc = true;
        if (line.includes('export')) hasExport = true;
      });

      if (hasExport && !hasJSDoc && file.additions > 10) {
        suggestions.push({
          type: 'missing',
          location: file.filename,
          file: file.filename,
          suggestion: 'Add JSDoc comments to explain the exported functions/classes',
          priority: 'medium',
        });
      }
    }

    return suggestions;
  }

  /**
   * Analyze test coverage
   */
  private async analyzeTestCoverage(
    prAnalysis: PRAnalysis
  ): Promise<TestingSuggestion[]> {
    const suggestions: TestingSuggestion[] = [];
    
    const codeFiles = prAnalysis.filesChanged.filter(
      f => f.status !== 'removed' && this.isCodeFile(f.filename)
    );
    
    const testFiles = prAnalysis.filesChanged.filter(
      f => this.isTestFile(f.filename)
    );

    const hasNewCode = codeFiles.some(f => f.additions > 0);
    const hasNewTests = testFiles.some(f => f.additions > 0);

    if (hasNewCode && !hasNewTests && codeFiles.length > 0) {
      suggestions.push({
        type: 'missing-tests',
        files: codeFiles.map(f => f.filename),
        suggestion: 'Consider adding unit tests for the new/modified code',
        priority: 'high',
        estimatedCoverage: 0,
      });
    }

    return suggestions;
  }

  /**
   * Generate review summary
   */
  private generateSummary(
    comments: ReviewComment[],
    riskScore: RiskScore,
    prAnalysis: PRAnalysis,
    simulation: ReviewSummary['simulation'],
    documentationSuggestions: DocumentationSuggestion[],
    testingSuggestions: TestingSuggestion[]
  ): ReviewSummary {
    const critical = comments.filter(c => c.severity === 'critical').length;
    const high = comments.filter(c => c.severity === 'high').length;
    const medium = comments.filter(c => c.severity === 'medium').length;
    const low = comments.filter(c => c.severity === 'low').length;

    const keyFindings: string[] = [];
    if (critical > 0) keyFindings.push(`${critical} critical security/quality issues found`);
    if (high > 0) keyFindings.push(`${high} high-priority issues need attention`);
    if (riskScore.level === 'high' || riskScore.level === 'critical') {
      keyFindings.push(`High-risk changes detected: ${riskScore.summary}`);
    }

    const positiveAspects: string[] = [];
    if (prAnalysis.totalAdditions < 200) positiveAspects.push('Manageable change size');
    if (comments.length < 5) positiveAspects.push('Generally clean code');

    const areasOfConcern: string[] = [];
    if (critical > 0) areasOfConcern.push('Critical security vulnerabilities');
    if (prAnalysis.totalAdditions > 500) areasOfConcern.push('Large changeset - consider splitting');

    let approvalRecommendation: 'approve' | 'request-changes' | 'comment' = 'approve';
    if (critical > 0 || riskScore.level === 'critical') {
      approvalRecommendation = 'request-changes';
    } else if (high > 0 || riskScore.level === 'high') {
      approvalRecommendation = 'request-changes';
    } else if (medium > 0) {
      approvalRecommendation = 'comment';
    }

    const severityPenalty = (critical * 25) + (high * 15) + (medium * 5) + (low * 2);
    const riskPenalty = Math.round(riskScore.overall * 0.3);
    const overallScore = Math.max(0, 100 - severityPenalty - riskPenalty);
    const approved = approvalRecommendation === 'approve';
    const requiresChanges = approvalRecommendation === 'request-changes';

    return {
      overallAssessment: this.generateOverallAssessment(riskScore, comments),
      keyFindings,
      criticalIssues: critical,
      highPriorityIssues: high,
      mediumPriorityIssues: medium,
      lowPriorityIssues: low,
      positiveAspects,
      areasOfConcern,
      approvalRecommendation,
      overallScore,
      approved,
      requiresChanges,
      simulation,
      documentationSuggestions,
      testingSuggestions,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    comments: ReviewComment[],
    riskScore: RiskScore,
    docSuggestions: DocumentationSuggestion[],
    testSuggestions: TestingSuggestion[]
  ): string[] {
    const recommendations: string[] = [];

    if (comments.some(c => c.severity === 'critical')) {
      recommendations.push('🚨 Address all critical security issues before merging');
    }

    if (riskScore.level === 'high' || riskScore.level === 'critical') {
      recommendations.push('⚠️ High-risk changes detected - extra testing recommended');
    }

    if (testSuggestions.length > 0) {
      recommendations.push('✅ Add unit tests to maintain code quality');
    }

    if (docSuggestions.length > 0) {
      recommendations.push('📝 Improve documentation for better maintainability');
    }

    if (comments.some(c => c.category === 'complexity')) {
      recommendations.push('🔄 Consider refactoring complex functions');
    }

    return recommendations;
  }

  /**
   * Estimate review time in minutes
   */
  private estimateReviewTime(prAnalysis: PRAnalysis): number {
    const baseTime = 5; // minutes
    const perFile = 2;
    const perHundredLines = 5;

    const fileTime = prAnalysis.filesChanged.length * perFile;
    const lineTime = ((prAnalysis.totalAdditions + prAnalysis.totalDeletions) / 100) * perHundredLines;

    return Math.ceil(baseTime + fileTime + lineTime);
  }

  /**
   * Generate overall assessment text
   */
  private generateOverallAssessment(
    riskScore: RiskScore,
    comments: ReviewComment[]
  ): string {
    const critical = comments.filter(c => c.severity === 'critical').length;
    
    if (critical > 0) {
      return `⛔ This PR contains ${critical} critical issue(s) that must be addressed before merging. Risk level: ${riskScore.level.toUpperCase()}.`;
    }

    if (riskScore.level === 'high') {
      return `⚠️ High-risk changes detected. Please review carefully and ensure adequate testing. ${riskScore.summary}`;
    }

    if (comments.length === 0) {
      return `✅ No significant issues found. Code quality looks good! Risk level: ${riskScore.level.toUpperCase()}.`;
    }

    return `✓ Code review complete. Found ${comments.length} suggestion(s). Risk level: ${riskScore.level.toUpperCase()}.`;
  }

  // Helper methods
  private shouldSkipFile(file: FileChange): boolean {
    const skipPatterns = [
      /\.lock$/,
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/,
      /\.min\.(js|css)$/,
      /\.svg$/,
      /\.png$/,
      /\.jpg$/,
      /\.gif$/,
    ];

    return skipPatterns.some(pattern => pattern.test(file.filename));
  }

  private isCodeFile(filename: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs'];
    return codeExtensions.some(ext => filename.endsWith(ext)) && !this.isTestFile(filename);
  }

  private isTestFile(filename: string): boolean {
    return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filename) || filename.includes('__tests__');
  }

  private severityWeight(severity: ReviewSeverity): number {
    const weights = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
    return weights[severity];
  }

  /**
   * Generate impact simulation describing affected components and potential breaking changes.
   */
  private generateSimulation(
    prAnalysis: PRAnalysis,
    comments: ReviewComment[]
  ): ReviewSummary['simulation'] {
    // Basic heuristics for affected components
    type SimAffectedComponent = {
      name: string;
      type: 'function' | 'class' | 'module' | 'api' | 'database';
      file: string;
      changeType: 'signature' | 'behavior' | 'removal' | 'addition';
      usageCount: number;
      criticalPath: boolean;
    };
    type SimBreakingChange = {
      type: 'api' | 'signature' | 'removal' | 'behavior';
      component: string;
      description: string;
      severity: ReviewSeverity;
      affectedUsages: string[];
      migrationSuggestion?: string;
    };
    type SimDependencyImpact = {
      package: string;
      changeType: 'added' | 'removed' | 'upgraded' | 'downgraded';
      oldVersion?: string;
      newVersion?: string;
      risk: 'critical' | 'high' | 'medium' | 'low';
    };

    const affectedComponents: SimAffectedComponent[] = [];
    const breakingChanges: SimBreakingChange[] = [];
    const dependencyImpacts: SimDependencyImpact[] = [];

    let affectedFunctions = 0;
    const functionPattern = /^(\+).*\b(function|const|let|var)\s+\w+\s*(=|\()/;
    const removedExportPattern = /^-.*export\s+(function|class|const|let)\s+\w+/;

    for (const file of prAnalysis.filesChanged) {
      if (!file.patch) continue;
      const lines = file.patch.split('\n');
      let functionsInFile = 0;
      lines.forEach(l => {
        if (functionPattern.test(l)) functionsInFile++;
        if (removedExportPattern.test(l)) {
          breakingChanges.push({
            type: 'api',
            component: file.filename,
            description: 'Export removed; may break consumers.',
            severity: 'high',
            affectedUsages: [],
          });
        }
      });
      affectedFunctions += functionsInFile;

  const componentType = this.inferComponentType(file.filename) as 'function' | 'class' | 'module' | 'api' | 'database';
      const isCriticalPath = this.isCriticalPath(file.filename, comments);
      if (functionsInFile > 0 || isCriticalPath) {
        affectedComponents.push({
          name: file.filename.split('/').pop() || file.filename,
          type: componentType,
          file: file.filename,
          changeType: file.status === 'removed' ? 'removal' : 'behavior',
          usageCount: this.estimateUsageCount(file.filename),
          criticalPath: isCriticalPath,
        });
      }
    }

    // Scope determination
    const affectedFiles = prAnalysis.filesChanged.length;
    const scope = affectedFiles > 15
      ? 'widespread'
      : affectedFiles > 5
        ? 'moderate'
        : 'isolated';

    // Elevate scope if many critical/high issues
    const highRiskIssues = comments.filter(c => c.severity === 'critical' || c.severity === 'high').length;
    const effectiveScope = highRiskIssues > 8 && scope !== 'widespread' ? 'moderate' : scope;

    const estimatedImpact = highRiskIssues > 10
      ? 'critical'
      : highRiskIssues > 5
        ? 'high'
        : highRiskIssues > 2
          ? 'medium'
          : 'low';

    return {
      prNumber: prAnalysis.prNumber,
      impactAnalysis: {
        scope: effectiveScope as 'isolated' | 'moderate' | 'widespread',
        affectedFiles,
        affectedFunctions,
        affectedModules: Array.from(new Set(affectedComponents.map(c => c.name))),
        downstreamDependencies: 0,
        upstreamDependencies: 0,
      },
      affectedComponents,
      potentialBreakingChanges: breakingChanges,
      dependencies: dependencyImpacts,
      estimatedImpact: estimatedImpact as 'critical' | 'high' | 'medium' | 'low',
    };
  }

  private inferComponentType(filename: string): string {
    if (/api\//.test(filename)) return 'api';
    if (/schema|prisma|db/.test(filename)) return 'database';
    if (/\.test|__tests__/.test(filename)) return 'module';
    if (/middleware|auth|security/.test(filename)) return 'module';
    return 'module';
  }

  private isCriticalPath(filename: string, comments: ReviewComment[]): boolean {
    const criticalPatterns = [/auth/, /security/, /middleware/, /db/, /prisma/];
    if (criticalPatterns.some(p => p.test(filename))) return true;
    return comments.some(c => c.file === filename && (c.severity === 'critical' || c.category === 'security'));
  }

  private estimateUsageCount(filename: string): number {
    // Placeholder heuristic: more central files assumed higher usage
    if (/auth|middleware|config|db|prisma/.test(filename)) return 50;
    if (/utils|helpers/.test(filename)) return 30;
    return 10;
  }
}
