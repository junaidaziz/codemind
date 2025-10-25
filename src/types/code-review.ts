/**
 * Types for AI-Powered Code Review System
 */

export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ReviewCategory = 
  | 'security' 
  | 'performance' 
  | 'maintainability' 
  | 'complexity' 
  | 'best-practices'
  | 'documentation'
  | 'testing'
  | 'accessibility'
  | 'error-handling';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface FileChange {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previousFilename?: string;
  language?: string;
}

export interface ReviewComment {
  id: string;
  file: string;
  line: number;
  endLine?: number;
  severity: ReviewSeverity;
  category: ReviewCategory;
  message: string;
  suggestion?: string;
  codeSnippet?: string;
  reasoning?: string;
  references?: string[];
  aiGenerated: boolean;
  createdAt: Date;
  resolved?: boolean;
}

export interface RiskScore {
  overall: number; // 0-100
  level: RiskLevel;
  factors: RiskFactor[];
  summary: string;
}

export type RiskFactorType = 
  | 'changeSize' 
  | 'fileCount' 
  | 'criticalFiles' 
  | 'complexity' 
  | 'testCoverage';

export interface RiskFactor {
  factor: RiskFactorType;
  score: number; // 0-100
  weight: number; // 0-1
  description: string;
  impact: RiskLevel;
  details?: Record<string, unknown>; // Additional details
}

export interface DocumentationSuggestion {
  type: 'missing' | 'incomplete' | 'outdated';
  location: string;
  file: string;
  suggestion: string;
  priority: ReviewSeverity;
}

export interface TestingSuggestion {
  type: 'missing-tests' | 'insufficient-coverage' | 'test-improvement';
  files: string[];
  suggestion: string;
  priority: ReviewSeverity;
  estimatedCoverage?: number;
}

export interface PRAnalysis {
  prNumber: number;
  repository: string;
  title: string;
  description?: string;
  author: string;
  headBranch: string; // Source branch (head.ref)
  baseBranch: string; // Target branch (base.ref)
  headSha?: string; // Head commit SHA (optional if not provided by API)
  url?: string; // HTML URL for the PR
  filesChanged: FileChange[];
  totalAdditions: number; // GitHub API additions
  totalDeletions: number; // GitHub API deletions
  commits: number;
  analyzedAt: Date;
}

export interface CodeReviewResult {
  prAnalysis: PRAnalysis;
  riskScore: RiskScore;
  comments: ReviewComment[];
  documentationSuggestions: DocumentationSuggestion[];
  testingSuggestions: TestingSuggestion[];
  summary: ReviewSummary;
  recommendations: string[];
  estimatedReviewTime: number; // minutes
  simulation?: ReviewSimulation; // Optional deeper impact simulation
}

export interface ReviewSummary {
  overallAssessment: string;
  keyFindings: string[];
  criticalIssues: number;
  highPriorityIssues: number;
  mediumPriorityIssues: number;
  lowPriorityIssues: number;
  positiveAspects: string[];
  areasOfConcern: string[];
  approvalRecommendation: 'approve' | 'request-changes' | 'comment';
  overallScore: number; // 0-100
  approved: boolean;
  requiresChanges: boolean;
  simulation?: ReviewSimulation; // Embedded to persist with summary JSON
  documentationSuggestions?: DocumentationSuggestion[];
  testingSuggestions?: TestingSuggestion[];
}

export interface ReviewSimulation {
  prNumber: number;
  impactAnalysis: ImpactAnalysis;
  affectedComponents: AffectedComponent[];
  potentialBreakingChanges: BreakingChange[];
  dependencies: DependencyImpact[];
  estimatedImpact: RiskLevel;
}

export interface ImpactAnalysis {
  scope: 'isolated' | 'moderate' | 'widespread';
  affectedFiles: number;
  affectedFunctions: number;
  affectedModules: string[];
  downstreamDependencies: number;
  upstreamDependencies: number;
}

export interface AffectedComponent {
  name: string;
  type: 'function' | 'class' | 'module' | 'api' | 'database';
  file: string;
  changeType: 'signature' | 'behavior' | 'removal' | 'addition';
  usageCount: number;
  criticalPath: boolean;
}

export interface BreakingChange {
  type: 'api' | 'signature' | 'removal' | 'behavior';
  component: string;
  description: string;
  severity: ReviewSeverity;
  affectedUsages: string[];
  migrationSuggestion?: string;
}

export interface DependencyImpact {
  package: string;
  changeType: 'added' | 'removed' | 'upgraded' | 'downgraded';
  oldVersion?: string;
  newVersion?: string;
  risk: RiskLevel;
  knownIssues?: string[];
}

export interface ReviewConfiguration {
  // Analysis settings
  enableSecurityCheck: boolean;
  enablePerformanceCheck: boolean;
  enableComplexityCheck: boolean;
  enableDocumentationCheck: boolean;
  enableTestingCheck: boolean;
  
  // Thresholds
  maxComplexity: number;
  minTestCoverage: number;
  maxFileSize: number;
  maxFunctionLength: number;
  
  // AI settings
  aiModel: string;
  temperature: number;
  maxTokens: number;
  
  // Review preferences
  includePositiveFeedback: boolean;
  suggestRefactoring: boolean;
  checkBestPractices: boolean;
}

export const DEFAULT_REVIEW_CONFIG: ReviewConfiguration = {
  enableSecurityCheck: true,
  enablePerformanceCheck: true,
  enableComplexityCheck: true,
  enableDocumentationCheck: true,
  enableTestingCheck: true,
  maxComplexity: 10,
  minTestCoverage: 80,
  maxFileSize: 500,
  maxFunctionLength: 50,
  aiModel: 'gpt-4',
  temperature: 0.3,
  maxTokens: 4000,
  includePositiveFeedback: true,
  suggestRefactoring: true,
  checkBestPractices: true,
};
