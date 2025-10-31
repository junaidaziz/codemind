import prisma from '@/lib/db';
import type { CodeReviewResult, RiskFactorType } from '@/types/code-review';
import { CommentSeverity, CommentCategory, RiskFactor, CodeReviewStatus, RiskLevel, Prisma, PrismaClient } from '@prisma/client';

type CreateData = Prisma.CodeReviewCreateInput & {
  simulation?: Prisma.InputJsonValue;
  documentationSuggestions?: Prisma.InputJsonValue;
  testingSuggestions?: Prisma.InputJsonValue;
};
type UpdateData = Prisma.CodeReviewUpdateInput & {
  simulation?: Prisma.InputJsonValue;
  documentationSuggestions?: Prisma.InputJsonValue;
  testingSuggestions?: Prisma.InputJsonValue;
};

// Allow injecting a lightweight prisma-like stub for unit tests
// Minimal subset of PrismaClient used by ReviewStorage; enables injection of stubs in tests
export interface PrismaSubset {
  codeReview: {
    findUnique: PrismaClient['codeReview']['findUnique'];
    findFirst: PrismaClient['codeReview']['findFirst'];
    create: PrismaClient['codeReview']['create'];
    update: PrismaClient['codeReview']['update'];
    findMany: PrismaClient['codeReview']['findMany'];
  };
  codeReviewComment: {
    findMany: PrismaClient['codeReviewComment']['findMany'];
    deleteMany: PrismaClient['codeReviewComment']['deleteMany'];
    updateMany: PrismaClient['codeReviewComment']['updateMany'];
  };
  codeReviewRisk: {
    deleteMany: PrismaClient['codeReviewRisk']['deleteMany'];
  };
  codeReviewImpact: {
    deleteMany: PrismaClient['codeReviewImpact']['deleteMany'];
  };
}

export class ReviewStorage {
  constructor(private client: PrismaSubset = prisma as unknown as PrismaSubset) {}

  async saveReview(projectId: string, prNumber: number, result: CodeReviewResult) {
    const existing = await this.client.codeReview.findUnique({
      where: { projectId_prNumber: { projectId, prNumber } },
      select: { id: true }
    });
    if (existing) return this.updateReview(existing.id, result);

    const data: CreateData = {
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
        create: result.comments.map(c => ({
          filePath: c.file,
          lineNumber: c.line,
            severity: this.mapSeverity(c.severity),
          category: this.mapCategory(c.category),
          message: c.message,
          suggestion: c.suggestion,
          codeSnippet: c.codeSnippet,
          aiGenerated: false,
        }))
      },
      CodeReviewRisk: {
        create: result.riskScore.factors.map(f => ({
          factor: this.mapRiskFactor(f.factor),
          score: f.score,
          weight: f.weight,
          description: f.description,
          details: f.details ? (f.details as unknown as Prisma.InputJsonValue) : undefined,
        }))
      },
      CodeReviewImpact: {
        create: this.generateImpacts(result).map(i => ({
          category: i.category,
          severity: i.severity,
          affectedFiles: i.affectedFiles,
          description: i.description,
          recommendations: i.recommendations,
        }))
      }
    };
    data.simulation = result.simulation ? (result.simulation as unknown as Prisma.InputJsonValue) : undefined;
    data.documentationSuggestions = result.documentationSuggestions.length > 0 ? (result.documentationSuggestions as unknown as Prisma.InputJsonValue) : undefined;
    data.testingSuggestions = result.testingSuggestions.length > 0 ? (result.testingSuggestions as unknown as Prisma.InputJsonValue) : undefined;

