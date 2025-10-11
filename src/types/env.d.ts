import { z } from 'zod';

// Environment variable validation schema
export const EnvSchema = z.object({
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

// Validation function
export function validateEnv(): Env {
  try {
    return EnvSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Environment validation failed:');
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

// Type declaration for process.env to enable TypeScript autocompletion
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Database
      DATABASE_URL: string;
      
      // Supabase
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      NEXT_PUBLIC_SUPABASE_URL: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
      
      // OpenAI
      OPENAI_API_KEY: string;
      
      // Next.js
      NODE_ENV: 'development' | 'production' | 'test';
      NEXT_PUBLIC_APP_URL?: string;
      
      // Optional: Monitoring & Analytics
      SENTRY_DSN?: string;
      VERCEL_URL?: string;
    }
  }
}