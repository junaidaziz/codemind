import { NextRequest, NextResponse } from "next/server";
import { z } from 'zod';
import { 
  AnalyticsQuerySchema,
  AnalyticsResponse,
  MetricType,
  TimePeriod,
} from "../../../types/analytics";
import { analyticsService } from "../../../lib/analytics";
import { createApiError } from "../../../types";
import { logger, withRequestTiming, createPerformanceTimer, endPerformanceTimer } from '../../lib/logger';

// GET /api/analytics - Get analytics data
export async function GET(request: NextRequest): Promise<NextResponse> {
  return withRequestTiming('GET', '/api/analytics', async () => {
    const totalTimer = createPerformanceTimer('total_analytics_time');
    
    try {
      const { searchParams } = new URL(request.url);
      const queryParams = Object.fromEntries(searchParams.entries());
      
      // Parse and validate query parameters
      const { 
        granularity,
        metrics,
        startDate, 
        endDate, 
        projectId, 
        userId
      } = AnalyticsQuerySchema.parse(queryParams);

      logger.info('Analytics request received', {
        granularity,
        metrics,
        startDate,
        endDate,
        projectId,
        userId,
      });

      // Parse dates if provided
      const parsedStartDate = startDate ? new Date(startDate) : undefined;
      const parsedEndDate = endDate ? new Date(endDate) : undefined;

      // For now, use the first metric and map granularity to period
      const metric = MetricType.USER_ACTIVITY; // Default metric
      const period = granularity === 'hour' ? TimePeriod.HOUR : 
                    granularity === 'day' ? TimePeriod.DAY : 
                    TimePeriod.MONTH;

      // Fetch analytics data
      const analyticsTimer = createPerformanceTimer('analytics_data_fetch');
      const data = await analyticsService.getAnalyticsData(
        metric,
        period,
        parsedStartDate,
        parsedEndDate,
        projectId,
        userId
      );
      const analyticsTime = endPerformanceTimer(analyticsTimer);

      const totalTime = endPerformanceTimer(totalTimer);

      const response: AnalyticsResponse = {
        success: true,
        data,
        metadata: {
          query: {
            metric,
            period,
            startDate: parsedStartDate?.toISOString(),
            endDate: parsedEndDate?.toISOString(),
          },
          processingTime: analyticsTime,
          dataPoints: data.data.length,
          cacheHit: false, // Would be true if data came from cache
        },
      };

      logger.info('Analytics request completed', {
        metric,
        dataPoints: data.data.length,
        processingTime: totalTime,
      });

      return NextResponse.json(response);

    } catch (error) {
      endPerformanceTimer(totalTimer);
      logger.error('Analytics request failed', {}, error as Error);

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
        createApiError("Analytics request failed", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}

// POST /api/analytics - Track analytics event
export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRequestTiming('POST', '/api/analytics', async () => {
    try {
      const body = await request.json();
      
      // Validate event data
      const EventSchema = z.object({
        type: z.enum(['user_action', 'api_request', 'system_metric']),
        userId: z.string().optional(),
        projectId: z.string().optional(),
        action: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        duration: z.number().optional(),
      });

      const eventData = EventSchema.parse(body);

      logger.debug('Analytics event received', {
        type: eventData.type,
        userId: eventData.userId,
        projectId: eventData.projectId,
        action: eventData.action,
      });

      // Track the event based on type
      switch (eventData.type) {
        case 'user_action':
          if (eventData.userId && eventData.action) {
            await analyticsService.trackUserActivity(
              eventData.userId,
              eventData.action,
              eventData.projectId,
              eventData.metadata,
              eventData.duration
            );
          }
          break;
        
        case 'api_request':
          // This would typically be handled by middleware
          logger.debug('API request event tracked via explicit call');
          break;
        
        case 'system_metric':
          // This would typically be handled by system monitoring
          logger.debug('System metric event tracked via explicit call');
          break;
      }

      return NextResponse.json({
        success: true,
        message: 'Analytics event tracked successfully',
      });

    } catch (error) {
      logger.error('Failed to track analytics event', {}, error as Error);

      if (error instanceof z.ZodError) {
        const details = error.issues.reduce((acc, issue) => {
          const path = issue.path.join('.');
          if (!acc[path]) acc[path] = [];
          acc[path].push(issue.message);
          return acc;
        }, {} as Record<string, string[]>);

        return NextResponse.json(
          createApiError("Invalid event data", "VALIDATION_ERROR", details),
          { status: 400 }
        );
      }

      return NextResponse.json(
        createApiError("Failed to track analytics event", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}