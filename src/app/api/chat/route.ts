import { NextResponse } from "next/server";
import { 
  CreateChatMessageSchema,
  createApiError
} from "../../../types";
import { z, ZodError } from 'zod';
import { logger, createError, withRequestTiming } from '../../lib/logger';
import { generateAnswerStream, GenerateAnswerInput } from '../../lib/langchain-rag';
import { createEnhancedRAGChain, AgentCommand } from '../../lib/langchain-agent';
import prisma from '../../lib/db';

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
});

export async function POST(req: Request) {
  return withRequestTiming('POST', '/api/chat', async () => {
    try {
      const body: unknown = await req.json();
      const requestData = EnhancedChatRequestSchema.parse(body);
      const { projectId, message, userId, command, context, sessionId, useAgent } = requestData;

      // Use provided userId or fallback to static for backwards compatibility
      const finalUserId = userId || "static-user-id";

      logger.info('Chat request received', {
        projectId,
        userId: finalUserId,
        messageLength: message.length,
        command: command || 'chat',
        useAgent,
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
              // Use Developer Agent for specialized commands
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
      
      return NextResponse.json(
        createApiError("Failed to process chat request", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}
