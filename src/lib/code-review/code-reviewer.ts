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

export class CodeReviewer {
  private config: ReviewConfiguration;

  constructor(config?: Partial<ReviewConfiguration>) {
    this.config = { ...DEFAULT_REVIEW_CONFIG, ...config };
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

    const summary = this.generateSummary(comments, riskScore, prAnalysis);
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
    };
  }

  /**
   * Generate AI-powered review comments for code changes
   */
  private async generateReviewComments(
    prAnalysis: PRAnalysis
  ): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];

    for (const file of prAnalysis.filesChanged) {
      // Skip non-code files
      if (this.shouldSkipFile(file)) continue;

      const fileComments = await this.analyzeFile(file);
      comments.push(...fileComments);
    }

    // Sort by severity
    return comments.sort((a, b) => this.severityWeight(b.severity) - this.severityWeight(a.severity));
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
    prAnalysis: PRAnalysis
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
}
