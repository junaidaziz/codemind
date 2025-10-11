import { z } from 'zod';

// Environment variable validation schema
const EnvSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  
  // OpenAI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  
  // Next.js
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  
  // Optional: Monitoring & Analytics
  SENTRY_DSN: z.string().url().optional(),
  VERCEL_URL: z.string().optional(),
  
}).superRefine((data, ctx) => {
  // Custom validation: ensure public and private Supabase URLs match
  if (data.SUPABASE_URL !== data.NEXT_PUBLIC_SUPABASE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL must match',
      path: ['NEXT_PUBLIC_SUPABASE_URL'],
    });
  }
  
  // Custom validation: ensure public and private Supabase keys match
  if (data.SUPABASE_ANON_KEY !== data.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'SUPABASE_ANON_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY must match',
      path: ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    });
  }
});

// Infer TypeScript type from Zod schema
export type Env = z.infer<typeof EnvSchema>;

// Validation function with fallbacks for development
function validateEnv(): Env {
  const processEnv = {
    ...process.env,
    // Provide fallbacks for development
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/codemind',
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-key',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-placeholder-key',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  try {
    return EnvSchema.parse(processEnv);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Environment validation failed in development mode, using defaults:');
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          console.warn(`  - ${issue.path.join('.')}: ${issue.message}`);
        });
      }
      // Return a safe default for development
      return {
        DATABASE_URL: 'postgresql://localhost:5432/codemind',
        SUPABASE_URL: 'https://placeholder.supabase.co',
        SUPABASE_ANON_KEY: 'placeholder-key',
        NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-key',
        OPENAI_API_KEY: 'sk-placeholder-key',
        NODE_ENV: 'development',
        NEXT_PUBLIC_APP_URL: undefined,
        SENTRY_DSN: undefined,
        VERCEL_URL: undefined,
      } as Env;
    }
    
    console.error('❌ Environment validation failed in production:');
    if (error instanceof z.ZodError) {
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
    }
    throw new Error('Invalid environment configuration');
  }
}

// Get validated environment variables
export const env = validateEnv();

export { EnvSchema };