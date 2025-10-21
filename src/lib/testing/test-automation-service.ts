/**
 * Test Automation Service
 * 
 * Orchestrates the test automation workflow:
 * - Coverage analysis
 * - Test generation recommendations
 * - Integration with AI test generator
 * 
 * @module testing/test-automation-service
 */

import { CoverageAnalyzer, type CoverageReport, type FileCoverage } from './coverage-analyzer';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Test generation recommendation
 */
export interface TestRecommendation {
  file: FileCoverage;
  priority: 'high' | 'medium' | 'low';
  estimatedTestCount: number;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  framework: 'jest' | 'vitest' | 'playwright';
  testType: 'unit' | 'integration' | 'e2e';
  reason: string;
}

/**
 * Test automation session
 */
export interface TestAutomationSession {
  id: string;
  projectId: string;
  startTime: Date;
  report?: CoverageReport;
  recommendations?: TestRecommendation[];
  status: 'analyzing' | 'ready' | 'generating' | 'complete' | 'error';
  error?: string;
}

/**
 * Test Automation Service
 */
export class TestAutomationService {
  private analyzer: CoverageAnalyzer;
  private projectRoot: string;
  private sessions: Map<string, TestAutomationSession> = new Map();

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.analyzer = new CoverageAnalyzer(projectRoot);
  }

  /**
   * Start a new test automation session
   */
  async startSession(projectId: string, targetDir?: string): Promise<TestAutomationSession> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: TestAutomationSession = {
      id: sessionId,
      projectId,
      startTime: new Date(),
      status: 'analyzing',
    };

    this.sessions.set(sessionId, session);

    try {
      // Run coverage analysis
      const report = await this.analyzer.analyze(targetDir);
      session.report = report;

      // Generate recommendations
      const recommendations = await this.generateRecommendations(report);
      session.recommendations = recommendations;

      session.status = 'ready';
    } catch (error) {
      session.status = 'error';
      session.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): TestAutomationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Generate test recommendations from coverage report
   */
  private async generateRecommendations(report: CoverageReport): Promise<TestRecommendation[]> {
    const recommendations: TestRecommendation[] = [];

    // Focus on untested files
    const untestedFiles = report.files.filter(f => !f.hasTests);

    for (const file of untestedFiles) {
      const recommendation = await this.createRecommendation(file);
      recommendations.push(recommendation);
    }

    // Sort by priority
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return recommendations;
  }

  /**
   * Create recommendation for a single file
   */
  private async createRecommendation(file: FileCoverage): Promise<TestRecommendation> {
    const { filePath, untestedFunctions } = file;
    
    // Determine test framework based on file location and type
    const framework = this.determineFramework(filePath);
    
    // Determine test type
    const testType = this.determineTestType(filePath);
    
    // Estimate test count (1-3 tests per function)
    const estimatedTestCount = untestedFunctions.reduce((sum, fn) => {
      // More complex functions need more tests
      return sum + Math.min(fn.complexity, 5);
    }, 0);

    // Estimate complexity
    const avgComplexity = untestedFunctions.length > 0
      ? untestedFunctions.reduce((sum, fn) => sum + fn.complexity, 0) / untestedFunctions.length
      : 1;

    const estimatedComplexity = avgComplexity > 5 ? 'complex' : avgComplexity > 2 ? 'moderate' : 'simple';

    return {
      file,
      priority: file.priority,
      estimatedTestCount,
      estimatedComplexity,
      framework,
      testType,
      reason: file.reason,
    };
  }

  /**
   * Determine appropriate test framework
   */
  private determineFramework(filePath: string): 'jest' | 'vitest' | 'playwright' {
    if (filePath.includes('/e2e/') || filePath.includes('.e2e.')) {
      return 'playwright';
    }
    
    // Default to Jest for now (can be configured per project)
    return 'jest';
  }

  /**
   * Determine test type
   */
  private determineTestType(filePath: string): 'unit' | 'integration' | 'e2e' {
    if (filePath.includes('/e2e/') || filePath.includes('.e2e.')) {
      return 'e2e';
    }

    if (
      filePath.includes('/api/') ||
      filePath.includes('/services/') ||
      filePath.includes('integration')
    ) {
      return 'integration';
    }

    return 'unit';
  }

  /**
   * Get high priority recommendations
   */
  getHighPriorityRecommendations(sessionId: string): TestRecommendation[] {
    const session = this.sessions.get(sessionId);
    if (!session || !session.recommendations) {
      return [];
    }

    return session.recommendations.filter(r => r.priority === 'high');
  }

  /**
   * Generate a summary report
   */
  generateSummary(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session || !session.report) {
      return 'No session found';
    }

    const { report, recommendations } = session;
    const highPriority = recommendations?.filter(r => r.priority === 'high').length || 0;
    const mediumPriority = recommendations?.filter(r => r.priority === 'medium').length || 0;

    let summary = `## Test Automation Summary\n\n`;
    summary += `**Session ID:** ${sessionId}\n`;
    summary += `**Status:** ${session.status}\n`;
    summary += `**Analysis Time:** ${new Date(session.startTime).toLocaleString()}\n\n`;

    summary += `### Coverage Overview\n\n`;
    summary += `- **Total Files:** ${report.totalFiles}\n`;
    summary += `- **Tested Files:** ${report.testedFiles} (${((report.testedFiles / report.totalFiles) * 100).toFixed(1)}%)\n`;
    summary += `- **Untested Files:** ${report.untestedFiles}\n`;
    summary += `- **Overall Coverage:** ${report.overallCoverage.toFixed(1)}%\n\n`;

    summary += `### Test Generation Recommendations\n\n`;
    summary += `- **High Priority:** ${highPriority} files\n`;
    summary += `- **Medium Priority:** ${mediumPriority} files\n`;
    summary += `- **Total Tests to Generate:** ${recommendations?.reduce((sum, r) => sum + r.estimatedTestCount, 0) || 0}\n\n`;

    if (highPriority > 0 && recommendations) {
      summary += `### Top 5 High Priority Files\n\n`;
      const top5 = recommendations.filter(r => r.priority === 'high').slice(0, 5);
      top5.forEach((rec, i) => {
        summary += `${i + 1}. **${rec.file.relativePath}**\n`;
        summary += `   - Functions: ${rec.file.functions.length}\n`;
        summary += `   - Estimated Tests: ${rec.estimatedTestCount}\n`;
        summary += `   - Complexity: ${rec.estimatedComplexity}\n`;
        summary += `   - Reason: ${rec.reason}\n\n`;
      });
    }

    return summary;
  }

  /**
   * Export coverage report to file
   */
  async exportReport(sessionId: string, outputPath: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.report) {
      throw new Error('No report found for session');
    }

    const markdown = this.analyzer.generateMarkdownReport(session.report);
    await fs.writeFile(outputPath, markdown, 'utf-8');
  }

  /**
   * Get coverage gaps for specific directory
   */
  async analyzePath(targetPath: string): Promise<FileCoverage[]> {
    const fullPath = path.join(this.projectRoot, targetPath);
    const report = await this.analyzer.analyze(fullPath);
    return report.files.filter(f => !f.hasTests);
  }

  /**
   * Get detailed coverage for a specific file
   */
  async analyzeFile(filePath: string): Promise<FileCoverage | null> {
    const fullPath = path.join(this.projectRoot, filePath);
    
    try {
      const report = await this.analyzer.analyze(path.dirname(fullPath));
      const file = report.files.find(f => f.filePath === fullPath);
      return file || null;
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Clean up old sessions
   */
  cleanupSessions(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.startTime.getTime();
      if (age > maxAgeMs) {
        this.sessions.delete(sessionId);
      }
    }
  }
}
