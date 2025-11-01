/**
 * Notification Helpers
 * Utility functions for sending notifications from various parts of the application
 */

import { getNotificationFactory } from './notification-factory';
import type { NotificationPayload } from './notification-provider';

/**
 * Send notification to all configured providers
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const factory = getNotificationFactory();

  if (!factory.isAnyProviderConfigured()) {
    console.log('No notification providers configured, skipping notification');
    return;
  }

  const providers = factory.getAllProviders();
  
  await Promise.all(
    providers.map(async (provider) => {
      try {
        const result = await provider.send(payload);
        if (!result.success) {
          console.error(`Notification failed for ${provider.name}:`, result.error);
        }
      } catch (error) {
        console.error(`Notification error for ${provider.name}:`, error);
      }
    })
  );
}

/**
 * Send code review completion notification
 */
export async function notifyCodeReviewCompleted(params: {
  pullRequestUrl: string;
  suggestionsCount: number;
  highRiskCount: number;
  repository: string;
  branch: string;
}): Promise<void> {
  const { pullRequestUrl, suggestionsCount, highRiskCount, repository, branch } = params;
  
  const severity = highRiskCount > 0 ? 'warning' : 'info';
  const type = highRiskCount > 0 ? 'review_high_risk' : 'review_completed';

  await sendNotification({
    type,
    severity,
    title: 'Code Review Completed',
    message: `Analyzed pull request in ${repository}`,
    url: pullRequestUrl,
    metadata: {
      repository,
      branch,
      suggestions: suggestionsCount,
      highRisk: highRiskCount,
    },
  });
}

/**
 * Send deployment status notification
 */
export async function notifyDeploymentStatus(params: {
  projectId: string;
  status: 'success' | 'failed';
  environment: string;
  deploymentUrl?: string;
  commitSha?: string;
  branch?: string;
}): Promise<void> {
  const { projectId, status, environment, deploymentUrl, commitSha, branch } = params;

  const type = status === 'success' ? 'deployment_ready' : 'deployment_failed';
  const severity = status === 'success' ? 'info' : 'error';

  await sendNotification({
    type,
    severity,
    title: `Deployment ${status === 'success' ? 'Ready' : 'Failed'}`,
    message: `Deployment to ${environment} ${status === 'success' ? 'completed successfully' : 'failed'}`,
    url: deploymentUrl,
    metadata: {
      project: projectId,
      environment,
      commit: commitSha?.substring(0, 7),
      branch,
    },
  });
}

/**
 * Send health check failure notification
 */
export async function notifyHealthCheckFailed(params: {
  deploymentUrl: string;
  statusCode?: number;
  error: string;
  projectId: string;
  environment: string;
}): Promise<void> {
  const { deploymentUrl, statusCode, error, projectId, environment } = params;

  await sendNotification({
    type: 'health_check_failed',
    severity: 'critical',
    title: 'Health Check Failed',
    message: `Health check failed for ${deploymentUrl}`,
    url: deploymentUrl,
    metadata: {
      project: projectId,
      environment,
      statusCode: statusCode?.toString(),
      error,
    },
  });
}
