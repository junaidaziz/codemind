import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { notifyDeploymentStatus } from '@/lib/notifications/notification-helpers';

const prisma = new PrismaClient();

/**
 * POST /api/integrations/vercel/webhook
 * Receives Vercel deployment webhooks and stores deployment events
 * 
 * Webhook events: deployment.created, deployment.ready, deployment.error, deployment.canceled
 * 
 * Setup: https://vercel.com/docs/deployments/webhooks
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (if VERCEL_WEBHOOK_SECRET is set)
    const signature = request.headers.get('x-vercel-signature');
    const body = await request.text();
    
    if (process.env.VERCEL_WEBHOOK_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.VERCEL_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('[Vercel Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(body);
    const { type, payload: eventPayload } = payload;

    // Extract deployment data
    const {
      id: deploymentId,
      url,
      meta,
      target,
      readyState,
      createdAt,
      buildingAt,
      readyStateAt,
    } = eventPayload.deployment || {};

    const commitSha = meta?.githubCommitSha;
    const branch = meta?.githubCommitRef;
    const projectId = eventPayload.team?.id || 'default';

    // Map Vercel event types to our status
    let status: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED' = 'QUEUED';
    let errorMessage: string | undefined;

    switch (type) {
      case 'deployment.created':
        status = 'QUEUED';
        break;
      case 'deployment.building':
        status = 'BUILDING';
        break;
      case 'deployment.ready':
        status = 'READY';
        break;
      case 'deployment.error':
        status = 'ERROR';
        errorMessage = eventPayload.deployment?.errorMessage || 'Build failed';
        break;
      case 'deployment.canceled':
        status = 'CANCELED';
        break;
      default:
        // Handle unknown event types gracefully
        if (readyState === 'READY') status = 'READY';
        else if (readyState === 'ERROR') status = 'ERROR';
        else if (readyState === 'BUILDING') status = 'BUILDING';
    }

    const buildDuration = buildingAt && readyStateAt
      ? new Date(readyStateAt).getTime() - new Date(buildingAt).getTime()
      : undefined;

    // Upsert deployment record
    const deployment = await prisma.deployment.upsert({
      where: { id: deploymentId },
      update: {
        status,
        url: url ? `https://${url}` : undefined,
        deploymentUrl: url ? `https://${url}` : undefined,
        buildDuration,
        errorMessage,
        deployedAt: status === 'READY' ? new Date(readyStateAt || Date.now()) : undefined,
        updatedAt: new Date(),
      },
      create: {
        id: deploymentId,
        projectId,
        commitSha,
        branch,
        status,
        url: url ? `https://${url}` : undefined,
        deploymentUrl: url ? `https://${url}` : undefined,
        environment: target,
        provider: 'vercel',
        buildDuration,
        errorMessage,
        metadata: payload,
        createdAt: new Date(createdAt),
        deployedAt: status === 'READY' ? new Date(readyStateAt || Date.now()) : undefined,
      },
    });

    console.log(`[Vercel Webhook] ${type} - ${deploymentId} (${status})`);

    // Send notifications for terminal states
    if (status === 'READY' || status === 'ERROR') {
      await notifyDeploymentStatus({
        projectId,
        status: status === 'READY' ? 'success' : 'failed',
        environment: target || 'production',
        deploymentUrl: url ? `https://${url}` : undefined,
        commitSha,
        branch,
      }).catch(error => {
        console.error('[Vercel Webhook] Notification failed:', error);
        // Don't fail webhook processing if notification fails
      });
    }

    // TODO: Optionally trigger post-deploy health check
    // if (status === 'READY' && deployment.url) {
    //   await triggerHealthCheck(deployment.id, deployment.url);
    // }

    return NextResponse.json({
      success: true,
      deploymentId: deployment.id,
      status: deployment.status,
    });
  } catch (error) {
    console.error('[Vercel Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
