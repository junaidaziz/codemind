import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-utils';
import prisma from '@/lib/db';
import { jobQueue, type Job, JobType } from '../../../../../lib/job-queue';
import { type FullIndexJobData } from '../../../../../lib/job-processors';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const fullIndexRequestSchema = z.object({
  forceReindex: z.boolean().optional().default(false),
  includeContent: z.boolean().optional().default(true),
  chunkAndEmbed: z.boolean().optional().default(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (!project.githubUrl) {
      return NextResponse.json(
        { error: 'Project must have a GitHub URL to perform full indexing' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    let requestData: z.infer<typeof fullIndexRequestSchema>;
    try {
      const body = await request.json();
      requestData = fullIndexRequestSchema.parse(body);
    } catch {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Check if there's already a full indexing job running for this project
    const existingJobs = jobQueue.getActiveJobs();
    const hasActiveFullIndexJob = existingJobs.some(
      (job: Job) => job.data.type === JobType.FULL_INDEX_PROJECT && 
              (job.data as FullIndexJobData).projectId === projectId
    );

    if (hasActiveFullIndexJob) {
      return NextResponse.json(
        { 
          error: 'Full indexing is already in progress for this project',
          message: 'Please wait for the current indexing job to complete'
        },
        { status: 409 }
      );
    }

    // Queue the full indexing job
    const job = await jobQueue.addJobWithConfig({
      type: JobType.FULL_INDEX_PROJECT,
      data: {
        projectId,
        githubUrl: project.githubUrl,
        forceReindex: requestData.forceReindex,
        includeContent: requestData.includeContent,
        chunkAndEmbed: requestData.chunkAndEmbed,
      },
      priority: 'high',
      retries: 2,
    });

    logger.info('Full repository indexing job queued', {
      projectId,
      jobId: job.id,
      githubUrl: project.githubUrl,
      options: requestData,
    });

    return NextResponse.json({
      success: true,
      message: 'Full repository indexing job queued successfully',
      jobId: job.id,
      project: {
        id: project.id,
        name: project.name,
        githubUrl: project.githubUrl,
      },
      options: requestData,
    });

  } catch (error) {
    logger.error('Failed to queue full indexing job', { error: (error as Error).message });
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to queue full repository indexing job'
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;

    // Verify project exists and user has access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: user.id,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get active and recent full indexing jobs for this project
    const allJobs = jobQueue.getActiveJobs();
    const recentJobs = jobQueue.getCompletedJobs(10);
    
    const fullIndexJobs = [...allJobs, ...recentJobs].filter(
      (job: Job) => job.data.type === JobType.FULL_INDEX_PROJECT && 
             (job.data as FullIndexJobData).projectId === projectId
    );

    // Get current indexing statistics
    const stats = await prisma.projectFile.aggregate({
      where: { projectId },
      _count: {
        id: true,
      },
    });

    const chunksCount = await prisma.codeChunk.count({
      where: { projectId },
    });

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        githubUrl: project.githubUrl,
      },
      statistics: {
        totalFiles: stats._count.id || 0,
        totalChunks: chunksCount,
      },
      jobs: fullIndexJobs.map(job => ({
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        progress: job.progress,
        result: job.result,
      })),
    });

  } catch (error) {
    logger.error('Failed to get full indexing status', { error: (error as Error).message });
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to get full indexing status'
      },
      { status: 500 }
    );
  }
}