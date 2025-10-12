import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { 
  UpdateUserRequestSchema, 
  type UpdateUserRequest,
  createApiSuccess, 
  createApiError,
  type ApiResponse 
} from '../../../../types';
import { ZodError } from 'zod';

// Define the User type based on our Prisma schema
type User = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: string;
  createdAt: Date;
};

export async function GET(req: Request): Promise<NextResponse<ApiResponse<User>>> {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        createApiError("User ID is required", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    // Get user from database including role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        createApiError("User not found", "RESOURCE_NOT_FOUND"),
        { status: 404 }
      );
    }

    return NextResponse.json(createApiSuccess(user));
  } catch (error) {
    console.error("Error fetching user:", error);
    
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
      createApiError("Failed to fetch user", "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<User>>> {
  try {
    const body: unknown = await req.json();
    const userData: UpdateUserRequest = UpdateUserRequestSchema.parse(body);

    // Create or update user in our database
    const user = await prisma.user.upsert({
      where: { id: userData.id },
      update: {
        email: userData.email,
        name: userData.name,
        image: userData.image,
        role: userData.role || 'user',
      },
      create: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        image: userData.image,
        role: userData.role || 'user',
      },
    });

    return NextResponse.json(
      createApiSuccess(user, 'User updated successfully')
    );
  } catch (error) {
    console.error('Error handling user:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        createApiError('Validation failed', 'VALIDATION_ERROR', {
          validation: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createApiError('Failed to handle user', 'INTERNAL_ERROR'),
      { status: 500 }
    );
  }
}