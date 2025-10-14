import prisma from '../app/lib/db';
import { logger } from '../app/lib/logger';

/**
 * Dynamic Project Configuration Resolver
 * 
 * This service fetches project-specific configuration from the database
 * instead of relying on static environment variables, enabling multi-tenant
 * support where each project can have its own credentials and settings.
 */

export interface ProjectConfigData {
  // Vercel Configuration
  vercelToken?: string | null;
  vercelProjectId?: string | null;
  vercelTeamId?: string | null;
  
  // OpenAI Configuration  
  openaiApiKey?: string | null;
  
  // GitHub Configuration
  githubAppId?: string | null;
  githubPrivateKey?: string | null;
  githubInstallationId?: string | null;
  githubWebhookSecret?: string | null;
  githubToken?: string | null;
  
  // Encryption settings
  encryptionSalt?: string | null;
  isEncrypted?: boolean;
}

export interface ResolvedConfig {
  // Core configuration
  vercel: {
    token: string | null;
    projectId: string | null;
    teamId: string | null;
  };
  
  openai: {
    apiKey: string | null;
  };
  
  github: {
    appId: string | null;
    privateKey: string | null;
    installationId: string | null;
    webhookSecret: string | null;
    token: string | null;
  };
  
  // Auto-fix settings
  autoFix: {
    prTitle: string;
    prBody: string;
    buildErrors: boolean;
    testFailures: boolean;
    lintErrors: boolean;
    security: boolean;
    dependencies: boolean;
    syntax: boolean;
    notifyOnSuccess: boolean;
    notifyOnFailure: boolean;
  };
  
  // Metadata
  projectId: string;
  hasConfig: boolean;
  fallbackToEnv: boolean;
}

/**
 * Cache for project configurations to avoid repeated database queries
 */
