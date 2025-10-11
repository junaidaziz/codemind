// Job processors for CodeMind background operations
import { 
  JobType, 
  IndexProjectJobData, 
  IndexProjectResult,
  ReindexProjectJobData,
  ReindexProjectResult,
  CleanupChunksJobData,
  CleanupChunksResult,
  OptimizeDatabaseJobData,
  OptimizeDatabaseResult,
  GenerateEmbeddingsJobData,
  GenerateEmbeddingsResult,
  jobQueue,
} from './job-queue';
import { logger, withDatabaseTiming } from '../app/lib/logger';
import { chunkCodeFile } from '../app/lib/chunking';
import { embedTexts } from '../app/lib/embeddings';
import { 
  insertEmbeddingsBatch, 
  deleteProjectChunks, 
  optimizeDatabaseTables,
} from '../app/lib/db-utils';
import prisma from '../app/lib/db';

// Index project processor
async function indexProjectProcessor(
  data: IndexProjectJobData,
  progress: (percent: number) => void
): Promise<IndexProjectResult> {
  const startTime = new Date();
  let chunksCreated = 0;
  let filesProcessed = 0;
  let embeddingsGenerated = 0;
  const errors: string[] = [];

  try {
    logger.info('Starting project indexing', { 
      projectId: data.projectId,
      githubUrl: data.githubUrl,
    });

    progress(10);

    // Fetch repository files (stubbed implementation)
    const files = await fetchRepositoryFiles(data.githubUrl, {
      includePatterns: data.includePatterns,
      excludePatterns: data.excludePatterns,
    });

    progress(20);

    if (files.length === 0) {
      throw new Error('No files found in repository');
    }

    // Process files in batches
    const batchSize = 5;
    const totalBatches = Math.ceil(files.length / batchSize);

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchProgress = 20 + (60 * (i / files.length));
      progress(batchProgress);

      try {
        await withDatabaseTiming('processBatch', async () => {
          const allChunks = [];

          for (const file of batch) {
            try {
              const chunkingResult = chunkCodeFile(file.content, file.path);
              allChunks.push(...chunkingResult.chunks.map(chunk => ({
                path: chunk.path,
                language: chunk.language || 'text',
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                content: chunk.content,
                tokenCount: chunk.tokenCount || 0,
                embedding: [] as number[], // Will be filled below
              })));
              filesProcessed++;
            } catch (error) {
              const errorMsg = `Failed to chunk file ${file.path}: ${error}`;
              errors.push(errorMsg);
              logger.warn(errorMsg);
            }
          }

          if (allChunks.length > 0) {
            // Generate embeddings
            const contents = allChunks.map(chunk => chunk.content);
            const embeddings = await embedTexts(contents);
            
            // Assign embeddings to chunks
            allChunks.forEach((chunk, index) => {
              chunk.embedding = embeddings[index] || [];
            });

            // Insert into database
            await insertEmbeddingsBatch(data.projectId, allChunks);
            
            chunksCreated += allChunks.length;
            embeddingsGenerated += embeddings.length;
          }
        });
      } catch (error) {
        const errorMsg = `Failed to process batch ${Math.floor(i / batchSize) + 1}: ${error}`;
        errors.push(errorMsg);
        logger.error(errorMsg, {}, error as Error);
      }
    }

    progress(90);

    // Update project status
    await prisma.project.update({
      where: { id: data.projectId },
      data: { 
        status: errors.length > files.length / 2 ? 'error' : 'indexed',
        updatedAt: new Date(),
      },
    });

    progress(100);

    const endTime = new Date();
    const result: IndexProjectResult = {
      success: errors.length < files.length / 2,
      message: `Processed ${filesProcessed} files, created ${chunksCreated} chunks`,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      chunksCreated,
      filesProcessed,
      embeddingsGenerated,
      errors,
      metadata: {
        totalFiles: files.length,
        totalBatches,
        errorRate: errors.length / files.length,
      },
    };

    logger.info('Project indexing completed', {
      projectId: data.projectId,
      result: {
        success: result.success,
        chunksCreated,
        filesProcessed,
        errors: errors.length,
      },
    });

    return result;

  } catch (error) {
    const endTime = new Date();
    logger.error('Project indexing failed', { projectId: data.projectId }, error as Error);
    
    return {
      success: false,
      message: `Indexing failed: ${error}`,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      chunksCreated,
      filesProcessed,
      embeddingsGenerated,
      errors: [...errors, String(error)],
    };
  }
}

