/**
 * Role-Based Access Control (RBAC) for Project Configuration
 * Provides granular access control for sensitive project settings
 */

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export type ProjectPermission = 
  | 'config.read'
  | 'config.write'
  | 'config.delete'
  | 'config.view_secrets'
  | 'config.test_connections'
  | 'analytics.read'
  | 'analytics.export'
  | 'project.admin';

// Role permission mapping
const ROLE_PERMISSIONS: Record<UserRole, ProjectPermission[]> = {
  owner: [
    'config.read',
    'config.write', 
    'config.delete',
    'config.view_secrets',
    'config.test_connections',
    'analytics.read',
    'analytics.export',
    'project.admin'
  ],
  admin: [
    'config.read',
    'config.write',
    'config.view_secrets',
    'config.test_connections',
    'analytics.read',
    'analytics.export'
  ],
  member: [
    'config.read',
    'analytics.read'
  ],
  viewer: [
    'analytics.read'
  ]
};

/**
 * Check if user has specific permission for a project
 */
export function hasPermission(userRole: UserRole, permission: ProjectPermission): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}

/**
 * Get user's role for a project
 */
export async function getUserProjectRole(userId: string, projectId: string): Promise<UserRole> {
  // For now, we'll implement a simple check
  // In production, this would query the database for actual user roles
  
  // TODO: Implement actual role checking from database
  // This is a placeholder that assumes project owner = admin role
  
  try {
    const prisma = (await import('../app/lib/db')).default;
    
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: userId
      }
    });

    if (project) {
      return 'owner';
    }

    // Check if user is a member of the project's organization
    const orgMember = await prisma.organizationMember.findFirst({
      where: {
        userId: userId,
        organization: {
          projects: {
            some: {
              id: projectId
            }
          }
        }
      }
    });

    if (orgMember) {
      return orgMember.role as UserRole;
    }

    return 'viewer'; // Default role
  } catch (error) {
    console.error('Error checking user role:', error);
    return 'viewer';
  }
}

/**
 * Middleware to check project permissions
 */
export function requirePermission(permission: ProjectPermission) {
  return async function(userId: string, projectId: string): Promise<boolean> {
    const role = await getUserProjectRole(userId, projectId);
    return hasPermission(role, permission);
  };
}

/**
 * Field masking utilities for sensitive data
 */
export class FieldMasker {
  /**
   * Mask sensitive string (show first 4 and last 4 characters)
   */
  static maskSensitive(value: string | null | undefined): string | null {
    if (!value || typeof value !== 'string') {
      return null;
    }

    if (value.length <= 8) {
      return '••••';
    }

    const first = value.slice(0, 4);
    const last = value.slice(-4);
    const middle = '•'.repeat(Math.min(value.length - 8, 20));
    
    return `${first}${middle}${last}`;
  }

  /**
   * Mask API key (show prefix and last few characters)
   */
  static maskApiKey(value: string | null | undefined): string | null {
    if (!value || typeof value !== 'string') {
      return null;
    }

    // For keys like "sk-..." or "gho_..."
    const parts = value.split(/[-_]/);
    if (parts.length > 1) {
      const prefix = parts[0];
      const suffix = value.slice(-6);
      return `${prefix}-••••••${suffix}`;
    }

    return this.maskSensitive(value);
  }

  /**
   * Mask GitHub private key (show key type and last few characters)
   */
  static maskPrivateKey(value: string | null | undefined): string | null {
    if (!value || typeof value !== 'string') {
      return null;
    }

    // For PEM keys
    if (value.includes('BEGIN') && value.includes('END')) {
      const lines = value.split('\n');
      const beginLine = lines.find(line => line.includes('BEGIN'));
      const endLine = lines.find(line => line.includes('END'));
      
      if (beginLine && endLine) {
        return `${beginLine}\n••••••••••••••••••••\n${endLine}`;
      }
    }

    return this.maskSensitive(value);
  }

  /**
   * Apply appropriate masking based on field name
   */
  static maskField(fieldName: string, value: string | null | undefined): string | null {
    if (!value) return null;

    switch (fieldName.toLowerCase()) {
      case 'githubprivatekey':
      case 'private_key':
        return this.maskPrivateKey(value);
      
      case 'openaiApikey':
      case 'githubtoken':
      case 'verceltoken':
      case 'api_key':
      case 'token':
        return this.maskApiKey(value);
      
      case 'githubwebhooksecret':
      case 'webhook_secret':
      case 'secret':
        return this.maskSensitive(value);
      
      default:
        // Don't mask non-sensitive fields
        if (this.isSensitiveField(fieldName)) {
          return this.maskSensitive(value);
        }
        return value;
    }
  }

  /**
   * Check if field name indicates sensitive data
   */
  static isSensitiveField(fieldName: string): boolean {
    const sensitiveKeywords = [
      'key', 'token', 'secret', 'password', 'credential', 
      'private', 'auth', 'api', 'webhook'
    ];
    
    const fieldLower = fieldName.toLowerCase();
    return sensitiveKeywords.some(keyword => fieldLower.includes(keyword));
  }

  /**
   * Mask all sensitive fields in an object
   */
  static maskSensitiveFields<T extends Record<string, unknown>>(
    obj: T, 
    _userRole?: UserRole
  ): T {
    const masked = { ...obj } as T;
    
    for (const [key, value] of Object.entries(obj)) {
      if (FieldMasker.isSensitiveField(key)) {
        (masked as Record<string, unknown>)[key] = FieldMasker.maskField(key, value as string);
      }
    }
    
    return masked;
  }
}

/**
 * Configuration access levels
 */
export interface ConfigAccessLevel {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canViewSecrets: boolean;
  canTestConnections: boolean;
}

/**
 * Get access level for user and project
 */
export async function getConfigAccessLevel(
  userId: string, 
  projectId: string
): Promise<ConfigAccessLevel> {
  const role = await getUserProjectRole(userId, projectId);
  
  return {
    canRead: hasPermission(role, 'config.read'),
    canWrite: hasPermission(role, 'config.write'),
    canDelete: hasPermission(role, 'config.delete'),
    canViewSecrets: hasPermission(role, 'config.view_secrets'),
    canTestConnections: hasPermission(role, 'config.test_connections')
  };
}

/**
 * Audit logging for configuration changes
 */
export interface ConfigAuditLog {
  userId: string;
  projectId: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'test';
  fieldNames?: string[];
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

export async function logConfigAccess(audit: ConfigAuditLog): Promise<void> {
  try {
    // TODO: Implement audit logging to database
    console.log('Config access:', {
      user: audit.userId,
      project: audit.projectId,
      action: audit.action,
      fields: audit.fieldNames,
      timestamp: audit.timestamp.toISOString()
    });
    
    // In production, save to audit table:
    // await prisma.configAuditLog.create({ data: audit });
  } catch (error) {
    console.error('Failed to log config access:', error);
  }
}