    return this.client.codeReview.create({
      data,
      include: { CodeReviewComment: true, CodeReviewRisk: true, CodeReviewImpact: true }
    });
  }

  async updateReview(reviewId: string, result: CodeReviewResult) {
    const previouslyPosted = await this.client.codeReviewComment.findMany({
      where: { reviewId, postedToGitHub: true, lineNumber: { not: null } },
      select: { filePath: true, lineNumber: true, githubCommentId: true }
    });
    const postedMap = new Map<string, number | null>();
    for (const pc of previouslyPosted) {
      if (pc.lineNumber != null) postedMap.set(`${pc.filePath}:${pc.lineNumber}`, pc.githubCommentId);
    }

    await this.client.codeReviewComment.deleteMany({ where: { reviewId } });
    await this.client.codeReviewRisk.deleteMany({ where: { reviewId } });
    await this.client.codeReviewImpact.deleteMany({ where: { reviewId } });

    const data: UpdateData = {
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
        create: result.comments.map(c => {
          const key = `${c.file}:${c.line}`;
          const wasPosted = postedMap.has(key);
          return {
            filePath: c.file,
            lineNumber: c.line,
            severity: this.mapSeverity(c.severity),
            category: this.mapCategory(c.category),
            message: c.message,
            suggestion: c.suggestion,
            codeSnippet: c.codeSnippet,
            aiGenerated: false,
            postedToGitHub: wasPosted,
            githubCommentId: wasPosted ? postedMap.get(key) ?? undefined : undefined,
          };
        })
      },
      CodeReviewRisk: {
        create: result.riskScore.factors.map(f => ({
          factor: this.mapRiskFactor(f.factor),
          score: f.score,
          weight: f.weight,
          description: f.description,
          details: f.details ? (f.details as unknown as Prisma.InputJsonValue) : undefined,
        }))
      },
      CodeReviewImpact: {
        create: this.generateImpacts(result).map(i => ({
          category: i.category,
          severity: i.severity,
          affectedFiles: i.affectedFiles,
          description: i.description,
          recommendations: i.recommendations,
        }))
      }
    };
    data.simulation = result.simulation ? (result.simulation as unknown as Prisma.InputJsonValue) : undefined;
    data.documentationSuggestions = result.documentationSuggestions.length > 0 ? (result.documentationSuggestions as unknown as Prisma.InputJsonValue) : undefined;
    data.testingSuggestions = result.testingSuggestions.length > 0 ? (result.testingSuggestions as unknown as Prisma.InputJsonValue) : undefined;

    return this.client.codeReview.update({
      where: { id: reviewId },
      data,
      include: { CodeReviewComment: true, CodeReviewRisk: true, CodeReviewImpact: true }
    });
  }

  async getReview(projectId: string, prNumber: number) {
    return this.client.codeReview.findUnique({
      where: { projectId_prNumber: { projectId, prNumber } },
      include: {
        CodeReviewComment: { orderBy: { severity: 'desc' } },
        CodeReviewRisk: { orderBy: { score: 'desc' } },
        CodeReviewImpact: true,
      }
    });
  }

  async getPostedInlineCommentCoordinates(projectId: string, prNumber: number) {
    const review = await this.client.codeReview.findUnique({
      where: { projectId_prNumber: { projectId, prNumber } },
      select: {
        CodeReviewComment: {
          where: { postedToGitHub: true, lineNumber: { not: null } },
          select: { filePath: true, lineNumber: true }
        }
      }
    });
    const set = new Set<string>();
    review?.CodeReviewComment.forEach(c => set.add(`${c.filePath}:${c.lineNumber}`));
    return set;
  }

  async getReviewById(reviewId: string) {
    return this.client.codeReview.findUnique({
      where: { id: reviewId },
      include: {
        CodeReviewComment: { orderBy: { severity: 'desc' } },
        CodeReviewRisk: { orderBy: { score: 'desc' } },
        CodeReviewImpact: true,
      }
    });
  }

  async getProjectReviews(projectId: string, options?: { limit?: number; offset?: number; status?: CodeReviewStatus; riskLevel?: RiskLevel }) {
    const { limit = 50, offset = 0, status, riskLevel } = options || {};
    return this.client.codeReview.findMany({
      where: { projectId, ...(status && { status }), ...(riskLevel && { riskLevel }) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        CodeReviewComment: {
          where: { severity: { in: ['ERROR', 'CRITICAL'] } },
          take: 5,
        },
        CodeReviewRisk: true,
        CodeReviewImpact: true,
      }
    });
  }

  async reviewExistsForCommit(projectId: string, commitSha: string) {
    const review = await this.client.codeReview.findFirst({ where: { projectId, commitSha } });
    return !!review;
  }

  async getReviewStats(projectId: string) {
    const reviews = await this.client.codeReview.findMany({
      where: { projectId },
      select: { riskLevel: true, approved: true, requiresChanges: true, overallScore: true }
    });
    const total = reviews.length;
    const approved = reviews.filter(r => r.approved).length;
    const requiresChanges = reviews.filter(r => r.requiresChanges).length;
    const avgScore = reviews.reduce((sum, r) => sum + r.overallScore, 0) / (total || 1);
    const riskDistribution = {
      LOW: reviews.filter(r => r.riskLevel === 'LOW').length,
      MEDIUM: reviews.filter(r => r.riskLevel === 'MEDIUM').length,
      HIGH: reviews.filter(r => r.riskLevel === 'HIGH').length,
      CRITICAL: reviews.filter(r => r.riskLevel === 'CRITICAL').length,
    };
    return { total, approved, requiresChanges, avgScore, riskDistribution };
  }

  private mapRiskLevel(level: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const mapping: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = { low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'CRITICAL' };
    return mapping[level.toLowerCase()] || 'LOW';
  }
  private mapSeverity(severity: string): CommentSeverity {
    const mapping: Record<string, CommentSeverity> = { info: 'INFO', warning: 'WARNING', error: 'ERROR', critical: 'CRITICAL' };
    return mapping[severity.toLowerCase()] || 'INFO';
  }
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

  private generateImpacts(result: CodeReviewResult) {
    const impactfulSeverities = new Set(['high', 'critical']);
    const grouped: Record<string, { files: Set<string>; severities: Set<string>; comments: string[] }> = {};
    for (const c of result.comments) {
      if (!impactfulSeverities.has(c.severity)) continue;
      const category = c.category;
      if (!grouped[category]) grouped[category] = { files: new Set(), severities: new Set(), comments: [] };
      grouped[category].files.add(c.file);
      grouped[category].severities.add(c.severity);
      grouped[category].comments.push(c.message);
    }
    const severityRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    return Object.entries(grouped).map(([category, data]) => {
      let highest = 'high';
      for (const s of data.severities) if (severityRank[s] > severityRank[highest]) highest = s;
      const description = `${data.comments.length} significant ${category} issue(s) detected.`;
      const recommendations = this.generateRecommendationsForCategory(category, highest);
      return { category, severity: highest.toUpperCase(), affectedFiles: Array.from(data.files), description, recommendations };
    });
  }
  private generateRecommendationsForCategory(category: string, severity: string) {
    switch (category) {
      case 'security': return 'Review authentication, validate inputs, and add missing security tests.';
      case 'performance': return 'Optimize hotspots; consider profiling and adding performance benchmarks.';
      case 'complexity': return 'Refactor large functions; add unit tests before restructuring.';
      case 'documentation': return 'Add or update README/module docs for changed critical logic.';
      case 'testing': return 'Increase coverage for modified critical paths and edge cases.';
      default: return `Address ${category} issues with priority: ${severity}.`;
    }
  }

  async markCommentsPosted(reviewId: string, postings: Array<{ filePath: string; lineNumber: number; githubCommentId: number }>) {
    if (postings.length === 0) return { updated: 0 };
    let updated = 0;
    for (const p of postings) {
      try {
        await this.client.codeReviewComment.updateMany({
          where: { reviewId, filePath: p.filePath, lineNumber: p.lineNumber, postedToGitHub: false },
          data: { postedToGitHub: true, githubCommentId: p.githubCommentId }
        });
        updated++;
      } catch (err) {
        console.error('[ReviewStorage] Failed to mark comment posted', p, err);
      }
    }
    return { updated };
  }
}

export const reviewStorage = new ReviewStorage(prisma);
