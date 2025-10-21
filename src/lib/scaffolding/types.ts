/**
 * Core Type Definitions for Smart Scaffolder Mode
 * 
 * This file defines all TypeScript interfaces and types used across
 * the scaffolding system for type safety and clarity.
 */

// ============================================================================
// Scaffold Request & Response Types
// ============================================================================

export interface ScaffoldRequest {
  prompt: string;
  projectId: string;
  userId: string;
  previewOnly?: boolean;
  applyConventions?: boolean;
  dryRun?: boolean;
}

export interface ScaffoldResult {
  id: string;
  projectId: string;
  userId: string;
  prompt: string;
  parsedIntent: ParsedIntent;
  files: GeneratedFile[];
  dependencyGraph: DependencyGraph;
  appliedConventions: ProjectConventions;
  preview: PreviewData;
  status: ScaffoldStatus;
  createdAt: Date;
  appliedAt?: Date;
  error?: string;
}

export type ScaffoldStatus = 
  | 'parsing'      // Parsing the prompt
  | 'analyzing'    // Analyzing project conventions
  | 'generating'   // Generating files
  | 'previewing'   // Ready for preview
  | 'pending'      // Waiting for user confirmation
  | 'applying'     // Applying changes
  | 'applied'      // Successfully applied
  | 'failed'       // Failed at some stage
  | 'cancelled'    // User cancelled
  | 'rolled_back'; // Changes rolled back

// ============================================================================
// Generated File Types
// ============================================================================

export interface GeneratedFile {
  path: string;                    // Relative path from project root
  content: string;                 // Generated file content
  language: ProgrammingLanguage;   // File language
  imports: ImportStatement[];      // All imports in the file
  exports: ExportStatement[];      // All exports from the file
  dependencies: string[];          // Other files this depends on
  template?: string;               // Template used to generate
  isNew: boolean;                  // true if creating new file
  originalContent?: string;        // Original content if modifying existing
  diffPreview?: string;            // Unified diff for preview
}

export interface ImportStatement {
  from: string;                    // Import source
  items: string[];                 // Imported items
  default?: string;                // Default import name
  isType?: boolean;                // Type-only import
  isRelative: boolean;             // Relative vs absolute
}

export interface ExportStatement {
  name: string;                    // Exported name
  type: 'default' | 'named' | 'type';
  signature?: string;              // Type signature if available
}

export type ProgrammingLanguage = 
  | 'typescript'
  | 'javascript'
  | 'tsx'
  | 'jsx'
  | 'json'
  | 'prisma'
  | 'sql'
  | 'markdown';

// ============================================================================
// Dependency Graph Types
// ============================================================================

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  entryPoints: string[];           // Files with no dependencies
  layers: string[][];              // Files grouped by dependency layer
}

export interface DependencyNode {
  id: string;                      // File path
  type: NodeType;
  label: string;                   // Display name
  metadata: Record<string, unknown>;
}

export type NodeType = 
  | 'component'
  | 'route'
  | 'model'
  | 'service'
  | 'utility'
  | 'test'
  | 'config'
  | 'type';

export interface DependencyEdge {
  from: string;                    // Source file path
  to: string;                      // Target file path
  type: EdgeType;
}

export type EdgeType = 
  | 'imports'
  | 'uses'
  | 'tests'
  | 'extends'
  | 'implements';

// ============================================================================
// Preview Types
// ============================================================================

