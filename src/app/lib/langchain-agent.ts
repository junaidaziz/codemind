import { Tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { logger } from './logger';
import { CodeMindVectorStore } from './langchain-vectorstore';
import { CodeMindChatMemory } from './langchain-memory';
import { CodeMindToolRegistry, createToolRegistry, ToolConfig } from './langchain-tools-registry';
import { createGitHubTools } from './langchain-tools-github';
import { createNPMTools } from './langchain-tools-npm';
import { createDocumentationTools } from './langchain-tools-docs';
import { toolAnalytics } from './langchain-tools-analytics';
import { agentMemoryTracker } from './langchain-memory-analytics';
import { env } from '../../types/env';
import prisma from './db';

// Developer Agent command schemas
export const AgentCommandSchema = z.object({
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
});

export const AgentResponseSchema = z.object({
  response: z.string(),
  toolsUsed: z.array(z.string()),
  executionTime: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Input/Output schemas for the enhanced RAG chain
export const EnhancedRAGInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(2000, 'Query too long'),
  projectId: z.string().min(1, 'Project ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  sessionId: z.string().optional(),
  enableTools: z.boolean().default(true),
  maxToolExecutions: z.number().min(1).max(10).default(5),
});

export const EnhancedRAGOutputSchema = z.object({
  answer: z.string(),
  sources: z.array(z.object({
    path: z.string(),
    startLine: z.number(),
    endLine: z.number(),
    language: z.string(),
    similarity: z.number(),
  })),
  toolsUsed: z.array(z.object({
    name: z.string(),
    input: z.string(),
    output: z.string(),
    success: z.boolean(),
    executionTimeMs: z.number(),
  })),
  sessionId: z.string(),
  tokenUsage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }),
  executionTimeMs: z.number(),
});

export type AgentCommand = z.infer<typeof AgentCommandSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;
export type EnhancedRAGInput = z.infer<typeof EnhancedRAGInputSchema>;
export type EnhancedRAGOutput = z.infer<typeof EnhancedRAGOutputSchema>;

/**
 * Enhanced RAG Chain with Tool Integration
 */
export class EnhancedRAGChain {
  private vectorStore: CodeMindVectorStore | null = null;
  private memory: CodeMindChatMemory | null = null;
  private toolRegistry: CodeMindToolRegistry | null = null;
  private agent: AgentExecutor | null = null;
  private projectId: string;
  private userId: string;

  constructor(projectId: string, userId: string) {
    this.projectId = projectId;
    this.userId = userId;
  }

  /**
   * Initialize the enhanced RAG chain with tools
   */
  async initialize(sessionId?: string, githubToken?: string): Promise<void> {
    logger.info('Initializing Enhanced RAG Chain', {
      projectId: this.projectId,
      userId: this.userId,
      sessionId,
    });

    try {
      // Initialize vector store
      this.vectorStore = await CodeMindVectorStore.fromProjectId(this.projectId);

      // Initialize memory if session provided
      if (sessionId) {
        this.memory = new CodeMindChatMemory({ sessionId });
      }

      // Initialize tool registry
      this.toolRegistry = createToolRegistry({
        projectId: this.projectId,
        userId: this.userId,
        tools: [],
        globalSettings: {
          maxConcurrentTools: 3,
          timeout: 30000,
          enableLogging: true,
        },
      });

      // Register all available tools
      await this.registerTools(githubToken);

      // Create the agent
      await this.createAgent();

      logger.info('Enhanced RAG Chain initialized successfully', {
        projectId: this.projectId,
        toolCount: this.toolRegistry.getAvailableTools().length,
      });

    } catch (error) {
      logger.error('Failed to initialize Enhanced RAG Chain', {
        projectId: this.projectId,
        userId: this.userId,
      }, error as Error);
      throw error;
    }
  }

  /**
   * Register all available tools
   */
  private async registerTools(githubToken?: string): Promise<void> {
    if (!this.toolRegistry) {
      throw new Error('Tool registry not initialized');
    }

    // GitHub tools
    const githubTools = createGitHubTools(githubToken);
    for (const tool of githubTools) {
      const config: ToolConfig = {
        name: tool.name,
        description: tool.description,
        enabled: true,
        rateLimit: {
          maxCalls: 100,
          windowMs: 60000, // 1 minute
        },
      };
      this.toolRegistry.registerTool(tool, config);
    }

    // NPM tools
    const npmTools = createNPMTools();
    for (const tool of npmTools) {
      const config: ToolConfig = {
        name: tool.name,
        description: tool.description,
        enabled: true,
        rateLimit: {
          maxCalls: 200,
          windowMs: 60000,
        },
      };
      this.toolRegistry.registerTool(tool, config);
    }

    // Documentation tools
    const docTools = createDocumentationTools();
    for (const tool of docTools) {
      const config: ToolConfig = {
        name: tool.name,
        description: tool.description,
        enabled: true,
        rateLimit: {
          maxCalls: 150,
          windowMs: 60000,
        },
      };
      this.toolRegistry.registerTool(tool, config);
    }

    logger.info('Tools registered successfully', {
      projectId: this.projectId,
      toolCount: this.toolRegistry.getAvailableTools().length,
    });
  }

