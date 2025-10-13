import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { agentLogger } from './lib/logger.js';
import { env } from './lib/env.js';
import { AgentCore } from './lib/agent.js';
import { 
  AgentRequest,
  AgentResponse,
  AgentHealth,
  ValidationError,
  RateLimitError,
  ProcessingError,
  AgentRequestSchema,
  AgentHealthSchema
} from './lib/types.js';

// Server metrics
let totalRequests = 0;
let activeConnections = 0;
const startTime = Date.now();

/**
 * Agent Service Express Server
 */
class AgentServer {
  private app: express.Application;
  private server: any = null;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
      credentials: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    }));

    // Compression
    this.app.use(compression());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
      max: parseInt(env.RATE_LIMIT_MAX),
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        agentLogger.rateLimit('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
        });
        
        throw new RateLimitError('Rate limit exceeded');
      },
    });

    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req: any, res: Response, buf: Buffer) => {
        // Verify request size
        if (buf.length > 10 * 1024 * 1024) { // 10MB
          throw new ValidationError('Request body too large');
        }
      }
    }));

    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = req.headers['x-request-id'] as string || uuidv4();
      (req as any).requestId = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      totalRequests++;
      activeConnections++;
      
      agentLogger.info('Request received', {
        requestId: (req as any).requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.on('finish', () => {
        activeConnections--;
        agentLogger.info('Request completed', {
          requestId: (req as any).requestId,
          statusCode: res.statusCode,
          contentLength: res.get('Content-Length'),
        });
      });

      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      const memoryUsage = process.memoryUsage();
      
      const health: AgentHealth = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
        version: '1.0.0',
        memoryUsage: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        },
        activeConnections,
        totalRequests,
      };

      res.json(AgentHealthSchema.parse(health));
    });

    // Process agent request
    this.app.post('/api/agent/process', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const requestId = (req as any).requestId;
        const agentCore = new AgentCore(requestId);
        
        const request: AgentRequest = AgentRequestSchema.parse(req.body);
        const response: AgentResponse = await agentCore.processRequest(request);
        
        agentCore.dispose();
        res.json(response);
        
      } catch (error) {
        next(error);
      }
    });

    // Stream agent response
    this.app.post('/api/agent/stream', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const requestId = (req as any).requestId;
        const agentCore = new AgentCore(requestId);
        
        const request: AgentRequest = AgentRequestSchema.parse(req.body);
        
        // Set up SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        try {
          for await (const chunk of agentCore.processRequestStream(request)) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        } finally {
          agentCore.dispose();
          res.end();
        }
        
      } catch (error) {
        next(error);
      }
    });

    // Agent capabilities endpoint
    this.app.get('/api/agent/capabilities', (req: Request, res: Response) => {
      res.json({
        commands: [
          'summarize_project',
          'explain_function', 
          'generate_tests',
          'analyze_code',
          'chat'
        ],
        tools: [
          'code_analysis'
        ],
        limits: {
          maxMessageLength: 4000,
          maxTokens: parseInt(env.OPENAI_MAX_TOKENS),
          maxToolExecutions: 5,
        },
        version: '1.0.0',
      });
    });

    // Metrics endpoint
    this.app.get('/api/metrics', (req: Request, res: Response) => {
      const memoryUsage = process.memoryUsage();
      
      res.json({
        uptime: Date.now() - startTime,
        totalRequests,
        activeConnections,
        memoryUsage: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
        },
        environment: env.NODE_ENV,
        version: '1.0.0',
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      const requestId = (req as any).requestId;

      agentLogger.error('Request error', {
        requestId,
        error: error.message,
        stack: error.stack,
        path: req.path,
      });

      // Handle known error types
      if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
          requestId,
          timestamp: new Date().toISOString(),
          metadata: error.metadata,
        });
      }

      if (error instanceof RateLimitError) {
        return res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
          requestId,
          timestamp: new Date().toISOString(),
        });
      }

      if (error instanceof ProcessingError) {
        return res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
          requestId,
          timestamp: new Date().toISOString(),
          metadata: error.metadata,
        });
      }

      // Generic error handler
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An internal server error occurred',
        requestId,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    const port = parseInt(env.PORT);
    
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, '0.0.0.0', () => {
        agentLogger.info('Agent Service started', {
          port,
          environment: env.NODE_ENV,
          version: '1.0.0',
        });
        resolve();
      });

      this.server.on('error', (error: Error) => {
        agentLogger.error('Server startup error', {
          error: error.message,
          stack: error.stack,
        });
        reject(error);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdown('SIGINT'));
    });
  }

  /**
   * Shutdown the server gracefully
   */
  private shutdown(signal: string): void {
    agentLogger.info(`Received ${signal}, shutting down gracefully`);
    
    if (this.server) {
      this.server.close(() => {
        agentLogger.info('Server closed');
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        agentLogger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    } else {
      process.exit(0);
    }
  }
}

// Start the server
async function main(): Promise<void> {
  try {
    const server = new AgentServer();
    await server.start();
  } catch (error) {
    agentLogger.error('Failed to start Agent Service', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Only start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error during startup:', error);
    process.exit(1);
  });
}

export { AgentServer };