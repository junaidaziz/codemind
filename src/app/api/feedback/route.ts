// API route for agent feedback submission - /api/feedback
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { 
  createApiError,
  createApiSuccess
} from '../../../types';
import { 
  SubmitFeedbackSchema,
  type SubmitFeedbackRequest,
} from '../../../types/feedback';
import { z } from 'zod';

// GET /api/feedback - Get feedback stored in message metadata (temporary until migration)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');
    const sessionId = url.searchParams.get('sessionId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    if (!projectId) {
      return NextResponse.json(
        createApiError('Project ID is required', 'VALIDATION_ERROR'),
        { status: 400 }
      );
    }

    // Build where clause for messages
    const whereClause: Record<string, unknown> = {
      session: { projectId },
      role: 'assistant', // Only get assistant messages that could have feedback
    };
    
    if (sessionId) {
      whereClause.sessionId = sessionId;
    }

    const offset = (page - 1) * limit;

    // Get messages that might have feedback in metadata
    const [messages, totalCount] = await Promise.all([
      prisma.message.findMany({
        where: whereClause,
        include: {
          session: {
            include: {
              user: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.message.count({ where: whereClause }),
    ]);

    // Extract feedback from messages (stored as JSON in a hypothetical feedback field)
    // For now, return mock data structure
    const feedbacks = messages.map(message => ({
      id: `feedback_${message.id}`,
      messageId: message.id,
      sessionId: message.sessionId,
      projectId,
      userId: message.session.user.id,
      rating: 0, // Default - no feedback yet
      comment: null,
      createdAt: message.createdAt,
      user: message.session.user,
      message: {
        id: message.id,
        content: message.content,
        role: message.role,
        createdAt: message.createdAt,
      },
    }));

    return NextResponse.json(createApiSuccess({
      feedbacks,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalFeedbacks: 0,
        averageRating: 0,
        ratingDistribution: {},
        categoryAverages: {},
        recentTrend: 'stable',
        topIssues: [],
        responseTimeStats: {
          average: 0,
          median: 0,
          fastest: 0,
          slowest: 0,
        },
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

// POST /api/feedback - Submit new feedback (temporary storage until migration)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const feedbackData = SubmitFeedbackSchema.parse(body);
    
    // Verify that the message exists
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

    // For now, store feedback data in a simple JSON format in session metadata
    // TODO: Replace with proper database storage after migration
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Log the feedback for now (in production, this would be stored in the database)
    console.log('Feedback submitted:', {
      feedbackId,
      messageId: feedbackData.messageId,
      sessionId: feedbackData.sessionId,
      projectId: feedbackData.projectId,
      feedbackType: feedbackData.feedbackType,
      rating: feedbackData.rating,
      comment: feedbackData.comment,
      category: feedbackData.category,
      responseTime: feedbackData.responseTime,
      contextData: feedbackData.contextData,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(createApiSuccess({
      feedbackId,
      message: 'Feedback submitted successfully (stored temporarily)',
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