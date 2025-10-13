// Log Analysis System for Auto Fix
import { OpenAI } from 'openai';
import { logger } from '../app/lib/logger';
import { env } from '../types/env';
import {
  DetectedIssue,
  LogAnalysisResult,
  FileChange,
  DetectedIssueSchema,
  LogAnalysisResultSchema,
  FileChangeSchema,
} from '../types/github';
import { applyAutoFix } from './autoFix';

/**
 * Log analysis patterns for different error types
 */
const ERROR_PATTERNS = {
  // Build errors
  BUILD_ERROR: [
    /ERROR.*in\s+([^\s:]+):(\d+):(\d+)?\s*(.+)/i,
    /error:\s*(.+)/i,
    /compilation\s+error/i,
    /build\s+failed/i,
    /\[ERROR\]/i,
  ],
  
  // Test failures
  TEST_FAILURE: [
    /test.*failed/i,
    /assertion.*failed/i,
    /expect.*received/i,
    /\d+\)\s*(.+)\s*×/i,
    /jest.*failed/i,
    /mocha.*failing/i,
  ],
  
  // Lint errors
  LINT_ERROR: [
    /eslint.*error/i,
    /tslint.*error/i,
    /warning.*unused/i,
    /error.*rule/i,
    /prettier.*error/i,
  ],
  
  // Security issues
  SECURITY_ISSUE: [
    /security.*vulnerability/i,
    /cve-\d+/i,
    /high.*severity/i,
    /critical.*vulnerability/i,
    /audit.*found/i,
  ],
  
  // Dependency issues
  DEPENDENCY_ISSUE: [
    /module.*not.*found/i,
    /cannot.*resolve/i,
    /missing.*dependency/i,
    /peer.*dependency/i,
    /package.*not.*installed/i,
  ],
  
  // Syntax errors
  SYNTAX_ERROR: [
    /syntax.*error/i,
    /unexpected.*token/i,
    /parse.*error/i,
    /invalid.*syntax/i,
  ],
  
  // TypeScript specific errors
  TYPESCRIPT_ERROR: [
    /error\s+TS\d+/i,
    /cannot find module/i,
    /property.*does not exist/i,
    /type.*is not assignable/i,
    /cannot resolve.*path mapping/i,
    /module.*has no exported member/i,
  ],
  
  // Import/Export errors
  IMPORT_ERROR: [
    /cannot find module/i,
    /module not found/i,
    /failed to resolve/i,
    /cannot resolve module/i,
    /module.*has no default export/i,
    /module.*has no exported member/i,
  ],
  
  // Prisma specific errors
  PRISMA_ERROR: [
    /prisma.*error/i,
    /database.*connection/i,
    /schema.*validation/i,
    /migration.*failed/i,
    /prisma generate/i,
  ],
  
  // Environment/Configuration errors
  ENV_CONFIG_ERROR: [
    /environment variable.*not defined/i,
    /missing.*env/i,
    /invalid.*configuration/i,
    /config.*not found/i,
    /dotenv/i,
  ],
  
  // Supabase specific errors
  SUPABASE_ERROR: [
    /supabase.*error/i,
    /authentication.*failed/i,
    /invalid.*supabase/i,
    /supabase.*connection/i,
  ],
};

/**
 * Common fix suggestions for different issue types
 */
