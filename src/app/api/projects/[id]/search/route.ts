import { NextRequest, NextResponse } from "next/server";
import { embedTexts } from "@/lib/embeddings";
import { retrieveRelevantChunksPaginated } from "@/lib/db-utils";
import { 
  SearchQuerySchema,
  SearchResponse,
  PerformanceMetrics,
} from "../../../../../types/pagination";
import { createApiError } from "../../../../../types";
import { logger, withRequestTiming, createPerformanceTimer, endPerformanceTimer } from '../../../../lib/logger';
import { ZodError } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<SearchResponse | ReturnType<typeof createApiError>>> {
  return withRequestTiming('GET', '/api/projects/[id]/search', async () => {
    const totalTimer = createPerformanceTimer('total_search_time');
    
    try {
      const { id: projectId } = await params;
      const { searchParams } = new URL(request.url);
      
      // Parse and validate query parameters
      const queryParams = Object.fromEntries(searchParams.entries());
      const { 
        q: query, 
        limit, 
        offset, 
        cursor,
        languages,
        paths,
        minSimilarity 
      } = SearchQuerySchema.parse(queryParams);

      logger.info('Search request received', {
        projectId,
        query: query?.substring(0, 100),
        limit,
        offset,
        languages,
        paths,
        minSimilarity,
      });

      if (!query) {
        throw createApiError("Query parameter 'q' is required", "VALIDATION_ERROR");
      }

      // Generate embeddings for the query
      const embeddingTimer = createPerformanceTimer('embedding_generation');
      const [queryEmbedding] = await embedTexts([query]);
      const embeddingTime = endPerformanceTimer(embeddingTimer);

      // Search for relevant chunks with pagination
      const searchTimer = createPerformanceTimer('vector_search');
      const result = await retrieveRelevantChunksPaginated(
        projectId,
        queryEmbedding,
        {
          limit,
          offset,
          cursor,
          minSimilarity,
          languages,
          paths,
        }
      );
      const searchTime = endPerformanceTimer(searchTimer);

      const totalTime = endPerformanceTimer(totalTimer);

      const metrics: PerformanceMetrics = {
        queryTime: embeddingTime,
        processingTime: searchTime,
        totalTime,
      };

      const response: SearchResponse = {
        chunks: result.chunks,
        metrics,
        pagination: {
          limit,
          offset: offset || 0,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        },
      };

      logger.info('Search completed successfully', {
        projectId,
        resultsCount: result.chunks.length,
        metrics,
      });

      return NextResponse.json(response);

    } catch (error) {
      endPerformanceTimer(totalTimer);
      logger.error('Search request failed', {}, error as Error);

      if (error instanceof ZodError) {
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
        createApiError("Search request failed", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}