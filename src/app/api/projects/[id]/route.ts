import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { 
  createApiError,
  createApiSuccess
} from "../../../../types";
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// Params validation schema
const GetProjectParamsSchema = z.object({
  id: z.string().min(1, "Project ID is required"),
});

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    
    // Validate params
    const { id: projectId } = GetProjectParamsSchema.parse(params);
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: true,
        sessions: {
          select: { id: true, title: true, createdAt: true }
        },
        files: {
          select: {
            id: true,
            path: true,
            startLine: true,
            endLine: true,
            updatedAt: true
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json(
        createApiError("Project not found", "RESOURCE_NOT_FOUND"), 
        { status: 404 }
      );
    }

    return NextResponse.json(createApiSuccess(project));
  } catch (error) {
    console.error("Error fetching project:", error);
    
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
      createApiError("Internal Server Error", "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    
    // Validate params
    const { id: projectId } = GetProjectParamsSchema.parse(params);

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json(
        createApiError("Project not found", "RESOURCE_NOT_FOUND"), 
        { status: 404 }
      );
    }

    // Use transaction to ensure all deletions succeed or fail together
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete messages first (they reference chat sessions)
      await tx.message.deleteMany({
        where: {
          session: {
            projectId: projectId
          }
        }
      });

      // Delete chat sessions (they reference project)
      await tx.chatSession.deleteMany({
        where: { projectId: projectId }
      });

      // Delete code chunks (they reference project)
      await tx.codeChunk.deleteMany({
        where: { projectId: projectId }
      });

      // Finally delete the project
      await tx.project.delete({
        where: { id: projectId }
      });
    });

    return NextResponse.json(createApiSuccess({ message: "Project deleted successfully" }));
  } catch (error) {
    console.error("Error deleting project:", error);
    
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
      createApiError("Failed to delete project", "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}
