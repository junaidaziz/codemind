import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { 
  CreateProjectSchema,
  type CreateProjectRequest,
  type ProjectResponse,
  createApiSuccess,
  createApiError,
  type ApiResponse
} from "../../../types";
import { ZodError } from 'zod';

export async function GET(): Promise<NextResponse<ApiResponse<ProjectResponse[]>>> {
  try {
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        lastIndexedAt: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedProjects: ProjectResponse[] = projects.map((project: {
      id: string;
      name: string;
      status: string;
      lastIndexedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      lastIndexedAt: project.lastIndexedAt?.toISOString() || null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    }));

    return NextResponse.json(createApiSuccess(formattedProjects));
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      createApiError("Failed to fetch projects", "FETCH_ERROR"), 
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<ProjectResponse>>> {
  try {
    const body: unknown = await req.json();
    const data: CreateProjectRequest = CreateProjectSchema.parse(body);
    
    // For now, use a default user or create one if needed
    // TODO: Implement proper authentication once session handling is fixed
    let userId = data.userId;
    
    if (!userId) {
      // Try to find an existing user or create a default one
      let defaultUser = await prisma.user.findFirst({
        where: { email: { not: null } },
        select: { id: true }
      });

      if (!defaultUser) {
        // Create a default user for development
        defaultUser = await prisma.user.create({
          data: {
            email: 'default@codemind.dev',
            name: 'Default User',
            role: 'user'
          },
          select: { id: true }
        });
      }
      
      userId = defaultUser.id;
    }

    // Create a project
    const project = await prisma.project.create({
      data: {
        name: data.name,
        githubUrl: data.githubUrl,
        ownerId: userId
      }
    });

    const projectResponse: ProjectResponse = {
      id: project.id,
      name: project.name,
      status: project.status,
      lastIndexedAt: project.lastIndexedAt?.toISOString() || null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    };

    return NextResponse.json(createApiSuccess(projectResponse, "Project created successfully"));
  } catch (error) {
    console.error("Error creating project:", error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        createApiError('Validation failed', 'VALIDATION_ERROR', {
          validation: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createApiError("Failed to create project", "CREATE_ERROR"), 
      { status: 500 }
    );
  }
}
