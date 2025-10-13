import winston from 'winston';
import { env } from './env.js';

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

// Define log info interface
interface LogInfo {
  level: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

// Custom format for simple logging
const simpleFormat = printf(({ level, message, timestamp, ...meta }: LogInfo) => {
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
});

// Configure winston logger
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    env.LOG_FORMAT === 'json' ? json() : combine(colorize(), simpleFormat)
  ),
  defaultMeta: {
    service: 'agent-core',
    version: '1.0.0'
  },
  transports: [
    new winston.transports.Console(),
    ...(env.NODE_ENV === 'production' ? [
      new winston.transports.File({ 
        filename: '/var/log/agent-core/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({ 
        filename: '/var/log/agent-core/combined.log',
        maxsize: 5242880, // 5MB  
        maxFiles: 5
      })
    ] : [])
  ],
});

// Extend logger with helper methods
export const agentLogger = {
  ...logger,
  
  /**
   * Log agent execution details
   */
  execution: (message: string, metadata: {
    projectId?: string;
    userId?: string;
    sessionId?: string;
    command?: string;
    executionTimeMs?: number;
    toolsUsed?: string[];
  }) => {
    logger.info(message, { 
      type: 'execution',
      ...metadata 
    });
  },

  /**
   * Log performance metrics
   */
  performance: (message: string, metrics: {
    executionTimeMs: number;
    memoryUsage?: number;
    tokenUsage?: number;
    toolExecutions?: number;
  }) => {
    logger.info(message, {
      type: 'performance', 
      ...metrics
    });
  },

  /**
   * Log security events
   */
  security: (message: string, details: {
    ip?: string;
    userAgent?: string;
    requestId?: string;
    action?: string;
  }) => {
    logger.warn(message, {
      type: 'security',
      ...details
    });
  },

  /**
   * Log rate limiting events
   */
  rateLimit: (message: string, details: {
    ip?: string;
    userId?: string;
    endpoint?: string;
    limit?: number;
    current?: number;
  }) => {
    logger.warn(message, {
      type: 'rate_limit',
      ...details
    });
  }
};

export default agentLogger;