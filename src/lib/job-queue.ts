// Background Job System for CodeMind
// Provides typed interfaces for async job processing without external dependencies

import { logger, createError } from '../app/lib/logger';

// Job status enum
export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Job types
export enum JobType {
  INDEX_PROJECT = 'INDEX_PROJECT',
  REINDEX_PROJECT = 'REINDEX_PROJECT',
  CLEANUP_CHUNKS = 'CLEANUP_CHUNKS',
  OPTIMIZE_DATABASE = 'OPTIMIZE_DATABASE',
  GENERATE_EMBEDDINGS = 'GENERATE_EMBEDDINGS',
  CODE_ANALYSIS = 'CODE_ANALYSIS',
  PR_COMMENT = 'PR_COMMENT',
  PR_ANALYSIS = 'PR_ANALYSIS',
  FULL_INDEX_PROJECT = 'FULL_INDEX_PROJECT',
}

// Base job data interface
export interface BaseJobData {
  type: JobType;
  projectId?: string;
  userId?: string;
  priority?: number;
  retries?: number;
  maxRetries?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Specific job data types
export interface IndexProjectJobData extends BaseJobData {
  type: JobType.INDEX_PROJECT;
  projectId: string;
  githubUrl: string;
  includePatterns?: string[];
  excludePatterns?: string[];
}

export interface ReindexProjectJobData extends BaseJobData {
  type: JobType.REINDEX_PROJECT;
  projectId: string;
  forceReindex?: boolean;
  chunkOptions?: {
    maxLines?: number;
    maxTokens?: number;
    overlapLines?: number;
  };
}

export interface CleanupChunksJobData extends BaseJobData {
  type: JobType.CLEANUP_CHUNKS;
  projectId?: string;
  olderThanDays?: number;
}

export interface OptimizeDatabaseJobData extends BaseJobData {
  type: JobType.OPTIMIZE_DATABASE;
  tables?: string[];
  vacuum?: boolean;
  analyze?: boolean;
}

export interface GenerateEmbeddingsJobData extends BaseJobData {
  type: JobType.GENERATE_EMBEDDINGS;
  projectId: string;
  chunkIds: string[];
  batchSize?: number;
}

export interface CodeAnalysisJobData extends BaseJobData {
  type: JobType.CODE_ANALYSIS;
  projectId: string;
  repositoryUrl: string;
  branch: string;
  commitSha: string;
  pullRequestNumber?: number;
  eventType: 'push' | 'pull_request';
  metadata: {
    eventData: Record<string, unknown>;
    triggeredAt: string;
    triggeredBy: string;
  };
}

export interface PRCommentJobData extends BaseJobData {
  type: JobType.PR_COMMENT;
  projectId: string;
  repositoryUrl: string;
  pullRequestNumber: number;
  analysisResult: {
    projectId: string;
    commitSha: string;
    analysisId: string;
    metrics: Record<string, number>;
    findings: Record<string, Array<Record<string, unknown>>>;
    summary: string;
    completedAt: string;
    processingTime: number;
  };
  metadata: {
    commitSha: string;
    triggeredAt: string;
  };
}

export interface PRAnalysisJobData extends BaseJobData {
  type: JobType.PR_ANALYSIS;
  projectId: string;
  repository: {
    owner: string;
    name: string;
  };
  pullRequest: {
    number: number;
    title: string;
    sha: string;
  };
}

export interface FullIndexJobData extends BaseJobData {
  type: JobType.FULL_INDEX_PROJECT;
  projectId: string;
  githubUrl: string;
  forceReindex?: boolean;
  includeContent?: boolean;
  chunkAndEmbed?: boolean;
}

// Union type for all job data
export type JobData = 
  | IndexProjectJobData
  | ReindexProjectJobData
  | CleanupChunksJobData
  | OptimizeDatabaseJobData
  | GenerateEmbeddingsJobData
  | CodeAnalysisJobData
  | PRCommentJobData
  | PRAnalysisJobData
  | FullIndexJobData;

// Job result interfaces
export interface BaseJobResult {
  success: boolean;
  message: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface IndexProjectResult extends BaseJobResult {
  chunksCreated: number;
  filesProcessed: number;
  embeddingsGenerated: number;
  errors: string[];
}

export interface ReindexProjectResult extends BaseJobResult {
  chunksDeleted: number;
  chunksCreated: number;
  filesProcessed: number;
}

export interface CleanupChunksResult extends BaseJobResult {
  chunksDeleted: number;
  spaceFreed: number; // in bytes
}

export interface OptimizeDatabaseResult extends BaseJobResult {
  tablesOptimized: string[];
  spaceReclaimed: number; // in bytes
}

export interface GenerateEmbeddingsResult extends BaseJobResult {
  embeddingsGenerated: number;
  batchesProcessed: number;
}

export interface PRAnalysisResult extends BaseJobResult {
  pullRequestNumber: number;
  riskScore: number;
  qualityScore: number;
  commentPosted: boolean;
  commentId?: number;
}

export interface FullIndexResult extends BaseJobResult {
  totalFiles: number;
  newFiles: number;
  updatedFiles: number;
  deletedFiles: number;
  chunksCreated: number;
  embeddingsGenerated: number;
  errorCount: number;
}

// Union type for all job results
export type JobResult = 
  | IndexProjectResult
  | ReindexProjectResult
  | CleanupChunksResult
  | OptimizeDatabaseResult
  | GenerateEmbeddingsResult
  | PRAnalysisResult
  | FullIndexResult;

// Job interface
export interface Job {
  id: string;
  data: JobData;
  status: JobStatus;
  result?: JobResult;
  error?: string;
  progress?: number; // 0-100
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// Job event types
export interface JobEventHandlers {
  onProgress?: (job: Job, progress: number) => void | Promise<void>;
  onCompleted?: (job: Job, result: JobResult) => void | Promise<void>;
  onFailed?: (job: Job, error: Error) => void | Promise<void>;
  onCancelled?: (job: Job) => void | Promise<void>;
}

// Job processor function type
export type JobProcessor<T extends JobData = JobData, R extends JobResult = JobResult> = (
  data: T,
  progress: (percent: number) => void
) => Promise<R>;

// Simple in-memory job queue implementation
class SimpleJobQueue {
  private jobs = new Map<string, Job>();
  private processors = new Map<JobType, JobProcessor>();
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;

