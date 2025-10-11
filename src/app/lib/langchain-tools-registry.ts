import { Tool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from './logger';

// Zod schema for tool configuration
export const ToolConfigSchema = z.object({
  name: z.string().min(1, 'Tool name is required'),
  description: z.string().min(1, 'Tool description is required'),
  enabled: z.boolean().default(true),
  rateLimit: z.object({
    maxCalls: z.number().min(1).default(100),
    windowMs: z.number().min(1000).default(60000), // 1 minute default
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ToolRegistryConfigSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  tools: z.array(ToolConfigSchema),
  globalSettings: z.object({
    maxConcurrentTools: z.number().min(1).default(3),
    timeout: z.number().min(1000).default(30000), // 30 seconds default
    enableLogging: z.boolean().default(true),
  }).optional(),
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type ToolRegistryConfig = z.infer<typeof ToolRegistryConfigSchema>;

// Tool execution result interface
export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTimeMs: number;
  toolName: string;
  timestamp: Date;
}

// Tool usage statistics interface
export interface ToolUsageStats {
  toolName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  lastUsed: Date;
}

// Rate limiting interface
interface RateLimiter {
  canExecute(toolName: string, config?: ToolConfig): boolean;
  recordExecution(toolName: string, config?: ToolConfig): void;
}

/**
 * Simple in-memory rate limiter for tool execution
 */
class MemoryRateLimiter implements RateLimiter {
  private callCounts: Map<string, { count: number; windowStart: number }> = new Map();

  canExecute(toolName: string, config?: ToolConfig): boolean {
    if (!config?.rateLimit) return true;

    const now = Date.now();
    const key = toolName;
    const current = this.callCounts.get(key);

    if (!current) {
      return true;
    }

    // Reset window if expired
    if (now - current.windowStart >= config.rateLimit.windowMs) {
      this.callCounts.delete(key);
      return true;
    }

    return current.count < config.rateLimit.maxCalls;
  }

  recordExecution(toolName: string, config?: ToolConfig): void {
    if (!config?.rateLimit) return;

    const now = Date.now();
    const key = toolName;
    const current = this.callCounts.get(key);

    if (!current || now - current.windowStart >= config.rateLimit.windowMs) {
      this.callCounts.set(key, { count: 1, windowStart: now });
    } else {
      current.count++;
    }
  }
}

/**
 * CodeMind Tool Registry - Manages and executes tools for projects
 */
export class CodeMindToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private configs: Map<string, ToolConfig> = new Map();
  private stats: Map<string, ToolUsageStats> = new Map();
  private rateLimiter: RateLimiter = new MemoryRateLimiter();
  private config: ToolRegistryConfig;

  constructor(config: ToolRegistryConfig) {
    this.config = ToolRegistryConfigSchema.parse(config);
    logger.info('CodeMindToolRegistry initialized', {
      projectId: this.config.projectId,
      userId: this.config.userId,
      toolCount: this.config.tools.length,
    });
  }

  /**
   * Register a new tool with the registry
   */
  registerTool(tool: Tool, config: ToolConfig): void {
    const validatedConfig = ToolConfigSchema.parse(config);
    
    this.tools.set(validatedConfig.name, tool);
    this.configs.set(validatedConfig.name, validatedConfig);
    
    // Initialize stats
    this.stats.set(validatedConfig.name, {
      toolName: validatedConfig.name,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageExecutionTime: 0,
      lastUsed: new Date(),
    });

    logger.info('Tool registered', {
      toolName: validatedConfig.name,
      projectId: this.config.projectId,
    });
  }

  /**
   * Get all available tools for the current project
   */
  getAvailableTools(): Tool[] {
    return Array.from(this.tools.values()).filter(tool => {
      const config = this.configs.get(tool.name);
      return config?.enabled !== false;
    });
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): Tool | undefined {
    const config = this.configs.get(name);
    if (!config?.enabled) {
      return undefined;
    }
    return this.tools.get(name);
  }

  /**
   * Execute a tool with rate limiting and error handling
   */
  async executeTool(
    toolName: string, 
    input: string
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tool = this.getTool(toolName);
    const config = this.configs.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not found or disabled`,
        executionTimeMs: 0,
        toolName,
        timestamp: new Date(),
      };
    }

    // Check rate limiting
    if (!this.rateLimiter.canExecute(toolName, config)) {
      return {
        success: false,
        error: `Rate limit exceeded for tool '${toolName}'`,
        executionTimeMs: 0,
        toolName,
        timestamp: new Date(),
      };
    }

    try {
      // Execute with timeout
      const timeout = this.config.globalSettings?.timeout || 30000;
      const result = await Promise.race([
        tool.call(input),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
        ),
      ]);

      const executionTime = Date.now() - startTime;

      // Record successful execution
      this.rateLimiter.recordExecution(toolName, config);
      this.updateStats(toolName, executionTime, true);

      const executionResult: ToolExecutionResult = {
        success: true,
        result,
        executionTimeMs: executionTime,
        toolName,
        timestamp: new Date(),
      };

      if (this.config.globalSettings?.enableLogging) {
        logger.info('Tool executed successfully', {
          toolName,
          executionTimeMs: executionTime,
          projectId: this.config.projectId,
        });
      }

      return executionResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateStats(toolName, executionTime, false);

      const executionResult: ToolExecutionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: executionTime,
        toolName,
        timestamp: new Date(),
      };

      logger.error('Tool execution failed', {
        toolName,
        error: executionResult.error,
        executionTimeMs: executionTime,
        projectId: this.config.projectId,
      });

      return executionResult;
    }
  }

  /**
   * Execute multiple tools concurrently with limits
   */
  async executeTools(
    toolExecutions: Array<{ toolName: string; input: string }>
  ): Promise<ToolExecutionResult[]> {
    const maxConcurrent = this.config.globalSettings?.maxConcurrentTools || 3;
    const results: ToolExecutionResult[] = [];

    // Execute in batches to respect concurrency limits
    for (let i = 0; i < toolExecutions.length; i += maxConcurrent) {
      const batch = toolExecutions.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(({ toolName, input }) =>
        this.executeTool(toolName, input)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get usage statistics for all tools
   */
  getToolStats(): ToolUsageStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get statistics for a specific tool
   */
  getToolStat(toolName: string): ToolUsageStats | undefined {
    return this.stats.get(toolName);
  }

  /**
   * Clear all tools and reset registry
   */
  clear(): void {
    this.tools.clear();
    this.configs.clear();
    this.stats.clear();
    
    logger.info('Tool registry cleared', {
      projectId: this.config.projectId,
    });
  }

  /**
   * Update tool usage statistics
   */
  private updateStats(toolName: string, executionTime: number, success: boolean): void {
    const stats = this.stats.get(toolName);
    if (!stats) return;

    stats.totalCalls++;
    stats.lastUsed = new Date();

    if (success) {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
    }

    // Update rolling average execution time
    const previousAvg = stats.averageExecutionTime;
    const totalSuccessful = stats.successfulCalls;
    
    if (success && totalSuccessful > 0) {
      stats.averageExecutionTime = 
        (previousAvg * (totalSuccessful - 1) + executionTime) / totalSuccessful;
    }
  }

  /**
   * Export tool registry configuration
   */
  exportConfig(): ToolRegistryConfig {
    return {
      ...this.config,
      tools: Array.from(this.configs.values()),
    };
  }
}

/**
 * Create a tool registry for a specific project
 */
export function createToolRegistry(config: ToolRegistryConfig): CodeMindToolRegistry {
  return new CodeMindToolRegistry(config);
}

/**
 * Helper to validate tool input with Zod
 */
export function validateToolInput<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}