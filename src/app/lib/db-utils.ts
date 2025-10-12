import { PrismaClient } from "@prisma/client";
import { logger, withDatabaseTiming } from './logger';

const prisma = new PrismaClient();

// Type definitions for enhanced database operations
export interface CodeChunkData {
  path: string;
  language: string;
  startLine: number;
  endLine: number;
  content: string;
  tokenCount: number;
  embedding: number[];
}

export interface RelevantChunk {
  id: string;
  path: string;
  language: string;
  startLine: number;
  endLine: number;
  content: string;
  similarity: number;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface SearchOptions extends PaginationOptions {
  minSimilarity?: number;
  languages?: string[];
  paths?: string[];
}

/**
 * Safely inserts code chunks and embeddings into the database using raw SQL with batch optimization.
 * Works with Supabase pgvector and Prisma 6+.
 * 
 * @param projectId - The project ID to associate chunks with
 * @param chunks - Array of code chunks with embeddings
 * @param batchSize - Maximum number of chunks to insert per batch (default: 100)
 * @returns Promise<void>
 */
export async function insertEmbeddingsBatch(
  projectId: string,
  chunks: CodeChunkData[],
  batchSize: number = 100
): Promise<void> {
  if (!chunks.length) {
    logger.debug('No chunks to insert', { projectId });
    return;
  }

  return withDatabaseTiming('insertEmbeddingsBatch', async () => {
    logger.info('Starting batch insert', { 
      projectId, 
      chunkCount: chunks.length, 
      batchSize 
    });

    // Process chunks in batches to avoid query size limits
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      await withDatabaseTiming(`insertBatch_${Math.floor(i / batchSize)}`, async () => {
        // Build parameterized SQL values
        const values: string[] = [];
        const params: unknown[] = [];

        for (const chunk of batch) {
          values.push(`(
            gen_random_uuid(),
            $${params.length + 1},  -- projectId
            $${params.length + 2},  -- path
            $${params.length + 3},  -- sha (empty for now)
            $${params.length + 4},  -- language
            $${params.length + 5},  -- startLine
            $${params.length + 6},  -- endLine
            $${params.length + 7},  -- content
            $${params.length + 8},  -- tokenCount
            $${params.length + 9}::vector, -- embedding as pgvector
            NOW()
          )`);

          params.push(
            projectId,
            chunk.path,
            "",
            chunk.language,
            chunk.startLine,
            chunk.endLine,
            chunk.content,
            chunk.tokenCount,
            `[${chunk.embedding.join(",")}]`
          );
        }

        const sql = `
          INSERT INTO "CodeChunk"
          ("id","projectId","path","sha","language","startLine","endLine","content","tokenCount","embedding","updatedAt")
          VALUES ${values.join(",")};
        `;

        await prisma.$executeRawUnsafe(sql, ...params);
        
        logger.debug('Batch inserted successfully', { 
          projectId, 
          batchIndex: Math.floor(i / batchSize),
          batchSize: batch.length 
        });
      });
    }

    logger.info('Batch insert completed', { 
      projectId, 
      totalChunks: chunks.length 
    });
  });
}

/**
 * Retrieves relevant code chunks for a given project and query using vector similarity.
 * Uses cosine similarity with pgvector to find the most relevant chunks.
 * 
 * @param projectId - The project ID to search within
 * @param queryEmbedding - The embedding vector for the query
 * @param options - Search and pagination options
 * @returns Promise<RelevantChunk[]>
 */
