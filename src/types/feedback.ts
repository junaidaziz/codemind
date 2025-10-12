// Agent Feedback System Types for CodeMind
import { z } from 'zod';

// Enums matching Prisma schema
export const AgentFeedbackTypeSchema = z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']);
export const AgentFeedbackCategorySchema = z.enum([
  'ACCURACY',      // How accurate was the response
  'HELPFULNESS',   // How helpful was the response
  'RELEVANCE',     // How relevant was the response
  'COMPLETENESS',  // Was the response complete
  'CLARITY',       // How clear was the response
  'SPEED',         // Response speed satisfaction
  'OVERALL',       // Overall satisfaction
]);

export type AgentFeedbackType = z.infer<typeof AgentFeedbackTypeSchema>;
export type AgentFeedbackCategory = z.infer<typeof AgentFeedbackCategorySchema>;

// Feedback submission schemas
export const SubmitFeedbackSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  sessionId: z.string().min(1, 'Session ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  feedbackType: AgentFeedbackTypeSchema,
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comment: z.string().optional(),
  category: AgentFeedbackCategorySchema,
  responseTime: z.number().int().min(0).optional(), // Time in milliseconds
  contextData: z.record(z.string(), z.unknown()).optional(), // Additional context as JSON
});

export const BulkFeedbackSchema = z.object({
  feedbacks: z.array(SubmitFeedbackSchema).min(1).max(10), // Limit bulk submissions
});

export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackSchema>;
export type BulkFeedbackRequest = z.infer<typeof BulkFeedbackSchema>;

// Feedback query schemas
export const GetFeedbackQuerySchema = z.object({
  projectId: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  messageId: z.string().optional(),
  feedbackType: AgentFeedbackTypeSchema.optional(),
  category: AgentFeedbackCategorySchema.optional(),
  rating: z.number().int().min(1).max(5).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'rating', 'responseTime']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type GetFeedbackQuery = z.infer<typeof GetFeedbackQuerySchema>;

// Analytics query schemas
export const GetAnalyticsQuerySchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  userId: z.string().optional(),
  period: z.enum(['day', 'week', 'month']).default('week'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  categories: z.array(AgentFeedbackCategorySchema).optional(),
});

export type GetAnalyticsQuery = z.infer<typeof GetAnalyticsQuerySchema>;

// Response types
export interface FeedbackWithDetails {
  id: string;
  sessionId: string;
  messageId: string;
  userId: string;
  projectId: string;
  feedbackType: AgentFeedbackType;
  rating: number;
  comment?: string;
  category: AgentFeedbackCategory;
  responseTime?: number;
  contextData?: Record<string, unknown>;
  createdAt: Date;
  user: {
    id: string;
    name?: string;
    email?: string;
  };
  message: {
    id: string;
    content: string;
    role: string;
    createdAt: Date;
  };
}

export interface FeedbackAnalytics {
  id: string;
  projectId: string;
  userId?: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  totalFeedbacks: number;
  avgRating?: number;
  ratingCounts: Record<string, number>; // {"1": 2, "2": 5, ...}
  categoryBreakdown: Record<string, number>; // {"accuracy": 4.2, ...}
  topIssues?: string[]; // Most common issues from comments
  improvement?: number; // Rating improvement vs previous period
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedbackSummary {
  totalFeedbacks: number;
  averageRating: number;
  ratingDistribution: Record<number, number>; // {1: 5, 2: 10, 3: 20, 4: 30, 5: 25}
  categoryAverages: Record<AgentFeedbackCategory, number>;
  recentTrend: 'improving' | 'declining' | 'stable';
  topIssues: Array<{
    category: AgentFeedbackCategory;
    issue: string;
    count: number;
  }>;
  responseTimeStats: {
    average: number;
    median: number;
    fastest: number;
    slowest: number;
  };
}

export interface FeedbackMetrics {
  period: string;
  startDate: Date;
  endDate: Date;
  metrics: {
    totalResponses: number;
    feedbackRate: number; // Percentage of messages that received feedback
    satisfactionScore: number; // Average rating
    npsScore: number; // Net Promoter Score (0-100)
    categoryScores: Record<AgentFeedbackCategory, {
      average: number;
      count: number;
      trend: number; // Change from previous period
    }>;
    commonFeedback: {
      positive: string[];
      negative: string[];
      suggestions: string[];
    };
  };
}

// UI Component Props
export interface FeedbackFormProps {
  messageId: string;
  sessionId: string;
  projectId: string;
  onSubmit?: (feedback: SubmitFeedbackRequest) => void;
  onClose?: () => void;
  initialCategory?: AgentFeedbackCategory;
  compact?: boolean;
  showCategories?: AgentFeedbackCategory[];
}

export interface FeedbackDisplayProps {
  feedback: FeedbackWithDetails;
  showUserInfo?: boolean;
  showMessageContext?: boolean;
  compact?: boolean;
}

export interface FeedbackAnalyticsProps {
  projectId: string;
  userId?: string;
  period: 'day' | 'week' | 'month';
  showTrends?: boolean;
  showComparison?: boolean;
}

// API Response types
export interface GetFeedbackResponse {
  success: true;
  data: {
    feedbacks: FeedbackWithDetails[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    summary: FeedbackSummary;
  };
}

export interface GetAnalyticsResponse {
  success: true;
  data: {
    analytics: FeedbackAnalytics[];
    metrics: FeedbackMetrics;
    trends: Array<{
      period: string;
      averageRating: number;
      totalFeedbacks: number;
    }>;
  };
}

export interface SubmitFeedbackResponse {
  success: true;
  data: {
    feedbackId: string;
    message: string;
  };
}

// Error types
export interface FeedbackError {
  success: false;
  error: string;
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'RATE_LIMIT' | 'INTERNAL_ERROR';
  details?: Record<string, string[]>;
}

// Configuration types
export interface FeedbackConfig {
  enableRealTimeUpdates: boolean;
  showQuickFeedback: boolean; // Show thumbs up/down for quick feedback
  requireCommentForLowRating: boolean; // Require comment for ratings 1-2
  categoriesEnabled: AgentFeedbackCategory[];
  analyticsRefreshInterval: number; // Milliseconds
  maxFeedbackAge: number; // Days after which feedback collection is disabled
  ratingScale: 3 | 5 | 10; // Different rating scales
}

// Utility functions types
export type FeedbackValidator = (feedback: SubmitFeedbackRequest) => {
  isValid: boolean;
  errors: string[];
};

export type FeedbackAggregator = (
  feedbacks: FeedbackWithDetails[]
) => FeedbackSummary;

export type FeedbackAnalyzer = (
  feedbacks: FeedbackWithDetails[],
  timeframe: { start: Date; end: Date }
) => FeedbackMetrics;