import { NextRequest, NextResponse } from "next/server";
import { getProjectStats } from "../../../../lib/db-utils";
import { 
  ProjectStatsQuerySchema,
  ProjectStatsResponse,
  PerformanceMetrics,
} from "../../../../../types/pagination";
import { createApiError } from "../../../../../types";
import { logger, withRequestTiming, createPerformanceTimer, endPerformanceTimer } from '../../../../lib/logger';
import { ZodError } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ProjectStatsResponse | ReturnType<typeof createApiError>>> {
  return withRequestTiming('GET', '/api/projects/[id]/stats', async () => {
    const totalTimer = createPerformanceTimer('total_stats_time');
    
    try {
      const { id: projectId } = await params;
      const { searchParams } = new URL(request.url);
      
      // Parse and validate query parameters
      const queryParams = Object.fromEntries(searchParams.entries());
      const { includeLanguages, includeMetrics } = ProjectStatsQuerySchema.parse(queryParams);

      logger.info('Project stats request received', {
        projectId,
        includeLanguages,
        includeMetrics,
      });

      // Get project statistics
      const statsTimer = createPerformanceTimer('stats_collection');
      const stats = await getProjectStats(projectId);
      const statsTime = endPerformanceTimer(statsTimer);

      const totalTime = endPerformanceTimer(totalTimer);

      const metrics: PerformanceMetrics = {
        queryTime: 0,
        processingTime: statsTime,
        totalTime,
      };

      const response: ProjectStatsResponse = {
        projectId,
        stats,
        metrics: includeMetrics ? metrics : { queryTime: 0, processingTime: 0, totalTime: 0 },
      };

      logger.info('Project stats completed successfully', {
        projectId,
        stats: {
          totalChunks: stats.totalChunks,
          totalTokens: stats.totalTokens,
          languageCount: Object.keys(stats.languageBreakdown).length,
        },
        metrics,
      });

      return NextResponse.json(response);

    } catch (error) {
      endPerformanceTimer(totalTimer);
      logger.error('Project stats request failed', {}, error as Error);

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
        createApiError("Project stats request failed", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}