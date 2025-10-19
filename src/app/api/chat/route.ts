import { NextResponse } from "next/server";
import { 
  CreateChatMessageSchema,
  createApiError
} from "../../../types";
import { z, ZodError } from 'zod';
import { logger, createError, withRequestTiming } from '../../lib/logger';
import { generateAnswerStream, GenerateAnswerInput } from '../../lib/langchain-rag';
import { createEnhancedRAGChain, AgentCommand } from '../../lib/langchain-agent';
import { getAgentRouter } from '../../../lib/agent-router';
import { AgentRequest } from '../../../lib/agent-service-client';
import { env } from '../../../types/env';
import prisma from '../../lib/db';
import { chatWithFunctionsStream } from '@/lib/chat-function-calling';

// Enhanced chat request schema supporting developer agent commands
const EnhancedChatRequestSchema = CreateChatMessageSchema.extend({
  command: z.enum(['summarize_project', 'explain_function', 'generate_tests', 'analyze_code', 'chat']).optional(),
  context: z.object({
    filePath: z.string().optional(),
    functionName: z.string().optional(),
    codeSnippet: z.string().optional(),
  }).optional(),
  sessionId: z.string().optional(),
  useAgent: z.boolean().default(false), // Flag to use developer agent
  useFunctionCalling: z.boolean().default(true), // Enable AI tools (GitHub, Jira, Trello)
});

