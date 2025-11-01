import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { notifyHealthCheckFailed } from '@/lib/notifications/notification-helpers';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'unknown';
  statusCode?: number;
  responseTime?: number;
  error?: string;
  checkedAt: string;
}

/**
 * POST /api/deployments/health-check
 * Performs a health check on a deployment and stores the result
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deploymentId } = body;

    if (!deploymentId) {
      return NextResponse.json({ error: 'deploymentId is required' }, { status: 400 });
    }

    // Fetch deployment
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { id: true, deploymentUrl: true, url: true },
    });

    if (!deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    const targetUrl = deployment.deploymentUrl || deployment.url;
    if (!targetUrl) {
      return NextResponse.json({ error: 'No URL to check' }, { status: 400 });
    }

    // Perform health check
    const result = await performHealthCheck(targetUrl);

    // Store result
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        healthCheckResult: result as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });

    // Send notification if health check failed
    if (result.status === 'unhealthy') {
      await notifyHealthCheckFailed({
        deploymentUrl: targetUrl,
        statusCode: result.statusCode,
        error: result.error || 'Health check failed',
        projectId: deployment.id,
        environment: 'production', // Could be extracted from deployment metadata
      }).catch(error => {
        console.error('[Deployments] Notification failed:', error);
      });
    }

    return NextResponse.json({
      deploymentId,
      healthCheck: result,
    });
  } catch (error) {
    console.error('[Deployments] Health check error:', error);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}

async function performHealthCheck(url: string): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000), // 10s timeout
      headers: {
        'User-Agent': 'CodeMind-HealthCheck/1.0',
      },
    });

    const responseTime = Date.now() - startTime;
    const status = response.ok ? 'healthy' : 'unhealthy';

    return {
      status,
      statusCode: response.status,
      responseTime,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      status: 'unhealthy',
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      checkedAt: new Date().toISOString(),
    };
  }
}

export const dynamic = 'force-dynamic';
