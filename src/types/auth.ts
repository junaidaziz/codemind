import { z } from 'zod';
import { User, Session } from '@supabase/supabase-js';

// Role Types
export const UserRoleSchema = z.enum(['user', 'admin']);
export type UserRole = 'admin' | 'user';

// Auth Request/Response Types
export const LoginRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const SignUpRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
});

export const ResetPasswordRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const UpdateUserRequestSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  image: z.string().url().nullable().optional(),
  role: UserRoleSchema.optional(),
});

// Infer TypeScript types from Zod schemas
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type SignUpRequest = z.infer<typeof SignUpRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

// Auth Response Types
export interface AuthSuccess {
  success: true;
  user?: User;
  message?: string;
}

export interface AuthError {
  success: false;
  error: string;
  code?: string;
}

export type AuthResponse = AuthSuccess | AuthError;

// Additional metadata types
export interface UserMetadata {
  name?: string;
  avatar_url?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface AppMetadata {
  role?: UserRole;
  [key: string]: string | number | boolean | null | undefined;
}

// Session User Type (extended from Supabase User)
export interface SessionUser extends User {
  id: string;
  email: string;
  user_metadata: UserMetadata;
  app_metadata: AppMetadata;
}



// Auth Context Type
export interface AuthContextType {
  user: SessionUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (data: SignUpRequest) => Promise<AuthResponse>;
  signIn: (data: LoginRequest) => Promise<AuthResponse>;
  signOut: () => Promise<AuthResponse>;
  resetPassword: (data: ResetPasswordRequest) => Promise<AuthResponse>;
  updateProfile: (data: Partial<SessionUser>) => Promise<AuthResponse>;
}

// Protected Route Props
export interface ProtectedRouteProps {
  children: React.ReactNode;
  fallbackUrl?: string;
  requiredRole?: UserRole;
}

export interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

// Role-based utility functions
export const hasRole = (user: SessionUser | null, role: UserRole): boolean => {
  return user?.role === role;
};

export const hasAnyRole = (user: SessionUser | null, roles: UserRole[]): boolean => {
  return user && user.role ? roles.includes(user.role as UserRole) : false;
};

export const isAdmin = (user: SessionUser | null): boolean => {
  return hasRole(user, 'admin');
};

export const canManageProject = (user: SessionUser | null, ownerId: string): boolean => {
  return isAdmin(user) || user?.id === ownerId;
};

export const canAccessAdminFeatures = (user: SessionUser | null): boolean => {
  return isAdmin(user);
};