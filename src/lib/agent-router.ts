import { AgentServiceClient, AgentRequest, AgentResponse, AgentStreamChunk } from './agent-service-client';
import { createEnhancedRAGChain, AgentCommand } from '../app/lib/langchain-agent';
import { parseFixCommand, startAutoFix } from './auto-fix-orchestrator';
import { env } from '../types/env';
import { logger } from '../app/lib/logger';

/**
 * Agent Router - Routes requests between local agent and external agent service
 * Provides seamless fallback and feature flags for agent deployment
 */
export class AgentRouter {
  private agentServiceClient: AgentServiceClient | null = null;
  private useStandaloneAgent: boolean;

  constructor() {
    this.useStandaloneAgent = env.ENABLE_STANDALONE_AGENT === 'true';
    
    if (this.useStandaloneAgent) {
      this.agentServiceClient = new AgentServiceClient({
        baseUrl: env.AGENT_SERVICE_URL,
        apiKey: env.AGENT_SERVICE_API_KEY,
        timeout: env.AGENT_SERVICE_TIMEOUT,
        retries: env.AGENT_SERVICE_RETRIES,
        retryDelay: env.AGENT_SERVICE_RETRY_DELAY,
      });

      logger.info('Agent Router initialized with standalone agent service', {
        agentServiceUrl: env.AGENT_SERVICE_URL,
        timeout: env.AGENT_SERVICE_TIMEOUT,
      });
    } else {
      logger.info('Agent Router initialized with local agent processing');
    }
  }

  /**
   * Process agent request - automatically routes to best available option
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    if (this.useStandaloneAgent && this.agentServiceClient) {
      try {
        return await this.processWithStandaloneAgent(request);
      } catch (error) {
        logger.warn('Standalone agent failed, falling back to local agent', {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: request.id,
        });
        
        // Fallback to local agent
        return this.processWithLocalAgent(request);
      }
    } else {
      return this.processWithLocalAgent(request);
    }
  }

  /**
   * Process request with streaming - routes to appropriate service
   */
  async *processRequestStream(request: AgentRequest): AsyncGenerator<AgentStreamChunk, void, unknown> {
    if (this.useStandaloneAgent && this.agentServiceClient) {
      try {
        yield* this.streamWithStandaloneAgent(request);
        return;
      } catch (error) {
        logger.warn('Standalone agent stream failed, falling back to local agent', {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: request.id,
        });
        
        // Fallback to local agent streaming
        yield* this.streamWithLocalAgent(request);
      }
    } else {
      yield* this.streamWithLocalAgent(request);
    }
  }

  /**
   * Process request using standalone agent service
   */
  private async processWithStandaloneAgent(request: AgentRequest): Promise<AgentResponse> {
    if (!this.agentServiceClient) {
      throw new Error('Agent service client not initialized');
    }

    logger.info('Processing request with standalone agent', {
      command: request.command,
      projectId: request.projectId,
      userId: request.userId,
    });

    const startTime = Date.now();
    const response = await this.agentServiceClient.processRequest(request);
    
    logger.info('Standalone agent request completed', {
      executionTimeMs: Date.now() - startTime,
      responseLength: response.response.length,
      toolsUsed: response.toolsUsed.length,
    });

    return response;
  }

