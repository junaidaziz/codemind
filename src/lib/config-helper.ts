import { ConfigHelpers } from './project-config-resolver';
import { logger } from '../app/lib/logger';

/**
 * Configuration Helper Service
 * Provides convenient methods to replace direct environment variable access
 */
export class ConfigHelper {
  
  /**
   * Get GitHub token for a project (replaces process.env.GITHUB_TOKEN)
   */
  static async getGitHubToken(projectId: string): Promise<string | null> {
    try {
      const config = await ConfigHelpers.getGitHubConfig(projectId);
      
      // For GitHub App authentication, we might need to generate a token
      // For now, return the direct token if available
      return config.privateKey || process.env.GITHUB_TOKEN || null;
    } catch (error) {
      logger.error('Error getting GitHub token', { projectId, error });
      return process.env.GITHUB_TOKEN || null;
    }
  }

  /**
   * Get OpenAI API key for a project (replaces process.env.OPENAI_API_KEY)
   */
  static async getOpenAIKey(projectId: string): Promise<string | null> {
    try {
      const config = await ConfigHelpers.getOpenAIConfig(projectId);
      return config.apiKey || process.env.OPENAI_API_KEY || null;
    } catch (error) {
      logger.error('Error getting OpenAI key', { projectId, error });
      return process.env.OPENAI_API_KEY || null;
    }
  }

  /**
   * Get Vercel configuration for a project
   */
  static async getVercelConfig(projectId: string) {
    try {
      const config = await ConfigHelpers.getVercelConfig(projectId);
      return {
        token: config.token || process.env.VERCEL_TOKEN || null,
        projectId: config.projectId || process.env.VERCEL_PROJECT_ID || null,
        teamId: config.teamId || process.env.VERCEL_TEAM_ID || null
      };
    } catch (error) {
      logger.error('Error getting Vercel config', { projectId, error });
      return {
        token: process.env.VERCEL_TOKEN || null,
        projectId: process.env.VERCEL_PROJECT_ID || null,
        teamId: process.env.VERCEL_TEAM_ID || null
      };
    }
  }

  /**
   * Get GitHub App configuration for a project
   */
  static async getGitHubAppConfig(projectId: string) {
    try {
      const config = await ConfigHelpers.getGitHubConfig(projectId);
      return {
        appId: config.appId || process.env.GITHUB_APP_ID || null,
        privateKey: config.privateKey || process.env.GITHUB_PRIVATE_KEY || null,
        installationId: config.installationId || process.env.GITHUB_INSTALLATION_ID || null,
        webhookSecret: config.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET || null
      };
    } catch (error) {
      logger.error('Error getting GitHub App config', { projectId, error });
      return {
        appId: process.env.GITHUB_APP_ID || null,
        privateKey: process.env.GITHUB_PRIVATE_KEY || null,
        installationId: process.env.GITHUB_INSTALLATION_ID || null,
        webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || null
      };
    }
  }

  /**
   * Check if project has complete configuration
   */
  static async isProjectConfigured(projectId: string): Promise<boolean> {
    try {
      const [hasGitHub, hasOpenAI] = await Promise.all([
        ConfigHelpers.hasCompleteGitHubConfig(projectId),
        ConfigHelpers.hasOpenAIConfig(projectId)
      ]);

      return hasGitHub && hasOpenAI;
    } catch (error) {
      logger.error('Error checking project configuration', { projectId, error });
      return false;
    }
  }

  /**
   * Get configuration status for multiple projects
   */
  static async getMultiProjectStatus(projectIds: string[]) {
    const results: Record<string, {
      configured: boolean;
      hasGitHub: boolean;
      hasOpenAI: boolean;
      hasVercel: boolean;
    }> = {};

    await Promise.allSettled(
      projectIds.map(async (projectId) => {
        try {
          const [hasGitHub, hasOpenAI, hasVercel] = await Promise.all([
            ConfigHelpers.hasCompleteGitHubConfig(projectId),
            ConfigHelpers.hasOpenAIConfig(projectId),
            ConfigHelpers.hasVercelConfig(projectId)
          ]);

          results[projectId] = {
            configured: hasGitHub && hasOpenAI,
            hasGitHub,
            hasOpenAI,
            hasVercel
          };
        } catch (error) {
          logger.error('Error getting project status', { projectId, error });
          results[projectId] = {
            configured: false,
            hasGitHub: false,
            hasOpenAI: false,
            hasVercel: false
          };
        }
      })
    );

    return results;
  }
}

/**
 * Convenience functions to replace common environment variable patterns
 */

// Replace process.env.OPENAI_API_KEY
export async function getOpenAIKey(projectId: string): Promise<string | null> {
  return ConfigHelper.getOpenAIKey(projectId);
}

// Replace process.env.GITHUB_TOKEN  
export async function getGitHubToken(projectId: string): Promise<string | null> {
  return ConfigHelper.getGitHubToken(projectId);
}

// Replace process.env.VERCEL_TOKEN
export async function getVercelToken(projectId: string): Promise<string | null> {
  const config = await ConfigHelper.getVercelConfig(projectId);
  return config.token;
}

// Replace process.env.GITHUB_APP_ID, etc.
export async function getGitHubAppId(projectId: string): Promise<string | null> {
  const config = await ConfigHelper.getGitHubAppConfig(projectId);
  return config.appId;
}

export async function getGitHubPrivateKey(projectId: string): Promise<string | null> {
  const config = await ConfigHelper.getGitHubAppConfig(projectId);
  return config.privateKey;
}

export async function getGitHubInstallationId(projectId: string): Promise<string | null> {
  const config = await ConfigHelper.getGitHubAppConfig(projectId);
  return config.installationId;
}

export async function getGitHubWebhookSecret(projectId: string): Promise<string | null> {
  const config = await ConfigHelper.getGitHubAppConfig(projectId);
  return config.webhookSecret;
}

export default ConfigHelper;