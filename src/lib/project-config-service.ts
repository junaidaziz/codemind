import prisma from '@/lib/db';
import { logger } from '@/lib/logger';

// Extended Prisma client type with projectConfig
type PrismaWithProjectConfig = typeof prisma & {
  projectConfig: {
    findUnique: {
      (args: { where: { projectId: string } }): Promise<ProjectConfig | null>;
      (args: { where: { projectId: string }; select: { id: boolean } }): Promise<{ id: string } | null>;
    };
    upsert: (args: { 
      where: { projectId: string }; 
      update: Record<string, unknown>; 
      create: Record<string, unknown>;
    }) => Promise<ProjectConfig>;
  };
};

// ProjectConfig type based on Prisma schema
interface ProjectConfig {
  id: string;
  projectId: string;
  vercelToken?: string | null;
  vercelProjectId?: string | null;
  vercelTeamId?: string | null;
  openaiApiKey?: string | null;
  githubAppId?: string | null;
  githubPrivateKey?: string | null;
  githubInstallationId?: string | null;
  githubWebhookSecret?: string | null;
  githubToken?: string | null;
  encryptionSalt?: string | null;
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Configuration field mappings to environment variable names
export const CONFIG_FIELD_MAPPINGS = {
  vercelToken: 'VERCEL_TOKEN',
  vercelProjectId: 'VERCEL_PROJECT_ID', 
  vercelTeamId: 'VERCEL_TEAM_ID',
  openaiApiKey: 'OPENAI_API_KEY',
  githubAppId: 'GITHUB_APP_ID',
  githubPrivateKey: 'GITHUB_PRIVATE_KEY',
  githubInstallationId: 'GITHUB_INSTALLATION_ID',
  githubWebhookSecret: 'GITHUB_WEBHOOK_SECRET',
  githubToken: 'GITHUB_TOKEN'
} as const;

// Type for configuration field names
export type ConfigFieldName = keyof typeof CONFIG_FIELD_MAPPINGS;

// Fields that should be encrypted
export const ENCRYPTED_FIELDS = new Set<ConfigFieldName>([
  'vercelToken',
  'openaiApiKey', 
  'githubPrivateKey',
  'githubWebhookSecret',
  'githubToken'
]);

// Type for cached configuration
type CachedConfig = ProjectConfig & {
  hasConfig: boolean;
  fallbackToEnv: boolean;
};

/**
 * Enhanced Project Configuration Service
 * Works with the actual Prisma schema structure using named fields
 */
export class ProjectConfigService {
  private static configCache = new Map<string, CachedConfig>();
  private static cacheExpiry = new Map<string, number>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get a specific configuration field for a project
   */
  static async getConfigField(
    projectId: string,
    fieldName: ConfigFieldName,
    fallbackToEnv: boolean = true
  ): Promise<string | null> {
    try {
      // Check cache first
      const cached = this.getCachedConfig(projectId);
      if (cached && cached[fieldName] !== undefined) {
        return cached[fieldName];
      }

      // Fetch from database
      const config: ProjectConfig | null = await (prisma as PrismaWithProjectConfig).projectConfig.findUnique({
        where: { projectId }
      });

      if (config) {
        // Cache the entire config
        this.setCachedConfig(projectId, { ...config, hasConfig: true, fallbackToEnv });

        const fieldValue = config[fieldName];
        if (fieldValue) {
          // Decrypt if this field should be encrypted
          const value = (config.isEncrypted && ENCRYPTED_FIELDS.has(fieldName)) ? 
            await this.decryptValue(fieldValue) : 
            fieldValue;
          
          return value;
        }
      }

      // Fallback to environment variable if configured
      if (fallbackToEnv) {
        const envVarName = CONFIG_FIELD_MAPPINGS[fieldName];
        const envValue = process.env[envVarName];
        if (envValue) {
          logger.info('Using environment fallback for config field', {
            projectId,
            fieldName,
            envVar: envVarName
          });
          return envValue;
        }
      }

      return null;

    } catch (error) {
      logger.error('Error retrieving project config field', {
        projectId,
        fieldName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fallback to environment variable on error
      if (fallbackToEnv) {
        const envVarName = CONFIG_FIELD_MAPPINGS[fieldName];
        return process.env[envVarName] || null;
      }

      return null;
    }
  }

  /**
   * Get multiple configuration fields for a project
   */
  static async getConfigFields(
    projectId: string,
    fieldNames: ConfigFieldName[],
    fallbackToEnv: boolean = true
  ): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};

    try {
      // Try to get all at once for efficiency
      const config: ProjectConfig | null = await (prisma as PrismaWithProjectConfig).projectConfig.findUnique({
        where: { projectId }
      });

      if (config) {
        // Cache the config
        this.setCachedConfig(projectId, { ...config, hasConfig: true, fallbackToEnv });

        for (const fieldName of fieldNames) {
          const fieldValue = config[fieldName];
          if (fieldValue) {
            // Decrypt if needed
            results[fieldName] = (config.isEncrypted && ENCRYPTED_FIELDS.has(fieldName)) ?
              await this.decryptValue(fieldValue) :
              fieldValue;
          } else if (fallbackToEnv) {
            // Fallback to environment
            const envVarName = CONFIG_FIELD_MAPPINGS[fieldName];
            results[fieldName] = process.env[envVarName] || null;
          } else {
            results[fieldName] = null;
          }
        }
      } else {
        // No config found, use environment fallbacks if enabled
        for (const fieldName of fieldNames) {
          if (fallbackToEnv) {
            const envVarName = CONFIG_FIELD_MAPPINGS[fieldName];
            results[fieldName] = process.env[envVarName] || null;
          } else {
            results[fieldName] = null;
          }
        }
      }

    } catch (error) {
      logger.error('Error retrieving project config fields', {
        projectId,
        fieldNames,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fallback to environment variables on error
      if (fallbackToEnv) {
        for (const fieldName of fieldNames) {
          const envVarName = CONFIG_FIELD_MAPPINGS[fieldName];
          results[fieldName] = process.env[envVarName] || null;
        }
      }
    }

    return results;
  }

  /**
   * Set a configuration field for a project
   */
  static async setConfigField(
    projectId: string,
    fieldName: ConfigFieldName,
    value: string | null
  ): Promise<void> {
    try {
      const shouldEncrypt = ENCRYPTED_FIELDS.has(fieldName);
      const processedValue = (value && shouldEncrypt) ? 
        await this.encryptValue(value) : 
        value;

      const updateData: Partial<ProjectConfig> = {
        [fieldName]: processedValue,
        isEncrypted: shouldEncrypt,
        updatedAt: new Date()
      };

      await (prisma as PrismaWithProjectConfig).projectConfig.upsert({
        where: { projectId },
        update: updateData,
        create: {
          projectId,
          ...updateData
        }
      });

      // Clear cache for this project
      this.clearCache(projectId);

      logger.info('Project config field updated', {
        projectId,
        fieldName,
        hasValue: !!value,
        encrypted: shouldEncrypt
      });

    } catch (error) {
      logger.error('Error setting project config field', {
        projectId,
        fieldName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update multiple configuration fields for a project
   */
  static async setConfigFields(
    projectId: string,
    fields: Partial<Record<ConfigFieldName, string | null>>
  ): Promise<void> {
    try {
      const updateData: Record<string, string | Date | boolean | null> = { updatedAt: new Date() };
      let hasEncrypted = false;

      // Process each field
      for (const [fieldName, value] of Object.entries(fields)) {
        const configField = fieldName as ConfigFieldName;
        const shouldEncrypt = ENCRYPTED_FIELDS.has(configField);
        
        const processedValue = (value && shouldEncrypt) ? 
          await this.encryptValue(value) : 
          value;
          
        updateData[fieldName] = processedValue;
          
        if (shouldEncrypt && value) {
          hasEncrypted = true;
        }
      }

      // Set encryption flag if any encrypted fields were set
      if (hasEncrypted) {
        updateData.isEncrypted = true;
      }

      await (prisma as PrismaWithProjectConfig).projectConfig.upsert({
        where: { projectId },
        update: updateData,
        create: {
          projectId,
          ...updateData
        }
      });

      // Clear cache for this project
      this.clearCache(projectId);

      logger.info('Project config fields updated', {
        projectId,
        fields: Object.keys(fields),
        encrypted: hasEncrypted
      });

    } catch (error) {
      logger.error('Error setting project config fields', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get the entire configuration for a project
   */
  static async getFullConfig(projectId: string, fallbackToEnv: boolean = true): Promise<CachedConfig | null> {
    try {
      const config: ProjectConfig | null = await (prisma as PrismaWithProjectConfig).projectConfig.findUnique({
        where: { projectId }
      });

      if (!config) {
        if (fallbackToEnv) {
          // Return environment fallbacks
          const envConfig = {
            hasConfig: false,
            fallbackToEnv: true,
            id: '',
            projectId,
            isEncrypted: false,
            vercelToken: process.env.VERCEL_TOKEN || null,
            vercelProjectId: process.env.VERCEL_PROJECT_ID || null,
            vercelTeamId: process.env.VERCEL_TEAM_ID || null,
            openaiApiKey: process.env.OPENAI_API_KEY || null,
            githubAppId: process.env.GITHUB_APP_ID || null,
            githubPrivateKey: process.env.GITHUB_PRIVATE_KEY || null,
            githubInstallationId: process.env.GITHUB_INSTALLATION_ID || null,
            githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || null,
            githubToken: process.env.GITHUB_TOKEN || null,
            encryptionSalt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          return envConfig as CachedConfig;
        }
        return null;
      }

      // Decrypt encrypted fields if needed
      const decryptedConfig: CachedConfig = { 
        ...config, 
        hasConfig: true, 
        fallbackToEnv 
      };
      
      if (config.isEncrypted) {
        for (const fieldName of ENCRYPTED_FIELDS) {
          if (config[fieldName]) {
            decryptedConfig[fieldName] = await this.decryptValue(config[fieldName]);
          }
        }
      }

      // Add environment fallbacks for missing fields
      if (fallbackToEnv) {
        if (!decryptedConfig.vercelToken) decryptedConfig.vercelToken = process.env.VERCEL_TOKEN || null;
        if (!decryptedConfig.vercelProjectId) decryptedConfig.vercelProjectId = process.env.VERCEL_PROJECT_ID || null;
        if (!decryptedConfig.vercelTeamId) decryptedConfig.vercelTeamId = process.env.VERCEL_TEAM_ID || null;
        if (!decryptedConfig.openaiApiKey) decryptedConfig.openaiApiKey = process.env.OPENAI_API_KEY || null;
        if (!decryptedConfig.githubAppId) decryptedConfig.githubAppId = process.env.GITHUB_APP_ID || null;
        if (!decryptedConfig.githubPrivateKey) decryptedConfig.githubPrivateKey = process.env.GITHUB_PRIVATE_KEY || null;
        if (!decryptedConfig.githubInstallationId) decryptedConfig.githubInstallationId = process.env.GITHUB_INSTALLATION_ID || null;
        if (!decryptedConfig.githubWebhookSecret) decryptedConfig.githubWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET || null;
        if (!decryptedConfig.githubToken) decryptedConfig.githubToken = process.env.GITHUB_TOKEN || null;
      }

      return decryptedConfig;

    } catch (error) {
      logger.error('Error getting full project config', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (fallbackToEnv) {
        const envConfig = {
          hasConfig: false,
          fallbackToEnv: true,
          id: '',
          projectId,
          isEncrypted: false,
          vercelToken: process.env.VERCEL_TOKEN || null,
          vercelProjectId: process.env.VERCEL_PROJECT_ID || null,
          vercelTeamId: process.env.VERCEL_TEAM_ID || null,
          openaiApiKey: process.env.OPENAI_API_KEY || null,
          githubAppId: process.env.GITHUB_APP_ID || null,
          githubPrivateKey: process.env.GITHUB_PRIVATE_KEY || null,
          githubInstallationId: process.env.GITHUB_INSTALLATION_ID || null,
          githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || null,
          githubToken: process.env.GITHUB_TOKEN || null,
          encryptionSalt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        return envConfig as CachedConfig;
      }

      return null;
    }
  }

  /**
   * Clear configuration cache for a project
   */
  static clearCache(projectId?: string): void {
    if (projectId) {
      this.configCache.delete(projectId);
      this.cacheExpiry.delete(projectId);
    } else {
      this.configCache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Check if a project has configuration
   */
  static async hasConfig(projectId: string): Promise<boolean> {
    try {
      const config = await (prisma as PrismaWithProjectConfig).projectConfig.findUnique({
        where: { projectId },
        select: { id: true }
      });
      return !!config;
    } catch (error) {
      logger.error('Error checking if project has config', {
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  // Private helper methods
  private static getCachedConfig(projectId: string): CachedConfig | null {
    const config = this.configCache.get(projectId);
    const expiry = this.cacheExpiry.get(projectId);

    if (!config || !expiry || Date.now() > expiry) {
      return null;
    }

    return config;
  }

  private static setCachedConfig(projectId: string, config: CachedConfig): void {
    this.configCache.set(projectId, config);
    this.cacheExpiry.set(projectId, Date.now() + this.CACHE_TTL);
  }

  private static async encryptValue(value: string): Promise<string> {
    try {
      const { ConfigEncryption } = await import('./config-encryption');
      return ConfigEncryption.safeEncrypt(value);
    } catch (error) {
      logger.error('Error encrypting value, using fallback', { error });
      // Fallback to base64 if encryption service fails
      return Buffer.from(value).toString('base64');
    }
  }

  private static async decryptValue(encryptedValue: string): Promise<string> {
    try {
      const { ConfigEncryption } = await import('./config-encryption');
      return ConfigEncryption.safeDecrypt(encryptedValue);
    } catch (error) {
      logger.error('Error decrypting value, using fallback', { error });
      // Fallback to base64 decode if encryption service fails
      try {
        return Buffer.from(encryptedValue, 'base64').toString('utf-8');
      } catch {
        // If all else fails, return the original value
        return encryptedValue;
      }
    }
  }
}

export default ProjectConfigService;