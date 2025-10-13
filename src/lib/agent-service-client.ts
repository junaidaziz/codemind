/**
 * Agent Service Client
 * HTTP client for communicating with the standalone agent service
 */

import { z } from 'zod';

// Import types from the agent service
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

export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;
export type AgentStreamChunk = z.infer<typeof AgentStreamChunkSchema>;

export interface AgentClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export class AgentServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly requestId?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentServiceError';
  }
}

/**
 * HTTP client for the CodeMind Agent Service
 */
export class AgentServiceClient {
  private config: Required<AgentClientConfig>;

  constructor(config: AgentClientConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
      apiKey: config.apiKey || '',
      timeout: config.timeout || 30000, // 30 seconds
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000, // 1 second
    };
  }

  /**
   * Process an agent request
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const validatedRequest = AgentRequestSchema.parse(request);

    return this.makeRequest('/api/agent/process', {
      method: 'POST',
      body: JSON.stringify(validatedRequest),
    });
  }

  /**
   * Process request with streaming response
   */
  async *processRequestStream(request: AgentRequest): AsyncGenerator<AgentStreamChunk, void, unknown> {
    const validatedRequest = AgentRequestSchema.parse(request);

    const response = await this.makeRequest('/api/agent/stream', {
      method: 'POST',
      body: JSON.stringify(validatedRequest),
      stream: true,
    });

    if (!response.body) {
      throw new AgentServiceError('No response body for stream', 'NO_STREAM_BODY');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              const streamChunk = AgentStreamChunkSchema.parse(data);
              yield streamChunk;

              // Break on done signal
              if (streamChunk.type === 'done') {
                return;
              }

              // Throw on error
              if (streamChunk.type === 'error') {
                throw new AgentServiceError(
                  streamChunk.error || 'Stream processing error',
                  'STREAM_ERROR',
                  500,
                  streamChunk.requestId
                );
              }
            } catch {
              // Skip invalid JSON chunks
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get agent service capabilities
   */
  async getCapabilities(): Promise<{
    commands: string[];
    tools: string[];
    limits: {
      maxMessageLength: number;
      maxTokens: number;
      maxToolExecutions: number;
    };
    version: string;
  }> {
    return this.makeRequest('/api/agent/capabilities', {
      method: 'GET',
    });
  }

  /**
   * Check agent service health
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    activeConnections: number;
    totalRequests: number;
  }> {
    return this.makeRequest('/health', {
      method: 'GET',
    });
  }

  /**
   * Get service metrics
   */
  async getMetrics(): Promise<{
    uptime: number;
    totalRequests: number;
    activeConnections: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    environment: string;
    version: string;
  }> {
    return this.makeRequest('/api/metrics', {
      method: 'GET',
    });
  }

  /**
   * Make HTTP request to agent service
   */
  private async makeRequest(
    endpoint: string,
    options: {
      method: 'GET' | 'POST';
      body?: string;
      stream?: boolean;
    }
  ): Promise<unknown> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const requestId = crypto.randomUUID();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      'User-Agent': 'CodeMind-WebApp/1.0',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method: options.method,
          headers,
          body: options.body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle streaming response
        if (options.stream) {
          if (!response.ok) {
            const errorText = await response.text();
            throw new AgentServiceError(
              errorText || `HTTP ${response.status}`,
              'HTTP_ERROR',
              response.status,
              requestId
            );
          }
          return response;
        }

        // Handle JSON response
        if (!response.ok) {
          let errorData: Record<string, unknown> = {};
          try {
            errorData = await response.json();
          } catch {
            errorData = { message: `HTTP ${response.status}` };
          }

          throw new AgentServiceError(
            errorData.message || `HTTP ${response.status}`,
            errorData.error || 'HTTP_ERROR',
            response.status,
            errorData.requestId || requestId,
            errorData.metadata
          );
        }

        const data = await response.json();
        return data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on certain error types
        if (error instanceof AgentServiceError) {
          if (error.statusCode === 400 || error.statusCode === 401 || error.statusCode === 403) {
            throw error; // Don't retry validation or auth errors
          }
        }

        // Don't retry on last attempt
        if (attempt === this.config.retries) {
          break;
        }

        // Wait before retry
        await this.sleep(this.config.retryDelay * Math.pow(2, attempt)); // Exponential backoff
      }
    }

    throw lastError || new AgentServiceError('Max retries exceeded', 'MAX_RETRIES_EXCEEDED', 500, requestId);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update client configuration
   */
  updateConfig(config: Partial<AgentClientConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      baseUrl: (config.baseUrl || this.config.baseUrl).replace(/\/$/, ''),
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): AgentClientConfig {
    return { ...this.config };
  }
}

/**
 * Create agent service client with environment-based configuration
 */
export function createAgentServiceClient(overrides?: Partial<AgentClientConfig>): AgentServiceClient {
  const config: AgentClientConfig = {
    baseUrl: process.env.AGENT_SERVICE_URL || 'http://localhost:3001',
    apiKey: process.env.AGENT_SERVICE_API_KEY,
    timeout: parseInt(process.env.AGENT_SERVICE_TIMEOUT || '30000'),
    retries: parseInt(process.env.AGENT_SERVICE_RETRIES || '3'),
    retryDelay: parseInt(process.env.AGENT_SERVICE_RETRY_DELAY || '1000'),
    ...overrides,
  };

  return new AgentServiceClient(config);
}

/**
 * Singleton agent service client for the application
 */
let defaultClient: AgentServiceClient | null = null;

export function getAgentServiceClient(): AgentServiceClient {
  if (!defaultClient) {
    defaultClient = createAgentServiceClient();
  }
  return defaultClient;
}

/**
 * Reset the default client (useful for testing)
 */
export function resetAgentServiceClient(): void {
  defaultClient = null;
}