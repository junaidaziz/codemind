import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '../../types/env';

export async function getAuthenticatedUser(req: NextRequest): Promise<{ id: string; email: string | null } | null> {
  try {
    // Get the Authorization header
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('No Authorization header found or invalid format');
      return null;
    }

    // Extract the access token
    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Create a Supabase client and verify the token
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        },
        auth: {
          persistSession: false
        }
      }
    );

    // Get user from the token
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error) {
      console.error('Auth error:', error.message);
      return null;
    }
    
    if (!user) {
      console.warn('No authenticated user found');
      return null;
    }

    return {
      id: user.id,
      email: user.email || null
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}