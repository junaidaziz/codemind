import { NextResponse } from "next/server";
import OpenAI from "openai";
import { embedTexts } from "@/lib/embeddings";
import { retrieveRelevantChunks } from "@/lib/db-utils";
import prisma from "@/lib/db";
import { 
  CreateChatMessageSchema,
  createApiError
} from "../../../types";
import { ZodError } from 'zod';
import { env } from '../../../types/env';
import { logger, createError, withRequestTiming, withDatabaseTiming } from '../../lib/logger';

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  return withRequestTiming('POST', '/api/chat', async () => {
    try {
      const body: unknown = await req.json();
      const { projectId, message, userId } = CreateChatMessageSchema.parse(body);

      // Use provided userId or fallback to static for backwards compatibility
      const finalUserId = userId || "static-user-id";

      logger.info('Chat request received', {
        projectId,
        userId: finalUserId,
        messageLength: message.length,
      });

      // Verify project exists
      const project = await withDatabaseTiming('findProject', () =>
        prisma.project.findUnique({
          where: { id: projectId },
          select: { id: true, name: true }
        })
      );

      if (!project) {
        logger.warn('Project not found', { projectId, userId: finalUserId });
        throw createError.notFound("Project not found", { projectId });
      }

    // Create chat session
    const session = await prisma.chatSession.create({
      data: {
        projectId,
        userId: finalUserId,
        title: message.substring(0, 50) + (message.length > 50 ? "..." : "")
      }
    });

    // Save user message
    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: message
      }
    });

    // Generate embedding for the user message
    const [queryEmbedding] = await embedTexts([message]);

    // Retrieve relevant code chunks
    const relevantChunks = await retrieveRelevantChunks(projectId, queryEmbedding, { limit: 8 });

    // Build context from relevant chunks
    const context = relevantChunks
      .map(chunk => 
        `File: ${chunk.path} (lines ${chunk.startLine}-${chunk.endLine})\n` +
        `Language: ${chunk.language}\n` +
        `Code:\n${chunk.content}\n`
      )
      .join("\n---\n");

    // Prepare messages for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are an AI assistant helping with code analysis and questions about the "${project.name}" project. 
        
Use the following code context to answer questions accurately:

${context}

When referencing code, mention the file path and line numbers. Provide helpful explanations and suggestions based on the codebase.`
      },
      {
        role: "user",
        content: message
      }
    ];

    // Create streaming response from OpenAI
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1000
    });

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    let assistantMessage = "";

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              assistantMessage += content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          
          // Save assistant message to database
          await prisma.message.create({
            data: {
              sessionId: session.id,
              role: "assistant",
              content: assistantMessage
            }
          });

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
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
