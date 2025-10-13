import { Tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { v4 as uuidv4 } from 'uuid';
import { agentLogger } from './logger.js';
import { env } from './env.js';
import { 
  AgentRequest, 
  AgentResponse, 
  AgentStreamChunk, 
  ProcessingError,
  ValidationError,
  AgentRequestSchema,
  AgentResponseSchema,
  AgentStreamChunkSchema
} from './types.js';

/**
 * Core Agent Processor
 * Handles AI agent processing independently from Next.js web application
 */
export class AgentCore {
  private agent: AgentExecutor | null = null;
  private model: ChatOpenAI;
  private isInitialized = false;
  private readonly requestId: string;

  constructor(requestId?: string) {
    this.requestId = requestId || uuidv4();
    
    // Initialize OpenAI model
    this.model = new ChatOpenAI({
      openAIApiKey: env.OPENAI_API_KEY,
      modelName: env.OPENAI_MODEL,
      temperature: parseFloat(env.OPENAI_TEMPERATURE),
      maxTokens: parseInt(env.OPENAI_MAX_TOKENS),
    });
  }

  /**
   * Initialize the agent with minimal tools
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      agentLogger.info('Initializing Agent Core', { requestId: this.requestId });

      // Create basic tools
      const tools = await this.createBasicTools();

      // Create the prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', `You are CodeMind, an AI assistant specialized in code analysis and development tasks.

You have access to various tools that can help you analyze code, generate documentation, and provide development assistance.

Guidelines:
- Provide accurate, helpful responses with clear explanations
- Use tools when additional information would be helpful
- Structure your responses clearly with proper formatting
- When analyzing code, mention best practices and potential improvements
- If you can't find relevant information, say so clearly

Available tools: {tools}
Tool names: {tool_names}`],
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
      ]);

      // Create the agent
      const agent = await createToolCallingAgent({
        llm: this.model,
        tools,
        prompt,
      });

      // Create the agent executor
      this.agent = new AgentExecutor({
        agent,
        tools,
        verbose: env.NODE_ENV === 'development',
        maxIterations: 10,
        returnIntermediateSteps: true,
      });

      this.isInitialized = true;
      agentLogger.info('Agent Core initialized successfully', { 
        requestId: this.requestId,
        toolCount: tools.length 
      });

    } catch (error) {
      agentLogger.error('Failed to initialize Agent Core', { 
        requestId: this.requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new ProcessingError('Failed to initialize agent', {
        requestId: this.requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Process an agent request
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // Validate request
      const validatedRequest = AgentRequestSchema.parse(request);
      
      agentLogger.execution('Processing agent request', {
        requestId: this.requestId,
        command: validatedRequest.command,
        projectId: validatedRequest.projectId,
        userId: validatedRequest.userId,
        sessionId: validatedRequest.sessionId
      });

      // Initialize if needed
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Prepare input based on command type
      const input = this.prepareAgentInput(validatedRequest);

      // Execute the agent
      const result = await this.agent!.invoke({
        input,
        chat_history: '', // No persistent memory in standalone service
      });

      // Extract tool usage information
      const toolsUsed = this.extractToolUsage(result.intermediateSteps || []);
      
      const executionTime = Date.now() - startTime;

      // Create response
      const response: AgentResponse = {
        id: uuidv4(),
        requestId: this.requestId,
        response: result.output,
        toolsUsed,
        executionTimeMs: executionTime,
        tokenUsage: this.estimateTokenUsage(validatedRequest.message, result.output),
        metadata: {
          command: validatedRequest.command,
          projectId: validatedRequest.projectId,
          userId: validatedRequest.userId,
          sessionId: validatedRequest.sessionId,
          modelUsed: env.OPENAI_MODEL,
          intermediateSteps: result.intermediateSteps?.length || 0,
          memorySize: validatedRequest.message.length + result.output.length,
        },
      };

      agentLogger.performance('Agent request completed', {
        executionTimeMs: executionTime,
        tokenUsage: response.tokenUsage?.totalTokens,
        toolExecutions: toolsUsed.length
      });

      return AgentResponseSchema.parse(response);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      agentLogger.error('Agent request failed', {
        requestId: this.requestId,
        executionTimeMs: executionTime,
        error: errorMessage
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      // Return error response instead of throwing
      return {
        id: uuidv4(),
        requestId: this.requestId,
        response: `I apologize, but I encountered an error while processing your request: ${errorMessage}`,
        toolsUsed: [],
        executionTimeMs: executionTime,
        error: errorMessage,
        metadata: {
          command: request.command || 'unknown',
          projectId: request.projectId || 'unknown',
          userId: request.userId || 'unknown',
          modelUsed: env.OPENAI_MODEL,
          intermediateSteps: 0,
          memorySize: 0,
        },
      };
    }
  }

  /**
   * Process request as stream (for real-time responses)
   */
  async *processRequestStream(request: AgentRequest): AsyncGenerator<AgentStreamChunk, void, unknown> {
    try {
      const validatedRequest = AgentRequestSchema.parse(request);
      
      // Initialize if needed
      if (!this.isInitialized) {
        await this.initialize();
      }

      const input = this.prepareAgentInput(validatedRequest);

      // Stream the agent response
      const stream = await this.agent!.stream({
        input,
        chat_history: '',
      });

      for await (const chunk of stream) {
        if (chunk.agent && chunk.agent.messages) {
          for (const message of chunk.agent.messages) {
            if (message.content) {
              const streamChunk: AgentStreamChunk = {
                id: uuidv4(),
                requestId: this.requestId,
                type: 'content',
                content: message.content,
              };

              yield AgentStreamChunkSchema.parse(streamChunk);
            }
          }
        }

        // Handle tool calls
        if (chunk.tools && chunk.tools.length > 0) {
          for (const tool of chunk.tools) {
            const toolChunk: AgentStreamChunk = {
              id: uuidv4(),
              requestId: this.requestId,
              type: 'tool',
              tool: {
                name: tool.name || 'unknown',
                status: 'start',
                input: JSON.stringify(tool.input || {}),
              },
            };

            yield AgentStreamChunkSchema.parse(toolChunk);
          }
        }
      }

      // Send completion signal
      const doneChunk: AgentStreamChunk = {
        id: uuidv4(),
        requestId: this.requestId,
        type: 'done',
      };

      yield AgentStreamChunkSchema.parse(doneChunk);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      const errorChunk: AgentStreamChunk = {
        id: uuidv4(),
        requestId: this.requestId,
        type: 'error',
        error: errorMessage,
      };

      yield AgentStreamChunkSchema.parse(errorChunk);
    }
  }

  /**
   * Create basic tools for the agent
   */
  private async createBasicTools(): Promise<Tool[]> {
    const tools: Tool[] = [];

    // Basic analysis tool
    class CodeAnalysisTool extends Tool {
      name = 'code_analysis';
      description = 'Analyze code for quality, patterns, and potential improvements';

      async _call(_input: string): Promise<string> {
        try {
          // This would integrate with external services or databases
          // For now, return a structured analysis
          return JSON.stringify({
            success: true,
            analysis: {
              codeQuality: 'Analysis completed',
              suggestions: ['Use consistent formatting', 'Add error handling', 'Consider type safety'],
              patterns: ['Standard patterns detected'],
            },
          });
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Analysis failed',
          });
        }
      }
    }

    tools.push(new CodeAnalysisTool());

    return tools;
  }

  /**
   * Prepare agent input based on command type
   */
  private prepareAgentInput(request: AgentRequest): string {
    const { command, context, message } = request;

    switch (command) {
      case 'summarize_project':
        return `Please provide a comprehensive summary of this project. Include:
- Overall architecture and structure
- Key technologies and frameworks used
- Main features and functionality
- Code quality and patterns observed
- Potential areas for improvement

User query: ${message}`;

      case 'explain_function':
        const functionContext = context?.functionName 
          ? `Focus on the function: ${context.functionName}` 
          : '';
        const fileContext = context?.filePath 
          ? `In file: ${context.filePath}` 
          : '';
        const codeContext = context?.codeSnippet 
          ? `Code snippet: ${context.codeSnippet}` 
          : '';

        return `Please explain this function in detail. ${functionContext} ${fileContext} ${codeContext}

Include:
- What the function does and its purpose
- Parameters and return values
- Algorithm or logic explanation
- Potential issues or improvements
- Usage examples if relevant

User query: ${message}`;

      case 'generate_tests':
        return `Please generate comprehensive test cases for the specified code. Include:
- Unit tests covering normal cases
- Edge cases and error conditions
- Mock setup if needed
- Test data and assertions
- Best practices for testing this type of code

${context?.filePath ? `File: ${context.filePath}` : ''}
${context?.functionName ? `Function: ${context.functionName}` : ''}
${context?.codeSnippet ? `Code: ${context.codeSnippet}` : ''}

User query: ${message}`;

      case 'analyze_code':
        return `Please analyze this code for:
- Code quality and best practices
- Performance considerations
- Security implications
- Maintainability and readability
- Potential bugs or issues
- Suggestions for improvement

${context?.filePath ? `File: ${context.filePath}` : ''}
${context?.codeSnippet ? `Code: ${context.codeSnippet}` : ''}

User query: ${message}`;

      case 'chat':
      default:
        return message;
    }
  }

  /**
   * Extract tool usage from intermediate steps
   */
  private extractToolUsage(intermediateSteps: unknown[]): Array<{
    name: string;
    input: string;
    output: string;
    success: boolean;
    executionTimeMs: number;
  }> {
    return intermediateSteps.map((step, index) => ({
      name: step.action?.tool || `tool_${index}`,
      input: JSON.stringify(step.action?.toolInput || {}),
      output: step.observation || '',
      success: !step.observation?.includes('error'),
      executionTimeMs: 100, // Placeholder - would need proper timing
    }));
  }

  /**
   * Estimate token usage (rough calculation)
   */
  private estimateTokenUsage(input: string, output: string): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    // Rough estimation: ~4 characters per token
    const promptTokens = Math.ceil(input.length / 4);
    const completionTokens = Math.ceil(output.length / 4);
    
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.agent = null;
    this.isInitialized = false;
    agentLogger.info('Agent Core disposed', { requestId: this.requestId });
  }
}