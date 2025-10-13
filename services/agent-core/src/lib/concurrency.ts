import { Request, Response, NextFunction } from 'express';
import { agentLogger } from './logger.js';
import { env } from './env.js';
import { RateLimitError } from './types.js';

// Node.js globals
declare const Buffer: typeof globalThis.Buffer;
declare const process: typeof globalThis.process;
declare const setInterval: typeof globalThis.setInterval;

/**
 * Request metrics and tracking
 */
interface RequestMetrics {
  activeRequests: number;
  totalRequests: number;
  requestsPerSecond: number;
  averageResponseTime: number;
  memoryUsage: number;
}

/**
 * Rate limit storage
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastRequest: number;
}

/**
 * Concurrency and rate limiting manager
 */
export class ConcurrencyManager {
  private static instance: ConcurrencyManager;
  private activeRequests = 0;
  private totalRequests = 0;
  private requestTimes: number[] = [];
  private rateLimitStore = new Map<string, RateLimitEntry>();
  private maxConcurrent: number;
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor() {
    this.maxConcurrent = parseInt(env.MAX_CONCURRENT_REQUESTS);
    this.windowMs = parseInt(env.RATE_LIMIT_WINDOW_MS);
    this.maxRequests = parseInt(env.RATE_LIMIT_MAX);
    
    // Clean up rate limit entries every minute
    setInterval(() => this.cleanupRateLimitStore(), 60000);
    
    // Log metrics every 30 seconds
    setInterval(() => this.logMetrics(), 30000);
  }

  static getInstance(): ConcurrencyManager {
    if (!ConcurrencyManager.instance) {
      ConcurrencyManager.instance = new ConcurrencyManager();
    }
    return ConcurrencyManager.instance;
  }

  /**
   * Middleware to enforce rate limiting and concurrency controls
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const clientId = this.getClientId(req);

      try {
        // Check rate limit
        if (!this.checkRateLimit(clientId)) {
          agentLogger.rateLimit('Rate limit exceeded', {
            ip: req.ip,
            clientId,
            endpoint: req.path,
            current: this.rateLimitStore.get(clientId)?.count || 0,
            limit: this.maxRequests,
          });

          throw new RateLimitError(`Rate limit exceeded. Maximum ${this.maxRequests} requests per ${this.windowMs / 1000}s`);
        }

        // Check concurrency limit
        if (!this.checkConcurrencyLimit()) {
          agentLogger.rateLimit('Concurrency limit exceeded', {
            ip: req.ip,
            clientId,
            endpoint: req.path,
            current: this.activeRequests,
            limit: this.maxConcurrent,
          });

          throw new RateLimitError(`Service at capacity. Maximum ${this.maxConcurrent} concurrent requests`);
        }

        // Track request
        this.incrementActiveRequests();
        this.recordRateLimitRequest(clientId);

        // Add metrics to request object
        (req as Request & { concurrencyMetrics?: { startTime: number; clientId: string } }).concurrencyMetrics = {
          startTime,
          clientId,
        };

        // Handle response completion
        res.on('finish', () => {
          this.decrementActiveRequests();
          this.recordRequestTime(Date.now() - startTime);
          
          agentLogger.performance('Request completed', {
            executionTimeMs: Date.now() - startTime,
            activeRequests: this.activeRequests,
            statusCode: res.statusCode,
            endpoint: req.path,
          });
        });

        next();

      } catch (error) {
        if (error instanceof RateLimitError) {
          res.status(429).json({
            error: 'RATE_LIMIT_EXCEEDED',
            message: error.message,
            retryAfter: Math.ceil(this.windowMs / 1000),
            timestamp: new Date().toISOString(),
          });
        } else {
          next(error);
        }
      }
    };
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientId(req: Request): string {
    // Use user ID if authenticated, otherwise use IP + User-Agent hash
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
      return `user:${userId}`;
    }

    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    // Simple hash for IP + User-Agent
    const hash = Buffer.from(`${ip}:${userAgent}`).toString('base64').slice(0, 12);
    return `anonymous:${hash}`;
  }

  /**
   * Check if request is within rate limit
   */
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const entry = this.rateLimitStore.get(clientId);