  constructor() {
    this.startProcessing();
  }

  // Add a job to the queue
  async addJob<T extends JobData>(
    data: T,
    handlers?: JobEventHandlers
  ): Promise<string> {
    const jobId = this.generateJobId();
    const job: Job = {
      id: jobId,
      data,
      status: JobStatus.PENDING,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);

    logger.info('Job added to queue', {
      jobId,
      type: data.type,
      projectId: data.projectId,
    });

    // Store handlers for this job (in a real implementation, this would be persisted)
    if (handlers) {
      // In a real implementation, you'd store these handlers properly
      // For now, we'll just log that handlers were provided
      logger.debug('Job handlers registered', { jobId });
    }

    return jobId;
  }

  // Register a job processor
  registerProcessor<T extends JobData, R extends JobResult>(
    type: JobType,
    processor: JobProcessor<T, R>
  ): void {
    this.processors.set(type, processor as unknown as JobProcessor);
    logger.info('Job processor registered', { type });
  }

  // Get job status
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  // Get all jobs with optional filtering
  getJobs(filter?: {
    status?: JobStatus;
    type?: JobType;
    projectId?: string;
    limit?: number;
  }): Job[] {
    let jobs = Array.from(this.jobs.values());

    if (filter) {
      if (filter.status) {
        jobs = jobs.filter(job => job.status === filter.status);
      }
      if (filter.type) {
        jobs = jobs.filter(job => job.data.type === filter.type);
      }
      if (filter.projectId) {
        jobs = jobs.filter(job => job.data.projectId === filter.projectId);
      }
      if (filter.limit) {
        jobs = jobs.slice(0, filter.limit);
      }
    }

    return jobs.sort((a, b) => 
      (b.data.priority || 0) - (a.data.priority || 0) ||
      a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  // Cancel a job
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === JobStatus.PENDING) {
      job.status = JobStatus.CANCELLED;
      job.updatedAt = new Date();
      logger.info('Job cancelled', { jobId });
      return true;
    }

    return false;
  }

  // Start processing jobs
  private startProcessing(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.processingInterval = setInterval(() => {
      this.processNextJob().catch(error => {
        logger.error('Error processing job queue', {}, error);
      });
    }, 1000); // Check for jobs every second

    logger.info('Job queue processing started');
  }

  // Stop processing jobs
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    this.isProcessing = false;
    logger.info('Job queue processing stopped');
  }

