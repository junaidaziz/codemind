// Sentry Integration Stub for CodeMind
// This file provides typed interfaces for future Sentry integration
// To enable full functionality, install @sentry/nextjs and uncomment implementation

import { env } from '../../types/env';

// Sentry event type (simplified)
export interface SentryEvent {
  message?: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: unknown;
    }>;
  };
  contexts?: Record<string, unknown>;
  tags?: Record<string, string>;
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
}

// Sentry configuration interface
export interface SentryConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  beforeSend?: (event: SentryEvent) => SentryEvent | null;
}

// User context type
export interface SentryUser {
  id: string;
  email?: string;
  role?: string;
}

// Initialize Sentry (client-side stub)
export function initSentryClient(): void {
  if (env.SENTRY_DSN) {
    console.log('Sentry client initialization requested (stub implementation)');
    // TODO: Implement when @sentry/nextjs is installed
  }
}

// Initialize Sentry (server-side stub)
export function initSentryServer(): void {
  if (env.SENTRY_DSN) {
    console.log('Sentry server initialization requested (stub implementation)');
    // TODO: Implement when @sentry/nextjs is installed
  }
}

// Sentry utility functions (stub implementations)
export const sentry = {
  // Capture exception with context
  captureException: (error: Error, context?: Record<string, unknown>) => {
    if (env.NODE_ENV === 'development') {
      console.error('Sentry captureException (stub):', error.message, context);
    }
    // TODO: Implement actual Sentry integration
  },

  // Capture message with level
  captureMessage: (
    message: string, 
    level: 'debug' | 'info' | 'warning' | 'error' = 'info', 
    context?: Record<string, unknown>
  ) => {
    if (env.NODE_ENV === 'development') {
      console.log(`Sentry captureMessage (stub) [${level}]:`, message, context);
    }
    // TODO: Implement actual Sentry integration
  },

  // Add breadcrumb
  addBreadcrumb: (message: string, category: string, data?: Record<string, unknown>) => {
    if (env.NODE_ENV === 'development') {
      console.log(`Sentry breadcrumb (stub) [${category}]:`, message, data);
    }
    // TODO: Implement actual Sentry integration
  },

  // Set user context
  setUser: (user: SentryUser) => {
    if (env.NODE_ENV === 'development') {
      console.log('Sentry setUser (stub):', user);
    }
    // TODO: Implement actual Sentry integration
  },

  // Clear user context
  clearUser: () => {
    if (env.NODE_ENV === 'development') {
      console.log('Sentry clearUser (stub)');
    }
    // TODO: Implement actual Sentry integration
  },
};

// Performance monitoring (stub)
export function withSentryTracing<T extends (...args: unknown[]) => unknown>(
  name: string,
  fn: T,
  tags?: Record<string, string>
): T {
  return ((...args: Parameters<T>) => {
    if (env.NODE_ENV === 'development') {
      console.log(`Sentry trace (stub): ${name}`, tags);
    }
    return fn(...args);
  }) as T;
}

// Error boundary integration
export interface ErrorBoundaryProps {
  fallback: React.ComponentType<{ error: Error; resetError: () => void }>;
  children: React.ReactNode;
}

// Installation instructions
export const SENTRY_SETUP = `
# Install Sentry SDK
npm install @sentry/nextjs

# Add to next.config.ts
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(
  {
    // Your Next.js config
  },
  {
    // Sentry configuration
    silent: true,
    org: "your-org",
    project: "codemind",
  }
);

# Environment variables
SENTRY_DSN=your-sentry-dsn-url
SENTRY_ORG=your-org
SENTRY_PROJECT=codemind
SENTRY_AUTH_TOKEN=your-auth-token
`;

export default sentry;