const FIX_SUGGESTIONS = {
  build_error: [
    'Check for missing imports or dependencies',
    'Verify file paths and references',
    'Review TypeScript configuration',
    'Check for circular dependencies',
  ],
  test_failure: [
    'Update test expectations',
    'Check test setup and teardown',
    'Verify mock implementations',
    'Review test data and fixtures',
  ],
  lint_error: [
    'Run linter with --fix flag',
    'Update code formatting',
    'Remove unused variables and imports',
    'Fix code style violations',
  ],
  security_issue: [
    'Update vulnerable dependencies',
    'Review security configurations',
    'Implement security best practices',
    'Add security headers and validation',
  ],
  dependency_issue: [
    'Install missing dependencies',
    'Update package.json',
    'Clear node_modules and reinstall',
    'Check dependency versions',
  ],
  syntax_error: [
    'Fix syntax according to language rules',
    'Check for missing brackets or semicolons',
    'Verify proper indentation',
    'Review language-specific syntax',
  ],
  typescript_error: [
    'Add missing type definitions',
    'Update tsconfig.json paths configuration',
    'Install @types packages for missing types',
    'Fix type compatibility issues',
  ],
  import_error: [
    'Add missing import statements',
    'Check file paths and extensions',
    'Install missing npm packages',
    'Update module resolution settings',
  ],
  prisma_error: [
    'Run prisma generate to update client',
    'Check database connection string',
    'Run pending migrations with prisma migrate deploy',
    'Verify schema.prisma syntax',
  ],
  env_config_error: [
    'Add missing environment variables',
    'Check .env file configuration',
    'Verify environment variable names',
    'Update environment setup documentation',
  ],
  supabase_error: [
    'Check Supabase connection credentials',
    'Verify SUPABASE_URL and SUPABASE_ANON_KEY',
    'Update Supabase client configuration',
    'Check network connectivity to Supabase',
  ],
};

/**
 * Log Analysis Service for detecting issues and generating fixes
 */
