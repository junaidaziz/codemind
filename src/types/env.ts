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
  
  // Agent Service Configuration
  AGENT_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  AGENT_SERVICE_API_KEY: z.string().optional(),
  AGENT_SERVICE_TIMEOUT: z.string().regex(/^\d+$/).transform(Number).default('30000'),
  AGENT_SERVICE_RETRIES: z.string().regex(/^\d+$/).transform(Number).default('3'),
  AGENT_SERVICE_RETRY_DELAY: z.string().regex(/^\d+$/).transform(Number).default('1000'),
  ENABLE_STANDALONE_AGENT: z.enum(['true', 'false']).default('false'),
  
  // GitHub OAuth (optional - required only when GitHub OAuth is enabled)
  GITHUB_CLIENT_ID: z.string().min(1, 'GitHub Client ID is required for OAuth authentication').optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GitHub Client Secret is required for OAuth authentication').optional(),
  
  // GitHub App for Auto Fix & PR Creation (optional - use either App or PAT)
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_PRIVATE_KEY: z.string().optional(),
  GITHUB_INSTALLATION_ID: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  
  // Personal Access Token alternative to GitHub App
  GITHUB_TOKEN: z.string().optional(),
  
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
  // Skip validation during build if requested
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    return {
      DATABASE_URL: 'postgresql://localhost:5432/codemind',
      SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-key',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-placeholder-key',
      AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL || 'http://localhost:3001',
      AGENT_SERVICE_API_KEY: process.env.AGENT_SERVICE_API_KEY,
      AGENT_SERVICE_TIMEOUT: parseInt(process.env.AGENT_SERVICE_TIMEOUT || '30000'),
      AGENT_SERVICE_RETRIES: parseInt(process.env.AGENT_SERVICE_RETRIES || '3'),
      AGENT_SERVICE_RETRY_DELAY: parseInt(process.env.AGENT_SERVICE_RETRY_DELAY || '1000'),
      ENABLE_STANDALONE_AGENT: (process.env.ENABLE_STANDALONE_AGENT as 'true' | 'false') || 'false',
      GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
      GITHUB_APP_ID: process.env.GITHUB_APP_ID,
      GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY,
      GITHUB_INSTALLATION_ID: process.env.GITHUB_INSTALLATION_ID,
      GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      SENTRY_DSN: process.env.SENTRY_DSN,
      VERCEL_URL: process.env.VERCEL_URL,
    } as Env;
  }

  const processEnv = {
    ...process.env,
    // Provide fallbacks for development - but never use placeholder for Supabase if real values exist
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/codemind',
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-placeholder-key',
    AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL || 'http://localhost:3001',
    AGENT_SERVICE_API_KEY: process.env.AGENT_SERVICE_API_KEY,
    AGENT_SERVICE_TIMEOUT: process.env.AGENT_SERVICE_TIMEOUT || '30000',
    AGENT_SERVICE_RETRIES: process.env.AGENT_SERVICE_RETRIES || '3',
    AGENT_SERVICE_RETRY_DELAY: process.env.AGENT_SERVICE_RETRY_DELAY || '1000',
    ENABLE_STANDALONE_AGENT: process.env.ENABLE_STANDALONE_AGENT || 'false',
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY,
    GITHUB_INSTALLATION_ID: process.env.GITHUB_INSTALLATION_ID,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
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
      // Return a safe default for development - use real Supabase values if available
      return {
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/codemind',
        SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-key',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-placeholder-key',
        AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL || 'http://localhost:3001',
        AGENT_SERVICE_API_KEY: process.env.AGENT_SERVICE_API_KEY,
        AGENT_SERVICE_TIMEOUT: parseInt(process.env.AGENT_SERVICE_TIMEOUT || '30000'),
        AGENT_SERVICE_RETRIES: parseInt(process.env.AGENT_SERVICE_RETRIES || '3'),
        AGENT_SERVICE_RETRY_DELAY: parseInt(process.env.AGENT_SERVICE_RETRY_DELAY || '1000'),
        ENABLE_STANDALONE_AGENT: (process.env.ENABLE_STANDALONE_AGENT as 'true' | 'false') || 'false',
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
        GITHUB_APP_ID: process.env.GITHUB_APP_ID,
        GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY,
        GITHUB_INSTALLATION_ID: process.env.GITHUB_INSTALLATION_ID,
        GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        NODE_ENV: 'development',
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        SENTRY_DSN: process.env.SENTRY_DSN,
        VERCEL_URL: process.env.VERCEL_URL,
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