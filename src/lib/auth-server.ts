import { NextRequest } from 'next/server';
import { createServerClient } from '../app/lib/supabase';
import { cookies } from 'next/headers';

/**
 * Get the authenticated user from the request
 * This function extracts the user from the Supabase session
 */
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    // Get the authorization header or cookie
    const authHeader = request.headers.get('authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Extract JWT token from Authorization header
      const token = authHeader.substring(7);
      
      const supabase = createServerClient();
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        return null;
      }
      
      return user;
    }
    
    // Fallback: Try to get session from cookies (for browser requests)
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('codemind-auth-token.0')?.value;
    
    if (accessToken) {
      const supabase = createServerClient();
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);
      
      if (error || !user) {
        return null;
      }
      
      return user;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Get user ID with development fallback
 * In development mode, if no authenticated user is found, 
 * it will use the project owner ID as fallback
 */
export async function getUserId(request: NextRequest, projectId?: string): Promise<string | null> {
  // First try to get authenticated user
  const user = await getAuthenticatedUser(request);
  if (user?.id) {
    return user.id;
  }
  
  // Fallback to x-user-id header (for compatibility)
  const headerUserId = request.headers.get('x-user-id');
  if (headerUserId && headerUserId !== 'anonymous') {
    return headerUserId;
  }
  
  // Development mode fallback: use project owner
  if (process.env.NODE_ENV === 'development' && projectId) {
    try {
      const prisma = (await import('../app/lib/db')).default;
      const project = await prisma.project.findFirst({
        where: { id: projectId }
      });
      
      if (project?.ownerId) {
        console.log(`Development mode: Using project owner ID ${project.ownerId} for authentication`);
        return project.ownerId;
      }
    } catch (error) {
      console.error('Error getting project owner in development mode:', error);
    }
  }
  
  return null;
}