export interface PreviewData {
  fileTree: FileTreeNode;          // Tree structure of changes
  summary: PreviewSummary;
  warnings: PreviewWarning[];
  conflicts: FileConflict[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  status?: 'new' | 'modified' | 'unchanged';
  size?: number;
}

export interface PreviewSummary {
  filesCreated: number;
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  importsAdded: number;
  estimatedDuration: number;       // Estimated time to apply (ms)
}

export interface PreviewWarning {
  type: WarningType;
  message: string;
  filePath?: string;
  severity: 'info' | 'warning' | 'error';
}

export type WarningType = 
  | 'file_exists'
  | 'naming_mismatch'
  | 'missing_dependency'
  | 'convention_violation'
  | 'large_file'
  | 'circular_dependency';

export interface FileConflict {
  filePath: string;
  type: ConflictType;
  existingContent: string;
  newContent: string;
  resolution?: 'skip' | 'overwrite' | 'merge';
}

export type ConflictType = 
  | 'file_exists'
  | 'different_content'
  | 'permission_denied'
  | 'locked';

// ============================================================================
// Convention Analysis Types
// ============================================================================

export interface ProjectConventions {
  naming: NamingConventions;
  imports: ImportConventions;
  structure: StructureConventions;
  framework: FrameworkInfo;
  typescript: TypeScriptConfig;
  testing?: TestingConfig;
  styling?: StylingConfig;
  cacheKey: string;                // For cache invalidation
  analyzedAt: Date;
  confidence: number;              // 0-1, confidence in analysis
}

export interface NamingConventions {
  files: NamingStyle;              // File naming pattern
  directories: NamingStyle;        // Directory naming pattern
  components: NamingStyle;         // Component naming
  functions: NamingStyle;          // Function naming
  variables: NamingStyle;          // Variable naming
  constants: NamingStyle;          // Constant naming
  types: NamingStyle;              // Type/Interface naming
  examples: Record<string, string>; // Example patterns found
}

export type NamingStyle = 
  | 'camelCase'
  | 'PascalCase'
  | 'snake_case'
  | 'kebab-case'
  | 'SCREAMING_SNAKE_CASE'
  | 'mixed';                       // Inconsistent

export interface ImportConventions {
  style: ImportStyle;
  pathAlias: Record<string, string>; // Path aliases (e.g., '@/' -> 'src/')
  preferredQuotes: 'single' | 'double';
  grouping: ImportGrouping;
  sortOrder: 'alphabetical' | 'type' | 'none';
}

export type ImportStyle = 
  | 'default'                      // import X from 'y'
  | 'named'                        // import { X } from 'y'
  | 'namespace'                    // import * as X from 'y'
  | 'mixed';

export type ImportGrouping = 
  | 'by-type'                      // External, internal, relative
  | 'by-source'                    // Alphabetical
  | 'none';

export interface StructureConventions {
  rootDir: string;                 // Project root
  sourceDir: string;               // Source code directory (e.g., 'src/')
  componentDir?: string;           // Components directory
  utilsDir?: string;               // Utilities directory
  typesDir?: string;               // Type definitions directory
  testPattern: string;             // Test file pattern (e.g., '*.test.ts')
  configLocation: string;          // Config files location
  flatStructure: boolean;          // Flat vs nested structure
}

export interface FrameworkInfo {
  name: Framework;
  version?: string;
  features: FrameworkFeature[];
  router?: RouterType;
  serverComponents?: boolean;
  stateManagement?: StateManagement;
}

export type Framework = 
  | 'nextjs'
  | 'react'
  | 'express'
  | 'nestjs'
  | 'vanilla'
  | 'unknown';

export type FrameworkFeature = 
  | 'app-router'
  | 'pages-router'
  | 'server-actions'
  | 'api-routes'
  | 'ssr'
  | 'ssg'
  | 'isr';

export type RouterType = 
  | 'app-router'
  | 'pages-router'
  | 'react-router'
  | 'express-router'
  | 'none';

export type StateManagement = 
  | 'redux'
  | 'zustand'
  | 'jotai'
  | 'recoil'
  | 'context'
  | 'none';

export interface TypeScriptConfig {
  enabled: boolean;
  strict: boolean;
  version?: string;
  compilerOptions: Record<string, unknown>;
  pathMapping: Record<string, string[]>;
}

export interface TestingConfig {
  framework: TestFramework;
  coverage: boolean;
  testDir: string;
  setupFiles: string[];
}

export type TestFramework = 
  | 'jest'
  | 'vitest'
  | 'mocha'
  | 'jasmine'
  | 'none';

export interface StylingConfig {
  approach: StylingApproach;
  framework?: string;              // e.g., 'tailwind', 'styled-components'
  cssModules: boolean;
}

export type StylingApproach = 
  | 'tailwind'
  | 'css-modules'
  | 'styled-components'
  | 'emotion'
  | 'sass'
  | 'plain-css'
  | 'mixed';

// ============================================================================
// Prompt Parsing Types
// ============================================================================

export interface ParsedIntent {
  raw: string;                     // Original prompt
  intent: IntentType;
  entities: Entity[];
  modifiers: Modifier[];
  references: Reference[];
  confidence: number;              // 0-1
  alternatives?: ParsedIntent[];   // Alternative interpretations
  ambiguities: string[];           // Unclear aspects
}

export type IntentType = 
  | 'create'
  | 'generate'
  | 'add'
  | 'scaffold'
  | 'update'
  | 'extend'
  | 'duplicate'
  | 'unknown';

export interface Entity {
  type: EntityType;
  name: string;
  category?: string;               // e.g., 'auth', 'admin', 'user'
  attributes?: Record<string, unknown>;
  position: [number, number];      // Start, end position in prompt
}

export type EntityType = 
  | 'module'
  | 'component'
  | 'route'
  | 'model'
  | 'service'
  | 'utility'
  | 'test'
  | 'migration'
  | 'config';

export interface Modifier {
  type: ModifierType;
  value?: string;
}

export type ModifierType = 
  | 'with-tests'
  | 'with-types'
  | 'with-docs'
  | 'with-auth'
  | 'with-validation'
  | 'typescript'
  | 'javascript'
  | 'functional'
  | 'class-based';

export interface Reference {
  type: ReferenceType;
  target: string;                  // What to reference
  relationship: 'similar' | 'extends' | 'uses' | 'based-on';
}

export type ReferenceType = 
  | 'file'
  | 'module'
  | 'pattern'
  | 'template';

// ============================================================================
// Template Types
// ============================================================================

export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  framework?: Framework;
  tags: string[];
  files: TemplateFile[];
  variables: TemplateVariable[];
  hooks?: TemplateHooks;
  examples?: string[];             // Example prompts
  popularity?: number;             // Usage count
  version: string;
}

