import db from './db';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

// Define ApiKeyScope type since it may not be in Prisma schema yet
export type ApiKeyScope = 'READ' | 'WRITE' | 'ADMIN' | 'DEPLOY' | 'ANALYTICS'

export const ApiKeyScope = {
  READ: 'READ' as const,
  WRITE: 'WRITE' as const,
  ADMIN: 'ADMIN' as const,
  DEPLOY: 'DEPLOY' as const,
  ANALYTICS: 'ANALYTICS' as const,
}

export interface CreateApiKeyInput {
  name: string;
  userId: string;
  organizationId?: string;
  projectId?: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export class ApiKeyService {
  /**
   * Generate a secure API key with prefix
   */
  private static generateApiKey(): { key: string; hash: string; prefix: string } {
    // Generate random key: cm_xxxxxxxxxxxxxxxxxxxxx (32 chars after prefix)
    const randomKey = nanoid(32);
    const prefix = 'cm_' + randomKey.substring(0, 8);
    const fullKey = prefix + randomKey.substring(8);
    
    // Hash the key for storage
    const hash = crypto.createHash('sha256').update(fullKey).digest('hex');
    
    return { key: fullKey, hash, prefix };
  }

  /**
   * Create a new API key
   */
  static async createApiKey(input: CreateApiKeyInput): Promise<{
    apiKey: ApiKeyInfo;
    key: string; // Raw key to show user (only shown once!)
  }> {
    const { key, hash, prefix } = this.generateApiKey();

    const apiKey = await db.apiKey.create({
      data: {
        id: nanoid(),
        name: input.name,
        key: hash,
        prefix,
        userId: input.userId,
        organizationId: input.organizationId,
        projectId: input.projectId,
        scopes: input.scopes,
        expiresAt: input.expiresAt,
      },
    });

    return {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
        revokedAt: apiKey.revokedAt,
      },
      key, // Return raw key only once
    };
  }

  /**
   * Verify and get API key details
   */
  static async verifyApiKey(key: string): Promise<ApiKeyInfo | null> {
    const hash = crypto.createHash('sha256').update(key).digest('hex');

    const apiKey = await db.apiKey.findUnique({
      where: { key: hash },
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

    if (!apiKey) {
      return null;
    }

    // Check if revoked
    if (apiKey.revokedAt) {
      return null;
    }

    // Check if expired
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp
    await db.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      revokedAt: apiKey.revokedAt,
    };
  }

  /**
   * Get all API keys for a user
   */
  static async getUserApiKeys(
    userId: string,
    organizationId?: string
  ): Promise<ApiKeyInfo[]> {
    const where: { userId: string; organizationId?: string } = { userId };
    
    if (organizationId) {
      where.organizationId = organizationId;
    }

    const apiKeys = await db.apiKey.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return apiKeys.map((key: any) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt,
    }));
  }

  /**
   * Get API keys for an organization
   */
  static async getOrganizationApiKeys(
    organizationId: string
  ): Promise<ApiKeyInfo[]> {
    const apiKeys = await db.apiKey.findMany({
      where: { organizationId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return apiKeys.map((key: any) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt,
    }));
  }

  /**
   * Get API keys for a project
   */
  static async getProjectApiKeys(projectId: string): Promise<ApiKeyInfo[]> {
    const apiKeys = await db.apiKey.findMany({
      where: { projectId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return apiKeys.map((key: any) => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      revokedAt: key.revokedAt,
    }));
  }

  /**
   * Revoke an API key
   */
  static async revokeApiKey(keyId: string, userId: string): Promise<void> {
    // Verify user owns the key
    const apiKey = await db.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey || apiKey.userId !== userId) {
      throw new Error('API key not found or unauthorized');
    }

    await db.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Delete an API key (permanent)
   */
  static async deleteApiKey(keyId: string, userId: string): Promise<void> {
    // Verify user owns the key
    const apiKey = await db.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey || apiKey.userId !== userId) {
      throw new Error('API key not found or unauthorized');
    }

    await db.apiKey.delete({
      where: { id: keyId },
    });
  }

  /**
   * Check if API key has required scope
   */
  static hasScope(apiKey: ApiKeyInfo, requiredScope: ApiKeyScope): boolean {
    // ADMIN scope has all permissions
    if (apiKey.scopes.includes(ApiKeyScope.ADMIN)) {
      return true;
    }

    return apiKey.scopes.includes(requiredScope);
  }

  /**
   * Check if API key has any of the required scopes
   */
  static hasAnyScope(
    apiKey: ApiKeyInfo,
    requiredScopes: ApiKeyScope[]
  ): boolean {
    // ADMIN scope has all permissions
    if (apiKey.scopes.includes(ApiKeyScope.ADMIN)) {
      return true;
    }

    return requiredScopes.some((scope) => apiKey.scopes.includes(scope));
  }

  /**
   * Get API key usage statistics
   */
  static async getApiKeyStats(keyId: string) {
    const apiKey = await db.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      throw new Error('API key not found');
    }

    // Calculate key age
    const ageInDays = Math.floor(
      (Date.now() - apiKey.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if expired
    const isExpired = apiKey.expiresAt ? apiKey.expiresAt < new Date() : false;

    // Check if revoked
    const isRevoked = !!apiKey.revokedAt;

    // Days until expiration
    const daysUntilExpiration = apiKey.expiresAt
      ? Math.ceil(
          (apiKey.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      : null;

    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      ageInDays,
      isExpired,
      isRevoked,
      daysUntilExpiration,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
    };
  }

  /**
   * Rotate API key (create new, revoke old)
   */
  static async rotateApiKey(
    oldKeyId: string,
    userId: string
  ): Promise<{ apiKey: ApiKeyInfo; key: string }> {
    // Get old key details
    const oldKey = await db.apiKey.findUnique({
      where: { id: oldKeyId },
    });

    if (!oldKey || oldKey.userId !== userId) {
      throw new Error('API key not found or unauthorized');
    }

    // Create new key with same properties
    const newKey = await this.createApiKey({
      name: oldKey.name + ' (Rotated)',
      userId: oldKey.userId,
      organizationId: oldKey.organizationId || undefined,
      projectId: oldKey.projectId || undefined,
      scopes: oldKey.scopes,
      expiresAt: oldKey.expiresAt || undefined,
    });

    // Revoke old key
    await db.apiKey.update({
      where: { id: oldKeyId },
      data: { revokedAt: new Date() },
    });

    return newKey;
  }
}
