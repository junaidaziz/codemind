import { z } from 'zod';

// Generic API Response Types
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, string[]>;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// Common response schemas
export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.string(), z.array(z.string())).optional(),
});

export const ApiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
  });

// Pagination Types
export const PaginationParamsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(10),
  offset: z.coerce.number().min(0).default(0),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error helper functions
export function createApiError(
  error: string,
  code?: string,
  details?: Record<string, string[]>
): ApiError {
  return {
    success: false,
    error,
    code,
    details,
  };
}

export function createApiSuccess<T>(
  data: T,
  message?: string
): ApiSuccess<T> {
  return {
    success: true,
    data,
    message,
  };
}

// Type guards
export function isApiError(response: ApiResponse): response is ApiError {
  return !response.success;
}

export function isApiSuccess<T>(
  response: ApiResponse<T>
): response is ApiSuccess<T> {
  return response.success;
}