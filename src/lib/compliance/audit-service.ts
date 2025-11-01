import db from '../db';
import { nanoid } from 'nanoid';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface CreateAuditInput {
  projectId: string;
  prNumber?: number;
  commitSha?: string;
  triggeredBy: string;
  triggerType?: string;
}

export interface ViolationInput {
  ruleId: string;
  projectId: string;
  prNumber?: number;
  commitSha?: string;
  filePath?: string;
  lineNumber?: number;
  severity: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AuditFilters {
  projectId?: string;
  prNumber?: number;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class ComplianceAuditService {
  /**
   * Create a new compliance audit
   */
  static async createAudit(input: CreateAuditInput) {
    return db.complianceAudit.create({
      data: {
        id: nanoid(),
        projectId: input.projectId,
        prNumber: input.prNumber,
        commitSha: input.commitSha,
        triggeredBy: input.triggeredBy,
        triggerType: (input.triggerType || 'PR_EVENT') as never,
        status: 'PENDING' as never,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Update audit status and metrics
   */
  static async updateAudit(
    id: string,
    data: {
      status?: string;
      rulesChecked?: number;
      violationsFound?: number;
      criticalCount?: number;
      highCount?: number;
      mediumCount?: number;
      lowCount?: number;
      aiInsights?: string;
      overallScore?: number;
      duration?: number;
      metadata?: Record<string, unknown>;
    }
  ) {
    const updateData: Record<string, unknown> = {};

    if (data.status) updateData.status = data.status;
    if (data.rulesChecked !== undefined)
      updateData.rulesChecked = data.rulesChecked;
    if (data.violationsFound !== undefined)
      updateData.violationsFound = data.violationsFound;
    if (data.criticalCount !== undefined)
      updateData.criticalCount = data.criticalCount;
    if (data.highCount !== undefined) updateData.highCount = data.highCount;
    if (data.mediumCount !== undefined)
      updateData.mediumCount = data.mediumCount;
    if (data.lowCount !== undefined) updateData.lowCount = data.lowCount;
    if (data.aiInsights) updateData.aiInsights = data.aiInsights;
    if (data.overallScore !== undefined)
      updateData.overallScore = data.overallScore;
    if (data.duration !== undefined) updateData.duration = data.duration;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (data.metadata) updateData.metadata = data.metadata as any;

    if (data.status === 'COMPLETED' || data.status === 'FAILED') {
      updateData.completedAt = new Date();
    }

    return db.complianceAudit.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Get audit by ID
   */
  static async getAudit(id: string) {
    return db.complianceAudit.findUnique({
      where: { id },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * List audits with filters
   */
  static async listAudits(filters: AuditFilters) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.prNumber) {
      where.prNumber = filters.prNumber;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [audits, total] = await Promise.all([
      db.complianceAudit.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      db.complianceAudit.count({ where }),
    ]);

    return {
      audits,
      total,
      hasMore: total > (filters.offset || 0) + audits.length,
    };
  }

  /**
   * Create a violation
   */
  static async createViolation(input: ViolationInput) {
    return db.complianceViolation.create({
      data: {
        id: nanoid(),
        ruleId: input.ruleId,
        projectId: input.projectId,
        prNumber: input.prNumber,
        commitSha: input.commitSha,
        filePath: input.filePath,
        lineNumber: input.lineNumber,
        severity: input.severity as never,
        message: input.message,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        details: input.details as any,
        status: 'OPEN' as never,
      },
      include: {
        rule: true,
      },
    });
  }

  /**
   * Get violations for an audit
   */
  static async getViolations(
    projectId: string,
    prNumber?: number,
    status?: string
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      projectId,
    };

    if (prNumber) {
      where.prNumber = prNumber;
    }

    if (status) {
      where.status = status;
    }

    return db.complianceViolation.findMany({
      where,
      include: {
        rule: true,
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Update violation with AI analysis
   */
  static async analyzeViolationWithAI(violationId: string) {
    const violation = await db.complianceViolation.findUnique({
      where: { id: violationId },
      include: {
        rule: true,
      },
    });

    if (!violation) {
      throw new Error('Violation not found');
    }

    try {
      const prompt = `Analyze this compliance violation and provide a detailed explanation and suggested fix:

Rule: ${violation.rule.name}
Category: ${violation.rule.category}
Severity: ${violation.severity}
Message: ${violation.message}
File: ${violation.filePath || 'N/A'}
Line: ${violation.lineNumber || 'N/A'}
Details: ${JSON.stringify(violation.details, null, 2)}

Please provide:
1. A detailed analysis of why this is a violation
2. Potential impact of not fixing it
3. Specific steps to fix the issue
4. Code examples if applicable`;

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content:
              'You are a compliance expert helping developers understand and fix code compliance violations. Provide clear, actionable advice.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const aiAnalysis = response.choices[0]?.message?.content || '';

      // Extract suggestion from the analysis
      const suggestionMatch = aiAnalysis.match(
        /(?:steps to fix|fix|solution):(.*?)(?:\n\n|\n#|$)/is
      );
      const aiSuggestion = suggestionMatch
        ? suggestionMatch[1].trim()
        : 'Review the analysis for fix suggestions';

      // Update violation with AI insights
      return db.complianceViolation.update({
        where: { id: violationId },
        data: {
          aiAnalysis,
          aiSuggestion,
        },
      });
    } catch (error) {
      console.error('Error analyzing violation with AI:', error);
      throw error;
    }
  }

  /**
   * Generate AI insights for an audit
   */
  static async generateAuditInsights(auditId: string) {
    const audit = await db.complianceAudit.findUnique({
      where: { id: auditId },
    });

    if (!audit) {
      throw new Error('Audit not found');
    }

    // Get all violations for this audit
    const violations = await this.getViolations(
      audit.projectId,
      audit.prNumber,
      undefined
    );

    if (violations.length === 0) {
      return db.complianceAudit.update({
        where: { id: auditId },
        data: {
          aiInsights: 'No violations found. All compliance checks passed.',
          overallScore: 100,
        },
      });
    }

    try {
      const violationSummary = violations.map((v) => ({
        rule: v.rule.name,
        category: v.rule.category,
        severity: v.severity,
        message: v.message,
        file: v.filePath,
      }));

      const prompt = `Analyze this compliance audit report and provide overall insights:

Total Violations: ${violations.length}
Critical: ${audit.criticalCount}
High: ${audit.highCount}
Medium: ${audit.mediumCount}
Low: ${audit.lowCount}

Violations:
${JSON.stringify(violationSummary, null, 2)}

Please provide:
1. Overall assessment of compliance status
2. Key areas of concern
3. Priority recommendations
4. Risk assessment
5. A compliance score from 0-100`;

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content:
              'You are a compliance auditor providing executive-level insights on code compliance. Be concise and actionable.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const aiInsights = response.choices[0]?.message?.content || '';

      // Extract compliance score from AI response
      const scoreMatch = aiInsights.match(/score[:\s]+(\d+)/i);
      const overallScore = scoreMatch
        ? parseInt(scoreMatch[1], 10)
        : this.calculateComplianceScore(audit);

      return db.complianceAudit.update({
        where: { id: auditId },
        data: {
          aiInsights,
          overallScore,
        },
      });
    } catch (error) {
      console.error('Error generating audit insights:', error);
      throw error;
    }
  }

  /**
   * Calculate compliance score based on violations
   */
  private static calculateComplianceScore(audit: {
    violationsFound: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  }): number {
    if (audit.violationsFound === 0) return 100;

    // Weight violations by severity
    const weightedScore =
      audit.criticalCount * 25 +
      audit.highCount * 10 +
      audit.mediumCount * 5 +
      audit.lowCount * 1;

    // Cap at 100 violations worth of impact
    const normalizedScore = Math.min(weightedScore, 100);

    // Return inverted score (100 - penalties)
    return Math.max(0, 100 - normalizedScore);
  }

  /**
   * Resolve a violation
   */
  static async resolveViolation(
    violationId: string,
    resolvedBy: string,
    status: string
  ) {
    return db.complianceViolation.update({
      where: { id: violationId },
      data: {
        status: status as never,
        resolvedBy,
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * Get audit statistics
   */
  static async getAuditStats(projectId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [total, completed, failed, avgScore] = await Promise.all([
      db.complianceAudit.count({
        where: { projectId, createdAt: { gte: since } },
      }),
      db.complianceAudit.count({
        where: {
          projectId,
          status: 'COMPLETED',
          createdAt: { gte: since },
        },
      }),
      db.complianceAudit.count({
        where: {
          projectId,
          status: 'FAILED',
          createdAt: { gte: since },
        },
      }),
      db.complianceAudit.aggregate({
        where: {
          projectId,
          status: 'COMPLETED',
          createdAt: { gte: since },
        },
        _avg: { overallScore: true },
      }),
    ]);

    const violations = await db.complianceViolation.groupBy({
      by: ['severity'],
      where: {
        projectId,
        createdAt: { gte: since },
      },
      _count: true,
    });

    return {
      total,
      completed,
      failed,
      averageScore: avgScore._avg.overallScore || 0,
      violationsBySeverity: Object.fromEntries(
        violations.map((v) => [v.severity, v._count])
      ),
      period: { startDate: since, endDate: new Date() },
    };
  }
}

/**
 * Violation statuses
 */
export const violationStatuses = {
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
  IGNORED: 'IGNORED',
  FALSE_POSITIVE: 'FALSE_POSITIVE',
} as const;

/**
 * Audit trigger types
 */
export const auditTriggerTypes = {
  PR_EVENT: 'PR_EVENT',
  MANUAL: 'MANUAL',
  SCHEDULED: 'SCHEDULED',
  COMMIT_PUSH: 'COMMIT_PUSH',
  DEPLOYMENT: 'DEPLOYMENT',
} as const;

/**
 * Audit statuses
 */
export const auditStatuses = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