export async function retrieveRelevantChunks(
  projectId: string,
  queryEmbedding: number[],
  options: SearchOptions = {}
): Promise<RelevantChunk[]> {
  const {
    limit = 10,
    offset = 0,
    minSimilarity = 0.1,
    languages,
    paths
  } = options;

  return withDatabaseTiming('retrieveRelevantChunks', async () => {
    logger.debug('Retrieving relevant chunks', {
      projectId,
      limit,
      offset,
      minSimilarity,
      embeddingLength: queryEmbedding.length,
    });

    // Build dynamic WHERE clause
    const conditions: string[] = [`"projectId" = $1`];
    const params: unknown[] = [projectId, `[${queryEmbedding.join(",")}]`];
    let paramIndex = 3;

    // Add similarity threshold
    conditions.push(`1 - ("embedding" <=> $2::vector) >= $${paramIndex}`);
    params.push(minSimilarity);
    paramIndex++;

    // Add language filter
    if (languages && languages.length > 0) {
      conditions.push(`"language" = ANY($${paramIndex})`);
      params.push(languages);
      paramIndex++;
    }

    // Add path filter (prefix matching)
    if (paths && paths.length > 0) {
      const pathConditions = paths.map(() => {
        const condition = `"path" LIKE $${paramIndex}`;
        params.push(`%${paths[paths.indexOf(paths[paramIndex - params.length - 1])]}%`);
        paramIndex++;
        return condition;
      });
      conditions.push(`(${pathConditions.join(' OR ')})`);
    }

    const sql = `
      SELECT 
        "id",
        "path",
        "language",
        "startLine",
        "endLine",
        "content",
        1 - ("embedding" <=> $2::vector) as similarity
      FROM "CodeChunk"
      WHERE ${conditions.join(' AND ')}
      ORDER BY "embedding" <=> $2::vector
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    params.push(limit, offset);

    const result = await prisma.$queryRawUnsafe(sql, ...params) as RelevantChunk[];

    logger.debug('Retrieved chunks', {
      projectId,
      resultCount: result.length,
      limit,
      offset,
    });

    return result;
  });
}

/**
 * Enhanced version with cursor-based pagination for better performance
 */
export async function retrieveRelevantChunksPaginated(
  projectId: string,
  queryEmbedding: number[],
  options: SearchOptions & { cursor?: string } = {}
): Promise<{
  chunks: RelevantChunk[];
  nextCursor?: string;
  hasMore: boolean;
}> {
  const { limit = 10, cursor } = options;
  
  return withDatabaseTiming('retrieveRelevantChunksPaginated', async () => {
    const chunks = await retrieveRelevantChunks(projectId, queryEmbedding, {
      ...options,
      limit: limit + 1, // Get one extra to check if there are more
      offset: cursor ? parseInt(cursor, 10) : 0,
    });

    const hasMore = chunks.length > limit;
    const results = hasMore ? chunks.slice(0, limit) : chunks;
    const nextCursor = hasMore ? 
      ((cursor ? parseInt(cursor, 10) : 0) + limit).toString() : 
      undefined;

    return {
      chunks: results,
      nextCursor,
      hasMore,
    };
  });
}

/**
 * Batch delete code chunks for a project (useful for reindexing)
 */
export async function deleteProjectChunks(projectId: string): Promise<number> {
  return withDatabaseTiming('deleteProjectChunks', async () => {
    logger.info('Deleting project chunks', { projectId });
    
    const result = await prisma.codeChunk.deleteMany({
      where: { projectId },
    });

    logger.info('Project chunks deleted', { 
      projectId, 
      deletedCount: result.count 
    });

    return result.count;
  });
}

/**
 * Get project statistics for performance monitoring
 */
export async function getProjectStats(projectId: string): Promise<{
  totalChunks: number;
  totalTokens: number;
  languageBreakdown: Record<string, number>;
  avgSimilarityScore?: number;
}> {
  return withDatabaseTiming('getProjectStats', async () => {
    const [totalStats, languageStats] = await Promise.all([
      // Get total chunks and tokens
      prisma.codeChunk.aggregate({
        where: { projectId },
        _count: { id: true },
        _sum: { tokenCount: true },
      }),
      
      // Get language breakdown
      prisma.codeChunk.groupBy({
        by: ['language'],
        where: { projectId },
        _count: { id: true },
      }),
    ]);

    const languageBreakdown = languageStats.reduce((acc: Record<string, number>, stat) => {
      acc[stat.language] = stat._count.id;
      return acc;
    }, {} as Record<string, number>);

    const stats = {
      totalChunks: totalStats._count.id || 0,
      totalTokens: totalStats._sum.tokenCount || 0,
      languageBreakdown,
    };

    logger.debug('Project stats retrieved', { projectId, stats });

    return stats;
  });
}

/**
 * Optimize database performance by running VACUUM and ANALYZE
 */
export async function optimizeDatabaseTables(): Promise<void> {
  return withDatabaseTiming('optimizeDatabaseTables', async () => {
    logger.info('Starting database optimization');
    
    try {
      // Note: These operations may require elevated privileges
      await prisma.$executeRaw`VACUUM ANALYZE "CodeChunk";`;
      await prisma.$executeRaw`VACUUM ANALYZE "Project";`;
      await prisma.$executeRaw`VACUUM ANALYZE "ChatSession";`;
      
      logger.info('Database optimization completed');
    } catch (error) {
      logger.warn('Database optimization failed', {}, error as Error);
      // Don't throw - optimization is nice-to-have
    }
  });
}

/**
 * Create database indices for better query performance
 */
export async function ensureOptimalIndices(): Promise<void> {
  return withDatabaseTiming('ensureOptimalIndices', async () => {
    logger.info('Ensuring optimal database indices');
    
    try {
      // Index for project-based queries
      await prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_codechunk_project_similarity" 
        ON "CodeChunk" USING ivfflat ("embedding" vector_cosine_ops) 
        WHERE "projectId" IS NOT NULL;
      `;
      
      // Index for language-based filtering
      await prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_codechunk_language" 
        ON "CodeChunk" ("projectId", "language");
      `;
      
      // Index for path-based filtering
      await prisma.$executeRaw`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_codechunk_path" 
        ON "CodeChunk" ("projectId", "path");
      `;
      
      logger.info('Database indices ensured');
    } catch (error) {
      logger.warn('Index creation failed', {}, error as Error);
      // Don't throw - indices might already exist
    }
  });
}
