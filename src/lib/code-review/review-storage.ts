import prisma from '@/lib/db';
import type {
  CodeReviewResult,
  RiskFactorType,
} from '@/types/code-review';
import {
  CommentSeverity,
  CommentCategory,
  RiskFactor,
  CodeReviewStatus,
  RiskLevel,
  Prisma,
} from '@prisma/client';

/**
 * Storage service for code review data
 */
export class ReviewStorage {
  /**
   * Save code review result to database
   */
  async saveReview(
    projectId: string,
    prNumber: number,
    result: CodeReviewResult
  ) {
    // Check if review already exists
    const existing = await prisma.codeReview.findUnique({
      where: {
        projectId_prNumber: {
          projectId,
          prNumber,
        },
      },
    });

    if (existing) {
      // Update existing review
      return await this.updateReview(existing.id, result);
    }

    // Create new review
    return await prisma.codeReview.create({
      data: {
        projectId,
        prNumber,
  prTitle: result.prAnalysis.title,
  prUrl: result.prAnalysis.url || '',
  headBranch: result.prAnalysis.headBranch,
  baseBranch: result.prAnalysis.baseBranch,
        authorLogin: result.prAnalysis.author,
        status: 'COMPLETED',
        riskLevel: this.mapRiskLevel(result.riskScore.level),
        riskScore: result.riskScore.overall,
        overallScore: result.summary.overallScore,
        approved: result.summary.approved,
        requiresChanges: result.summary.requiresChanges,
  filesAnalyzed: result.prAnalysis.filesChanged.length,
  linesAdded: result.prAnalysis.totalAdditions,
  linesRemoved: result.prAnalysis.totalDeletions,
        summary: JSON.stringify(result.summary),
        commitSha: result.prAnalysis.headSha,
        completedAt: new Date(),
        CodeReviewComment: {
          create: result.comments.map((comment) => ({
            filePath: comment.file,
            lineNumber: comment.line,
            severity: this.mapSeverity(comment.severity),
            category: this.mapCategory(comment.category),
            message: comment.message,
            suggestion: comment.suggestion,
            codeSnippet: comment.codeSnippet,
            aiGenerated: false,
          })),
        },
        CodeReviewRisk: {
          create: result.riskScore.factors.map((factor) => ({
            factor: this.mapRiskFactor(factor.factor),
            score: factor.score,
            weight: factor.weight,
            description: factor.description,
            // Narrow details type to Prisma acceptable JSON value
            details: factor.details
              ? (factor.details as unknown as Prisma.InputJsonValue)
              : undefined,
          })),
        },
      },
      include: {
        CodeReviewComment: true,
        CodeReviewRisk: true,
      },
    });
  }

  /**
   * Update existing review
   */
  private async updateReview(reviewId: string, result: CodeReviewResult) {
    // Delete old comments and risks
    await prisma.codeReviewComment.deleteMany({ where: { reviewId } });
    await prisma.codeReviewRisk.deleteMany({ where: { reviewId } });

    // Update review with new data
    return await prisma.codeReview.update({
      where: { id: reviewId },
      data: {
        status: 'COMPLETED',
        riskLevel: this.mapRiskLevel(result.riskScore.level),
        riskScore: result.riskScore.overall,
        overallScore: result.summary.overallScore,
        approved: result.summary.approved,
        requiresChanges: result.summary.requiresChanges,
  filesAnalyzed: result.prAnalysis.filesChanged.length,
  linesAdded: result.prAnalysis.totalAdditions,
  linesRemoved: result.prAnalysis.totalDeletions,
        summary: JSON.stringify(result.summary),
        commitSha: result.prAnalysis.headSha,
        completedAt: new Date(),
        updatedAt: new Date(),
        CodeReviewComment: {
          create: result.comments.map((comment) => ({
            filePath: comment.file,
            lineNumber: comment.line,
            severity: this.mapSeverity(comment.severity),
            category: this.mapCategory(comment.category),
            message: comment.message,
            suggestion: comment.suggestion,
            codeSnippet: comment.codeSnippet,
            aiGenerated: false,
          })),
        },
        CodeReviewRisk: {
          create: result.riskScore.factors.map((factor) => ({
            factor: this.mapRiskFactor(factor.factor),
            score: factor.score,
            weight: factor.weight,
            description: factor.description,
            details: factor.details
              ? (factor.details as unknown as Prisma.InputJsonValue)
              : undefined,
          })),
        },
      },
      include: {
        CodeReviewComment: true,
        CodeReviewRisk: true,
      },
    });
  }

