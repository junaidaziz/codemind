/**
 * Risk Scoring System for Pull Requests
 * 
 * Calculates risk scores based on multiple factors
 */

import type {
  PRAnalysis,
  RiskScore,
  RiskFactor,
  RiskLevel,
} from '@/types/code-review';

export class RiskScorer {
  /**
   * Calculate comprehensive risk score for a PR
   */
  calculateRisk(prAnalysis: PRAnalysis): RiskScore {
    const factors: RiskFactor[] = [];

    // Factor 1: Change Size
    factors.push(this.assessChangeSize(prAnalysis));

    // Factor 2: File Count
    factors.push(this.assessFileCount(prAnalysis));

    // Factor 3: Critical Files Modified
    factors.push(this.assessCriticalFiles(prAnalysis));

    // Factor 4: Complexity of Changes
    factors.push(this.assessComplexity(prAnalysis));

    // Factor 5: Test File Ratio
    factors.push(this.assessTestCoverage(prAnalysis));

    // Calculate weighted overall score
    const overall = this.calculateWeightedScore(factors);
    const level = this.determineRiskLevel(overall);
    const summary = this.generateRiskSummary(factors);

    return {
      overall,
      level,
      factors,
      summary,
    };
  }

  /**
   * Assess risk based on change size (additions + deletions)
   */
  private assessChangeSize(prAnalysis: PRAnalysis): RiskFactor {
    const totalChanges = prAnalysis.totalAdditions + prAnalysis.totalDeletions;
    
    let score: number;
    let impact: RiskLevel;

    if (totalChanges < 50) {
      score = 10;
      impact = 'low';
    } else if (totalChanges < 200) {
      score = 30;
      impact = 'low';
    } else if (totalChanges < 500) {
      score = 60;
      impact = 'medium';
    } else if (totalChanges < 1000) {
      score = 80;
      impact = 'high';
    } else {
      score = 95;
      impact = 'critical';
    }

    return {
      factor: 'changeSize',
      score,
      weight: 0.25,
      description: `${totalChanges} lines changed (${prAnalysis.totalAdditions}+ / ${prAnalysis.totalDeletions}-)`,
      impact,
    };
  }

  /**
   * Assess risk based on number of files changed
   */
  private assessFileCount(prAnalysis: PRAnalysis): RiskFactor {
    const fileCount = prAnalysis.filesChanged.length;
    
    let score: number;
    let impact: RiskLevel;

    if (fileCount <= 3) {
      score = 10;
      impact = 'low';
    } else if (fileCount <= 10) {
      score = 40;
      impact = 'medium';
    } else if (fileCount <= 20) {
      score = 70;
      impact = 'high';
    } else {
      score = 90;
      impact = 'critical';
    }

    return {
      factor: 'fileCount',
      score,
      weight: 0.15,
      description: `${fileCount} files modified`,
      impact,
    };
  }

  /**
   * Assess risk based on critical files being modified
   */
  private assessCriticalFiles(prAnalysis: PRAnalysis): RiskFactor {
    const criticalPatterns = [
      /auth/i,
      /security/i,
      /payment/i,
      /database/i,
      /migration/i,
      /schema/i,
      /api.*route/i,
      /middleware/i,
      /config/i,
      /\.env/i,
    ];

    const criticalFiles = prAnalysis.filesChanged.filter(file =>
      criticalPatterns.some(pattern => pattern.test(file.filename))
    );

    const count = criticalFiles.length;
    let score: number;
    let impact: RiskLevel;

    if (count === 0) {
      score = 5;
      impact = 'low';
    } else if (count === 1) {
      score = 50;
      impact = 'medium';
    } else if (count === 2) {
      score = 75;
      impact = 'high';
    } else {
      score = 95;
      impact = 'critical';
    }

    const fileList = criticalFiles.map(f => f.filename).join(', ');
    const description = count > 0
      ? `${count} critical files modified: ${fileList}`
      : 'No critical files modified';

    return {
      factor: 'criticalFiles',
      score,
      weight: 0.35,
      description,
      impact,
    };
  }