// Reindex project processor
async function reindexProjectProcessor(
  data: ReindexProjectJobData,
  progress: (percent: number) => void
): Promise<ReindexProjectResult> {
  const startTime = new Date();
  
  try {
    logger.info('Starting project reindexing', { 
      projectId: data.projectId,
      forceReindex: data.forceReindex,
    });

    progress(10);

    // Delete existing chunks
    const chunksDeleted = await deleteProjectChunks(data.projectId);
    progress(30);

    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: data.projectId },
      select: { githubUrl: true },
    });

    if (!project?.githubUrl) {
      throw new Error('Project not found or missing GitHub URL');
    }

    progress(40);

    // Trigger new indexing
    const indexJobData: IndexProjectJobData = {
      type: JobType.INDEX_PROJECT,
      projectId: data.projectId,
      githubUrl: project.githubUrl,
      priority: 5,
      maxRetries: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const indexJobId = await jobQueue.addJob(indexJobData);
    progress(50);

    // Wait for indexing to complete
    const indexJob = await jobUtils.waitForJob(indexJobId, 120000); // 2 minute timeout
    progress(100);

    const endTime = new Date();
    const indexResult = indexJob.result as IndexProjectResult;

    return {
      success: indexJob.status === 'completed' && indexResult?.success,
      message: `Reindexing completed. Deleted ${chunksDeleted} chunks, created ${indexResult?.chunksCreated || 0} new chunks`,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      chunksDeleted,
      chunksCreated: indexResult?.chunksCreated || 0,
      filesProcessed: indexResult?.filesProcessed || 0,
      metadata: {
        indexJobId,
        indexResult,
      },
    };

  } catch (error) {
    const endTime = new Date();
    logger.error('Project reindexing failed', { projectId: data.projectId }, error as Error);
    
    return {
      success: false,
      message: `Reindexing failed: ${error}`,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      chunksDeleted: 0,
      chunksCreated: 0,
      filesProcessed: 0,
    };
  }
}

// Cleanup chunks processor
async function cleanupChunksProcessor(
  data: CleanupChunksJobData,
  progress: (percent: number) => void
): Promise<CleanupChunksResult> {
  const startTime = new Date();
  
  try {
    logger.info('Starting chunk cleanup', { 
      projectId: data.projectId,
      olderThanDays: data.olderThanDays,
    });

    progress(20);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (data.olderThanDays || 30));

    const whereClause = {
      updatedAt: { lt: cutoffDate },
      ...(data.projectId ? { projectId: data.projectId } : {}),
    };

    progress(40);

    // Count chunks to be deleted
    const chunksToDelete = await prisma.codeChunk.count({ where: whereClause });
    
    progress(60);

    // Delete chunks
    const deleteResult = await prisma.codeChunk.deleteMany({ where: whereClause });
    
    progress(100);

    const endTime = new Date();

    return {
      success: true,
      message: `Cleaned up ${deleteResult.count} old chunks`,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      chunksDeleted: deleteResult.count,
      spaceFreed: chunksToDelete * 1000, // Rough estimate
      metadata: {
        cutoffDate,
        projectId: data.projectId,
      },
    };

  } catch (error) {
    const endTime = new Date();
    logger.error('Chunk cleanup failed', { projectId: data.projectId }, error as Error);
    
    return {
      success: false,
      message: `Cleanup failed: ${error}`,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      chunksDeleted: 0,
      spaceFreed: 0,
    };
  }
}

// Database optimization processor
async function optimizeDatabaseProcessor(
  data: OptimizeDatabaseJobData,
  progress: (percent: number) => void
): Promise<OptimizeDatabaseResult> {
  const startTime = new Date();
  
  try {
    logger.info('Starting database optimization');

    progress(20);

    await optimizeDatabaseTables();
    
    progress(100);

    const endTime = new Date();

    return {
      success: true,
      message: 'Database optimization completed',
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      tablesOptimized: ['CodeChunk', 'Project', 'ChatSession'],
      spaceReclaimed: 0, // Would need actual measurement
    };

  } catch (error) {
    const endTime = new Date();
    logger.error('Database optimization failed', {}, error as Error);
    
    return {
      success: false,
      message: `Optimization failed: ${error}`,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      tablesOptimized: [],
      spaceReclaimed: 0,
    };
  }
}