  /**
   * Get review by project and PR number
   */
  async getReview(projectId: string, prNumber: number) {
    return await prisma.codeReview.findUnique({
      where: {
        projectId_prNumber: {
          projectId,
          prNumber,
        },
      },
      include: {
        CodeReviewComment: {
          orderBy: { severity: 'desc' },
        },
        CodeReviewRisk: {
          orderBy: { score: 'desc' },
        },
        CodeReviewImpact: true,
      },
    });
  }

  /**
   * Get review by its unique ID
   */
  async getReviewById(reviewId: string) {
    return await prisma.codeReview.findUnique({
      where: { id: reviewId },
      include: {
        CodeReviewComment: {
          orderBy: { severity: 'desc' },
        },
        CodeReviewRisk: {
          orderBy: { score: 'desc' },
        },
        CodeReviewImpact: true,
      },
    });
  }

  /**
   * Get all reviews for a project
   */
  async getProjectReviews(
    projectId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: CodeReviewStatus;
      riskLevel?: RiskLevel;
    }
  ) {
    const { limit = 50, offset = 0, status, riskLevel } = options || {};

    return await prisma.codeReview.findMany({
      where: {
        projectId,
        ...(status && { status }),
        ...(riskLevel && { riskLevel }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        CodeReviewComment: {
          where: {
            severity: {
              in: ['ERROR', 'CRITICAL'],
            },
          },
          take: 5,
        },
        CodeReviewRisk: true,
      },
    });
  }

  /**
   * Check if review exists for commit SHA
   */
  async reviewExistsForCommit(projectId: string, commitSha: string) {
    const review = await prisma.codeReview.findFirst({
      where: {
        projectId,
        commitSha,
      },
    });
    return !!review;
  }

  /**
   * Get review statistics for a project
   */
  async getReviewStats(projectId: string) {
    const reviews = await prisma.codeReview.findMany({
      where: { projectId },
      select: {
        riskLevel: true,
        approved: true,
        requiresChanges: true,
        overallScore: true,
      },
    });

    const total = reviews.length;
    const approved = reviews.filter((r) => r.approved).length;
    const requiresChanges = reviews.filter((r) => r.requiresChanges).length;
    const avgScore =
      reviews.reduce((sum, r) => sum + r.overallScore, 0) / (total || 1);

    const riskDistribution = {
      LOW: reviews.filter((r) => r.riskLevel === 'LOW').length,
      MEDIUM: reviews.filter((r) => r.riskLevel === 'MEDIUM').length,
      HIGH: reviews.filter((r) => r.riskLevel === 'HIGH').length,
      CRITICAL: reviews.filter((r) => r.riskLevel === 'CRITICAL').length,
    };

    return {
      total,
      approved,
      requiresChanges,
      avgScore,
      riskDistribution,
    };
  }

  /**
   * Map risk level from string to enum
   */
  private mapRiskLevel(
    level: string
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const mapping: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      low: 'LOW',
      medium: 'MEDIUM',
      high: 'HIGH',
      critical: 'CRITICAL',
    };
    return mapping[level.toLowerCase()] || 'LOW';
  }

  /**
   * Map severity from string to enum
   */
  private mapSeverity(severity: string): CommentSeverity {
    const mapping: Record<string, CommentSeverity> = {
      info: 'INFO',
      warning: 'WARNING',
      error: 'ERROR',
      critical: 'CRITICAL',
    };
    return mapping[severity.toLowerCase()] || 'INFO';
  }

  /**
   * Map category from string to enum
   */
  private mapCategory(category: string): CommentCategory {
    const mapping: Record<string, CommentCategory> = {
      security: 'SECURITY',
      performance: 'PERFORMANCE',
      'best-practices': 'BEST_PRACTICES',
      complexity: 'COMPLEXITY',
      documentation: 'DOCUMENTATION',
      testing: 'TESTING',
      style: 'STYLE',
      bug: 'BUG',
    };
    return mapping[category.toLowerCase()] || 'BEST_PRACTICES';
  }

  /**
   * Map risk factor from string to enum
   */
  private mapRiskFactor(factor: RiskFactorType): RiskFactor {
    const mapping: Record<RiskFactorType, RiskFactor> = {
      changeSize: 'CHANGE_SIZE',
      fileCount: 'FILE_COUNT',
      criticalFiles: 'CRITICAL_FILES',
      complexity: 'COMPLEXITY',
      testCoverage: 'TEST_COVERAGE',
    };
    return mapping[factor];
  }
}

export const reviewStorage = new ReviewStorage();