  /**
   * Create the LangChain agent with tools
   */
  private async createAgent(): Promise<void> {
    if (!this.toolRegistry || !this.vectorStore) {
      throw new Error('Tool registry or vector store not initialized');
    }

    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: this.projectId },
      select: { name: true, githubUrl: true },
    });

    // Create retriever tool for code context
    const retriever = this.vectorStore.asRetriever({ k: 8 });
    
    class CodeContextTool extends Tool {
      name = 'code_context_search';
      description = 'Search for relevant code context from the current project repository';

      async _call(query: string): Promise<string> {
        try {
          const docs = await retriever.getRelevantDocuments(query);
          return JSON.stringify({
            success: true,
            documents: docs.map(doc => ({
              path: doc.metadata.path,
              startLine: doc.metadata.startLine,
              endLine: doc.metadata.endLine,
              language: doc.metadata.language,
              content: doc.pageContent,
              similarity: doc.metadata.similarity || 0,
            })),
          }, null, 2);
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    const codeContextTool = new CodeContextTool();

    // Register the code context tool
    this.toolRegistry.registerTool(codeContextTool, {
      name: 'code_context_search',
      description: 'Search for relevant code context from the current project repository',
      enabled: true,
    });

    // Get all available tools
    const tools = this.toolRegistry.getAvailableTools();

    // Create the model
    const model = new ChatOpenAI({
      openAIApiKey: env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2000,
    });

    // Create the prompt template
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', `You are CodeMind, an AI assistant specialized in code analysis and development tasks for the "${project?.name || 'unknown'}" project.

You have access to various tools that can help you:
- Search and read code from the current project repository
- Search and read files from GitHub repositories
- Search NPM packages and get package information
- Look up documentation from various sources
- Get webpage content for additional information

{chat_history}

Guidelines:
- Always start by searching the project's code context if the question is about the current codebase
- Use GitHub tools to examine external repositories when relevant
- Use NPM tools to find and compare packages when discussing dependencies
- Use documentation tools to get authoritative information about APIs and frameworks
- Provide accurate, helpful responses with references to sources
- When referencing code, mention file paths and line numbers
- If you can't find relevant information with your tools, say so clearly

Available tools: {tools}
Tool names: {tool_names}`],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
    ]);

    // Create the agent
    const agent = await createToolCallingAgent({
      llm: model,
      tools,
      prompt,
    });

    // Create the agent executor
    this.agent = new AgentExecutor({
      agent,
      tools,
      verbose: false,
      maxIterations: 10,
      returnIntermediateSteps: true,
    });
  }

  /**
   * Execute a developer agent command
   */
  async executeCommand(command: AgentCommand): Promise<AgentResponse> {
    const startTime = Date.now();
    const validatedCommand = AgentCommandSchema.parse(command);
    const toolsUsed: string[] = [];

    try {
      // Initialize if not already done
      if (!this.agent) {
        await this.initialize(validatedCommand.sessionId);
      }

      // Prepare input based on command type
      const input = this.prepareAgentInput(validatedCommand);

      // Get conversation history if memory is available
      let chatHistory = '';
      if (this.memory) {
        const memoryVars = await this.memory.loadMemoryVariables({});
        chatHistory = memoryVars.history || '';
      }

      // Execute the agent
      const result = await this.agent!.invoke({
        input,
        chat_history: chatHistory,
      });

      // Extract tools used from intermediate steps
      if (result.intermediateSteps) {
        for (const step of result.intermediateSteps) {
          if (step.action && step.action.tool) {
            toolsUsed.push(step.action.tool);
          }
        }
      }

      // Save to memory if available
      if (this.memory) {
        await this.memory.saveContext(
          { input: validatedCommand.message },
          { output: result.output }
        );
      }

      // Record analytics for each tool used
      for (const toolName of toolsUsed) {
        toolAnalytics.recordExecution({
          toolName,
          projectId: validatedCommand.projectId,
          userId: validatedCommand.userId,
          sessionId: validatedCommand.sessionId,
          input: validatedCommand.message,
          output: result.output,
          success: true,
          executionTimeMs: Date.now() - startTime,
        });
      }

      // Record memory snapshot (mock for now until database migration is complete)
      const memorySize = validatedCommand.message.length + result.output.length;
      const tokenUsage = Math.ceil(memorySize / 4); // Rough token estimation
      
      // Uncomment when database migration is complete:
      // await agentMemoryTracker.recordMemorySnapshot({
      //   sessionId: validatedCommand.sessionId || `${validatedCommand.userId}-${validatedCommand.projectId}`,
      //   projectId: validatedCommand.projectId,
      //   userId: validatedCommand.userId,
      //   command: validatedCommand.command,
      //   memorySnapshot: { message: validatedCommand.message, response: result.output },
      //   tokenUsage,
      //   memorySize,
      //   contextRelevance: Math.random() * 0.4 + 0.6, // Mock relevance score
      //   responseQuality: Math.random() * 0.3 + 0.7, // Mock quality score
      //   executionTimeMs: Date.now() - startTime,
      //   toolsUsed,
      //   summary: result.output.substring(0, 100) + (result.output.length > 100 ? '...' : ''),
      // });

      const response: AgentResponse = {
        response: result.output,
        toolsUsed,
        executionTime: Date.now() - startTime,
        metadata: {
          command: validatedCommand.command,
          intermediateSteps: result.intermediateSteps?.length || 0,
          memorySize,
          tokenUsage,
        },
      };

      return AgentResponseSchema.parse(response);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      logger.error('Agent command execution failed', {
        command: validatedCommand.command,
        projectId: validatedCommand.projectId,
        error: errorMessage,
      }, error as Error);

      // Record failed execution
      toolAnalytics.recordExecution({
        toolName: 'agent_executor',
        projectId: validatedCommand.projectId,
        userId: validatedCommand.userId,
        sessionId: validatedCommand.sessionId,
        input: validatedCommand.message,
        output: errorMessage,
        success: false,
        executionTimeMs: Date.now() - startTime,
        error: errorMessage,
      });

      return {
        response: `I apologize, but I encountered an error while processing your request: ${errorMessage}`,
        toolsUsed,
        executionTime: Date.now() - startTime,
        metadata: { error: errorMessage },
      };
    }
  }

  /**
   * Prepare agent input based on command type
   */
  private prepareAgentInput(command: AgentCommand): string {
    const { command: cmd, context, message } = command;

    switch (cmd) {
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
   * Stream agent response (for real-time chat)
   */
  async *streamCommand(command: AgentCommand): AsyncGenerator<string, void, unknown> {
    const validatedCommand = AgentCommandSchema.parse(command);

    try {
      // Initialize if not already done
      if (!this.agent) {
        await this.initialize(validatedCommand.sessionId);
      }

      const input = this.prepareAgentInput(validatedCommand);

      // Get conversation history if memory is available
      let chatHistory = '';
      if (this.memory) {
        const memoryVars = await this.memory.loadMemoryVariables({});
        chatHistory = memoryVars.history || '';
      }

      // Stream the agent response
      const stream = await this.agent!.stream({
        input,
        chat_history: chatHistory,
      });

      for await (const chunk of stream) {
        if (chunk.agent && chunk.agent.messages) {
          for (const message of chunk.agent.messages) {
            if (message.content) {
              yield message.content as string;
            }
          }
        }
        if (chunk.tools && chunk.tools.messages) {
          for (const message of chunk.tools.messages) {
            yield `🔧 ${message.content}\n`;
          }
        }
      }

    } catch (error) {
      logger.error('Agent streaming failed', {
        command: validatedCommand.command,
        projectId: validatedCommand.projectId,
      }, error as Error);

      yield `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
    }
  }

  /**
   * Generate an enhanced answer using the RAG chain with tools
   */
  async generateAnswer(input: EnhancedRAGInput): Promise<EnhancedRAGOutput> {
    const startTime = Date.now();
    
    // Validate input
    const validatedInput = EnhancedRAGInputSchema.parse(input);
    const { query, projectId, userId, sessionId, enableTools } = validatedInput;

    logger.info('Generating enhanced answer', {
      projectId,
      userId,
      sessionId,
      queryLength: query.length,
      enableTools,
    });

    try {
      // Initialize if not already done
      if (!this.agent) {
        await this.initialize(sessionId);
      }

      // Verify project exists
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true },
      });

      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      // Create or use existing chat session
      let finalSessionId = sessionId;
      if (!finalSessionId) {
        const session = await prisma.chatSession.create({
          data: {
            projectId,
            userId,
            title: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
          },
        });
        finalSessionId = session.id;
      }

      // Save user message
      await prisma.message.create({
        data: {
          sessionId: finalSessionId,
          role: 'user',
          content: query,
        },
      });

      // Get conversation history if memory is available
      let chatHistory = '';
      if (this.memory) {
        const memoryVars = await this.memory.loadMemoryVariables({});
        chatHistory = memoryVars.history || '';
      }

      // Prepare input for agent
      const agentInput = {
        input: query,
        chat_history: chatHistory,
      };

      // Execute the agent
      const agentResult = await this.agent!.invoke(agentInput);

      const executionTime = Date.now() - startTime;

      // Extract tool execution information
      const toolsUsed = (agentResult.intermediateSteps || []).map((step: { action?: { tool?: string; toolInput?: string }; observation?: string }) => ({
        name: step.action?.tool || 'unknown',
        input: step.action?.toolInput || '',
        output: step.observation || '',
        success: !step.observation?.includes('error'),
        executionTimeMs: 0, // Would need to track this individually
      }));

      // Save assistant message
      await prisma.message.create({
        data: {
          sessionId: finalSessionId,
          role: 'assistant',
          content: agentResult.output,
          latencyMs: executionTime,
        },
      });

      // Save to memory if available
      if (this.memory) {
        await this.memory.saveContext(
          { input: query },
          { output: agentResult.output }
        );
      }

      // Mock token usage calculation
      const tokenUsage = {
        promptTokens: Math.ceil(query.length / 4) + Math.ceil(chatHistory.length / 4),
        completionTokens: Math.ceil(agentResult.output.length / 4),
        totalTokens: 0,
      };
      tokenUsage.totalTokens = tokenUsage.promptTokens + tokenUsage.completionTokens;

      const result: EnhancedRAGOutput = {
        answer: agentResult.output,
        sources: [], // Would be extracted from code_context_search tool results
        toolsUsed,
        sessionId: finalSessionId,
        tokenUsage,
        executionTimeMs: executionTime,
      };

      const validatedOutput = EnhancedRAGOutputSchema.parse(result);

      logger.info('Enhanced answer generated successfully', {
        projectId,
        userId,
        sessionId: finalSessionId,
        answerLength: agentResult.output.length,
        toolsUsedCount: toolsUsed.length,
        executionTimeMs: executionTime,
      });

      return validatedOutput;

    } catch (error) {
      logger.error('Failed to generate enhanced answer', {
        projectId,
        userId,
        sessionId,
      }, error as Error);
      throw error;
    }
  }

  /**
   * Get tool usage statistics
   */
  getToolStats() {
    return this.toolRegistry?.getToolStats() || [];
  }

  /**
   * Clear the agent and reinitialize
   */
  async reset(): Promise<void> {
    this.agent = null;
    this.toolRegistry?.clear();
    await this.initialize();
  }
}