  /**
   * Assess complexity based on change patterns
   */
  private assessComplexity(prAnalysis: PRAnalysis): RiskFactor {
    let complexityScore = 0;

    // Check for removed files (potentially breaking)
    const removedFiles = prAnalysis.filesChanged.filter(f => f.status === 'removed');
    if (removedFiles.length > 0) {
      complexityScore += 30;
    }

    // Check for renamed files (can break imports)
    const renamedFiles = prAnalysis.filesChanged.filter(f => f.status === 'renamed');
    if (renamedFiles.length > 0) {
      complexityScore += 20;
    }

    // Check for large file changes
    const largeChanges = prAnalysis.filesChanged.filter(f => f.changes > 200);
    complexityScore += Math.min(largeChanges.length * 10, 30);

    // Check for multiple types of changes
    const hasAdditions = prAnalysis.filesChanged.some(f => f.status === 'added');
    const hasModifications = prAnalysis.filesChanged.some(f => f.status === 'modified');
    const hasDeletions = prAnalysis.filesChanged.some(f => f.status === 'removed');
    
    const changeTypes = [hasAdditions, hasModifications, hasDeletions].filter(Boolean).length;
    if (changeTypes >= 3) {
      complexityScore += 20;
    }

    const score = Math.min(complexityScore, 100);
    const impact = this.scoreToImpact(score);

    return {
      factor: 'complexity',
      score,
      weight: 0.15,
      description: this.generateComplexityDescription(prAnalysis),
      impact,
    };
  }

  /**
   * Assess test coverage ratio
   */
  private assessTestCoverage(prAnalysis: PRAnalysis): RiskFactor {
    const codeFiles = prAnalysis.filesChanged.filter(f => 
      this.isCodeFile(f.filename) && !this.isTestFile(f.filename) && f.status !== 'removed'
    );

    const testFiles = prAnalysis.filesChanged.filter(f => 
      this.isTestFile(f.filename) && f.status !== 'removed'
    );

    const codeChanges = codeFiles.reduce((sum, f) => sum + f.additions, 0);
    const testChanges = testFiles.reduce((sum, f) => sum + f.additions, 0);

    let score: number;
    let impact: RiskLevel;

    if (codeChanges === 0) {
      score = 0;
      impact = 'low';
    } else {
      const testRatio = testChanges / codeChanges;
      
      if (testRatio >= 0.5) {
        score = 10;
        impact = 'low';
      } else if (testRatio >= 0.2) {
        score = 40;
        impact = 'medium';
      } else if (testRatio > 0) {
        score = 70;
        impact = 'high';
      } else {
        score = 90;
        impact = 'critical';
      }
    }

    const description = codeChanges === 0
      ? 'No code changes to test'
      : testChanges === 0
      ? 'No test files modified - tests may be needed'
      : `Test ratio: ${Math.round((testChanges / codeChanges) * 100)}%`;

    return {
      factor: 'testCoverage',
      score,
      weight: 0.10,
      description,
      impact,
    };
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(factors: RiskFactor[]): number {
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedSum = factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
    
    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): RiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  /**
   * Generate risk summary
   */
  private generateRiskSummary(factors: RiskFactor[]): string {
    const labelMap: Record<string, string> = {
      changeSize: 'Change Size',
      fileCount: 'File Count',
      criticalFiles: 'Critical Files',
      complexity: 'Complexity',
      testCoverage: 'Test Coverage',
    };
    const highRiskFactors = factors
      .filter(f => f.impact === 'high' || f.impact === 'critical')
      .map(f => labelMap[f.factor] || f.factor);

    if (highRiskFactors.length === 0) return 'Low-risk changes overall';
    if (highRiskFactors.length === 1) return `Elevated risk due to: ${highRiskFactors[0]}`;
    return `High-risk factors: ${highRiskFactors.join(', ')}`;
  }

  /**
   * Generate complexity description
   */
  private generateComplexityDescription(prAnalysis: PRAnalysis): string {
    const parts: string[] = [];

    const removed = prAnalysis.filesChanged.filter(f => f.status === 'removed').length;
    const renamed = prAnalysis.filesChanged.filter(f => f.status === 'renamed').length;
    const added = prAnalysis.filesChanged.filter(f => f.status === 'added').length;

    if (removed > 0) parts.push(`${removed} removed`);
    if (renamed > 0) parts.push(`${renamed} renamed`);
    if (added > 0) parts.push(`${added} added`);

    return parts.length > 0 
      ? `Mixed changes: ${parts.join(', ')}`
      : 'Standard modifications';
  }

  // Helper methods
  private scoreToImpact(score: number): RiskLevel {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  private isCodeFile(filename: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs'];
    return codeExtensions.some(ext => filename.endsWith(ext));
  }

  private isTestFile(filename: string): boolean {
    return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filename) || filename.includes('__tests__');
  }
}
