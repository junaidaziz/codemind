import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { 
  createApiError,
  createApiSuccess
} from "../../../../../types";
import { z } from 'zod';

// Params validation schema
const ProjectStatusParamsSchema = z.object({
  id: z.string().min(1, "Project ID is required"),
});

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    
    // Validate params
    const { id } = ProjectStatusParamsSchema.parse(params);

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, lastIndexedAt: true }
    });

    if (!project) {
      return NextResponse.json(
        createApiError("Project not found", "RESOURCE_NOT_FOUND"), 
        { status: 404 }
      );
    }

    return NextResponse.json(createApiSuccess(project));
  } catch (error) {
    console.error("Error fetching project status:", error);
    
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
      createApiError("Failed to fetch project status", "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}
