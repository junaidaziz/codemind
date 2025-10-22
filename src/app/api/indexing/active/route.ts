import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getUserId } from '@/lib/auth-server';

/**
 * GET /api/indexing/active
 * 
 * Fetch currently active indexing jobs with their latest progress
 * Returns jobs that are IN_PROGRESS with their most recent PROGRESS event
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's projects
    const userProjects = await prisma.project.findMany({
      where: { ownerId: userId },
      select: { id: true }
    });
    
    const projectIds = userProjects.map(p => p.id);

    if (projectIds.length === 0) {
      return NextResponse.json({ 
        jobs: [], 
        count: 0,
        message: 'No projects found' 
      });
    }

    // Find active indexing events (IN_PROGRESS status)
    // Get the most recent STARTED or PROGRESS event for each project
    const activeIndexingEvents = await prisma.activityEvent.findMany({
      where: {
        projectId: { in: projectIds },
        eventType: {
          in: ['INDEXING_STARTED', 'INDEXING_PROGRESS', 'INDEXING_COMPLETED', 'INDEXING_FAILED']
        },
        status: 'IN_PROGRESS'
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            githubUrl: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // For each active job, get the latest progress update
    const jobsWithProgress = await Promise.all(
      activeIndexingEvents.map(async (event) => {
        // Get all progress events for this job
        const progressEvents = await prisma.activityEvent.findMany({
          where: {
            projectId: event.projectId,
            entityId: event.entityId, // Same job ID
            eventType: {
              in: ['INDEXING_STARTED', 'INDEXING_PROGRESS']
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        });

        const latestProgress = progressEvents[0];
        const metadata = (latestProgress?.metadata || event.metadata || {}) as Record<string, unknown>;

        return {
          jobId: event.entityId,
          projectId: event.projectId,
          projectName: event.project.name,
          githubUrl: event.project.githubUrl,
          status: event.status,
          eventType: event.eventType,
          title: latestProgress?.title || event.title,
          description: latestProgress?.description || event.description,
          startedAt: event.createdAt,
          lastUpdate: latestProgress?.createdAt || event.createdAt,
          progress: {
            percentage: typeof metadata.percentage === 'number' ? metadata.percentage : 0,
            processedFiles: typeof metadata.processedFiles === 'number' ? metadata.processedFiles : 0,
            totalFiles: typeof metadata.totalFiles === 'number' ? metadata.totalFiles : 0,
            chunksCreated: typeof metadata.chunksCreated === 'number' ? metadata.chunksCreated : 0,
            batchesProcessed: typeof metadata.batchesProcessed === 'number' ? metadata.batchesProcessed : 0
          },
          duration: Date.now() - new Date(event.createdAt).getTime()
        };
      })
    );

    return NextResponse.json({
      jobs: jobsWithProgress,
      count: jobsWithProgress.length
    });

  } catch (error) {
    console.error('Error fetching active indexing jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active indexing jobs' },
      { status: 500 }
    );
  }
}
