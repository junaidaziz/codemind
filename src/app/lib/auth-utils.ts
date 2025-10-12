import { NextRequest } from 'next/server';
import { createServerClient } from './supabase';

export async function getAuthenticatedUser(req: NextRequest): Promise<{ id: string; email: string | null } | null> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const supabase = createServerClient();

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || null
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}