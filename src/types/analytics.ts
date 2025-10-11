// Analytics and Usage Dashboard Types for CodeMind
import { z } from 'zod';

// Time period options for analytics queries
export enum TimePeriod {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
}

// Metric types for analytics
export enum MetricType {
  USER_ACTIVITY = 'user_activity',
  PROJECT_USAGE = 'project_usage',
  CHAT_SESSIONS = 'chat_sessions',
  API_REQUESTS = 'api_requests',
  INDEXING_JOBS = 'indexing_jobs',
  SYSTEM_PERFORMANCE = 'system_performance',
}

// Analytics query schema
export const AnalyticsQuerySchema = z.object({
  metric: z.nativeEnum(MetricType),
  period: z.nativeEnum(TimePeriod).default(TimePeriod.DAY),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  projectId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1).max(1000)).optional().default(100),
  groupBy: z.string().optional(),
});

// User activity metrics
export interface UserActivityMetric {
  timestamp: Date;
  userId: string;
  action: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  duration?: number; // in milliseconds
  success: boolean;
}

// Project usage metrics
export interface ProjectUsageMetric {
  projectId: string;
  projectName: string;
  totalSessions: number;
  totalQueries: number;
  totalUsers: number;
  avgSessionDuration: number;
  lastActivity: Date;
  indexingStatus: 'pending' | 'running' | 'completed' | 'failed';
  chunksCount: number;
  tokensCount: number;
}

// Chat session metrics
export interface ChatSessionMetric {
  sessionId: string;
  projectId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  messageCount: number;
  avgResponseTime: number;
  satisfaction?: number; // 1-5 rating
  topics: string[];
}

// API request metrics
export interface ApiRequestMetric {
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userId?: string;
  projectId?: string;
  errorType?: string;
  userAgent?: string;
}

// Indexing job metrics
export interface IndexingJobMetric {
  jobId: string;
  projectId: string;
  type: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  filesProcessed?: number;
  chunksCreated?: number;
  errorCount?: number;
}

// System performance metrics
export interface SystemPerformanceMetric {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  databaseConnections: number;
  queueSize: number;
  activeUsers: number;
  requestsPerMinute: number;
}

// Aggregated analytics data
export interface AnalyticsData {
  metric: MetricType;
  period: TimePeriod;
  data: Array<{
    timestamp: Date;
    value: number;
    label?: string;
    metadata?: Record<string, unknown>;
  }>;
  summary: {
    total: number;
    average: number;
    max: number;
    min: number;
    change: number; // percentage change from previous period
    trend: 'up' | 'down' | 'stable';
  };
}

// Dashboard overview data
export interface DashboardOverview {
  totalUsers: number;
  activeUsers: number;
  totalProjects: number;
  activeProjects: number;
  totalSessions: number;
  totalQueries: number;
  avgResponseTime: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  uptime: number; // percentage
  lastUpdated: Date;
}

// Chart data types for visualization
export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
  category?: string;
}

export interface PieChartData {
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

export interface BarChartData {
  category: string;
  value: number;
  comparison?: number;
  change?: number;
}

// Analytics response types
export interface AnalyticsResponse {
  success: boolean;
  data: AnalyticsData;
  metadata: {
    query: {
      metric: MetricType;
      period: TimePeriod;
      startDate?: string;
      endDate?: string;
    };
    processingTime: number;
    dataPoints: number;
    cacheHit?: boolean;
  };
}

export interface DashboardResponse {
  overview: DashboardOverview;
  charts: {
    userActivity: ChartDataPoint[];
    projectUsage: PieChartData[];
    apiRequests: BarChartData[];
    performance: ChartDataPoint[];
  };
  trends: {
    users: { current: number; change: number };
    projects: { current: number; change: number };
    sessions: { current: number; change: number };
    errors: { current: number; change: number };
  };
  alerts: Array<{
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: Date;
  }>;
}

// Real-time analytics event types
export interface AnalyticsEvent {
  type: 'user_action' | 'api_request' | 'system_metric' | 'error';
  timestamp: Date;
  data: UserActivityMetric | ApiRequestMetric | SystemPerformanceMetric | { error: string; context?: Record<string, unknown> };
}

// Analytics configuration
export interface AnalyticsConfig {
  enableRealTime: boolean;
  retentionDays: number;
  aggregationIntervals: TimePeriod[];
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    memoryUsage: number;
    diskUsage: number;
  };
}

// Export types for analytics query
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

// Default analytics configuration
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  enableRealTime: true,
  retentionDays: 90,
  aggregationIntervals: [TimePeriod.HOUR, TimePeriod.DAY, TimePeriod.WEEK],
  alertThresholds: {
    errorRate: 5, // 5%
    responseTime: 2000, // 2 seconds
    memoryUsage: 80, // 80%
    diskUsage: 85, // 85%
  },
};

const analyticsSchemas = {
  AnalyticsQuerySchema,
  DEFAULT_ANALYTICS_CONFIG,
};

export default analyticsSchemas;