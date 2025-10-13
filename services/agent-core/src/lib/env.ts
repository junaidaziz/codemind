import { z } from 'zod';

export const EnvConfigSchema = z.object({
  // Agent Service Configuration
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // OpenAI Configuration
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: z.string().default('1000'),
  OPENAI_TEMPERATURE: z.string().default('0.7'),
  
  // Database Configuration  
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  
  // Rate Limiting Configuration
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'), // 15 minutes
  
  // Security Configuration
  AGENT_SERVICE_SECRET: z.string().min(32, 'Agent service secret must be at least 32 characters'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Performance Configuration
  MAX_CONCURRENT_REQUESTS: z.string().default('10'),
  REQUEST_TIMEOUT_MS: z.string().default('30000'),
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
});

export type EnvConfig = z.infer<typeof EnvConfigSchema>;

export const env: EnvConfig = EnvConfigSchema.parse(process.env);