    if (!entry) {
      return true; // First request from this client
    }

    // Reset if window has expired
    if (now > entry.resetTime) {
      this.rateLimitStore.delete(clientId);
      return true;
    }

    // Check if within limit
    return entry.count < this.maxRequests;
  }

  /**
   * Check if within concurrency limit
   */
  private checkConcurrencyLimit(): boolean {
    return this.activeRequests < this.maxConcurrent;
  }

  /**
   * Record a request for rate limiting
   */
  private recordRateLimitRequest(clientId: string): void {
    const now = Date.now();
    const entry = this.rateLimitStore.get(clientId);

    if (!entry || now > entry.resetTime) {
      // New window
      this.rateLimitStore.set(clientId, {
        count: 1,
        resetTime: now + this.windowMs,
        lastRequest: now,
      });
    } else {
      // Increment existing
      entry.count++;
      entry.lastRequest = now;
    }

    this.totalRequests++;
  }

  /**
   * Increment active request counter
   */
  private incrementActiveRequests(): void {
    this.activeRequests++;
    
    if (this.activeRequests > this.maxConcurrent * 0.9) {
      agentLogger.warn('High concurrency detected', {
        activeRequests: this.activeRequests,
        maxConcurrent: this.maxConcurrent,
        utilizationPercent: (this.activeRequests / this.maxConcurrent) * 100,
      });
    }
  }

  /**
   * Decrement active request counter
   */
  private decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Record request completion time
   */
  private recordRequestTime(duration: number): void {
    this.requestTimes.push(duration);
    
    // Keep only last 1000 request times
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000);
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimitStore(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [clientId, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitStore.delete(clientId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      agentLogger.info('Cleaned up rate limit entries', {
        entriesRemoved: cleaned,
        totalEntries: this.rateLimitStore.size,
      });
    }
  }

  /**
   * Log performance metrics
   */
  private logMetrics(): void {
    const memoryUsage = process.memoryUsage();
    const metrics = this.getMetrics();

    agentLogger.performance('Service metrics', {
      activeRequests: metrics.activeRequests,
      totalRequests: metrics.totalRequests,
      requestsPerSecond: metrics.requestsPerSecond,
      averageResponseTime: metrics.averageResponseTime,
      memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      rateLimitEntries: this.rateLimitStore.size,
    });

    // Alert on high memory usage
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 80) {
      agentLogger.warn('High memory usage detected', {
        memoryUsagePercent: Math.round(memoryUsagePercent),
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      });
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): RequestMetrics {
    const memoryUsage = process.memoryUsage();
    
    // Calculate requests per second (last 60 seconds)
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequestTimes = this.requestTimes.filter(time => time > oneMinuteAgo);
    const requestsPerSecond = recentRequestTimes.length / 60;

    // Calculate average response time
    const averageResponseTime = this.requestTimes.length > 0
      ? this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length
      : 0;

    return {
      activeRequests: this.activeRequests,
      totalRequests: this.totalRequests,
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      memoryUsage: memoryUsage.heapUsed,
    };
  }

  /**
   * Get rate limit info for a client
   */
  getRateLimitInfo(clientId: string): {
    remaining: number;
    resetTime: number;
    total: number;
  } {
    const entry = this.rateLimitStore.get(clientId);
    
    if (!entry || Date.now() > entry.resetTime) {
      return {
        remaining: this.maxRequests,
        resetTime: Date.now() + this.windowMs,
        total: this.maxRequests,
      };
    }

    return {
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetTime: entry.resetTime,
      total: this.maxRequests,
    };
  }

  /**
   * Check service health
   */
  isHealthy(): boolean {
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    // Service is unhealthy if:
    // - Memory usage > 90%
    // - All concurrent slots are occupied
    // - Average response time > 30 seconds
    const averageResponseTime = this.requestTimes.length > 0
      ? this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length
      : 0;

    return (
      memoryUsagePercent < 90 &&
      this.activeRequests < this.maxConcurrent &&
      averageResponseTime < 30000
    );
  }
}