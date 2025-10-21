// Feedback Analytics API - /api/feedback/analytics
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { 
  createApiError,
  createApiSuccess
} from '../../../../types';
import { 
  GetAnalyticsQuerySchema,
  AgentFeedbackCategory,
} from '../../../../types/feedback';
import { z } from 'zod';

// GET /api/feedback/analytics - Get feedback analytics and metrics
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    
    const {
      projectId,
      userId,
      period = 'week',
      startDate,
      endDate,
      categories,
    } = GetAnalyticsQuerySchema.parse(queryParams);

    // Parse date range
    const now = new Date();
    let dateStart: Date;
    const dateEnd: Date = endDate ? new Date(endDate) : now;

    if (startDate) {
      dateStart = new Date(startDate);
    } else {
      // Default date range based on period
      switch (period) {
        case 'day':
          dateStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          dateStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          dateStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
    }

    // Build feedback query filters
    const feedbackWhere: Record<string, unknown> = {
      projectId,
      createdAt: {
        gte: dateStart,
        lte: dateEnd,
      },
    };

    if (userId) {
      feedbackWhere.userId = userId;
    }

    if (categories && categories.length > 0) {
      feedbackWhere.category = { in: categories };
    }

    // Get feedback data
    const feedbacks = await prisma.agentFeedback.findMany({
      where: feedbackWhere,
      include: {
        User: {
          select: { id: true, name: true, email: true }
        },
        Message: {
          select: { id: true, content: true, role: true, createdAt: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate metrics
    const totalFeedbacks = feedbacks.length;
    const averageRating = totalFeedbacks > 0 
      ? feedbacks.reduce((sum: number, f: typeof feedbacks[0]) => sum + f.rating, 0) / totalFeedbacks 
      : 0;

    // Rating distribution
    const ratingDistribution = feedbacks.reduce((acc: Record<number, number>, f: typeof feedbacks[0]) => {
      acc[f.rating] = (acc[f.rating] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Category averages
    const categoryGroups = feedbacks.reduce((acc: Record<AgentFeedbackCategory, number[]>, f: typeof feedbacks[0]) => {
      if (!acc[f.category]) acc[f.category] = [];
      acc[f.category].push(f.rating);
      return acc;
    }, {} as Record<AgentFeedbackCategory, number[]>);

    const categoryAverages = Object.entries(categoryGroups).reduce((acc: Record<AgentFeedbackCategory, number>, [cat, ratings]: [string, number[]]) => {
      acc[cat as AgentFeedbackCategory] = ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length;
      return acc;
    }, {} as Record<AgentFeedbackCategory, number>);

    // Feedback type distribution
    const typeDistribution = feedbacks.reduce((acc: Record<string, number>, f: typeof feedbacks[0]) => {
      acc[f.feedbackType] = (acc[f.feedbackType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Response time stats
    const responseTimes = feedbacks
      .filter((f: typeof feedbacks[0]) => f.responseTime !== null)
      .map((f: typeof feedbacks[0]) => f.responseTime!)
      .sort((a: number, b: number) => a - b);

    const responseTimeStats = {
      average: responseTimes.length > 0 ? responseTimes.reduce((sum: number, t: number) => sum + t, 0) / responseTimes.length : 0,
      median: responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length / 2)] : 0,
      fastest: responseTimes.length > 0 ? responseTimes[0] : 0,
      slowest: responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0,
    };

    // Calculate trends (compare with previous period)
    const previousPeriodStart = new Date(dateStart.getTime() - (dateEnd.getTime() - dateStart.getTime()));
    const previousPeriodEnd = dateStart;

    const previousFeedbacks = await prisma.agentFeedback.findMany({
      where: {
        ...feedbackWhere,
        createdAt: {
          gte: previousPeriodStart,
          lte: previousPeriodEnd,
        },
      },
    });

    const previousAverageRating = previousFeedbacks.length > 0 
      ? previousFeedbacks.reduce((sum: number, f: typeof previousFeedbacks[0]) => sum + f.rating, 0) / previousFeedbacks.length 
      : 0;

    const ratingTrend = averageRating - previousAverageRating;
    const volumeTrend = totalFeedbacks - previousFeedbacks.length;

    // Get feedback analytics records
    const analyticsRecords = await prisma.feedbackAnalytics.findMany({
      where: {
        projectId,
        periodStart: { gte: dateStart },
        periodEnd: { lte: dateEnd },
        ...(userId && { userId }),
      },
      orderBy: { periodStart: 'asc' },
    });

    // NPS Score calculation (ratings 4-5 are promoters, 1-2 are detractors)
    const promoters = feedbacks.filter(f => f.rating >= 4).length;
    const detractors = feedbacks.filter(f => f.rating <= 2).length;
    const npsScore = totalFeedbacks > 0 
      ? Math.round(((promoters - detractors) / totalFeedbacks) * 100)
      : 0;

    // Top issues from comments (simplified - in production would use NLP)
    const negativeComments = feedbacks
      .filter(f => f.rating <= 2 && f.comment)
      .map(f => f.comment!)
      .slice(0, 5);

    const positiveComments = feedbacks
      .filter(f => f.rating >= 4 && f.comment)
      .map(f => f.comment!)
      .slice(0, 5);

    // Trend analysis
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (ratingTrend > 0.2) trend = 'improving';
    else if (ratingTrend < -0.2) trend = 'declining';

    return NextResponse.json(createApiSuccess({
      analytics: analyticsRecords,
      metrics: {
        period,
        startDate: dateStart,
        endDate: dateEnd,
        metrics: {
          totalResponses: totalFeedbacks,
          feedbackRate: 100, // Would need total messages to calculate properly
          satisfactionScore: averageRating,
          npsScore,
          categoryScores: Object.entries(categoryAverages).reduce((acc, [cat, avg]) => {
            acc[cat as AgentFeedbackCategory] = {
              average: avg,
              count: categoryGroups[cat as AgentFeedbackCategory]?.length || 0,
              trend: 0, // Would need previous period comparison
            };
            return acc;
          }, {} as Record<AgentFeedbackCategory, { average: number; count: number; trend: number }>),
          commonFeedback: {
            positive: positiveComments,
            negative: negativeComments,
            suggestions: [], // Would extract from comments in production
          },
        },
      },
      trends: [
        {
          period: period,
          averageRating,
          totalFeedbacks,
          ratingTrend,
          volumeTrend,
        },
      ],
      summary: {
        totalFeedbacks,
        averageRating,
        ratingDistribution,
        categoryAverages,
        typeDistribution,
        recentTrend: trend,
        topIssues: negativeComments.map((comment) => ({
          category: 'OVERALL' as AgentFeedbackCategory,
          issue: comment.substring(0, 100),
          count: 1,
        })),
        responseTimeStats,
      },
    }));

  } catch (error) {
    console.error('Error fetching feedback analytics:', error);
    
    if (error instanceof z.ZodError) {
      const details = error.issues.reduce((acc, issue) => {
        const path = issue.path.join('.');
        if (!acc[path]) acc[path] = [];
        acc[path].push(issue.message);
        return acc;
      }, {} as Record<string, string[]>);
      
      return NextResponse.json(
        createApiError('Invalid analytics query parameters', 'VALIDATION_ERROR', details),
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      createApiError('Failed to fetch feedback analytics', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}