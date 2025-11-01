/**
 * Worker Pool for Parallel File Analysis
 * 
 * Distributes file analysis tasks across multiple workers for concurrent processing.
 * Supports progress tracking, cancellation, and configurable worker count.
 */

export interface WorkerTask<T, R> {
  id: string;
  data: T;
  execute: (data: T) => Promise<R>;
}

export interface WorkerPoolOptions {
  /**
   * Maximum number of concurrent workers
   * Default: CPU cores - 1, minimum 2, maximum 8
   */
  maxWorkers?: number;
  
  /**
   * Progress callback called after each task completes
   */
  onProgress?: (completed: number, total: number) => void;
  
  /**
   * Error callback for individual task failures
   */
  onError?: (taskId: string, error: Error) => void;
  
  /**
   * Whether to continue processing remaining tasks if one fails
   * Default: true
   */
  continueOnError?: boolean;
}

export interface WorkerPoolStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeWorkers: number;
  queuedTasks: number;
  startTime?: number;
  endTime?: number;
  duration?: number;
}

/**
 * Generic worker pool for parallel task execution
 */
export class WorkerPool<T, R> {
  private maxWorkers: number;
  private activeWorkers: number = 0;
  private taskQueue: WorkerTask<T, R>[] = [];
  private results: Map<string, R> = new Map();
  private errors: Map<string, Error> = new Map();
  private cancelled: boolean = false;
  private options: Required<WorkerPoolOptions>;
  private stats: WorkerPoolStats;

  constructor(options: WorkerPoolOptions = {}) {
    // Determine optimal worker count based on system resources
    const cpuCount = typeof navigator !== 'undefined' 
      ? navigator.hardwareConcurrency || 4
      : 4; // Default for server-side
    
    const defaultMaxWorkers = Math.max(2, Math.min(8, cpuCount - 1));
    
    this.maxWorkers = options.maxWorkers || defaultMaxWorkers;
    
    this.options = {
      maxWorkers: this.maxWorkers,
      onProgress: options.onProgress || (() => {}),
      onError: options.onError || (() => {}),
      continueOnError: options.continueOnError ?? true,
    };

    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      activeWorkers: 0,
      queuedTasks: 0,
    };
  }

  /**
   * Execute multiple tasks in parallel
   */
  async executeTasks(tasks: WorkerTask<T, R>[]): Promise<Map<string, R>> {
    if (tasks.length === 0) {
      return new Map();
    }

    this.reset();
    this.taskQueue = [...tasks];
    this.stats.totalTasks = tasks.length;
    this.stats.queuedTasks = tasks.length;
    this.stats.startTime = Date.now();

    // Start workers up to maxWorkers limit
    const workerPromises: Promise<void>[] = [];
    const workerCount = Math.min(this.maxWorkers, tasks.length);

    for (let i = 0; i < workerCount; i++) {
      workerPromises.push(this.worker());
    }

    // Wait for all workers to complete
    await Promise.all(workerPromises);

    this.stats.endTime = Date.now();
    this.stats.duration = this.stats.endTime - this.stats.startTime;

    // If any task failed and continueOnError is false, throw
    if (!this.options.continueOnError && this.errors.size > 0) {
      const firstError = Array.from(this.errors.values())[0];
      throw new Error(`Task execution failed: ${firstError.message}`);
    }

    return this.results;
  }

  /**
   * Worker function - processes tasks from the queue
   */
  private async worker(): Promise<void> {
    this.activeWorkers++;
    this.stats.activeWorkers = this.activeWorkers;

    while (this.taskQueue.length > 0 && !this.cancelled) {
      const task = this.taskQueue.shift();
      if (!task) break;

      this.stats.queuedTasks = this.taskQueue.length;

      try {
        const result = await task.execute(task.data);
        this.results.set(task.id, result);
        this.stats.completedTasks++;
        
        // Call progress callback
        this.options.onProgress(this.stats.completedTasks, this.stats.totalTasks);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.errors.set(task.id, err);
        this.stats.failedTasks++;
        
        // Call error callback
        this.options.onError(task.id, err);

        if (!this.options.continueOnError) {
          this.cancelled = true;
          break;
        }
      }
    }

    this.activeWorkers--;
    this.stats.activeWorkers = this.activeWorkers;
  }

  /**
   * Cancel all pending tasks
   */
  cancel(): void {
    this.cancelled = true;
    this.taskQueue = [];
    this.stats.queuedTasks = 0;
  }

  /**
   * Get current statistics
   */
  getStats(): Readonly<WorkerPoolStats> {
    return { ...this.stats };
  }

  /**
   * Get errors that occurred during execution
   */
  getErrors(): ReadonlyMap<string, Error> {
    return new Map(this.errors);
  }

  /**
   * Check if pool is currently processing tasks
   */
  isActive(): boolean {
    return this.activeWorkers > 0 || this.taskQueue.length > 0;
  }

  /**
   * Reset the worker pool state
   */
  private reset(): void {
    this.cancelled = false;
    this.results.clear();
    this.errors.clear();
    this.taskQueue = [];
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      activeWorkers: 0,
      queuedTasks: 0,
    };
  }
}

/**
 * Create a worker pool with sensible defaults
 */
export function createWorkerPool<T, R>(options?: WorkerPoolOptions): WorkerPool<T, R> {
  return new WorkerPool<T, R>(options);
}
