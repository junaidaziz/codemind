import { env } from '../../types/env';

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Log context type
export interface LogContext {
  userId?: string;
  projectId?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  url?: string;
  method?: string;
  [key: string]: unknown;
}

// Log entry structure
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
  error?: Error;
  stack?: string;
  metadata?: Record<string, unknown>;
}

// Logger configuration
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableSentry: boolean;
  environment: string;
}

class Logger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
      enableConsole: true,
      enableSentry: env.NODE_ENV === 'production',
      environment: env.NODE_ENV,
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private safeStringify(obj: unknown): string {
    const seen = new WeakSet();
    
    return JSON.stringify(obj, (key, value) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      
      // Filter out functions and symbols
      if (typeof value === 'function' || typeof value === 'symbol') {
        return '[Function]';
      }
      
      // Truncate long strings
      if (typeof value === 'string' && value.length > 200) {
        return value.substring(0, 200) + '...';
      }
      
      return value;
    });
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    
    let context = '';
    if (entry.context) {
      try {
        context = ` [${this.safeStringify(entry.context)}]`;
      } catch {
        context = ' [Context serialization failed]';
      }
    }
    
    return `[${timestamp}] ${level}: ${entry.message}${context}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      error,
      stack: error?.stack,
    };

    // Console logging
    if (this.config.enableConsole) {
      const formattedMessage = this.formatMessage(entry);
      
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage, error);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage, error);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage, error);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage, error);
          break;
      }
    }

    // Sentry logging (for errors and warnings in production)
    if (this.config.enableSentry && level >= LogLevel.WARN) {
      this.sendToSentry(entry);
    }
  }

  private sendToSentry(entry: LogEntry): void {
    // TODO: Implement Sentry integration when SDK is added
    // For now, this is a placeholder for future Sentry integration
    if (env.NODE_ENV === 'production') {
      // Sentry integration will be implemented here
      console.warn('Sentry integration not yet implemented:', entry.message);
    }
  }

  // Public logging methods
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  // Convenience methods for common use cases
  authError(message: string, userId?: string, error?: Error): void {
    this.error(message, { userId, component: 'auth' }, error);
  }

  apiError(message: string, context: { method?: string; url?: string; userId?: string }, error?: Error): void {
    this.error(message, { ...context, component: 'api' }, error);
  }

  databaseError(message: string, context?: LogContext, error?: Error): void {
    this.error(message, { ...context, component: 'database' }, error);
  }

  aiError(message: string, context: { projectId?: string; userId?: string }, error?: Error): void {
    this.error(message, { ...context, component: 'ai' }, error);
  }

  // Performance logging
  performanceLog(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation} took ${duration}ms`, {
      ...context,
      component: 'performance',
      duration,
      operation,
    });
  }

  // Request logging middleware
  requestLog(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void {
    const level = statusCode >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    const message = `${method} ${url} ${statusCode} - ${duration}ms`;
    
    this.log(level, message, {
      ...context,
      component: 'request',
      method,
      url,
      statusCode,
      duration,
    });
  }
}

// Global logger instance
export const logger = new Logger();

// Helper function to create a logger with specific context
export function createContextLogger(context: LogContext): {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string, error?: Error) => void;
  error: (message: string, error?: Error) => void;
} {
  return {
    debug: (message: string) => logger.debug(message, context),
    info: (message: string) => logger.info(message, context),
    warn: (message: string, error?: Error) => logger.warn(message, context, error),
    error: (message: string, error?: Error) => logger.error(message, context, error),
  };
}

// Performance measurement utility
export function measurePerformance<T>(
  operation: string,
  fn: () => T | Promise<T>,
  context?: LogContext
): T | Promise<T> {
  const start = Date.now();
  
  const result = fn();
  
  if (result instanceof Promise) {
    return result.finally(() => {
      const duration = Date.now() - start;
      logger.performanceLog(operation, duration, context);
    });
  } else {
    const duration = Date.now() - start;
    logger.performanceLog(operation, duration, context);
    return result;
  }
}

// Type-safe error wrapper
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly context?: LogContext;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    context?: LogContext,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.context = context;
    this.isOperational = isOperational;

    // Capture stack trace
    Error.captureStackTrace(this, AppError);
    
    // Log the error
    logger.error(message, context, this);
  }
}

// Error factory functions
export const createError = {
  validation: (message: string, context?: LogContext) =>
    new AppError(message, 'VALIDATION_ERROR', 400, context),
  
  unauthorized: (message: string = 'Unauthorized', context?: LogContext) =>
    new AppError(message, 'UNAUTHORIZED', 401, context),
  
  forbidden: (message: string = 'Forbidden', context?: LogContext) =>
    new AppError(message, 'FORBIDDEN', 403, context),
  
  notFound: (message: string = 'Not found', context?: LogContext) =>
    new AppError(message, 'NOT_FOUND', 404, context),
  
  conflict: (message: string, context?: LogContext) =>
    new AppError(message, 'CONFLICT', 409, context),
  
  internal: (message: string = 'Internal server error', context?: LogContext) =>
    new AppError(message, 'INTERNAL_ERROR', 500, context),
  
  database: (message: string, context?: LogContext) =>
    new AppError(message, 'DATABASE_ERROR', 500, context),
  
  external: (message: string, service: string, context?: LogContext) =>
    new AppError(message, 'EXTERNAL_SERVICE_ERROR', 502, { ...context, service }),
};

// Enhanced Performance timing utilities
export interface PerformanceTimer {
  start: number;
  name: string;
  labels?: Record<string, string>;
}

export function createPerformanceTimer(name: string, labels?: Record<string, string>): PerformanceTimer {
  return {
    start: performance.now(),
    name,
    labels,
  };
}

export function endPerformanceTimer(timer: PerformanceTimer): number {
  const duration = performance.now() - timer.start;
  
  logger.info('Performance timing', {
    metric: 'duration',
    name: timer.name,
    duration,
    labels: timer.labels,
  });

  return duration;
}

// Database performance monitoring
export function withDatabaseTiming<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const timer = createPerformanceTimer(`db.${operation}`, { type: 'database' });
  
  return fn()
    .then((result) => {
      endPerformanceTimer(timer);
      return result;
    })
    .catch((error) => {
      const duration = endPerformanceTimer(timer);
      logger.error('Database operation failed', {
        operation,
        duration,
      }, error);
      throw error;
    });
}

// API request timing
export function withRequestTiming<T>(
  method: string,
  path: string,
  fn: () => Promise<T>
): Promise<T> {
  const timer = createPerformanceTimer(`api.${method.toLowerCase()}.${path}`, { 
    type: 'api',
    method,
    path,
  });
  
  return fn()
    .then((result) => {
      endPerformanceTimer(timer);
      return result;
    })
    .catch((error) => {
      const duration = endPerformanceTimer(timer);
      logger.error('API request failed', {
        method,
        path,
        duration,
      }, error);
      throw error;
    });
}