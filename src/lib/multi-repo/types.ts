/**
 * Multi-Repo Workspace Types
 * 
 * Type definitions for multi-repository workspace management.
 * 
 * @module multi-repo/types
 */

/**
 * Repository information
 */
export interface Repository {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  defaultBranch: string;
  isPrivate: boolean;
  language?: string;
  topics?: string[];
  stars: number;
  forks: number;
  openIssues: number;
  createdAt: Date;
  updatedAt: Date;
  lastPushedAt?: Date;
}

/**
 * Workspace configuration
 */
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  organizationId?: string;
  repositories: string[]; // Repository IDs
  createdAt: Date;
  updatedAt: Date;
  settings: WorkspaceSettings;
}

/**
 * Workspace settings
 */
export interface WorkspaceSettings {
  autoSync: boolean;
  syncInterval?: number; // minutes
  defaultBranch?: string;
  includePrivate: boolean;
  includeForks: boolean;
  includeArchived: boolean;
  filters?: {
    languages?: string[];
    topics?: string[];
    minStars?: number;
  };
}

/**
 * Organization information
 */
export interface Organization {
  id: string;
  login: string;
  name?: string;
  description?: string;
  url: string;
  avatarUrl?: string;
  publicRepos: number;
  privateRepos?: number;
  members?: number;
  createdAt: Date;
  type: 'organization' | 'user';
}

/**
 * Repository dependency
 */
export interface RepositoryDependency {
  sourceRepo: string; // Repository ID
  targetRepo: string; // Repository ID
  type: 'npm' | 'git' | 'import' | 'reference' | 'unknown';
  confidence: number; // 0.0 to 1.0
  details?: {
    packageName?: string;
    version?: string;
    filePath?: string;
    lineNumber?: number;
  };
}

/**
 * Cross-repo reference
 */
export interface CrossRepoReference {
  id: string;
  sourceRepo: string;
  targetRepo: string;
  sourceType: 'issue' | 'pr' | 'commit' | 'comment';
  sourceId: string; // Issue/PR number or commit SHA
  targetType: 'issue' | 'pr' | 'commit';
  targetId: string;
  createdAt: Date;
  context?: string; // Surrounding text
}

/**
 * Workspace sync status
 */
export interface SyncStatus {
  workspaceId: string;
  lastSync?: Date;
  nextSync?: Date;
  status: 'idle' | 'syncing' | 'error';
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
  errors?: SyncError[];
}

/**
 * Sync error
 */
export interface SyncError {
  repositoryId: string;
  message: string;
  timestamp: Date;
  retryable: boolean;
}

/**
 * Repository health metrics
 */
export interface RepositoryHealth {
  repositoryId: string;
  score: number; // 0-100
  metrics: {
    codeQuality?: number;
    testCoverage?: number;
    documentation?: number;
    activityLevel?: number;
    issueResponseTime?: number;
    prMergeTime?: number;
  };
  issues: HealthIssue[];
  recommendations: string[];
  lastCalculated: Date;
}

/**
 * Health issue
 */
export interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'code' | 'tests' | 'docs' | 'performance' | 'security' | 'maintenance';
  message: string;
  affected?: string[]; // File paths or other identifiers
  autoFixable: boolean;
}

/**
 * Workspace statistics
 */
export interface WorkspaceStats {
  workspaceId: string;
  totalRepos: number;
  totalOrgs: number;
  languages: Record<string, number>; // Language -> count
  totalStars: number;
  totalForks: number;
  totalIssues: number;
  totalPRs: number;
  avgHealth: number;
  dependencies: {
    total: number;
    byType: Record<string, number>;
  };
  crossReferences: {
    total: number;
    byType: Record<string, number>;
  };
}

/**
 * Repository search filters
 */
export interface RepositoryFilters {
  query?: string;
  languages?: string[];
  topics?: string[];
  organizations?: string[];
  minStars?: number;
  maxStars?: number;
  hasIssues?: boolean;
  hasPRs?: boolean;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

/**
 * Workspace operation result
 */
export interface WorkspaceOperationResult {
  success: boolean;
  message?: string;
  data?: unknown;
  errors?: string[];
}
