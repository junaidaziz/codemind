import { EventEmitter } from 'events';
import os from 'os';
import { agentLogger } from './logger.js';

/**
 * System resource metrics
 */
interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    available: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
  };
}

/**
 * Resource alert configuration
 */
interface AlertConfig {
  memoryThreshold: number; // percentage
  cpuThreshold: number; // percentage  
  diskThreshold: number; // percentage
  alertCooldown: number; // milliseconds
}

/**
 * System resource monitoring and management
 */
export class ResourceMonitor extends EventEmitter {
  private static instance: ResourceMonitor;
  private monitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private alertConfig: AlertConfig;
  private lastAlerts: Map<string, number> = new Map();
  private metrics: SystemMetrics | null = null;

  constructor() {
    super();
    
    this.alertConfig = {
      memoryThreshold: 85, // Alert at 85% memory usage
      cpuThreshold: 90, // Alert at 90% CPU usage
      diskThreshold: 90, // Alert at 90% disk usage
      alertCooldown: 300000, // 5 minutes between same alert type
    };
  }

  static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor();
    }
    return ResourceMonitor.instance;
  }

  /**
   * Start resource monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.monitoring) {
      return;
    }

    this.monitoring = true;
    agentLogger.info('Starting resource monitoring', { intervalMs });

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    // Collect initial metrics
    this.collectMetrics();
  }

  /**
   * Stop resource monitoring
   */
  stopMonitoring(): void {
    if (!this.monitoring) {
      return;
    }

    this.monitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    agentLogger.info('Stopped resource monitoring');
  }

  /**
   * Collect current system metrics
   */
  private collectMetrics(): void {
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.metrics = {
        cpu: {
          usage: this.calculateCpuUsage(cpuUsage),
          loadAverage: this.getLoadAverage(),
        },
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          available: memoryUsage.heapTotal - memoryUsage.heapUsed,
        },
        disk: {
          used: 0, // Would need fs.statSync for actual disk usage
          total: 0,
          percentage: 0,
        },
        network: {
          bytesReceived: 0, // Would need network interface stats
          bytesSent: 0,
        },
      };

      // Check for resource alerts
      this.checkResourceAlerts(this.metrics);

      // Emit metrics event
      this.emit('metrics', this.metrics);

      // Log metrics periodically (every 10th collection)
      if (Math.random() < 0.1) {
        agentLogger.info('Resource metrics collected', {
          memoryUsagePercent: Math.round(this.metrics.memory.percentage),
          memoryUsedMB: Math.round(this.metrics.memory.used / 1024 / 1024),
          cpuUsagePercent: Math.round(this.metrics.cpu.usage),
          loadAverage: this.metrics.cpu.loadAverage,
        });
      }

    } catch (error) {
      agentLogger.error('Failed to collect resource metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    // This is a simplified calculation
    // In practice, you'd need to compare with previous measurements
    const totalTime = cpuUsage.user + cpuUsage.system;
    const totalSystemTime = process.uptime() * 1000000; // Convert to microseconds
    
    return Math.min(100, (totalTime / totalSystemTime) * 100);
  }

  /**
   * Get system load average
   */
  private getLoadAverage(): number[] {
    try {
      return os.loadavg();
    } catch {
      return [0, 0, 0]; // Fallback for environments without os module
    }
  }

  /**
   * Check for resource alerts
   */
  private checkResourceAlerts(metrics: SystemMetrics): void {
    const now = Date.now();

    // Memory alert
    if (metrics.memory.percentage > this.alertConfig.memoryThreshold) {
      if (this.shouldSendAlert('memory', now)) {
        this.sendAlert('memory', {
          type: 'HIGH_MEMORY_USAGE',
          message: `Memory usage at ${Math.round(metrics.memory.percentage)}%`,
          threshold: this.alertConfig.memoryThreshold,
          current: metrics.memory.percentage,
          usedMB: Math.round(metrics.memory.used / 1024 / 1024),
          totalMB: Math.round(metrics.memory.total / 1024 / 1024),
        });
      }
    }

    // CPU alert
    if (metrics.cpu.usage > this.alertConfig.cpuThreshold) {
      if (this.shouldSendAlert('cpu', now)) {
        this.sendAlert('cpu', {
          type: 'HIGH_CPU_USAGE',
          message: `CPU usage at ${Math.round(metrics.cpu.usage)}%`,
          threshold: this.alertConfig.cpuThreshold,
          current: metrics.cpu.usage,
          loadAverage: metrics.cpu.loadAverage,
        });
      }
    }

    // Load average alert (if load > number of CPUs)
    const numCpus = this.getNumCpus();
    const load1m = metrics.cpu.loadAverage[0];
    
    if (load1m > numCpus * 1.5) {
      if (this.shouldSendAlert('load', now)) {
        this.sendAlert('load', {
          type: 'HIGH_LOAD_AVERAGE',
          message: `Load average ${load1m.toFixed(2)} exceeds ${numCpus * 1.5}`,
          threshold: numCpus * 1.5,
          current: load1m,
          cpuCount: numCpus,
        });
      }
    }
  }

  /**
   * Get number of CPUs
   */
  private getNumCpus(): number {
    try {
      return os.cpus().length;
    } catch {
      return 1; // Fallback
    }
  }

  /**
   * Check if alert should be sent (respecting cooldown)
   */
  private shouldSendAlert(alertType: string, now: number): boolean {
    const lastAlert = this.lastAlerts.get(alertType);
    
    if (!lastAlert) {
      return true;
    }

    return (now - lastAlert) > this.alertConfig.alertCooldown;
  }

  /**
   * Send resource alert
   */
  private sendAlert(alertType: string, alertData: Record<string, unknown>): void {
    const now = Date.now();
    
    agentLogger.warn('Resource alert triggered', {
      alertType,
      ...alertData,
      timestamp: new Date().toISOString(),
    });

    // Update last alert time
    this.lastAlerts.set(alertType, now);

    // Emit alert event
    this.emit('alert', {
      alertType,
      timestamp: now,
      ...alertData,
    });
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): SystemMetrics | null {
    return this.metrics;
  }

  /**
   * Check if system is healthy
   */
  isSystemHealthy(): boolean {
    if (!this.metrics) {
      return true; // Assume healthy if no metrics yet
    }

    return (
      this.metrics.memory.percentage < this.alertConfig.memoryThreshold &&
      this.metrics.cpu.usage < this.alertConfig.cpuThreshold
    );
  }

  /**
   * Get resource utilization summary
   */
  getUtilizationSummary(): {
    memory: { usage: number; status: 'low' | 'medium' | 'high' | 'critical' };
    cpu: { usage: number; status: 'low' | 'medium' | 'high' | 'critical' };
    overall: 'healthy' | 'warning' | 'critical';
  } {
    if (!this.metrics) {
      return {
        memory: { usage: 0, status: 'low' },
        cpu: { usage: 0, status: 'low' },
        overall: 'healthy',
      };
    }

    const getStatus = (percentage: number): 'low' | 'medium' | 'high' | 'critical' => {
      if (percentage < 50) return 'low';
      if (percentage < 70) return 'medium';
      if (percentage < 85) return 'high';
      return 'critical';
    };

    const memoryStatus = getStatus(this.metrics.memory.percentage);
    const cpuStatus = getStatus(this.metrics.cpu.usage);

    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (memoryStatus === 'critical' || cpuStatus === 'critical') {
      overall = 'critical';
    } else if (memoryStatus === 'high' || cpuStatus === 'high') {
      overall = 'warning';
    }

    return {
      memory: { usage: this.metrics.memory.percentage, status: memoryStatus },
      cpu: { usage: this.metrics.cpu.usage, status: cpuStatus },
      overall,
    };
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): boolean {
    try {
      if (global.gc) {
        global.gc();
        agentLogger.info('Forced garbage collection');
        return true;
      }
      return false;
    } catch (error) {
      agentLogger.warn('Failed to force garbage collection', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}