/**
 * Factory function to create an enhanced RAG chain
 */
export async function createEnhancedRAGChain(
  projectId: string,
  userId: string,
  sessionId?: string,
  githubToken?: string
): Promise<EnhancedRAGChain> {
  const chain = new EnhancedRAGChain(projectId, userId);
  await chain.initialize(sessionId, githubToken);
  return chain;
}

// Helper functions for common developer agent operations
export async function summarizeProject(
  projectId: string, 
  userId: string, 
  query?: string,
  sessionId?: string
): Promise<AgentResponse> {
  const chain = new EnhancedRAGChain(projectId, userId);
  await chain.initialize(sessionId);
  
  return chain.executeCommand({
    command: 'summarize_project',
    projectId,
    userId,
    sessionId,
    message: query || 'Please provide a comprehensive summary of this project.',
  });
}

export async function explainFunction(
  projectId: string, 
  userId: string, 
  filePath: string, 
  functionName?: string,
  query?: string,
  sessionId?: string
): Promise<AgentResponse> {
  const chain = new EnhancedRAGChain(projectId, userId);
  await chain.initialize(sessionId);

  return chain.executeCommand({
    command: 'explain_function',
    projectId,
    userId,
    sessionId,
    context: { filePath, functionName },
    message: query || `Please explain this function: ${functionName || 'the function in this file'}`,
  });
}

export async function generateTests(
  projectId: string, 
  userId: string, 
  filePath: string, 
  functionName?: string,
  sessionId?: string
): Promise<AgentResponse> {
  const chain = new EnhancedRAGChain(projectId, userId);
  await chain.initialize(sessionId);

  return chain.executeCommand({
    command: 'generate_tests',
    projectId,
    userId,
    sessionId,
    context: { filePath, functionName },
    message: `Please generate comprehensive test cases for ${functionName || 'the code in this file'}`,
  });
}

export async function analyzeCode(
  projectId: string, 
  userId: string, 
  codeSnippet: string, 
  filePath?: string,
  sessionId?: string
): Promise<AgentResponse> {
  const chain = new EnhancedRAGChain(projectId, userId);
  await chain.initialize(sessionId);

  return chain.executeCommand({
    command: 'analyze_code',
    projectId,
    userId,
    sessionId,
    context: { codeSnippet, filePath },
    message: 'Please analyze this code for quality, performance, and potential improvements.',
  });
}