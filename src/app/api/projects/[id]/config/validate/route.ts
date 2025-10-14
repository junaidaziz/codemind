import { NextRequest, NextResponse } from 'next/server';
import { getProjectConfig, ConfigHelpers } from '@/lib/project-config-resolver';
import { logger } from '@/lib/logger';

interface ValidateParams {
  params: Promise<{
    id: string;
  }>;
}

// POST /api/projects/[id]/config/validate - Validate project configuration
export async function POST(request: NextRequest, { params }: ValidateParams) {
  try {
    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get complete project configuration using the resolver
    const config = await getProjectConfig(projectId);

    // Check all configuration aspects
    const [hasGitHub, hasVercel, hasOpenAI] = await Promise.all([
      ConfigHelpers.hasCompleteGitHubConfig(projectId),
      ConfigHelpers.hasVercelConfig(projectId),
      ConfigHelpers.hasOpenAIConfig(projectId)
    ]);

    const validation = {
      projectId,
      overall: hasGitHub && hasOpenAI, // Minimum requirements
      hasConfig: config.hasConfig,
      fallbackToEnv: config.fallbackToEnv,
      
      github: {
        valid: hasGitHub,
        hasAppId: !!config.github.appId,
        hasPrivateKey: !!config.github.privateKey,
        hasInstallationId: !!config.github.installationId,
        hasWebhookSecret: !!config.github.webhookSecret,
        details: {
          appId: config.github.appId || 'Missing',
          installationId: config.github.installationId || 'Missing',
          privateKeyLength: config.github.privateKey ? config.github.privateKey.length : 0,
          hasWebhook: !!config.github.webhookSecret
        }
      },

      vercel: {
        valid: hasVercel,
        hasToken: !!config.vercel.token,
        hasProjectId: !!config.vercel.projectId,
        hasTeamId: !!config.vercel.teamId,
        details: {
          projectId: config.vercel.projectId || 'Not configured',
          teamId: config.vercel.teamId || 'Not configured',
          tokenLength: config.vercel.token ? config.vercel.token.length : 0
        }
      },

      openai: {
        valid: hasOpenAI,
        hasApiKey: !!config.openai.apiKey,
        details: {
          keyLength: config.openai.apiKey ? config.openai.apiKey.length : 0,
          keyPrefix: config.openai.apiKey ? config.openai.apiKey.substring(0, 7) : 'Missing'
        }
      },

      autoFix: {
        configured: true,
        settings: {
          buildErrors: config.autoFix.buildErrors,
          testFailures: config.autoFix.testFailures,
          lintErrors: config.autoFix.lintErrors,
          security: config.autoFix.security,
          dependencies: config.autoFix.dependencies,
          syntax: config.autoFix.syntax,
          notifications: {
            onSuccess: config.autoFix.notifyOnSuccess,
            onFailure: config.autoFix.notifyOnFailure
          }
        }
      },

      requirements: {
        minimum: ['GitHub App ID', 'GitHub Private Key', 'GitHub Installation ID', 'OpenAI API Key'],
        recommended: ['Vercel Token', 'Vercel Project ID', 'GitHub Webhook Secret'],
        optional: ['Vercel Team ID'],
        missing: [] as string[],
        warnings: [] as string[]
      }
    };

    // Determine missing requirements
    if (!hasGitHub) {
      if (!config.github.appId) validation.requirements.missing.push('GitHub App ID');
      if (!config.github.privateKey) validation.requirements.missing.push('GitHub Private Key');
      if (!config.github.installationId) validation.requirements.missing.push('GitHub Installation ID');
    }
    
    if (!hasOpenAI) {
      validation.requirements.missing.push('OpenAI API Key');
    }

    // Determine warnings for recommended items
    if (!hasVercel) {
      if (!config.vercel.token) validation.requirements.warnings.push('Vercel Token (recommended for deployments)');
      if (!config.vercel.projectId) validation.requirements.warnings.push('Vercel Project ID (recommended for deployments)');
    }

    if (!config.github.webhookSecret) {
      validation.requirements.warnings.push('GitHub Webhook Secret (recommended for real-time updates)');
    }

    // Calculate readiness percentage
    const totalRequired = validation.requirements.minimum.length;
    const satisfiedRequired = totalRequired - validation.requirements.missing.length;
    const readinessPercentage = Math.round((satisfiedRequired / totalRequired) * 100);

    const result = {
      success: true,
      validation,
      readiness: {
        percentage: readinessPercentage,
        isReady: validation.overall,
        canFunction: hasOpenAI || hasGitHub, // Partial functionality possible
        recommendations: validation.requirements.missing.length > 0 
          ? `Complete missing requirements: ${validation.requirements.missing.join(', ')}`
          : validation.requirements.warnings.length > 0
          ? `Consider adding: ${validation.requirements.warnings.join(', ')}`
          : 'Configuration is complete!'
      },
      timestamp: new Date().toISOString()
    };

    logger.info('Project configuration validated', {
      projectId,
      overall: validation.overall,
      readiness: readinessPercentage,
      missing: validation.requirements.missing,
      warnings: validation.requirements.warnings
    });

    return NextResponse.json(result);

  } catch (error) {
    logger.error('Error validating project configuration', {
      projectId: (await params).id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to validate project configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}