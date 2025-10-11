import { NextResponse } from 'next/server';
import prisma from '../../../lib/db';
import { createApiSuccess, createApiError, type ApiResponse } from '../../../../types';
import { z } from 'zod';

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ emailExists: boolean }>>> {
  try {
    const body = await request.json();
    
    const checkEmailSchema = z.object({
      email: z.string().email()
    });

    const { email } = checkEmailSchema.parse(body);
    
    // Check if user exists in our local database
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    return NextResponse.json(createApiSuccess({ 
      emailExists: !!existingUser 
    }), { status: 200 });

  } catch (error) {
    console.error('Error checking email:', error);
    return NextResponse.json(
      createApiError('Failed to check email', 'EMAIL_CHECK_FAILED'),
      { status: 500 }
    );
  }
}