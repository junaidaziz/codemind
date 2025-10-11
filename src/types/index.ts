// Export all type definitions from a single entry point
// Core type definitions
export * from './auth';
export * from './api';
export * from './models';
export * from './analytics';

// Export pagination separately to avoid conflicts
export type { 
  PaginationQuery,
  SearchQuery,
  ProjectStatsQuery,
  SearchResponse,
  ProjectStatsResponse,
  PerformanceMetrics,
} from './pagination';

// Export type guards and validation helpers
export {
  isApiError,
  isApiSuccess,
  createApiError,
  createApiSuccess,
} from './api';

// Export common type predicates
export const isValidRole = (role: string): role is 'admin' | 'user' => {
  return role === 'admin' || role === 'user';
};

export const isValidProjectStatus = (status: string): status is 'created' | 'indexing' | 'active' | 'failed' | 'archived' => {
  return ['created', 'indexing', 'active', 'failed', 'archived'].includes(status);
};

// Utility type definitions for external usage
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Timestamp = string; // ISO 8601 timestamp
export type UUID = string; // UUID v4 format

// Version information for SDK compatibility
export const VERSION = '1.0.0';
export const API_VERSION = 'v1';

// Common constants for external usage
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_TIMEOUT = 30000; // 30 seconds