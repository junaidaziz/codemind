// API route for agent feedback submission - /api/feedback
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { 
  createApiError,
  createApiSuccess
} from '../../../types';
import { 
  SubmitFeedbackSchema,
} from '../../../types/feedback';
import { z } from 'zod';

// GET /api/feedback - Get feedback with proper database queries
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const sessionId = url.searchParams.get('sessionId');
    const messageId = url.searchParams.get('messageId');
    const userId = url.searchParams.get('userId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    if (!projectId) {
      return NextResponse.json(
        createApiError('Project ID is required', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    // Build where clause for feedback
    const whereClause: Record<string, unknown> = {
      projectId,
    };
    
    if (sessionId) {
      whereClause.sessionId = sessionId;
    }
    
    if (messageId) {
      whereClause.messageId = messageId;
    }
    
    if (userId) {
      whereClause.userId = userId;
    }

    const offset = (page - 1) * limit;

    // Get feedback from AgentFeedback table
    const [feedbacks, totalCount] = await Promise.all([
      prisma.agentFeedback.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, name: true, email: true }
          },
          message: {
            select: { 
              id: true, 
              content: true, 
              role: true, 
              createdAt: true 
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.agentFeedback.count({ where: whereClause }),
    ]);

    // Calculate summary statistics
    const allProjectFeedback = await prisma.agentFeedback.findMany({
      where: { projectId },
      select: { rating: true, category: true, feedbackType: true, responseTime: true }
    });

    const totalFeedbacks = allProjectFeedback.length;
    const averageRating = totalFeedbacks > 0 
      ? allProjectFeedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedbacks 
      : 0;

    // Rating distribution
    const ratingDistribution = allProjectFeedback.reduce((acc, f) => {
      acc[f.rating] = (acc[f.rating] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Category averages
    const categoryGroups = allProjectFeedback.reduce((acc, f) => {
      if (!acc[f.category]) acc[f.category] = [];
      acc[f.category].push(f.rating);
      return acc;
    }, {} as Record<string, number[]>);

    const categoryAverages = Object.entries(categoryGroups).reduce((acc, [cat, ratings]) => {
      acc[cat] = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      return acc;
    }, {} as Record<string, number>);

    // Response time stats
    const responseTimes = allProjectFeedback
      .filter(f => f.responseTime !== null)
      .map(f => f.responseTime!) 
      .sort((a, b) => a - b);

    const responseTimeStats = {
      average: responseTimes.length > 0 ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length : 0,
      median: responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length / 2)] : 0,
      fastest: responseTimes.length > 0 ? responseTimes[0] : 0,
      slowest: responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0,
    };

    return NextResponse.json(createApiSuccess({
      feedbacks: feedbacks.map(feedback => ({
        id: feedback.id,
        messageId: feedback.messageId,
        sessionId: feedback.sessionId,
        projectId: feedback.projectId,
        userId: feedback.userId,
        feedbackType: feedback.feedbackType,
        rating: feedback.rating,
        comment: feedback.comment,
        category: feedback.category,
        responseTime: feedback.responseTime,
        contextData: feedback.contextData ? JSON.parse(JSON.stringify(feedback.contextData)) : null,
        createdAt: feedback.createdAt,
        user: feedback.user,
        message: feedback.message,
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalFeedbacks,
        averageRating,
        ratingDistribution,
        categoryAverages,
        recentTrend: 'stable' as const,
        topIssues: [],
        responseTimeStats,
      },
    }));

  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      createApiError('Failed to fetch feedback', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}

// POST /api/feedback - Submit new feedback with proper database storage
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const feedbackData = SubmitFeedbackSchema.parse(body);
    
    // Verify that the message exists and get user info
    const message = await prisma.message.findUnique({
      where: { id: feedbackData.messageId },
      include: {
        session: {
          include: {
            project: true,
            user: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json(
        createApiError('Message not found', 'NOT_FOUND'),
        { status: 404 }
      );
    }

    if (message.session.projectId !== feedbackData.projectId) {
      return NextResponse.json(
        createApiError('Project ID mismatch', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    // Check if feedback already exists for this message
    const existingFeedback = await prisma.agentFeedback.findFirst({
      where: {
        messageId: feedbackData.messageId,
        userId: message.session.userId,
      },
    });

    let feedback;

    if (existingFeedback) {
      // Update existing feedback
      feedback = await prisma.agentFeedback.update({
        where: { id: existingFeedback.id },
        data: {
          feedbackType: feedbackData.feedbackType,
          rating: feedbackData.rating,
          comment: feedbackData.comment,
          category: feedbackData.category,
          responseTime: feedbackData.responseTime,
          contextData: feedbackData.contextData ? JSON.parse(JSON.stringify(feedbackData.contextData)) : null,
        },
      });
    } else {
      // Create new feedback
      feedback = await prisma.agentFeedback.create({
        data: {
          messageId: feedbackData.messageId,
          sessionId: feedbackData.sessionId,
          projectId: feedbackData.projectId,
          userId: message.session.userId,
          feedbackType: feedbackData.feedbackType,
          rating: feedbackData.rating,
          comment: feedbackData.comment,
          category: feedbackData.category,
          responseTime: feedbackData.responseTime,
          contextData: feedbackData.contextData ? JSON.parse(JSON.stringify(feedbackData.contextData)) : null,
        },
      });
    }

    // Update or create analytics record for this feedback
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 1);

    // Check if analytics record exists for today
    const analyticsRecord = await prisma.feedbackAnalytics.findFirst({
      where: {
        projectId: feedbackData.projectId,
        userId: message.session.userId,
        period: 'day',
        periodStart: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
    });

    if (analyticsRecord) {
      // Update existing analytics
      const allTodayFeedbacks = await prisma.agentFeedback.findMany({
        where: {
          projectId: feedbackData.projectId,
          userId: message.session.userId,
          createdAt: {
            gte: periodStart,
            lt: periodEnd,
          },
        },
        select: { rating: true, category: true },
      });

      const avgRating = allTodayFeedbacks.length > 0
        ? allTodayFeedbacks.reduce((sum: number, f: typeof allTodayFeedbacks[0]) => sum + f.rating, 0) / allTodayFeedbacks.length
        : 0;

      const ratingCounts = allTodayFeedbacks.reduce((acc: Record<string, number>, f: typeof allTodayFeedbacks[0]) => {
        acc[f.rating.toString()] = (acc[f.rating.toString()] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const categoryBreakdown = allTodayFeedbacks.reduce((acc: Record<string, number>, f: typeof allTodayFeedbacks[0]) => {
        if (!acc[f.category]) {
          acc[f.category] = allTodayFeedbacks
            .filter((fb: typeof allTodayFeedbacks[0]) => fb.category === f.category)
            .reduce((sum: number, fb: typeof allTodayFeedbacks[0]) => sum + fb.rating, 0) / 
            allTodayFeedbacks.filter((fb: typeof allTodayFeedbacks[0]) => fb.category === f.category).length;
        }
        return acc;
      }, {} as Record<string, number>);

      await prisma.feedbackAnalytics.update({
        where: { id: analyticsRecord.id },
        data: {
          totalFeedbacks: allTodayFeedbacks.length,
          avgRating,
          ratingCounts: JSON.parse(JSON.stringify(ratingCounts)),
          categoryBreakdown: JSON.parse(JSON.stringify(categoryBreakdown)),
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new analytics record
      await prisma.feedbackAnalytics.create({
        data: {
          projectId: feedbackData.projectId,
          userId: message.session.userId,
          period: 'day',
          periodStart,
          periodEnd,
          totalFeedbacks: 1,
          avgRating: feedbackData.rating,
          ratingCounts: JSON.parse(JSON.stringify({ [feedbackData.rating.toString()]: 1 })),
          categoryBreakdown: JSON.parse(JSON.stringify({ [feedbackData.category]: feedbackData.rating })),
        },
      });
    }

    return NextResponse.json(createApiSuccess({
      feedbackId: feedback.id,
      message: existingFeedback 
        ? 'Feedback updated successfully' 
        : 'Feedback submitted successfully',
    }));

  } catch (error) {
    console.error('Error submitting feedback:', error);
    
    if (error instanceof z.ZodError) {
      const details = error.issues.reduce((acc, issue) => {
        const path = issue.path.join('.');
        if (!acc[path]) acc[path] = [];
        acc[path].push(issue.message);
        return acc;
      }, {} as Record<string, string[]>);
      
      return NextResponse.json(
        createApiError('Invalid feedback data', 'VALIDATION_ERROR', details),
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      createApiError('Failed to submit feedback', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}