class ConfigCache {
  private cache = new Map<string, { config: ResolvedConfig; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  get(projectId: string): ResolvedConfig | null {
    const entry = this.cache.get(projectId);
    if (!entry) return null;
    
    const isExpired = Date.now() - entry.timestamp > this.TTL;
    if (isExpired) {
      this.cache.delete(projectId);
      return null;
    }
    
    return entry.config;
  }

  set(projectId: string, config: ResolvedConfig): void {
    this.cache.set(projectId, {
      config,
      timestamp: Date.now()
    });
  }

  invalidate(projectId: string): void {
    this.cache.delete(projectId);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

const configCache = new ConfigCache();

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Omit<ResolvedConfig, 'projectId' | 'hasConfig' | 'fallbackToEnv'> = {
  vercel: {
    token: null,
    projectId: null,
    teamId: null,
  },
  openai: {
    apiKey: null,
  },
  github: {
    appId: null,
    privateKey: null,
    installationId: null,
    webhookSecret: null,
    token: null,
  },
  autoFix: {
    prTitle: 'AI Fix: Automated code improvements',
    prBody: 'This PR was automatically created by CodeMind to fix detected issues.\n\n## Changes Made\n{changes}\n\n## Issue Analysis\n{analysis}\n\n## Testing\n- [ ] Builds successfully\n- [ ] Tests pass\n- [ ] Manual review completed\n\nPlease review the changes carefully before merging.',
    buildErrors: true,
    testFailures: true,
    lintErrors: true,
    security: false,
    dependencies: true,
    syntax: true,
    notifyOnSuccess: true,
    notifyOnFailure: true,
  },
};

/**
 * Get configuration for a specific project
 */
export async function getProjectConfig(projectId: string): Promise<ResolvedConfig> {
  try {
    // Check cache first
    const cachedConfig = configCache.get(projectId);
    if (cachedConfig) {
      logger.debug('Project config cache hit', { projectId });
      return cachedConfig;
    }

    logger.debug('Fetching project config from database', { projectId });

    // Fetch from database
    const projectWithConfig = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        projectConfigs: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!projectWithConfig) {
      throw new Error(`Project ${projectId} not found`);
    }

    const config = projectWithConfig.projectConfigs[0];
    
    // Build resolved configuration
    const resolvedConfig: ResolvedConfig = {
      projectId,
      hasConfig: !!config,
      fallbackToEnv: !config,
      
      vercel: {
        token: config?.vercelToken || process.env.VERCEL_TOKEN || null,
        projectId: config?.vercelProjectId || process.env.VERCEL_PROJECT_ID || null,
        teamId: config?.vercelTeamId || process.env.VERCEL_TEAM_ID || null,
      },
      
      openai: {
        apiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY || null,
      },
      
      github: {
        appId: config?.githubAppId || process.env.GITHUB_APP_ID || null,
        privateKey: config?.githubPrivateKey || process.env.GITHUB_PRIVATE_KEY || null,
        installationId: config?.githubInstallationId || process.env.GITHUB_INSTALLATION_ID || null,
        webhookSecret: config?.githubWebhookSecret || process.env.GITHUB_WEBHOOK_SECRET || null,
        token: config?.githubToken || process.env.GITHUB_TOKEN || null,
      },
      
      autoFix: {
        prTitle: DEFAULT_CONFIG.autoFix.prTitle,
        prBody: DEFAULT_CONFIG.autoFix.prBody,
        buildErrors: DEFAULT_CONFIG.autoFix.buildErrors,
        testFailures: DEFAULT_CONFIG.autoFix.testFailures,
        lintErrors: DEFAULT_CONFIG.autoFix.lintErrors,
        security: DEFAULT_CONFIG.autoFix.security,
        dependencies: DEFAULT_CONFIG.autoFix.dependencies,
        syntax: DEFAULT_CONFIG.autoFix.syntax,
        notifyOnSuccess: DEFAULT_CONFIG.autoFix.notifyOnSuccess,
        notifyOnFailure: DEFAULT_CONFIG.autoFix.notifyOnFailure,
      },
    };

    // Cache the result
    configCache.set(projectId, resolvedConfig);

    logger.info('Project config resolved', {
      projectId,
      hasConfig: resolvedConfig.hasConfig,
      fallbackToEnv: resolvedConfig.fallbackToEnv,
      hasVercelToken: !!resolvedConfig.vercel.token,
      hasOpenAIKey: !!resolvedConfig.openai.apiKey,
      hasGitHubConfig: !!resolvedConfig.github.appId,
    });

    return resolvedConfig;

  } catch (error) {
    logger.error('Failed to get project config', { projectId }, error as Error);
    
    // Return fallback config with environment variables
    const fallbackConfig: ResolvedConfig = {
      ...DEFAULT_CONFIG,
      projectId,
      hasConfig: false,
      fallbackToEnv: true,
      vercel: {
        token: process.env.VERCEL_TOKEN || null,
        projectId: process.env.VERCEL_PROJECT_ID || null,
        teamId: process.env.VERCEL_TEAM_ID || null,
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY || null,
      },
      github: {
        appId: process.env.GITHUB_APP_ID || null,
        privateKey: process.env.GITHUB_PRIVATE_KEY || null,
        installationId: process.env.GITHUB_INSTALLATION_ID || null,
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || null,
        token: process.env.GITHUB_TOKEN || null,
      },
    };
    
    return fallbackConfig;
  }
}

/**
 * Get configuration for multiple projects at once
 */
export async function getMultiProjectConfig(projectIds: string[]): Promise<Record<string, ResolvedConfig>> {
  const configs: Record<string, ResolvedConfig> = {};
  
  // Process in parallel
  await Promise.allSettled(
    projectIds.map(async (projectId) => {
      try {
        configs[projectId] = await getProjectConfig(projectId);
      } catch (error) {
        logger.error('Failed to get config for project', { projectId }, error as Error);
        // Config will be undefined for this project
      }
    })
  );
  
  return configs;
}

/**
 * Invalidate cached configuration for a project
 */
export function invalidateProjectConfig(projectId: string): void {
  configCache.invalidate(projectId);
  logger.debug('Project config cache invalidated', { projectId });
}

/**
 * Clear all cached configurations
 */
export function clearConfigCache(): void {
  configCache.clear();
  logger.debug('Project config cache cleared');
}

/**
 * Get cache statistics
 */
export function getConfigCacheStats() {
  return configCache.getStats();
}

/**
 * Validate that required configuration exists for a project
 */
export async function validateProjectConfig(projectId: string, requiredKeys: Array<keyof ResolvedConfig>): Promise<{
  valid: boolean;
  missing: string[];
  config: ResolvedConfig;
}> {
  const config = await getProjectConfig(projectId);
  const missing: string[] = [];

  for (const key of requiredKeys) {
    const value = config[key];
    
    // Handle nested objects
    if (typeof value === 'object' && value !== null) {
      const hasAnyValue = Object.values(value).some(v => v !== null && v !== undefined);
      if (!hasAnyValue) {
        missing.push(key);
      }
    } else if (!value) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    config
  };
}

/**
 * Helper functions for common configuration needs
 */
export const ConfigHelpers = {
  // Get Vercel configuration
  async getVercelConfig(projectId: string) {
    const config = await getProjectConfig(projectId);
    return config.vercel;
  },

  // Get OpenAI configuration
  async getOpenAIConfig(projectId: string) {
    const config = await getProjectConfig(projectId);
    return config.openai;
  },

  // Get GitHub configuration
  async getGitHubConfig(projectId: string) {
    const config = await getProjectConfig(projectId);
    return config.github;
  },

  // Get Auto-fix configuration
  async getAutoFixConfig(projectId: string) {
    const config = await getProjectConfig(projectId);
    return config.autoFix;
  },

  // Check if project has complete GitHub setup
  async hasCompleteGitHubConfig(projectId: string) {
    const github = await this.getGitHubConfig(projectId);
    // Check for either GitHub App credentials OR token-based auth
    const hasAppAuth = !!(github.appId && github.privateKey && github.installationId);
    const hasTokenAuth = !!github.token;
    return hasAppAuth || hasTokenAuth;
  },

  // Check if project has Vercel setup
  async hasVercelConfig(projectId: string) {
    const vercel = await this.getVercelConfig(projectId);
    return !!(vercel.token && vercel.projectId);
  },

  // Check if project has OpenAI setup
  async hasOpenAIConfig(projectId: string) {
    const openai = await this.getOpenAIConfig(projectId);
    return !!openai.apiKey;
  }
};

const ProjectConfigResolver = {
  getProjectConfig,
  getMultiProjectConfig,
  invalidateProjectConfig,
  clearConfigCache,
  getConfigCacheStats,
  validateProjectConfig,
  ConfigHelpers
};

export default ProjectConfigResolver;