  /**
   * Process request using local agent
   */
  private async processWithLocalAgent(request: AgentRequest): Promise<AgentResponse> {
    logger.info('Processing request with local agent', {
      command: request.command,
      projectId: request.projectId,
      userId: request.userId,
    });

    const startTime = Date.now();
    
    // Convert AgentRequest to AgentCommand format for legacy compatibility
    const agentCommand: AgentCommand = {
      command: request.command,
      projectId: request.projectId,
      userId: request.userId,
      sessionId: request.sessionId,
      context: request.context,
      message: request.message,
    };

    // Detect /fix style command before default RAG processing
    const fixCmd = parseFixCommand(request.message || request.command || '');
    if (fixCmd) {
      try {
        const plan = await startAutoFix({
          projectId: request.projectId,
            userId: request.userId,
            issueNumber: fixCmd.issueNumber,
        });
        return {
          id: crypto.randomUUID(),
          requestId: request.id,
          response: `🔧 AutoFix session started (id: ${plan.sessionId})${plan.issueId ? ` for issue ${fixCmd.issueNumber}` : ''}.\nSteps:\n- ${plan.steps.join('\n- ')}\n\n(Phase 1 stub – patch generation not yet implemented)`,
          toolsUsed: [],
          executionTimeMs: Date.now() - startTime,
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          metadata: { command: request.command, projectId: request.projectId, userId: request.userId, modelUsed: 'gpt-4o-mini', intermediateSteps: 0, memorySize: 0, sessionId: plan.sessionId },
        };
      } catch (e) {
        return {
          id: crypto.randomUUID(),
          requestId: request.id,
          response: `AutoFix initialization failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
          toolsUsed: [],
          executionTimeMs: Date.now() - startTime,
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          metadata: { command: request.command, projectId: request.projectId, userId: request.userId, modelUsed: 'gpt-4o-mini', intermediateSteps: 0, memorySize: 0 },
        };
      }
    }

    // Create enhanced RAG chain
    const chain = await createEnhancedRAGChain(
      request.projectId,
      request.userId,
      request.sessionId
    );

    const localResponse = await chain.executeCommand(agentCommand);

    // Convert local response to AgentResponse format
    const response: AgentResponse = {
      id: crypto.randomUUID(),
      requestId: request.id,
      response: localResponse.response,
      toolsUsed: localResponse.toolsUsed.map((tool: string) => ({
        name: tool,
        input: '',
        output: '',
        success: true,
        executionTimeMs: 100, // Placeholder
      })),
      executionTimeMs: localResponse.executionTime,
      tokenUsage: {
        promptTokens: Math.ceil(request.message.length / 4),
        completionTokens: Math.ceil(localResponse.response.length / 4),
        totalTokens: Math.ceil((request.message.length + localResponse.response.length) / 4),
      },
      metadata: {
        command: request.command,
        projectId: request.projectId,
        userId: request.userId,
        sessionId: request.sessionId,
        modelUsed: 'gpt-4o-mini',
        intermediateSteps: localResponse.metadata?.intermediateSteps as number || 0,
        memorySize: localResponse.metadata?.memorySize as number || 0,
      },
    };

    logger.info('Local agent request completed', {
      executionTimeMs: Date.now() - startTime,
      responseLength: response.response.length,
      toolsUsed: response.toolsUsed.length,
    });

    return response;
  }

  /**
   * Stream request using standalone agent service
   */
  private async *streamWithStandaloneAgent(request: AgentRequest): AsyncGenerator<AgentStreamChunk, void, unknown> {
    if (!this.agentServiceClient) {
      throw new Error('Agent service client not initialized');
    }

    logger.info('Streaming request with standalone agent', {
      command: request.command,
      projectId: request.projectId,
    });

    yield* this.agentServiceClient.processRequestStream(request);
  }

  /**
   * Stream request using local agent
   */
  private async *streamWithLocalAgent(request: AgentRequest): AsyncGenerator<AgentStreamChunk, void, unknown> {
    logger.info('Streaming request with local agent', {
      command: request.command,
      projectId: request.projectId,
    });

    // Convert to AgentCommand for legacy compatibility
    const agentCommand: AgentCommand = {
      command: request.command,
      projectId: request.projectId,
      userId: request.userId,
      sessionId: request.sessionId,
      context: request.context,
      message: request.message,
    };

    const chain = await createEnhancedRAGChain(
      request.projectId,
      request.userId,
      request.sessionId
    );

    // Stream the local agent response
    for await (const chunk of chain.streamCommand(agentCommand)) {
      const streamChunk: AgentStreamChunk = {
        id: crypto.randomUUID(),
        requestId: request.id,
        type: 'content',
        content: chunk,
      };

      yield streamChunk;
    }

    // Send completion signal
    const doneChunk: AgentStreamChunk = {
      id: crypto.randomUUID(),
      requestId: request.id,
      type: 'done',
    };

    yield doneChunk;
  }

  /**
   * Check health of agent services
   */
  async checkHealth(): Promise<{
    localAgent: { status: 'healthy' | 'unhealthy'; message: string };
    standaloneAgent: { status: 'healthy' | 'unhealthy'; message: string } | null;
    activeService: 'local' | 'standalone';
  }> {
    const health = {
      localAgent: { status: 'healthy' as const, message: 'Local agent available' },
      standaloneAgent: null as { status: 'healthy' | 'unhealthy'; message: string } | null,
      activeService: this.useStandaloneAgent ? 'standalone' as const : 'local' as const,
    };

    // Check standalone agent if enabled
    if (this.useStandaloneAgent && this.agentServiceClient) {
      try {
        const agentHealth = await this.agentServiceClient.checkHealth();
        health.standaloneAgent = {
          status: agentHealth.status,
          message: `Agent service ${agentHealth.status} (uptime: ${Math.round(agentHealth.uptime / 1000)}s)`,
        };
      } catch (error) {
        health.standaloneAgent = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Connection failed',
        };
      }
    }

    return health;
  }

  /**
   * Get service metrics and capabilities
   */
  async getServiceInfo(): Promise<{
    activeService: 'local' | 'standalone';
    capabilities: string[];
    version: string;
    metrics?: unknown;
  }> {
    if (this.useStandaloneAgent && this.agentServiceClient) {
      try {
        const [capabilities, metrics] = await Promise.all([
          this.agentServiceClient.getCapabilities(),
          this.agentServiceClient.getMetrics().catch(() => null),
        ]);

        return {
          activeService: 'standalone',
          capabilities: capabilities.commands,
          version: capabilities.version,
          metrics,
        };
      } catch (error) {
        logger.warn('Failed to get standalone agent info', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Return local agent info
    return {
      activeService: 'local',
      capabilities: ['summarize_project', 'explain_function', 'generate_tests', 'analyze_code', 'chat'],
      version: '1.0.0',
    };
  }

  /**
   * Update configuration (for testing or runtime changes)
   */
  updateConfiguration(config: {
    useStandaloneAgent?: boolean;
    agentServiceUrl?: string;
    apiKey?: string;
  }): void {
    if (config.useStandaloneAgent !== undefined) {
      this.useStandaloneAgent = config.useStandaloneAgent;
    }

    if (this.useStandaloneAgent) {
      if (!this.agentServiceClient) {
        this.agentServiceClient = new AgentServiceClient({
          baseUrl: config.agentServiceUrl || env.AGENT_SERVICE_URL,
          apiKey: config.apiKey || env.AGENT_SERVICE_API_KEY,
          timeout: env.AGENT_SERVICE_TIMEOUT,
          retries: env.AGENT_SERVICE_RETRIES,
          retryDelay: env.AGENT_SERVICE_RETRY_DELAY,
        });
      } else {
        this.agentServiceClient.updateConfig({
          baseUrl: config.agentServiceUrl,
          apiKey: config.apiKey,
        });
      }
    }

    logger.info('Agent Router configuration updated', {
      useStandaloneAgent: this.useStandaloneAgent,
      agentServiceUrl: config.agentServiceUrl,
    });
  }
}

// Singleton instance for the application
let agentRouter: AgentRouter | null = null;

export function getAgentRouter(): AgentRouter {
  if (!agentRouter) {
    agentRouter = new AgentRouter();
  }
  return agentRouter;
}

/**
 * Reset the agent router (useful for testing)
 */
export function resetAgentRouter(): void {
  agentRouter = null;
}