  // Process the next pending job
  private async processNextJob(): Promise<void> {
    const pendingJobs = this.getJobs({ status: JobStatus.PENDING, limit: 1 });
    if (pendingJobs.length === 0) return;

    const job = pendingJobs[0];
    const processor = this.processors.get(job.data.type);
    
    if (!processor) {
      logger.warn('No processor found for job type', { 
        jobId: job.id, 
        type: job.data.type 
      });
      return;
    }

    // Update job status
    job.status = JobStatus.RUNNING;
    job.startedAt = new Date();
    job.updatedAt = new Date();

    logger.info('Processing job', { 
      jobId: job.id, 
      type: job.data.type,
      projectId: job.data.projectId,
    });

    try {
      // Progress callback
      const progressCallback = (progress: number) => {
        job.progress = Math.max(0, Math.min(100, progress));
        job.updatedAt = new Date();
      };

      // Execute the job
      const result = await processor(job.data, progressCallback);

      // Job completed successfully
      job.status = JobStatus.COMPLETED;
      job.result = result;
      job.completedAt = new Date();
      job.updatedAt = new Date();
      job.progress = 100;

      logger.info('Job completed successfully', { 
        jobId: job.id, 
        type: job.data.type,
        duration: job.completedAt.getTime() - job.startedAt!.getTime(),
      });

    } catch (error) {
      // Job failed
      job.status = JobStatus.FAILED;
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();
      job.updatedAt = new Date();

      logger.error('Job failed', { 
        jobId: job.id, 
        type: job.data.type,
        error: job.error,
      }, error as Error);

      // Retry logic
      const retries = job.data.retries || 0;
      const maxRetries = job.data.maxRetries || 3;
      
      if (retries < maxRetries) {
        job.data.retries = retries + 1;
        job.status = JobStatus.PENDING;
        job.startedAt = undefined;
        job.completedAt = undefined;
        job.error = undefined;
        job.progress = 0;
        
        logger.info('Job queued for retry', { 
          jobId: job.id, 
          attempt: retries + 1,
          maxRetries,
        });
      }
    }
  }

  // Generate unique job ID
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  // Get queue statistics
  getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === JobStatus.PENDING).length,
      running: jobs.filter(j => j.status === JobStatus.RUNNING).length,
      completed: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
      failed: jobs.filter(j => j.status === JobStatus.FAILED).length,
      cancelled: jobs.filter(j => j.status === JobStatus.CANCELLED).length,
    };
  }

  // Get active jobs (pending and running)
  getActiveJobs(): Job[] {
    const jobs = Array.from(this.jobs.values());
    return jobs.filter(j => 
      j.status === JobStatus.PENDING || 
      j.status === JobStatus.RUNNING
    );
  }

  // Get completed jobs (both successful and failed)
  getCompletedJobs(limit = 50): Job[] {
    const jobs = Array.from(this.jobs.values());
    return jobs
      .filter(j => 
        j.status === JobStatus.COMPLETED || 
        j.status === JobStatus.FAILED ||
        j.status === JobStatus.CANCELLED
      )
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  // Add job with simplified interface for the API
  async addJobWithConfig(config: {
    type: JobType;
    data: Record<string, unknown>;
    priority?: 'low' | 'normal' | 'high';
    retries?: number;
  }): Promise<{ id: string }> {
    const priorityMap = {
      'low': 1,
      'normal': 5,
      'high': 10,
    };

    const jobData = {
      ...config.data,
      type: config.type,
      priority: priorityMap[config.priority || 'normal'],
      maxRetries: config.retries || 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as JobData;

    const jobId = await this.addJob(jobData);
    return { id: jobId };
  }
}

// Global job queue instance
export const jobQueue = new SimpleJobQueue();

// Utility functions for common job operations
export const jobUtils = {
  // Create an index project job
  createIndexJob: (projectId: string, githubUrl: string, userId?: string): IndexProjectJobData => ({
    type: JobType.INDEX_PROJECT,
    projectId,
    githubUrl,
    userId,
    priority: 5,
    maxRetries: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  // Create a reindex project job
  createReindexJob: (projectId: string, forceReindex = false): ReindexProjectJobData => ({
    type: JobType.REINDEX_PROJECT,
    projectId,
    forceReindex,
    priority: 3,
    maxRetries: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  // Create a cleanup job
  createCleanupJob: (projectId?: string, olderThanDays = 30): CleanupChunksJobData => ({
    type: JobType.CLEANUP_CHUNKS,
    projectId,
    olderThanDays,
    priority: 1,
    maxRetries: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  // Wait for job completion
  waitForJob: async (jobId: string, timeoutMs = 30000): Promise<Job> => {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkJob = () => {
        const job = jobQueue.getJob(jobId);
        
        if (!job) {
          reject(createError.notFound('Job not found'));
          return;
        }

        if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
          resolve(job);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(createError.internal('Job timeout'));
          return;
        }

        setTimeout(checkJob, 1000);
      };

      checkJob();
    });
  },
};

export default jobQueue;