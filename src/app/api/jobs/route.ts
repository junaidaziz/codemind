import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import { 
  jobQueue, 
  jobUtils, 
  JobType, 
  JobStatus, 
  Job,
} from "../../../lib/job-queue";
import { initializeJobProcessors } from "../../../lib/job-processors";
import { createApiError } from "../../../types";
import { logger, withRequestTiming } from '../../lib/logger';

// Initialize processors when the module loads
initializeJobProcessors();

// Request schemas
const CreateJobSchema = z.object({
  type: z.nativeEnum(JobType),
  projectId: z.string().optional(),
  userId: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
});

const GetJobsQuerySchema = z.object({
  status: z.nativeEnum(JobStatus).optional(),
  type: z.nativeEnum(JobType).optional(),
  projectId: z.string().optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1).max(100)).optional().default(20),
});

// Response types
interface JobResponse {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
  projectId?: string;
}

interface JobsListResponse {
  jobs: JobResponse[];
  stats: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
}

interface CreateJobResponse {
  jobId: string;
  message: string;
}

// Helper function to serialize job for response
function serializeJob(job: Job): JobResponse {
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

// GET /api/jobs - List jobs
export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRequestTiming('GET', '/api/jobs', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const queryParams = Object.fromEntries(searchParams.entries());
      const { status, type, projectId, limit } = GetJobsQuerySchema.parse(queryParams);

      logger.info('Jobs list requested', { status, type, projectId, limit });

      // Get jobs with filtering
      const jobs = jobQueue.getJobs({
        status,
        type,
        projectId,
        limit,
      });

      // Get queue statistics
      const stats = jobQueue.getStats();

      const response: JobsListResponse = {
        jobs: jobs.map(serializeJob),
        stats,
      };

      return NextResponse.json(response);

    } catch (error) {
      logger.error('Failed to list jobs', {}, error as Error);

      if (error instanceof z.ZodError) {
        const details = error.issues.reduce((acc, issue) => {
          const path = issue.path.join('.');
          if (!acc[path]) acc[path] = [];
          acc[path].push(issue.message);
          return acc;
        }, {} as Record<string, string[]>);

        return NextResponse.json(
          createApiError("Invalid query parameters", "VALIDATION_ERROR", details),
          { status: 400 }
        );
      }

      return NextResponse.json(
        createApiError("Failed to list jobs", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}

// POST /api/jobs - Create a new job
export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRequestTiming('POST', '/api/jobs', async () => {
    try {
      const body = await request.json();
      const { type, projectId, userId, data: jobData } = CreateJobSchema.parse(body);

      logger.info('Job creation requested', { type, projectId, userId });

      // Create job data based on type
      let jobId: string;

      switch (type) {
        case JobType.INDEX_PROJECT:
          if (!projectId || !jobData.githubUrl) {
            return NextResponse.json(
              createApiError("Missing required fields for index job", "VALIDATION_ERROR"),
              { status: 400 }
            );
          }
          jobId = await jobQueue.addJob(
            jobUtils.createIndexJob(projectId, jobData.githubUrl as string, userId)
          );
          break;

        case JobType.REINDEX_PROJECT:
          if (!projectId) {
            return NextResponse.json(
              createApiError("Missing projectId for reindex job", "VALIDATION_ERROR"),
              { status: 400 }
            );
          }
          jobId = await jobQueue.addJob(
            jobUtils.createReindexJob(projectId, jobData.forceReindex as boolean)
          );
          break;

        case JobType.CLEANUP_CHUNKS:
          jobId = await jobQueue.addJob(
            jobUtils.createCleanupJob(projectId, jobData.olderThanDays as number)
          );
          break;

        default:
          return NextResponse.json(
            createApiError("Unsupported job type", "VALIDATION_ERROR"),
            { status: 400 }
          );
      }

      const response: CreateJobResponse = {
        jobId,
        message: `Job ${type} created successfully`,
      };

      logger.info('Job created successfully', { jobId, type, projectId });

      return NextResponse.json(response, { status: 201 });

    } catch (error) {
      logger.error('Failed to create job', {}, error as Error);

      if (error instanceof z.ZodError) {
        const details = error.issues.reduce((acc, issue) => {
          const path = issue.path.join('.');
          if (!acc[path]) acc[path] = [];
          acc[path].push(issue.message);
          return acc;
        }, {} as Record<string, string[]>);

        return NextResponse.json(
          createApiError("Invalid request body", "VALIDATION_ERROR", details),
          { status: 400 }
        );
      }

      return NextResponse.json(
        createApiError("Failed to create job", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}