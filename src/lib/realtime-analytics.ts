import { logger } from '../app/lib/logger';
import { CacheService } from './cache-service';

// Analytics update types
export interface AnalyticsUpdate {
  projectId: string;
  type: 'commits' | 'pull_requests' | 'issues' | 'contributors' | 'ai_metrics' | 'full_refresh' | 'github-sync-complete';
  data?: unknown;
  timestamp: number;
}

// Client connection interface for SSE
interface ClientConnection {
  id: string;
  response: Response;
  projectId: string;
  controller: ReadableStreamDefaultController;
  lastPing: number;
}

// Real-time analytics service using Server-Sent Events
export class RealTimeAnalyticsService {
  private connections = new Map<string, ClientConnection>();
  private updateQueue: AnalyticsUpdate[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startUpdateProcessor();
    this.startConnectionCleanup();
  }

  // Create SSE connection for a client
  createConnection(projectId: string): ReadableStream {
    const connectionId = `${projectId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return new ReadableStream({
      start: (controller) => {
        const connection: ClientConnection = {
          id: connectionId,
          response: new Response(), // Placeholder
          projectId,
          controller,
          lastPing: Date.now(),
        };

        this.connections.set(connectionId, connection);
        
        logger.info('SSE connection created', {
          connectionId,
          projectId,
          totalConnections: this.connections.size,
        });

        // Send initial connection message
        this.sendToConnection(connectionId, {
          type: 'connected',
          projectId,
          timestamp: Date.now(),
        });

        // Send cached analytics if available
        this.sendCachedAnalytics(connectionId, projectId);

        // Send periodic pings to keep connection alive
        const pingInterval = setInterval(() => {
          if (this.connections.has(connectionId)) {
            this.sendToConnection(connectionId, {
              type: 'ping',
              timestamp: Date.now(),
            });
            connection.lastPing = Date.now();
          } else {
            clearInterval(pingInterval);
          }
        }, 30000); // Ping every 30 seconds
      },
      cancel: () => {
        this.connections.delete(connectionId);
        logger.info('SSE connection closed', {
          connectionId,
          projectId,
          totalConnections: this.connections.size,
        });
      },
    });
  }

  // Send message to a specific connection
  private sendToConnection(connectionId: string, data: unknown): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      connection.controller.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      logger.error('Failed to send message to connection', { connectionId }, error as Error);
      this.connections.delete(connectionId);
    }
  }

  // Send cached analytics data to a specific connection
  private async sendCachedAnalytics(connectionId: string, projectId: string): Promise<void> {
    try {
      const cachedData = await CacheService.getProjectAnalytics(projectId);
      if (cachedData) {
        this.sendToConnection(connectionId, {
          type: 'analytics-data',
          projectId,
          data: cachedData,
          cached: true,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error('Failed to send cached analytics', { projectId, connectionId }, error as Error);
    }
  }

  // Trigger analytics refresh for a project
  private async triggerAnalyticsRefresh(projectId: string): Promise<void> {
    try {
      // Invalidate cache
      await CacheService.invalidateProjectAnalytics(projectId);
      
      // Emit refresh event to all subscribers
        this.sendToProject(projectId, {
          type: 'analytics-refresh',
          projectId,
          timestamp: Date.now(),
        });      logger.info('Analytics refresh triggered', { projectId });
    } catch (error) {
      logger.error('Failed to trigger analytics refresh', { projectId }, error as Error);
    }
  }

  // Queue an analytics update
  queueUpdate(update: AnalyticsUpdate): void {
    this.updateQueue.push(update);
    logger.debug('Analytics update queued', {
      projectId: update.projectId,
      type: update.type,
      queueSize: this.updateQueue.length,
    });

    // Process immediately if queue is getting large
    if (this.updateQueue.length >= 10) {
      this.processUpdates();
    }
  }

  // Process queued updates
  private async processUpdates(): Promise<void> {
    if (this.updateQueue.length === 0) return;

    const updates = [...this.updateQueue];
    this.updateQueue = [];

    logger.info('Processing analytics updates', {
      updateCount: updates.length,
    });

    // Group updates by project
    const projectUpdates = new Map<string, AnalyticsUpdate[]>();
    for (const update of updates) {
      const existing = projectUpdates.get(update.projectId) || [];
      existing.push(update);
      projectUpdates.set(update.projectId, existing);
    }

    // Process updates for each project
    for (const [projectId, updates] of projectUpdates) {
      await this.processProjectUpdates(projectId, updates);
    }
  }

  // Process updates for a specific project
  private async processProjectUpdates(projectId: string, updates: AnalyticsUpdate[]): Promise<void> {
    try {
      // Check if we need to do a full refresh
      const hasFullRefresh = updates.some(u => u.type === 'full_refresh');
      
      if (hasFullRefresh) {
        await this.triggerAnalyticsRefresh(projectId);
        return;
      }

      // Send incremental updates
      for (const update of updates) {
        this.sendToProject(projectId, {
          type: 'analytics-update',
          projectId,
          updateType: update.type,
          data: update.data,
          timestamp: update.timestamp,
        });
      }

      // Invalidate relevant cache entries
      await CacheService.markProjectAsUpdated(projectId);

    } catch (error) {
      logger.error('Failed to process project updates', { projectId }, error as Error);
    }
  }

  // Send event to all clients subscribed to a project
  private sendToProject(projectId: string, data: unknown): void {
    const projectConnections = Array.from(this.connections.values())
      .filter(conn => conn.projectId === projectId);
    
    logger.debug('Sending event to project subscribers', {
      projectId,
      subscriberCount: projectConnections.length,
    });

    for (const connection of projectConnections) {
      this.sendToConnection(connection.id, data);
    }
  }

  // Start connection cleanup process
  private startConnectionCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleConnections = Array.from(this.connections.entries())
        .filter(([, connection]) => now - connection.lastPing > 120000); // 2 minutes

      for (const [connectionId] of staleConnections) {
        this.connections.delete(connectionId);
      }

      if (staleConnections.length > 0) {
        logger.info('Cleaned up stale connections', {
          removed: staleConnections.length,
          remaining: this.connections.size,
        });
      }
    }, 60000); // Check every minute
  }

  // Start the update processor
  private startUpdateProcessor(): void {
    // Process updates every 5 seconds
    this.flushInterval = setInterval(() => {
      this.processUpdates();
    }, 5000);
  }

  // Webhook integration - handle GitHub events
  async handleWebhookEvent(projectId: string, eventType: string, eventData: unknown): Promise<void> {
    let updateType: AnalyticsUpdate['type'];

    switch (eventType) {
      case 'push':
        updateType = 'commits';
        break;
      case 'pull_request':
        updateType = 'pull_requests';
        break;
      case 'issues':
        updateType = 'issues';
        break;
      default:
        updateType = 'full_refresh';
    }

    this.queueUpdate({
      projectId,
      type: updateType,
      data: eventData,
      timestamp: Date.now(),
    });
  }

  // Notify GitHub sync completion
  notifyGitHubSyncComplete(projectId: string, syncData: unknown): void {
    this.queueUpdate({
      type: 'github-sync-complete',
      projectId,
      data: syncData,
      timestamp: Date.now(),
    });

    // Trigger full analytics refresh
    this.queueUpdate({
      projectId,
      type: 'full_refresh',
      timestamp: Date.now(),
    });
  }

  // Notify AI metrics updates (fixes, PR creation, etc.)
  notifyAIMetricsUpdate(projectId: string, metricsData?: unknown): void {
    this.queueUpdate({
      projectId,
      type: 'ai_metrics',
      data: metricsData,
      timestamp: Date.now(),
    });
  }

  // Get connection statistics
  getStats(): {
    connectedClients: number;
    projectSubscriptions: Record<string, number>;
    queuedUpdates: number;
  } {
    const projectSubscriptions: Record<string, number> = {};
    
    for (const connection of this.connections.values()) {
      const count = projectSubscriptions[connection.projectId] || 0;
      projectSubscriptions[connection.projectId] = count + 1;
    }

    return {
      connectedClients: this.connections.size,
      projectSubscriptions,
      queuedUpdates: this.updateQueue.length,
    };
  }

  // Cleanup
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        connection.controller.close();
      } catch {
        // Ignore errors when closing
      }
    }
    
    this.connections.clear();
    this.updateQueue = [];
    logger.info('Real-time analytics service destroyed');
  }
}

// Singleton instance
let realTimeAnalyticsService: RealTimeAnalyticsService | null = null;

export function getRealTimeAnalyticsService(): RealTimeAnalyticsService {
  if (!realTimeAnalyticsService) {
    realTimeAnalyticsService = new RealTimeAnalyticsService();
  }
  return realTimeAnalyticsService;
}

export { realTimeAnalyticsService };