export type TemplateCategory = 
  | 'component'
  | 'route'
  | 'model'
  | 'service'
  | 'utility'
  | 'test'
  | 'config'
  | 'migration'
  | 'full-module';                 // Multi-file module

export interface TemplateFile {
  path: string;                    // Relative path (can use variables)
  content: string;                 // Template content with variables
  language: ProgrammingLanguage;
  optional?: boolean;              // Can be skipped
  condition?: string;              // Conditional generation
}

export interface TemplateVariable {
  name: string;
  type: VariableType;
  description: string;
  default?: string | boolean | number;
  required: boolean;
  validation?: VariableValidation;
  examples?: string[];
}

export type VariableType = 
  | 'string'
  | 'boolean'
  | 'number'
  | 'array'
  | 'object'
  | 'enum';

export interface VariableValidation {
  pattern?: string;                // Regex pattern
  min?: number;
  max?: number;
  options?: string[];              // For enum type
  custom?: (value: unknown) => boolean;
}

export interface TemplateHooks {
  beforeGenerate?: (context: TemplateContext) => void | Promise<void>;
  afterGenerate?: (files: GeneratedFile[]) => void | Promise<void>;
  beforeApply?: (files: GeneratedFile[]) => void | Promise<void>;
  afterApply?: (result: ScaffoldResult) => void | Promise<void>;
}

export interface TemplateContext {
  variables: Record<string, unknown>;
  conventions: ProjectConventions;
  projectId: string;
  template: Template;
  parsedIntent: ParsedIntent;
}

// ============================================================================
// Service Configuration Types
// ============================================================================

export interface ScaffoldingConfig {
  maxFilesPerScaffold: number;
  maxFileSizeBytes: number;
  enableCache: boolean;
  cacheTTL: number;                // Seconds
  allowOverwrite: boolean;
  requirePreview: boolean;
  autoBackup: boolean;
  backupDir: string;
  parallelGeneration: boolean;
  workerThreads: number;
}

export interface ConventionAnalysisConfig {
  sampleSize: number;              // Number of files to analyze
  minConfidence: number;           // Minimum confidence threshold
  cacheEnabled: boolean;
  ignorePaths: string[];           // Paths to ignore
  customRules?: ConventionRule[];
}

export interface ConventionRule {
  name: string;
  pattern: RegExp;
  apply: (match: RegExpMatchArray) => Partial<ProjectConventions>;
}

// ============================================================================
// Error Types
// ============================================================================

export class ScaffoldingError extends Error {
  constructor(
    message: string,
    public code: ScaffoldErrorCode,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ScaffoldingError';
  }
}

export type ScaffoldErrorCode = 
  | 'PARSING_FAILED'
  | 'TEMPLATE_NOT_FOUND'
  | 'CONVENTION_ANALYSIS_FAILED'
  | 'FILE_GENERATION_FAILED'
  | 'FILE_WRITE_FAILED'
  | 'PERMISSION_DENIED'
  | 'INVALID_PROMPT'
  | 'AMBIGUOUS_INTENT'
  | 'CIRCULAR_DEPENDENCY'
  | 'MAX_FILES_EXCEEDED'
  | 'FILE_TOO_LARGE'
  | 'UNKNOWN_ERROR';

// ============================================================================
// Utility Types
// ============================================================================

export interface FileMetadata {
  path: string;
  size: number;
  lines: number;
  language: ProgrammingLanguage;
  lastModified: Date;
  hash: string;                    // Content hash for change detection
}

export interface ProjectMetadata {
  id: string;
  name: string;
  rootPath: string;
  totalFiles: number;
  totalLines: number;
  languages: ProgrammingLanguage[];
  frameworks: Framework[];
  lastIndexed: Date;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
}