export class LogAnalysisService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  /**
   * Extract file path and line number from error message
   */
  private extractFileLocation(message: string): { file?: string; line?: number; column?: number } {
    // Pattern: filename:line:column or filename:line
    const locationMatch = message.match(/([^\s:]+\.(ts|js|tsx|jsx|py|java|cpp|c|go|rs|php|rb)):(\d+)(?::(\d+))?/i);
    if (locationMatch) {
      return {
        file: locationMatch[1],
        line: parseInt(locationMatch[3], 10),
        column: locationMatch[4] ? parseInt(locationMatch[4], 10) : undefined,
      };
    }

    // Pattern: at filename (line:column)
    const atMatch = message.match(/at\s+([^\s(]+)\s*\(.*?:(\d+):(\d+)\)/i);
    if (atMatch) {
      return {
        file: atMatch[1],
        line: parseInt(atMatch[2], 10),
        column: parseInt(atMatch[3], 10),
      };
    }

    // Pattern: filename mentioned in message
    const fileMatch = message.match(/([^\s:]+\.(ts|js|tsx|jsx|py|java|cpp|c|go|rs|php|rb))/i);
    if (fileMatch) {
      return { file: fileMatch[1] };
    }

    return {};
  }

  /**
   * Extract structured error information from log content
   */
  private extractStructuredError(logContent: string): {
    errorType: string;
    filePath?: string;
    suggestion: string;
    confidence: number;
    details?: Record<string, string>;
  } | null {
    const content = logContent.toLowerCase();
    
    // TypeScript config missing path
    if (content.includes('cannot resolve') && content.includes('path mapping')) {
      return {
        errorType: 'ts_config_missing_path',
        filePath: 'tsconfig.json',
        suggestion: 'Add paths configuration to tsconfig.json for module resolution',
        confidence: 0.9,
        details: { configSection: 'compilerOptions.paths' },
      };
    }
    
    // Missing import
    const moduleNotFoundMatch = logContent.match(/cannot find module ['"]([^'"]+)['"]/i);
    if (moduleNotFoundMatch) {
      return {
        errorType: 'missing_import',
        filePath: this.extractFileLocation(logContent).file,
        suggestion: `Add import statement or install package: ${moduleNotFoundMatch[1]}`,
        confidence: 0.95,
        details: { missingModule: moduleNotFoundMatch[1] },
      };
    }
    
    // Prisma schema error
    if (content.includes('prisma') && (content.includes('schema') || content.includes('generate'))) {
      return {
        errorType: 'prisma_schema_error',
        filePath: 'prisma/schema.prisma',
        suggestion: 'Run prisma generate and check schema syntax',
        confidence: 0.85,
        details: { command: 'npx prisma generate' },
      };
    }
    
    // Missing environment variable
    const envVarMatch = logContent.match(/environment variable ['"]?([A-Z_]+)['"]? (is )?not (defined|set)/i);
    if (envVarMatch) {
      return {
        errorType: 'missing_env_var',
        filePath: '.env',
        suggestion: `Add ${envVarMatch[1]} to environment variables`,
        confidence: 0.9,
        details: { envVar: envVarMatch[1] },
      };
    }
    
    // Supabase connection error
    if (content.includes('supabase') && (content.includes('connection') || content.includes('auth'))) {
      return {
        errorType: 'supabase_connection_error',
        filePath: '.env',
        suggestion: 'Check SUPABASE_URL and SUPABASE_ANON_KEY configuration',
        confidence: 0.8,
        details: { 
          requiredVars: 'SUPABASE_URL, SUPABASE_ANON_KEY',
        },
      };
    }
    
    return null;
  }

  /**
   * Classify issue type based on log content
   */
  private classifyIssue(logContent: string): {
    type: DetectedIssue['type'];
    severity: DetectedIssue['severity'];
    confidence: number;
  } {
    const content = logContent.toLowerCase();
    let maxConfidence = 0;
    let detectedType: DetectedIssue['type'] = 'build_error';
    let severity: DetectedIssue['severity'] = 'medium';

    // Check each pattern type
    for (const [errorType, patterns] of Object.entries(ERROR_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          const confidence = 0.8 + (patterns.indexOf(pattern) * 0.05); // Higher confidence for earlier patterns
          if (confidence > maxConfidence) {
            maxConfidence = confidence;
            detectedType = errorType.toLowerCase() as DetectedIssue['type'];
          }
        }
      }
    }

    // Determine severity based on keywords
    if (content.includes('critical') || content.includes('fatal') || content.includes('security')) {
      severity = 'critical';
    } else if (content.includes('error') || content.includes('failed') || content.includes('exception')) {
      severity = 'high';
    } else if (content.includes('warning') || content.includes('deprecated')) {
      severity = 'medium';
    } else {
      severity = 'low';
    }

    return { type: detectedType, severity, confidence: maxConfidence };
  }

  /**
   * Parse structured logs to extract individual issues
   */
  private parseLogStructure(logContent: string): Array<{
    message: string;
    location?: { file?: string; line?: number; column?: number };
    type: DetectedIssue['type'];
    severity: DetectedIssue['severity'];
    suggestion?: string;
    structured?: {
      errorType: string;
      details?: Record<string, string>;
    };
  }> {
    const issues: Array<{
      message: string;
      location?: { file?: string; line?: number; column?: number };
      type: DetectedIssue['type'];
      severity: DetectedIssue['severity'];
      suggestion?: string;
      structured?: {
        errorType: string;
        details?: Record<string, string>;
      };
    }> = [];

    // First, try to extract structured errors from the full log
    const structuredError = this.extractStructuredError(logContent);
    if (structuredError && structuredError.confidence > 0.7) {
      const location = structuredError.filePath ? { file: structuredError.filePath } : undefined;
      
      issues.push({
        message: `Structured error detected: ${structuredError.errorType}`,
        location,
        type: this.mapErrorTypeToDetectedType(structuredError.errorType),
        severity: this.getSeverityForErrorType(structuredError.errorType),
        suggestion: structuredError.suggestion,
        structured: {
          errorType: structuredError.errorType,
          details: structuredError.details,
        },
      });
    }

    // Then analyze individual lines
    const lines = logContent.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Skip empty lines and progress indicators
      if (!line.trim() || line.includes('...') || line.includes('░')) {
        continue;
      }

      // Check for structured errors in individual lines too
      const lineStructuredError = this.extractStructuredError(line);
      if (lineStructuredError && lineStructuredError.confidence > 0.8) {
        const location = lineStructuredError.filePath ? { file: lineStructuredError.filePath } : this.extractFileLocation(line);
        
        issues.push({
          message: line.trim(),
          location,
          type: this.mapErrorTypeToDetectedType(lineStructuredError.errorType),
          severity: this.getSeverityForErrorType(lineStructuredError.errorType),
          suggestion: lineStructuredError.suggestion,
          structured: {
            errorType: lineStructuredError.errorType,
            details: lineStructuredError.details,
          },
        });
        continue;
      }

      // Fallback to pattern-based classification
      const classification = this.classifyIssue(line);
      
      // Only include lines that match error patterns
      if (classification.confidence > 0.3) {
        const location = this.extractFileLocation(line);
        
        issues.push({
          message: line.trim(),
          location,
          type: classification.type,
          severity: classification.severity,
        });
      }
    }

    return issues;
  }

  /**
   * Map structured error type to DetectedIssue type
   */
  private mapErrorTypeToDetectedType(errorType: string): DetectedIssue['type'] {
    if (errorType.includes('ts_config') || errorType.includes('typescript')) {
      return 'typescript_error';
    }
    if (errorType.includes('import') || errorType.includes('module')) {
      return 'import_error';
    }
    if (errorType.includes('prisma')) {
      return 'prisma_error';
    }
    if (errorType.includes('env')) {
      return 'env_config_error';
    }
    if (errorType.includes('supabase')) {
      return 'supabase_error';
    }
    return 'build_error';
  }

  /**
   * Get severity level for structured error type
   */
  private getSeverityForErrorType(errorType: string): DetectedIssue['severity'] {
    if (errorType.includes('missing_env') || errorType.includes('connection')) {
      return 'high';
    }
    if (errorType.includes('config') || errorType.includes('schema')) {
      return 'medium';
    }
    return 'medium';
  }

  /**
   * Use AI to analyze logs and suggest fixes
   */
  private async analyzeWithAI(
    logContent: string,
    projectContext?: string
  ): Promise<{
    issues: DetectedIssue[];
    summary: string;
    confidence: number;
    recommendedActions: string[];
    potentialFixes: Array<{
      file: string;
      suggestion: string;
      confidence: number;
    }>;
  }> {
    const prompt = `
Analyze the following log output and identify specific code issues that can be automatically fixed.

${projectContext ? `Project Context: ${projectContext}` : ''}

Log Output:
${logContent}

Please provide a detailed analysis including:
1. Specific issues found (type, severity, file, line number if available)
2. Summary of the main problems
3. Confidence level (0-1) in the analysis
4. Recommended actions to fix the issues
5. Specific file changes that could resolve the issues

Focus on issues that are:
- Automatically fixable (syntax errors, formatting, imports, etc.)
- Have clear file locations
- Don't require major architectural changes

Return the analysis in the following JSON format:
{
  "issues": [
    {
      "type": "build_error|test_failure|lint_error|security_issue|dependency_issue|syntax_error",
      "severity": "low|medium|high|critical",
      "message": "Clear description of the issue",
      "file": "path/to/file.ts",
      "line": 42,
      "column": 10,
      "suggestion": "Specific fix suggestion",
      "fixable": true
    }
  ],
  "summary": "Brief summary of all issues found",
  "confidence": 0.85,
  "recommendedActions": ["Action 1", "Action 2"],
  "potentialFixes": [
    {
      "file": "path/to/file.ts",
      "suggestion": "Specific code change needed",
      "confidence": 0.9
    }
  ]
}
`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert code analyzer that specializes in identifying and suggesting fixes for build errors, test failures, and code issues. Focus on providing actionable, specific fixes that can be automated.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI analysis');
      }

      // Try to parse JSON response
      try {
        const analysis = JSON.parse(content);
        return {
          issues: analysis.issues || [],
          summary: analysis.summary || 'AI analysis completed',
          confidence: analysis.confidence || 0.5,
          recommendedActions: analysis.recommendedActions || [],
          potentialFixes: analysis.potentialFixes || [],
        };
      } catch {
        // Fallback if JSON parsing fails
        logger.warn('Failed to parse AI analysis JSON, using fallback', {
          content: content.substring(0, 500),
        });

        return {
          issues: [],
          summary: 'AI analysis completed but response format was invalid',
          confidence: 0.3,
          recommendedActions: ['Manual review required'],
          potentialFixes: [],
        };
      }
    } catch (error) {
      logger.error('AI analysis failed', {}, error as Error);
      
      return {
        issues: [],
        summary: 'AI analysis failed',
        confidence: 0.0,
        recommendedActions: ['Manual analysis required'],
        potentialFixes: [],
      };
    }
  }

  /**
   * Generate file changes based on detected issues and AI suggestions
   */
  private async generateFixes(
    issues: DetectedIssue[],
    projectId: string,
    potentialFixes: Array<{
      file: string;
      suggestion: string;
      confidence: number;
    }>
  ): Promise<FileChange[]> {
    const fixes: FileChange[] = [];

    // For now, we'll create placeholder fixes for demonstration
    // In a real implementation, this would:
    // 1. Read the actual files from the project
    // 2. Apply specific fixes based on the issue type
    // 3. Generate the corrected content

    for (const fix of potentialFixes) {
      if (fix.confidence > 0.7) {
        // Only apply high-confidence fixes automatically
        try {
          const fileChange = FileChangeSchema.parse({
            path: fix.file,
            content: `// Auto-fix applied: ${fix.suggestion}\n// TODO: Implement actual fix logic`,
            encoding: 'utf-8',
            mode: '100644',
          });

          fixes.push(fileChange);
        } catch {
          logger.warn('Invalid file change generated', {
            file: fix.file,
            suggestion: fix.suggestion,
          });
        }
      }
    }

    return fixes;
  }

  /**
   * Main method to analyze logs and detect fixable issues
   */
  public async analyzeLogs(
    logContent: string,
    projectId?: string,
    projectContext?: string
  ): Promise<LogAnalysisResult> {
    logger.info('Starting log analysis', {
      logLength: logContent.length,
      projectId,
    });

    try {
      // Parse log structure to extract issues
      const structuredIssues = this.parseLogStructure(logContent);
      
      // Use AI for deeper analysis
      const aiAnalysis = await this.analyzeWithAI(logContent, projectContext);
      
      // Combine structured and AI analysis
      const allIssues: DetectedIssue[] = [];
      
      // Add structured issues
      for (const issue of structuredIssues) {
        const detectedIssue = DetectedIssueSchema.parse({
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
          file: issue.location?.file,
          line: issue.location?.line,
          column: issue.location?.column,
          suggestion: issue.suggestion || FIX_SUGGESTIONS[issue.type]?.[0],
          fixable: true,
        });
        
        allIssues.push(detectedIssue);
      }
      
      // Add AI-detected issues
      for (const aiIssue of aiAnalysis.issues) {
        try {
          const detectedIssue = DetectedIssueSchema.parse(aiIssue);
          allIssues.push(detectedIssue);
        } catch {
          logger.warn('Invalid AI issue format', { aiIssue });
        }
      }

      // Remove duplicates based on file and line
      const uniqueIssues = allIssues.filter((issue, index, self) => 
        index === self.findIndex(other => 
          other.file === issue.file && 
          other.line === issue.line && 
          other.message === issue.message
        )
      );

      // Filter fixable issues
      const fixableIssues = uniqueIssues.filter(issue => issue.fixable);

      // Generate summary
      const summary = aiAnalysis.summary || `Found ${uniqueIssues.length} issue${uniqueIssues.length === 1 ? '' : 's'} in logs`;
      
      // Combine recommended actions
      const recommendedActions = [
        ...aiAnalysis.recommendedActions,
        ...new Set(uniqueIssues.map(issue => issue.type).map(type => FIX_SUGGESTIONS[type]?.[0]).filter(Boolean)),
      ];

      const result = LogAnalysisResultSchema.parse({
        issues: uniqueIssues,
        summary,
        confidence: aiAnalysis.confidence,
        recommendedActions,
        fixableIssues,
      });

      logger.info('Log analysis completed', {
        totalIssues: uniqueIssues.length,
        fixableIssues: fixableIssues.length,
        confidence: aiAnalysis.confidence,
      });

      return result;
      
    } catch (error) {
      logger.error('Log analysis failed', {
        logLength: logContent.length,
        projectId,
      }, error as Error);

      // Return empty result on failure
      return LogAnalysisResultSchema.parse({
        issues: [],
        summary: 'Log analysis failed',
        confidence: 0,
        recommendedActions: ['Manual review required'],
        fixableIssues: [],
      });
    }
  }

  /**
   * Analyze logs and trigger auto-fix if issues are found
   */
  public async analyzeAndAutoFix(
    logContent: string,
    projectId: string,
    githubUrl: string,
    userId?: string,
    projectContext?: string
  ): Promise<{
    analysis: LogAnalysisResult;
    autoFixResult?: {
      success: boolean;
      message: string;
      prUrl?: string;
      error?: string;
    };
  }> {
    logger.info('Starting analyze and auto-fix workflow', {
      logLength: logContent.length,
      projectId,
      githubUrl,
      userId,
    });

    try {
      // First analyze the logs
      const analysis = await this.analyzeLogs(logContent, projectId, projectContext);

      // Check if there are fixable issues
      if (analysis.fixableIssues.length === 0) {
        logger.info('No fixable issues found in logs', {
          totalIssues: analysis.issues.length,
          projectId,
        });

        return {
          analysis,
          autoFixResult: {
            success: false,
            message: 'No automatically fixable issues detected',
          },
        };
      }

      // Generate fixes for the issues
      const aiAnalysis = await this.analyzeWithAI(logContent, projectContext);
      const fixes = await this.generateFixes(analysis.fixableIssues, projectId, aiAnalysis.potentialFixes);

      if (fixes.length === 0) {
        return {
          analysis,
          autoFixResult: {
            success: false,
            message: 'Could not generate fixes for detected issues',
          },
        };
      }

      // Apply auto-fix
      const autoFixResult = await applyAutoFix(
        projectId,
        githubUrl,
        analysis.fixableIssues,
        fixes,
        userId
      );

      logger.info('Analyze and auto-fix workflow completed', {
        projectId,
        fixableIssues: analysis.fixableIssues.length,
        fixesGenerated: fixes.length,
        autoFixSuccess: autoFixResult.success,
      });

      return {
        analysis,
        autoFixResult: {
          success: autoFixResult.success,
          message: autoFixResult.message,
          prUrl: autoFixResult.prUrl,
          error: autoFixResult.error,
        },
      };

    } catch (error) {
      logger.error('Analyze and auto-fix workflow failed', {
        logLength: logContent.length,
        projectId,
        githubUrl,
      }, error as Error);

      return {
        analysis: LogAnalysisResultSchema.parse({
          issues: [],
          summary: 'Analysis failed',
          confidence: 0,
          recommendedActions: ['Manual review required'],
          fixableIssues: [],
        }),
        autoFixResult: {
          success: false,
          message: 'Auto-fix workflow failed',
          error: (error as Error).message,
        },
      };
    }
  }
}

// Default instance
let defaultLogAnalysisService: LogAnalysisService | null = null;

/**
 * Get the default LogAnalysisService instance
 */
export function getLogAnalysisService(): LogAnalysisService {
  if (!defaultLogAnalysisService) {
    defaultLogAnalysisService = new LogAnalysisService();
  }
  return defaultLogAnalysisService;
}

/**
 * Quick method to analyze logs with default service
 */
export async function analyzeLogs(
  logContent: string,
  projectId?: string,
  projectContext?: string
): Promise<LogAnalysisResult> {
  const service = getLogAnalysisService();
  return service.analyzeLogs(logContent, projectId, projectContext);
}

/**
 * Quick method to analyze logs and trigger auto-fix with default service
 */
export async function analyzeAndAutoFix(
  logContent: string,
  projectId: string,
  githubUrl: string,
  userId?: string,
  projectContext?: string
): Promise<{
  analysis: LogAnalysisResult;
  autoFixResult?: {
    success: boolean;
    message: string;
    prUrl?: string;
    error?: string;
  };
}> {
  const service = getLogAnalysisService();
  return service.analyzeAndAutoFix(logContent, projectId, githubUrl, userId, projectContext);
}