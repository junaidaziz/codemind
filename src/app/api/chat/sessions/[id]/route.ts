import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { 
  createApiError,
  createApiSuccess
} from "../../../../../types";
import { z } from 'zod';

// Params validation schema
const GetSessionParamsSchema = z.object({
  id: z.string().min(1, "Session ID is required"),
});

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    
    // Validate params
    const { id: sessionId } = GetSessionParamsSchema.parse(params);

    // Fetch the chat session with all messages
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        Message: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            tokenCount: true,
            latencyMs: true,
            createdAt: true
          }
        },
        Project: {
          select: {
            id: true,
            name: true
          }
        },
        User: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!session) {
      return NextResponse.json(
        createApiError("Chat session not found", "RESOURCE_NOT_FOUND"),
        { status: 404 }
      );
    }

    return NextResponse.json(createApiSuccess(session));
  } catch (error) {
    console.error("Error fetching chat session:", error);
    
    if (error instanceof z.ZodError) {
      const details = error.issues.reduce((acc, issue) => {
        const path = issue.path.join('.');
        if (!acc[path]) acc[path] = [];
        acc[path].push(issue.message);
        return acc;
      }, {} as Record<string, string[]>);
      
      return NextResponse.json(
        createApiError("Invalid request parameters", "VALIDATION_ERROR", details),
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      createApiError("Failed to fetch chat session", "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}