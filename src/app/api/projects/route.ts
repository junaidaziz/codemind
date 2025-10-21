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
import { validateRequestBody } from "../../../middleware/api-error-handler";
import { logger } from "../../lib/logger";
import { ZodError } from 'zod';

async function getProjectsHandler(): Promise<NextResponse<ApiResponse<ProjectResponse[]>>> {
  logger.info('Fetching projects list');
  
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

  logger.info(`Successfully fetched ${formattedProjects.length} projects`);
  return NextResponse.json(createApiSuccess(formattedProjects));
}

export async function GET(): Promise<NextResponse<ApiResponse<ProjectResponse[]>>> {
  try {
    return await getProjectsHandler();
  } catch (error) {
    logger.error('Failed to fetch projects', {}, error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      createApiError('Failed to fetch projects', 'FETCH_ERROR'),
      { status: 500 }
    );
  }
}

async function createProjectHandler(req: NextRequest): Promise<NextResponse<ApiResponse<ProjectResponse>>> {
  const body: unknown = await req.json();
  const data: CreateProjectRequest = validateRequestBody(CreateProjectSchema, body);
  
  logger.info('Creating new project', { projectName: data.name, githubUrl: data.githubUrl });
  
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
      // Create a default user for development - handle missing role column
      try {
        defaultUser = await prisma.user.create({
          data: {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            email: 'default@codemind.dev',
            name: 'Default User',
            role: 'user'
          },
          select: { id: true }
        });
      } catch (dbError: unknown) {
        // Handle missing role column after database reset
        const error = dbError as { code?: string; message?: string };
        if (error.code === 'P2022' && error.message?.includes('does not exist')) {
          logger.warn('Database schema mismatch during user creation, creating without role column');
          defaultUser = await prisma.user.create({
            data: {
              id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              email: 'default@codemind.dev',
              name: 'Default User',
            },
            select: { id: true }
          });
        } else {
          throw dbError;
        }
      }
    }
    
    userId = defaultUser.id;
  }

  // Create a project
  const project = await prisma.project.create({
    data: {
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: data.name,
      githubUrl: data.githubUrl,
      ownerId: userId,
      updatedAt: new Date()
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

  logger.info('Successfully created project', { projectId: project.id, projectName: project.name });
  return NextResponse.json(createApiSuccess(projectResponse, "Project created successfully"));
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<ProjectResponse>>> {
  try {
    return await createProjectHandler(req);
  } catch (error) {
    logger.error('Failed to create project', {}, error instanceof Error ? error : new Error(String(error)));
    
    // Handle validation errors specifically
    if (error instanceof ZodError) {
      return NextResponse.json(
        createApiError('Validation failed', 'VALIDATION_ERROR', {
          validation: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createApiError('Failed to create project', 'CREATE_ERROR'),
      { status: 500 }
    );
  }
}
