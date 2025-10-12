// GitHub webhook management API - /api/github/webhooks
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { logger } from '@/lib/logger';
import { 
  createApiError,
  createApiSuccess 
} from '../../../../types';
import {
  CreateWebhookRequestSchema,
  UpdateWebhookRequestSchema,
  extractRepositoryInfo,
  GITHUB_EVENTS,
  type CreateWebhookRequest,
  type UpdateWebhookRequest,
} from '../../../../types/github';
import { z } from 'zod';

// GET /api/github/webhooks - List webhooks for a project
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        createApiError('Project ID is required', 'MISSING_PARAMETER'),
        { status: 400 }
      );
    }

    // For now, return webhook configuration from project data
    // In future, this would come from a dedicated webhooks table
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        githubUrl: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!project) {
      return NextResponse.json(
        createApiError('Project not found', 'PROJECT_NOT_FOUND'),
        { status: 404 }
      );
    }

    // Mock webhook configuration based on project
    const webhookConfig = {
      id: `webhook-${project.id}`,
      projectId: project.id,
      repositoryUrl: project.githubUrl || '',
      secret: '***', // Never expose the actual secret
      events: [
        GITHUB_EVENTS.PUSH,
        GITHUB_EVENTS.PULL_REQUEST,
        GITHUB_EVENTS.ISSUES,
        GITHUB_EVENTS.RELEASE,
      ],
      active: true,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };

    // Get recent webhook logs from messages
    const webhookLogs = await prisma.message.findMany({
      where: {
        sessionId: {
          startsWith: `webhook-${projectId}`,
        },
        role: 'system',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        content: true,
        createdAt: true,
        sessionId: true,
      }
    });

    const formattedLogs = webhookLogs.map(log => ({
      id: log.id,
      eventType: log.sessionId.includes('error') ? 'error' : 'webhook',
      eventAction: 'processed',
      processed: !log.sessionId.includes('error'),
      success: !log.sessionId.includes('error'),
      error: log.sessionId.includes('error') ? log.content : null,
      createdAt: log.createdAt.toISOString(),
      description: log.content,
    }));

    return NextResponse.json(createApiSuccess({
      webhook: webhookConfig,
      logs: formattedLogs,
      stats: {
        totalEvents: formattedLogs.length,
        successfulEvents: formattedLogs.filter(log => log.success).length,
        failedEvents: formattedLogs.filter(log => !log.success).length,
      }
    }));

  } catch (error) {
    logger.error('Failed to fetch webhook configuration', {}, error as Error);
    return NextResponse.json(
      createApiError('Failed to fetch webhook configuration', 'FETCH_ERROR'),
      { status: 500 }
    );
  }
}

// POST /api/github/webhooks - Create or update webhook configuration
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const data: CreateWebhookRequest = CreateWebhookRequestSchema.parse(body);

    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      return NextResponse.json(
        createApiError('Project not found', 'PROJECT_NOT_FOUND'),
        { status: 404 }
      );
    }

    // Extract repository info
    const repoInfo = extractRepositoryInfo(data.repositoryUrl);
    
    // Update project with repository URL if different
    if (project.githubUrl !== data.repositoryUrl) {
      await prisma.project.update({
        where: { id: data.projectId },
        data: { githubUrl: data.repositoryUrl },
      });
    }

    // In a real implementation, you would:
    // 1. Create the webhook on GitHub using their API
    // 2. Store the webhook configuration in a dedicated table
    // 3. Generate and store a webhook secret
    
    // For now, just return success
    const webhookConfig = {
      id: `webhook-${data.projectId}`,
      projectId: data.projectId,
      repositoryUrl: data.repositoryUrl,
      repositoryName: repoInfo.fullName,
      events: data.events,
      active: true,
      webhookUrl: `${req.nextUrl.origin}/api/github/webhook`,
      secret: data.secret || 'auto-generated-secret',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    logger.info('Webhook configuration created/updated', {
      projectId: data.projectId,
      repositoryUrl: data.repositoryUrl,
      events: data.events,
    });

    return NextResponse.json(createApiSuccess(webhookConfig, 'Webhook configured successfully'));

  } catch (error) {
    logger.error('Failed to create webhook configuration', {}, error as Error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('Validation failed', 'VALIDATION_ERROR', {
          validation: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createApiError('Failed to create webhook configuration', 'CREATE_ERROR'),
      { status: 500 }
    );
  }
}

// PUT /api/github/webhooks/:id - Update webhook configuration
export async function PUT(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const data: UpdateWebhookRequest = UpdateWebhookRequestSchema.parse(body);

    if (!data.projectId) {
      return NextResponse.json(
        createApiError('Project ID is required', 'MISSING_PARAMETER'),
        { status: 400 }
      );
    }

    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
    });

    if (!project) {
      return NextResponse.json(
        createApiError('Project not found', 'PROJECT_NOT_FOUND'),
        { status: 404 }
      );
    }

    // Update project if repository URL changed
    if (data.repositoryUrl && project.githubUrl !== data.repositoryUrl) {
      await prisma.project.update({
        where: { id: data.projectId },
        data: { githubUrl: data.repositoryUrl },
      });
    }

    // Return updated webhook config
    const webhookConfig = {
      id: `webhook-${data.projectId}`,
      projectId: data.projectId,
      repositoryUrl: data.repositoryUrl || project.githubUrl || '',
      events: data.events || [
        GITHUB_EVENTS.PUSH,
        GITHUB_EVENTS.PULL_REQUEST,
        GITHUB_EVENTS.ISSUES,
        GITHUB_EVENTS.RELEASE,
      ],
      active: true,
      updatedAt: new Date().toISOString(),
    };

    logger.info('Webhook configuration updated', {
      projectId: data.projectId,
      changes: data,
    });

    return NextResponse.json(createApiSuccess(webhookConfig, 'Webhook updated successfully'));

  } catch (error) {
    logger.error('Failed to update webhook configuration', {}, error as Error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createApiError('Validation failed', 'VALIDATION_ERROR', {
          validation: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createApiError('Failed to update webhook configuration', 'UPDATE_ERROR'),
      { status: 500 }
    );
  }
}

// DELETE /api/github/webhooks/:id - Delete webhook configuration
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        createApiError('Project ID is required', 'MISSING_PARAMETER'),
        { status: 400 }
      );
    }

    // Validate project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        createApiError('Project not found', 'PROJECT_NOT_FOUND'),
        { status: 404 }
      );
    }

    // In a real implementation, you would:
    // 1. Delete the webhook from GitHub using their API
    // 2. Remove the webhook configuration from your database
    
    // For now, just clear the GitHub URL from the project
    await prisma.project.update({
      where: { id: projectId },
      data: { githubUrl: undefined },
    });

    logger.info('Webhook configuration deleted', { projectId });

    return NextResponse.json(createApiSuccess({ 
      message: 'Webhook deleted successfully',
      projectId 
    }));

  } catch (error) {
    logger.error('Failed to delete webhook configuration', {}, error as Error);
    return NextResponse.json(
      createApiError('Failed to delete webhook configuration', 'DELETE_ERROR'),
      { status: 500 }
    );
  }
}