// Generate embeddings processor
async function generateEmbeddingsProcessor(
  data: GenerateEmbeddingsJobData,
  progress: (percent: number) => void
): Promise<GenerateEmbeddingsResult> {
  const startTime = new Date();
  let embeddingsGenerated = 0;
  let batchesProcessed = 0;
  
  try {
    logger.info('Starting embedding generation', { 
      projectId: data.projectId,
      chunkCount: data.chunkIds.length,
    });

    const batchSize = data.batchSize || 10;
    const totalBatches = Math.ceil(data.chunkIds.length / batchSize);

    for (let i = 0; i < data.chunkIds.length; i += batchSize) {
      const batchIds = data.chunkIds.slice(i, i + batchSize);
      const batchProgress = (i / data.chunkIds.length) * 90;
      progress(batchProgress);

      // Fetch chunks
      const chunks = await prisma.codeChunk.findMany({
        where: { id: { in: batchIds } },
        select: { id: true, content: true },
      });

      if (chunks.length > 0) {
        // Generate embeddings
        const contents = chunks.map(chunk => chunk.content);
        const embeddings = await embedTexts(contents);

        // Update chunks with embeddings using raw SQL
        for (let j = 0; j < chunks.length; j++) {
          await prisma.$executeRaw`
            UPDATE "CodeChunk" 
            SET embedding = ${`[${embeddings[j].join(',')}]`}::vector 
            WHERE id = ${chunks[j].id}
          `;
        }

        embeddingsGenerated += embeddings.length;
      }

      batchesProcessed++;
    }

    progress(100);

    const endTime = new Date();

    return {
      success: true,
      message: `Generated ${embeddingsGenerated} embeddings in ${batchesProcessed} batches`,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      embeddingsGenerated,
      batchesProcessed,
      metadata: {
        batchSize,
        totalBatches,
        projectId: data.projectId,
      },
    };

  } catch (error) {
    const endTime = new Date();
    logger.error('Embedding generation failed', { projectId: data.projectId }, error as Error);
    
    return {
      success: false,
      message: `Embedding generation failed: ${error}`,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      embeddingsGenerated,
      batchesProcessed,
    };
  }
}

// Stub function for fetching repository files
async function fetchRepositoryFiles(
  githubUrl: string,
  options?: {
    includePatterns?: string[];
    excludePatterns?: string[];
  }
): Promise<Array<{ path: string; content: string }>> {
  // This is a stub implementation
  // In a real implementation, you would:
  // 1. Parse the GitHub URL
  // 2. Use GitHub API to fetch repository contents
  // 3. Filter files based on patterns
  // 4. Return file contents
  
  logger.info('Fetching repository files (stub)', { githubUrl, options });
  
  // Return stub data for demo
  return [
    {
      path: 'src/index.ts',
      content: 'console.log("Hello, World!");',
    },
    {
      path: 'README.md',
      content: '# Project Title\n\nThis is a sample project.',
    },
  ];
}

// Register all processors
export function initializeJobProcessors(): void {
  jobQueue.registerProcessor(JobType.INDEX_PROJECT, indexProjectProcessor);
  jobQueue.registerProcessor(JobType.REINDEX_PROJECT, reindexProjectProcessor);
  jobQueue.registerProcessor(JobType.CLEANUP_CHUNKS, cleanupChunksProcessor);
  jobQueue.registerProcessor(JobType.OPTIMIZE_DATABASE, optimizeDatabaseProcessor);
  jobQueue.registerProcessor(JobType.GENERATE_EMBEDDINGS, generateEmbeddingsProcessor);
  
  logger.info('All job processors initialized');
}

// Import jobUtils from job-queue to avoid circular dependency issues
import { jobUtils } from './job-queue';

export {
  indexProjectProcessor,
  reindexProjectProcessor,
  cleanupChunksProcessor,
  optimizeDatabaseProcessor,
  generateEmbeddingsProcessor,
};