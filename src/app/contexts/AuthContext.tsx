'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { createBrowserClient } from '../lib/supabase';
import { 
  type LoginRequest,
  type SignUpRequest,
  type ResetPasswordRequest,
  type UserRole,
  LoginRequestSchema,
  SignUpRequestSchema,
  ResetPasswordRequestSchema
} from '../../types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: UserRole | null;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  // Function to fetch user role from database
  const fetchUserRole = async (userId: string) => {
    try {
      const response = await fetch(`/api/auth/user?id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setUserRole(data.data.role as UserRole);
        }
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
      }
      
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserRole(session.user.id);
        } else {
          setUserRole(null);
        }
        
        setLoading(false);

        // Create or update user in our database
        if (session?.user && event === 'SIGNED_IN') {
          try {
            await fetch('/api/auth/user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
                image: session.user.user_metadata?.avatar_url,
                role: 'user', // Default role for new users
              }),
            });
          } catch (error) {
            console.error('Error creating/updating user:', error);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signUp = async (email: string, password: string, fullName?: string) => {
    // Validate input with default name if not provided
    const signUpData: SignUpRequest = { 
      email, 
      password, 
      name: fullName || email.split('@')[0] 
    };
    
    const validatedData = SignUpRequestSchema.parse(signUpData);
    
    const { error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
      options: {
        data: { name: validatedData.name },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    // Validate input
    const loginData: LoginRequest = { email, password };
    const validatedData = LoginRequestSchema.parse(loginData);
    
    const { error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    // Validate input
    const resetData: ResetPasswordRequest = { email };
    const validatedData = ResetPasswordRequestSchema.parse(resetData);
    
    const { error } = await supabase.auth.resetPasswordForEmail(validatedData.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error };
  };

  const value = {
    user,
    session,
    userRole,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Custom hooks for common auth operations
export function useRequireAuth() {
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/auth/login';
    }
  }, [user, loading]);

  return { user, loading };
}