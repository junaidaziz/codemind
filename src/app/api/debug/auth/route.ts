import { NextRequest, NextResponse } from 'next/server';
import { getUserId, getAuthenticatedUser } from '@/lib/auth-server';
import { cookies } from 'next/headers';

/**
 * Debug endpoint to check authentication status
 * GET /api/debug/auth
 */
export async function GET(request: NextRequest) {
  try {
    // Check for user
    const user = await getAuthenticatedUser(request);
    const userId = await getUserId(request);

    // Check cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const authCookie = cookieStore.get('codemind-auth-token.0');

    // Check headers
    const authHeader = request.headers.get('authorization');
    const userIdHeader = request.headers.get('x-user-id');

    return NextResponse.json({
      authenticated: !!user,
      userId: userId,
      userEmail: user?.email || null,
      headers: {
        authorization: authHeader ? 'Present (Bearer token)' : 'Missing',
        xUserId: userIdHeader || 'Missing',
      },
      cookies: {
        total: allCookies.length,
        authCookie: authCookie ? 'Present' : 'Missing',
        cookieNames: allCookies.map((c) => c.name),
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Debug auth error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check auth',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
