import { NextRequest, NextResponse } from "next/server";
import { jobQueue, Job } from "../../../../lib/job-queue";
import { createApiError } from "../../../../types";
import { logger, withRequestTiming } from '../../../lib/logger';

// Helper function to serialize job for response
function serializeJob(job: Job) {
  return {
    id: job.id,
    type: job.data.type,
    status: job.status,
    progress: job.progress || 0,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    result: job.result,
    error: job.error,
    projectId: job.data.projectId,
  };
}

// GET /api/jobs/[id] - Get specific job status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withRequestTiming('GET', '/api/jobs/[id]', async () => {
    try {
      const { id: jobId } = await params;
      
      logger.debug('Job status requested', { jobId });

      const job = jobQueue.getJob(jobId);
      
      if (!job) {
        return NextResponse.json(
          createApiError("Job not found", "RESOURCE_NOT_FOUND"),
          { status: 404 }
        );
      }

      return NextResponse.json(serializeJob(job));

    } catch (error) {
      logger.error('Failed to get job status', {}, error as Error);

      return NextResponse.json(
        createApiError("Failed to get job status", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}

// DELETE /api/jobs/[id] - Cancel a job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withRequestTiming('DELETE', '/api/jobs/[id]', async () => {
    try {
      const { id: jobId } = await params;
      
      logger.info('Job cancellation requested', { jobId });

      const success = await jobQueue.cancelJob(jobId);
      
      if (!success) {
        return NextResponse.json(
          createApiError("Job not found or cannot be cancelled", "VALIDATION_ERROR"),
          { status: 400 }
        );
      }

      logger.info('Job cancelled successfully', { jobId });

      return NextResponse.json({
        message: "Job cancelled successfully",
        jobId,
      });

    } catch (error) {
      logger.error('Failed to cancel job', {}, error as Error);

      return NextResponse.json(
        createApiError("Failed to cancel job", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}