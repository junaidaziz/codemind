import db from './db';
import { nanoid } from 'nanoid';

export interface CreateAuditLogInput {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  organizationId?: string;
  projectId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  organizationId?: string;
  projectId?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class AuditLogService {
  /**
   * Create an audit log entry
   */
  static async log(input: CreateAuditLogInput) {
    return await db.auditLog.create({
      data: {
        id: nanoid(),
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        description: input.description,
        organizationId: input.organizationId,
        projectId: input.projectId,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });
  }

  /**
   * Get audit logs with filters
   */
  static async getAuditLogs(filters: AuditLogFilters) {
    const where: any = {};

    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.entityType) {
      where.entityType = filters.entityType;
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

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      db.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      hasMore: total > (filters.offset || 0) + logs.length,
    };
  }

  /**
   * Get audit log statistics for an organization
   */
  static async getOrganizationStats(organizationId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await db.auditLog.findMany({
      where: {
        organizationId,
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        action: true,
        entityType: true,
        userId: true,
        createdAt: true,
      },
    });

    // Group by action
    const actionCounts: Record<string, number> = {};
    const entityTypeCounts: Record<string, number> = {};
    const userActivityCounts: Record<string, number> = {};
    const dailyActivity: Record<string, number> = {};

    logs.forEach((log) => {
      // Count by action
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;

      // Count by entity type
      entityTypeCounts[log.entityType] =
        (entityTypeCounts[log.entityType] || 0) + 1;

      // Count by user
      userActivityCounts[log.userId] =
        (userActivityCounts[log.userId] || 0) + 1;

      // Count by day
      const day = log.createdAt.toISOString().split('T')[0];
      dailyActivity[day] = (dailyActivity[day] || 0) + 1;
    });

    return {
      totalLogs: logs.length,
      actionCounts,
      entityTypeCounts,
      userActivityCounts,
      dailyActivity,
      period: { startDate, endDate: new Date() },
    };
  }

  /**
   * Get audit log statistics for a project
   */
  static async getProjectStats(projectId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await db.auditLog.findMany({
      where: {
        projectId,
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        action: true,
        entityType: true,
        userId: true,
        createdAt: true,
      },
    });

    // Group by action
    const actionCounts: Record<string, number> = {};
    const entityTypeCounts: Record<string, number> = {};
    const userActivityCounts: Record<string, number> = {};

    logs.forEach((log) => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      entityTypeCounts[log.entityType] =
        (entityTypeCounts[log.entityType] || 0) + 1;
      userActivityCounts[log.userId] =
        (userActivityCounts[log.userId] || 0) + 1;
    });

    return {
      totalLogs: logs.length,
      actionCounts,
      entityTypeCounts,
      userActivityCounts,
      period: { startDate, endDate: new Date() },
    };
  }

  /**
   * Get recent activity for a user
   */
  static async getUserActivity(
    userId: string,
    limit: number = 20,
    organizationId?: string
  ) {
    const where: any = {
      userId,
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    return await db.auditLog.findMany({
      where,
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Delete old audit logs (for compliance/storage management)
   */
  static async deleteOldLogs(daysToKeep: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return {
      deleted: result.count,
      cutoffDate,
    };
  }

  /**
   * Search audit logs
   */
  static async searchLogs(
    query: string,
    filters: Omit<AuditLogFilters, 'limit' | 'offset'>,
    limit: number = 50,
    offset: number = 0
  ) {
    const where: any = {
      ...filters,
      OR: [
        { description: { contains: query, mode: 'insensitive' } },
        { action: { contains: query, mode: 'insensitive' } },
        { entityType: { contains: query, mode: 'insensitive' } },
      ],
    };

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      hasMore: total > offset + logs.length,
    };
  }
}

// Helper functions for common audit log actions

export const auditActions = {
  // Organization actions
  ORGANIZATION_CREATED: 'organization.created',
  ORGANIZATION_UPDATED: 'organization.updated',
  ORGANIZATION_DELETED: 'organization.deleted',
  MEMBER_INVITED: 'member.invited',
  MEMBER_JOINED: 'member.joined',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_ROLE_UPDATED: 'member.role_updated',
  OWNERSHIP_TRANSFERRED: 'ownership.transferred',

  // Project actions
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  PROJECT_MEMBER_ADDED: 'project_member.added',
  PROJECT_MEMBER_REMOVED: 'project_member.removed',
  PROJECT_INVITED: 'project.invited',

  // API Key actions
  API_KEY_CREATED: 'api_key.created',
  API_KEY_REVOKED: 'api_key.revoked',
  API_KEY_USED: 'api_key.used',

  // AI actions
  AI_FIX_STARTED: 'ai_fix.started',
  AI_FIX_COMPLETED: 'ai_fix.completed',
  AI_FIX_FAILED: 'ai_fix.failed',
  AI_PR_CREATED: 'ai_pr.created',
  AI_TEST_GENERATED: 'ai_test.generated',
  AI_CHAT_SESSION: 'ai_chat.session',

  // Security actions
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGED: 'auth.password_changed',
  TWO_FACTOR_ENABLED: 'auth.2fa_enabled',
  TWO_FACTOR_DISABLED: 'auth.2fa_disabled',

  // Settings actions
  SETTINGS_UPDATED: 'settings.updated',
  WEBHOOK_CONFIGURED: 'webhook.configured',
  INTEGRATION_ADDED: 'integration.added',
  INTEGRATION_REMOVED: 'integration.removed',
} as const;

export const entityTypes = {
  ORGANIZATION: 'organization',
  PROJECT: 'project',
  USER: 'user',
  MEMBER: 'member',
  API_KEY: 'api_key',
  AI_FIX: 'ai_fix',
  PR: 'pull_request',
  CHAT: 'chat',
  SETTINGS: 'settings',
  WEBHOOK: 'webhook',
  INTEGRATION: 'integration',
} as const;
