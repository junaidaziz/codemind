import { NextRequest, NextResponse } from 'next/server';
import { logger, AppError, createError } from '../app/lib/logger';
import { createApiError, type ApiResponse } from '../types';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// Type for API handler function
export type ApiHandler<T = unknown> = (
  req: NextRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse<ApiResponse<T>>>;

// Error handler utility
export function handleApiError(error: unknown, context?: Record<string, unknown>): NextResponse<ApiResponse<never>> {
  // Generate request ID for tracking
  const requestId = Math.random().toString(36).substring(7);
  
  // Enhanced context with request ID
  const logContext = {
    requestId,
    component: 'api',
    ...context,
  };

  // Handle known error types
  if (error instanceof AppError) {
    logger.warn(error.message, { ...logContext, code: error.code }, error);
    return NextResponse.json(
      createApiError(error.message, error.code, { requestId: [requestId] }),
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    logger.warn('Validation error', { 
      ...logContext, 
      validationErrors,
      code: 'VALIDATION_ERROR' 
    });

    return NextResponse.json(
      createApiError('Validation failed', 'VALIDATION_ERROR', {
        requestId: [requestId],
        validation: validationErrors.map(e => `${e.path}: ${e.message}`),
      }),
      { status: 400 }
    );
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let message = 'Database operation failed';
    let statusCode = 500;

    switch (error.code) {
      case 'P2002':
        message = 'A record with this data already exists';
        statusCode = 409;
        break;
      case 'P2025':
        message = 'Record not found';
        statusCode = 404;
        break;
      case 'P2003':
        message = 'Foreign key constraint failed';
        statusCode = 400;
        break;
      case 'P2022':
        message = 'Database column does not exist - schema migration may be pending';
        statusCode = 503;
        break;
    }

    logger.error(message, { 
      ...logContext, 
      prismaCode: error.code,
      prismaMessage: error.message,
      code: 'DATABASE_ERROR' 
    }, error);

    return NextResponse.json(
      createApiError(message, 'DATABASE_ERROR', { 
        requestId: [requestId],
        prismaCode: [error.code]
      }),
      { status: statusCode }
    );
  }

  // Handle Prisma initialization errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error('Database connection failed', {
      ...logContext,
      code: 'DATABASE_CONNECTION_ERROR'
    }, error);

    return NextResponse.json(
      createApiError(
        'Database service unavailable', 
        'DATABASE_CONNECTION_ERROR',
        { requestId: [requestId] }
      ),
      { status: 503 }
    );
  }

  // Handle generic errors
  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error('Unhandled API error', {
    ...logContext,
    errorMessage,
    stack,
    code: 'INTERNAL_ERROR'
  }, error instanceof Error ? error : new Error(String(error)));

  return NextResponse.json(
    createApiError('Internal server error', 'INTERNAL_ERROR', { requestId: [requestId] }),
    { status: 500 }
  );
}

// API wrapper with error handling and performance monitoring
export function withApiErrorHandling<T = unknown>(
  handler: ApiHandler<T>,
  operationName?: string
): ApiHandler<T> {
  return async (req: NextRequest, context?: { params: Record<string, string> }) => {
    const startTime = Date.now();
    const method = req.method;
    const url = req.url;
    const requestId = Math.random().toString(36).substring(7);

    // Extract basic request info for logging
    const logContext = {
      requestId,
      method,
      url,
      userAgent: req.headers.get('user-agent') || undefined,
      ip: req.headers.get('x-forwarded-for') || undefined,
      operation: operationName,
    };

    logger.info(`API Request started: ${method} ${url}`, logContext);

    try {
      const result = await handler(req, context);
      const duration = Date.now() - startTime;
      
      logger.info(`API Request completed: ${method} ${url}`, {
        ...logContext,
        duration,
        statusCode: result.status,
      });

      // Log performance if it's slow
      if (duration > 1000) {
        logger.warn('Slow API request', {
          ...logContext,
          duration,
          threshold: 1000,
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error(`API Request failed: ${method} ${url}`, {
        ...logContext,
        duration,
      }, error instanceof Error ? error : new Error(String(error)));

      return handleApiError(error, logContext);
    }
  };
}

// Rate limiting helper (basic implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string, 
  maxRequests: number = 100, 
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = `${identifier}-${Math.floor(now / windowMs)}`;
  
  const current = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };
  
  if (current.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: current.resetTime,
    };
  }
  
  current.count++;
  rateLimitStore.set(key, current);
  
  // Cleanup old entries periodically
  if (Math.random() < 0.01) {
    for (const [k, v] of rateLimitStore) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }
  
  return {
    allowed: true,
    remaining: maxRequests - current.count,
    resetTime: current.resetTime,
  };
}

// API response helpers with consistent formatting
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown>
) {
  return NextResponse.json({
    success: true,
    data,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

export function createErrorResponse(
  message: string,
  code: string,
  statusCode: number = 500,
  details?: Record<string, string[]>
) {
  return NextResponse.json(
    createApiError(message, code, {
      timestamp: [new Date().toISOString()],
      ...details,
    }),
    { status: statusCode }
  );
}

// Validation helper
export function validateRequestBody<T>(
  schema: { parse: (data: unknown) => T },
  data: unknown
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw error; // Let the error handler deal with it
    }
    throw createError.validation('Invalid request body format');
  }
}

// Auth helper placeholder
export function requireAuth(req: NextRequest): string | null {
  // TODO: Implement proper authentication when auth system is ready
  // For now, return null to indicate no auth required in development
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader) {
    return null; // Allow in development
  }
  
  // Basic token validation (placeholder)
  if (!authHeader.startsWith('Bearer ')) {
    throw createError.unauthorized('Invalid authorization header format');
  }
  
  // Return mock user ID for development
  return 'dev-user-id';
}

// Database transaction wrapper with error handling
export async function withDatabaseTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const prisma = (await import('../app/lib/db')).default;
  
  try {
    return await prisma.$transaction(operation);
  } catch (error) {
    logger.error('Database transaction failed', context, error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}