export async function POST(req: Request): Promise<Response> {
  return withRequestTiming('POST', '/api/chat', async () => {
    try {
      const body: unknown = await req.json();
      const requestData = EnhancedChatRequestSchema.parse(body);
      const { projectId, message, userId, command, context, sessionId, useAgent, useFunctionCalling } = requestData;

      // Use provided userId or fallback to static for backwards compatibility
      const finalUserId = userId || "static-user-id";

      logger.info('Chat request received', {
        projectId,
        userId: finalUserId,
        messageLength: message.length,
        command: command || 'chat',
        useAgent,
        useFunctionCalling,
      });

      // Verify project exists
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true }
      });

      if (!project) {
        logger.warn('Project not found', { projectId, userId: finalUserId });
        throw createError.notFound("Project not found", { projectId });
      }

      // Create a readable stream for the response
      const encoder = new TextEncoder();
      let finalSessionId = sessionId || "";

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            if (useAgent && command) {
              // Check if standalone agent is enabled
              if (env.ENABLE_STANDALONE_AGENT === 'true') {
                // Use Agent Router for routing between local and standalone agent
                const agentRouter = getAgentRouter();
                
                const agentRequest: AgentRequest = {
                  id: crypto.randomUUID(),
                  command,
                  projectId,
                  userId: finalUserId,
                  sessionId,
                  context,
                  message,
                  options: {
                    enableTools: true,
                    maxToolExecutions: 5,
                    temperature: 0.7,
                    maxTokens: 1000,
                  },
                };

                // Stream agent response through router
                for await (const chunk of agentRouter.processRequestStream(agentRequest)) {
                  if (chunk.type === 'content' && chunk.content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`)
                    );
                  } else if (chunk.type === 'done') {
                    controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                    controller.close();
                    break;
                  } else if (chunk.type === 'error') {
                    throw new Error(chunk.error || 'Agent processing error');
                  }
                }
              } else {
                // Use local enhanced RAG chain (existing behavior)
                const enhancedChain = await createEnhancedRAGChain(
                  projectId,
                  finalUserId,
                  sessionId
                );

                const agentCommand: AgentCommand = {
                  command,
                  projectId,
                  userId: finalUserId,
                  sessionId,
                  context,
                  message,
                };

                // Stream agent response
                for await (const chunk of enhancedChain.streamCommand(agentCommand)) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
                  );
                }

                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                controller.close();
              }

            } else if (useFunctionCalling) {
              // Use function calling for GitHub/Jira/Trello tools
              try {
                // Get recent messages from session for context
                const recentMessages = sessionId ? await prisma.message.findMany({
                  where: { sessionId },
                  orderBy: { createdAt: 'desc' },
                  take: 10,
                  select: { role: true, content: true }
                }) : [];

                // Build conversation history
                const messages = [
                  {
                    role: 'system' as const,
                    content: `You are the CodeMind AI Assistant, an intelligent project management companion. You help developers manage their GitHub projects through natural conversation.

**Your Capabilities:**

GitHub Issue Management:
- Create issues with title, description, labels, and assignees
- Assign issues to team members
- List and filter issues by state and labels
- Add comments to issues
- Add labels to categorize issues

GitHub Pull Request Management:
- Create pull requests with title, description, branches, draft mode, and reviewers
- List and filter PRs by state (open/closed/merged), author, and draft status
- Merge PRs using different methods (merge, squash, rebase)
- Check for conflicts before merging
- Add comments to PRs for code review
- Add labels to categorize PRs

AI-Powered Automation:
- **Auto-fix code issues**: Analyze bugs/issues, generate fixes using AI, create branch, commit, and open PR
- **Generate code from requirements**: Create new features/components from natural language, scaffold files, and open PR
- **Run automated tests**: Execute tests, linting, type checking on PRs or branches before merging
- Validate code quality with comprehensive checks
- Provide detailed test results and feedback

**Important Guidelines:**
1. When users ask "are there any open PRs?" or similar questions, use the list tools to check
2. You CAN check PR status, list PRs, and manage the complete workflow
3. Never say you can't do something if you have a tool for it
4. Be proactive - suggest related actions after completing tasks
5. Provide URLs and summaries after creating or listing items
6. Handle errors gracefully with clear explanations
7. When asked to fix bugs or create features, use the AI-powered automation tools
8. Always run tests before suggesting to merge PRs

**Current Project:** ${project.name}

Use your tools to help users efficiently manage their GitHub workflow and automate repetitive development tasks!`,
                  },
                  ...recentMessages.reverse().map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content
                  })),
                  {
                    role: 'user' as const,
                    content: message
                  }
                ];

                // Stream with function calling
                for await (const chunk of chatWithFunctionsStream({
                  projectId,
                  userId: finalUserId,
                  sessionId: sessionId || crypto.randomUUID(),
                  messages
                })) {
                  if (typeof chunk === 'string') {
                    // Regular content chunk
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
                    );
                  } else {
                    // Tool call notification
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ toolCall: chunk.data })}\n\n`)
                    );
                  }
                }

                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                controller.close();

                logger.info('Function calling chat completed', {
                  projectId,
                  userId: finalUserId,
                  sessionId
                });
              } catch (functionError) {
                logger.error('Function calling error', {
                  projectId,
                  userId: finalUserId,
                }, functionError as Error);
                throw functionError;
              }

            } else {
              // Use traditional RAG chain
              const ragInput: GenerateAnswerInput = {
                query: message,
                projectId,
                userId: finalUserId,
              };

              await generateAnswerStream(
                ragInput,
                // onChunk - stream content to client
                (chunk: string) => {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
                  );
                },
                // onComplete - handle final result
                (result) => {
                  finalSessionId = result.sessionId;
                  logger.info('LangChain streaming completed', {
                    projectId,
                    userId: finalUserId,
                    sessionId: finalSessionId,
                    answerLength: result.answer.length,
                    sourceCount: result.sources.length,
                    tokenUsage: result.tokenUsage,
                    // 💰 Calculate estimated cost for monitoring
                    estimatedCost: (result.tokenUsage.promptTokens * 0.15 + result.tokenUsage.completionTokens * 0.60) / 1000000,
                  });
                  
                  // Send sources information
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ 
                      sources: result.sources,
                      tokenUsage: result.tokenUsage 
                    })}\n\n`)
                  );
                  
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                  controller.close();
                },
                // onError - handle errors
                (error: Error) => {
                  logger.error('LangChain streaming error', {
                    projectId,
                    userId: finalUserId,
                  }, error);
                  controller.error(error);
                }
              );
            }
          } catch (error) {
            logger.error("Streaming initialization error", {
              projectId,
              userId: finalUserId,
            }, error as Error);
            controller.error(error);
          }
        }
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",  
          "Connection": "keep-alive",
        },
      });

    } catch (error) {
      logger.error("Chat API error", {}, error as Error);
      
      if (error instanceof ZodError) {
        const details = error.issues.reduce((acc, issue) => {
          const path = issue.path.join('.');
          if (!acc[path]) acc[path] = [];
          acc[path].push(issue.message);
          return acc;
        }, {} as Record<string, string[]>);
        
        return NextResponse.json(
          createApiError("Invalid request data", "VALIDATION_ERROR", details),
          { status: 400 }
        );
      }

      // Handle OpenAI quota and rate limit errors
      const errorMessage = (error as Error)?.message || '';
      const errorName = (error as Error)?.name || '';
      
      if (errorMessage.includes('exceeded your current quota') || 
          errorMessage.includes('InsufficientQuotaError') ||
          errorName === 'InsufficientQuotaError') {
        return NextResponse.json(
          createApiError(
            "OpenAI API quota exceeded. Please check your OpenAI billing and usage limits.", 
            "QUOTA_EXCEEDED",
            {
              provider: ["OpenAI"],
              suggestion: ["Visit https://platform.openai.com/usage to check your quota and billing details."],
              temporaryFix: ["Try again later or upgrade your OpenAI plan."]
            }
          ),
          { status: 429 }
        );
      }

      if (errorMessage.includes('rate limit') || 
          errorMessage.includes('MODEL_RATE_LIMIT') ||
          errorMessage.includes('429')) {
        return NextResponse.json(
          createApiError(
            "OpenAI API rate limit reached. Please wait and try again.", 
            "RATE_LIMIT_EXCEEDED",
            {
              provider: ["OpenAI"],
              suggestion: ["Wait a moment before sending another message."],
              retryAfter: ["30 seconds"]
            }
          ),
          { status: 429 }
        );
      }

      // Handle general OpenAI API errors
      if (errorMessage.includes('openai') || errorMessage.includes('OpenAI')) {
        return NextResponse.json(
          createApiError(
            "OpenAI API service error. Please try again later.", 
            "EXTERNAL_SERVICE_ERROR",
            {
              provider: ["OpenAI"],
              suggestion: ["This is likely a temporary issue with the OpenAI service."]
            }
          ),
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        createApiError("Failed to process chat request", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}
