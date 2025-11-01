import db from '../db';
import { nanoid } from 'nanoid';

export interface CreateRuleInput {
  name: string;
  description: string;
  category: string;
  severity?: string;
  ruleType?: string;
  enabled?: boolean;
  condition: Record<string, unknown>;
  action?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  organizationId?: string;
  projectId?: string;
  createdBy: string;
}

export interface UpdateRuleInput {
  name?: string;
  description?: string;
  category?: string;
  severity?: string;
  ruleType?: string;
  enabled?: boolean;
  condition?: Record<string, unknown>;
  action?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RuleFilters {
  category?: string;
  severity?: string;
  ruleType?: string;
  enabled?: boolean;
  organizationId?: string;
  projectId?: string;
  createdBy?: string;
  limit?: number;
  offset?: number;
}

export class ComplianceRuleService {
  /**
   * Create a new compliance rule
   */
  static async createRule(input: CreateRuleInput) {
    return db.complianceRule.create({
      data: {
        id: nanoid(),
        name: input.name,
        description: input.description,
        category: input.category as never,
        severity: (input.severity || 'MEDIUM') as never,
        ruleType: (input.ruleType || 'CODE_QUALITY') as never,
        enabled: input.enabled ?? true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        condition: input.condition as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        action: input.action as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: input.metadata as any,
        organizationId: input.organizationId,
        projectId: input.projectId,
        createdBy: input.createdBy,
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
   * Get a rule by ID
   */
  static async getRule(id: string) {
    return db.complianceRule.findUnique({
      where: { id },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        violations: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * List rules with filters
   */
  static async listRules(filters: RuleFilters) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.severity) {
      where.severity = filters.severity;
    }

    if (filters.ruleType) {
      where.ruleType = filters.ruleType;
    }

    if (filters.enabled !== undefined) {
      where.enabled = filters.enabled;
    }

    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }

    const [rules, total] = await Promise.all([
      db.complianceRule.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          violations: {
            where: { status: 'OPEN' },
            select: { id: true },
          },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      db.complianceRule.count({ where }),
    ]);

    return {
      rules: rules.map((rule) => ({
        ...rule,
        openViolationsCount: rule.violations.length,
        violations: undefined,
      })),
      total,
      hasMore: total > (filters.offset || 0) + rules.length,
    };
  }

  /**
   * Update a rule
   */
  static async updateRule(id: string, input: UpdateRuleInput) {
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.severity !== undefined) updateData.severity = input.severity;
    if (input.ruleType !== undefined) updateData.ruleType = input.ruleType;
    if (input.enabled !== undefined) updateData.enabled = input.enabled;
    if (input.condition !== undefined) updateData.condition = input.condition;
    if (input.action !== undefined) updateData.action = input.action;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    return db.complianceRule.update({
      where: { id },
      data: updateData,
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
   * Delete a rule
   */
  static async deleteRule(id: string) {
    return db.complianceRule.delete({
      where: { id },
    });
  }

  /**
   * Enable/disable a rule
   */
  static async toggleRule(id: string, enabled: boolean) {
    return db.complianceRule.update({
      where: { id },
      data: { enabled },
    });
  }

  /**
   * Get rules for a specific scope (organization or project)
   */
  static async getRulesForScope(
    organizationId?: string,
    projectId?: string
  ) {
    const where: {
      enabled: boolean;
      OR?: Array<{
        organizationId?: string | null;
        projectId?: string | null;
      }>;
    } = {
      enabled: true,
    };

    // Build OR conditions for scope hierarchy
    const orConditions: Array<{
      organizationId?: string | null;
      projectId?: string | null;
    }> = [];

    // Global rules (no organization or project)
    orConditions.push({
      organizationId: null,
      projectId: null,
    });

    // Organization-level rules
    if (organizationId) {
      orConditions.push({
        organizationId,
        projectId: null,
      });
    }

    // Project-level rules
    if (projectId) {
      orConditions.push({
        projectId,
      });
    }

    where.OR = orConditions;

    return db.complianceRule.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Get rule statistics
   */
  static async getRuleStats(
    organizationId?: string,
    projectId?: string
  ) {
    const where: {
      organizationId?: string;
      projectId?: string;
    } = {};

    if (organizationId) where.organizationId = organizationId;
    if (projectId) where.projectId = projectId;

    const [total, enabled, disabled, bySeverity, byCategory, byType] =
      await Promise.all([
        db.complianceRule.count({ where }),
        db.complianceRule.count({ where: { ...where, enabled: true } }),
        db.complianceRule.count({ where: { ...where, enabled: false } }),
        db.complianceRule.groupBy({
          by: ['severity'],
          where,
          _count: true,
        }),
        db.complianceRule.groupBy({
          by: ['category'],
          where,
          _count: true,
        }),
        db.complianceRule.groupBy({
          by: ['ruleType'],
          where,
          _count: true,
        }),
      ]);

    return {
      total,
      enabled,
      disabled,
      bySeverity: Object.fromEntries(
        bySeverity.map((s) => [s.severity, s._count])
      ),
      byCategory: Object.fromEntries(
        byCategory.map((c) => [c.category, c._count])
      ),
      byType: Object.fromEntries(byType.map((t) => [t.ruleType, t._count])),
    };
  }
}

/**
 * Rule categories
 */
export const ruleCategories = {
  SECURITY: 'SECURITY',
  CODE_QUALITY: 'CODE_QUALITY',
  PERFORMANCE: 'PERFORMANCE',
  ACCESSIBILITY: 'ACCESSIBILITY',
  DOCUMENTATION: 'DOCUMENTATION',
  TESTING: 'TESTING',
  DEPENDENCIES: 'DEPENDENCIES',
  LICENSE: 'LICENSE',
  DATA_PRIVACY: 'DATA_PRIVACY',
  CUSTOM: 'CUSTOM',
} as const;

/**
 * Rule severities
 */
export const ruleSeverities = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

/**
 * Rule types
 */
export const ruleTypes = {
  CODE_QUALITY: 'CODE_QUALITY',
  SECURITY: 'SECURITY',
  PERFORMANCE: 'PERFORMANCE',
  STYLE: 'STYLE',
  DOCUMENTATION: 'DOCUMENTATION',
  TESTING: 'TESTING',
  DEPENDENCY: 'DEPENDENCY',
  CUSTOM: 'CUSTOM',
} as const;
