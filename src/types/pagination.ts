import { z } from 'zod';

// Pagination schemas
export const PaginationQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(1).max(100)).optional().default(10),
  offset: z.string().transform(val => parseInt(val, 10)).pipe(z.number().int().min(0)).optional().default(0),
  cursor: z.string().optional(),
});

export const SearchQuerySchema = PaginationQuerySchema.extend({
  q: z.string().min(1).max(500).optional(),
  languages: z.string().transform(val => val.split(',').filter(Boolean)).optional(),
  paths: z.string().transform(val => val.split(',').filter(Boolean)).optional(),
  minSimilarity: z.string().transform(val => parseFloat(val)).pipe(z.number().min(0).max(1)).optional().default(0.1),
});

export const ProjectStatsQuerySchema = z.object({
  includeLanguages: z.string().transform(val => val === 'true').optional().default(true),
  includeMetrics: z.string().transform(val => val === 'true').optional().default(true),
});

// Response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total?: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface PerformanceMetrics {
  queryTime: number;
  processingTime: number;
  totalTime: number;
  cacheHit?: boolean;
}

export interface SearchResponse {
  chunks: Array<{
    id: string;
    path: string;
    language: string;
    startLine: number;
    endLine: number;
    content: string;
    similarity: number;
  }>;
  metrics: PerformanceMetrics;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface ProjectStatsResponse {
  projectId: string;
  stats: {
    totalChunks: number;
    totalTokens: number;
    languageBreakdown: Record<string, number>;
    avgSimilarityScore?: number;
  };
  metrics: PerformanceMetrics;
}

// Infer types from schemas
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type ProjectStatsQuery = z.infer<typeof ProjectStatsQuerySchema>;

const schemas = {
  PaginationQuerySchema,
  SearchQuerySchema,
  ProjectStatsQuerySchema,
};

export default schemas;