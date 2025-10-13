import { z } from 'zod';

// Agent Request/Response Schemas
export const AgentRequestSchema = z.object({
  id: z.string().uuid().optional(),
  command: z.enum(['summarize_project', 'explain_function', 'generate_tests', 'analyze_code', 'chat']),
  projectId: z.string().min(1, 'Project ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  sessionId: z.string().optional(),
  context: z.object({
    filePath: z.string().optional(),
    functionName: z.string().optional(),
    codeSnippet: z.string().optional(),
    query: z.string().optional(),
  }).optional(),
  message: z.string().min(1, 'Message cannot be empty').max(4000, 'Message too long'),
  options: z.object({
    enableTools: z.boolean().default(true),
    maxToolExecutions: z.number().min(1).max(10).default(5),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(1).max(4000).default(1000),
  }).optional(),
});

export const AgentResponseSchema = z.object({
  id: z.string(),
  requestId: z.string().optional(),
  response: z.string(),
  toolsUsed: z.array(z.object({
    name: z.string(),
    input: z.string(),
    output: z.string(),
    success: z.boolean(),
    executionTimeMs: z.number(),
  })),
  executionTimeMs: z.number(),
  tokenUsage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }).optional(),
  metadata: z.object({
    command: z.string(),
    projectId: z.string(),
    userId: z.string(),
    sessionId: z.string().optional(),
    modelUsed: z.string(),
    intermediateSteps: z.number(),
    memorySize: z.number(),
  }).optional(),
  error: z.string().optional(),
});

export const AgentHealthSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
  memoryUsage: z.object({
    used: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
  activeConnections: z.number(),
  totalRequests: z.number(),
});

// Stream Response Schemas
export const AgentStreamChunkSchema = z.object({
  id: z.string(),
  requestId: z.string().optional(),
  type: z.enum(['content', 'tool', 'error', 'done']),
  content: z.string().optional(),
  tool: z.object({
    name: z.string(),
    status: z.enum(['start', 'end']),
    input: z.string().optional(),
    output: z.string().optional(),
  }).optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Type exports
export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;
export type AgentHealth = z.infer<typeof AgentHealthSchema>;
export type AgentStreamChunk = z.infer<typeof AgentStreamChunkSchema>;

// Error types
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class ValidationError extends AgentError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, metadata);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends AgentError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, metadata);
    this.name = 'RateLimitError';
  }
}

export class ProcessingError extends AgentError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'PROCESSING_ERROR', 500, metadata);
    this.name = 'ProcessingError';
  }
}