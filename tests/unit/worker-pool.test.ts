/**
 * Unit tests for WorkerPool
 */

import { WorkerPool, createWorkerPool, type WorkerTask } from '@/lib/code-review/worker-pool';

describe('WorkerPool', () => {
  describe('basic functionality', () => {
    it('should execute tasks successfully', async () => {
      const pool = new WorkerPool<number, number>({ maxWorkers: 2 });

      const tasks: WorkerTask<number, number>[] = [
        { id: '1', data: 1, execute: async (n) => n * 2 },
        { id: '2', data: 2, execute: async (n) => n * 2 },
        { id: '3', data: 3, execute: async (n) => n * 2 },
      ];

      const results = await pool.executeTasks(tasks);

      expect(results.size).toBe(3);
      expect(results.get('1')).toBe(2);
      expect(results.get('2')).toBe(4);
      expect(results.get('3')).toBe(6);
    });

    it('should handle empty task list', async () => {
      const pool = new WorkerPool<number, number>();
      const results = await pool.executeTasks([]);
      
      expect(results.size).toBe(0);
    });

    it('should execute tasks in parallel', async () => {
      const pool = new WorkerPool<number, number>({ maxWorkers: 3 });
      const executionTimes: number[] = [];

      const tasks: WorkerTask<number, number>[] = [
        {
          id: '1',
          data: 1,
          execute: async () => {
            executionTimes.push(Date.now());
            await new Promise(resolve => setTimeout(resolve, 50));
            return 1;
          },
        },
        {
          id: '2',
          data: 2,
          execute: async () => {
            executionTimes.push(Date.now());
            await new Promise(resolve => setTimeout(resolve, 50));
            return 2;
          },
        },
        {
          id: '3',
          data: 3,
          execute: async () => {
            executionTimes.push(Date.now());
            await new Promise(resolve => setTimeout(resolve, 50));
            return 3;
          },
        },
      ];

      await pool.executeTasks(tasks);

      // All three tasks should start within a short time window (parallel execution)
      const maxTimeDiff = Math.max(...executionTimes) - Math.min(...executionTimes);
      expect(maxTimeDiff).toBeLessThan(20); // Should start almost simultaneously
    });
  });

  describe('worker count management', () => {
    it('should respect maxWorkers limit', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const pool = new WorkerPool<number, number>({ maxWorkers: 2 });

      const tasks: WorkerTask<number, number>[] = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        data: i,
        execute: async (n) => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          await new Promise(resolve => setTimeout(resolve, 10));
          concurrentCount--;
          return n;
        },
      }));

      await pool.executeTasks(tasks);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should use fewer workers than tasks if needed', async () => {
      const pool = new WorkerPool<number, number>({ maxWorkers: 10 });

      const tasks: WorkerTask<number, number>[] = [
        { id: '1', data: 1, execute: async (n) => n },
        { id: '2', data: 2, execute: async (n) => n },
      ];

      const results = await pool.executeTasks(tasks);
      
      expect(results.size).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should continue on error by default', async () => {
      const pool = new WorkerPool<number, number>({ maxWorkers: 2 });

      const tasks: WorkerTask<number, number>[] = [
        { id: '1', data: 1, execute: async (n) => n * 2 },
        { id: '2', data: 2, execute: async () => { throw new Error('Task failed'); } },
        { id: '3', data: 3, execute: async (n) => n * 2 },
      ];

      const results = await pool.executeTasks(tasks);

      expect(results.size).toBe(2);
      expect(results.get('1')).toBe(2);
      expect(results.get('3')).toBe(6);
      expect(results.has('2')).toBe(false);
    });

    it('should stop on error when continueOnError is false', async () => {
      const pool = new WorkerPool<number, number>({
        maxWorkers: 2,
        continueOnError: false,
      });

      const tasks: WorkerTask<number, number>[] = [
        { id: '1', data: 1, execute: async (n) => n * 2 },
        { id: '2', data: 2, execute: async () => { throw new Error('Task failed'); } },
        { id: '3', data: 3, execute: async (n) => n * 2 },
      ];

      await expect(pool.executeTasks(tasks)).rejects.toThrow('Task execution failed');
    });

    it('should call onError callback for failed tasks', async () => {
      const errors: Array<{ taskId: string; error: Error }> = [];

      const pool = new WorkerPool<number, number>({
        maxWorkers: 2,
        onError: (taskId, error) => {
          errors.push({ taskId, error });
        },
      });

      const tasks: WorkerTask<number, number>[] = [
        { id: '1', data: 1, execute: async () => { throw new Error('Error 1'); } },
        { id: '2', data: 2, execute: async () => { throw new Error('Error 2'); } },
      ];

      await pool.executeTasks(tasks);

      expect(errors.length).toBe(2);
      expect(errors[0].taskId).toBe('1');
      expect(errors[0].error.message).toBe('Error 1');
      expect(errors[1].taskId).toBe('2');
      expect(errors[1].error.message).toBe('Error 2');
    });

    it('should track errors in getErrors()', async () => {
      const pool = new WorkerPool<number, number>({ maxWorkers: 2 });

      const tasks: WorkerTask<number, number>[] = [
        { id: '1', data: 1, execute: async () => { throw new Error('Task 1 failed'); } },
        { id: '2', data: 2, execute: async (n) => n * 2 },
      ];

      await pool.executeTasks(tasks);

      const errors = pool.getErrors();
      expect(errors.size).toBe(1);
      expect(errors.has('1')).toBe(true);
      expect(errors.get('1')?.message).toBe('Task 1 failed');
    });
  });

  describe('progress tracking', () => {
    it('should call onProgress callback', async () => {
      const progressUpdates: Array<{ completed: number; total: number }> = [];

      const pool = new WorkerPool<number, number>({
        maxWorkers: 2,
        onProgress: (completed, total) => {
          progressUpdates.push({ completed, total });
        },
      });

      const tasks: WorkerTask<number, number>[] = [
        { id: '1', data: 1, execute: async (n) => n },
        { id: '2', data: 2, execute: async (n) => n },
        { id: '3', data: 3, execute: async (n) => n },
      ];

      await pool.executeTasks(tasks);

      expect(progressUpdates.length).toBe(3);
      expect(progressUpdates[0]).toEqual({ completed: 1, total: 3 });
      expect(progressUpdates[1]).toEqual({ completed: 2, total: 3 });
      expect(progressUpdates[2]).toEqual({ completed: 3, total: 3 });
    });
  });

  describe('statistics', () => {
    it('should provide accurate stats', async () => {
      const pool = new WorkerPool<number, number>({ maxWorkers: 2 });

      const tasks: WorkerTask<number, number>[] = [
        { id: '1', data: 1, execute: async (n) => n * 2 },
        { id: '2', data: 2, execute: async () => { throw new Error('Failed'); } },
        { id: '3', data: 3, execute: async (n) => n * 2 },
      ];

      await pool.executeTasks(tasks);

      const stats = pool.getStats();
      expect(stats.totalTasks).toBe(3);
      expect(stats.completedTasks).toBe(2);
      expect(stats.failedTasks).toBe(1);
      expect(stats.activeWorkers).toBe(0);
      expect(stats.queuedTasks).toBe(0);
      expect(stats.duration).toBeGreaterThanOrEqual(0);
      expect(stats.startTime).toBeDefined();
      expect(stats.endTime).toBeDefined();
    });

    it('should track timing information', async () => {
      const pool = new WorkerPool<number, number>({ maxWorkers: 2 });

      const tasks: WorkerTask<number, number>[] = [
        {
          id: '1',
          data: 1,
          execute: async (n) => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return n;
          },
        },
      ];

      await pool.executeTasks(tasks);

      const stats = pool.getStats();
      expect(stats.startTime).toBeDefined();
      expect(stats.endTime).toBeDefined();
      expect(stats.duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('cancellation', () => {
    it('should cancel pending tasks', async () => {
      const pool = new WorkerPool<number, number>({ maxWorkers: 1 });

      const tasks: WorkerTask<number, number>[] = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        data: i,
        execute: async (n) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return n;
        },
      }));

      const promise = pool.executeTasks(tasks);

      // Cancel after a short delay (some tasks will start, others won't)
      setTimeout(() => pool.cancel(), 50);

      const results = await promise;

      // Should have fewer results than total tasks
      expect(results.size).toBeLessThan(5);
      expect(pool.getStats().completedTasks).toBeLessThan(5);
    });

    it('should report isActive() correctly', async () => {
      const pool = new WorkerPool<number, number>({ maxWorkers: 2 });

      expect(pool.isActive()).toBe(false);

      const tasks: WorkerTask<number, number>[] = [
        {
          id: '1',
          data: 1,
          execute: async (n) => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return n;
          },
        },
      ];

      const promise = pool.executeTasks(tasks);
      
      // Should be active during execution
      expect(pool.isActive()).toBe(true);

      await promise;

      // Should be inactive after completion
      expect(pool.isActive()).toBe(false);
    });
  });

  describe('createWorkerPool factory', () => {
    it('should create a worker pool with default options', () => {
      const pool = createWorkerPool<number, number>();
      expect(pool).toBeInstanceOf(WorkerPool);
    });

    it('should create a worker pool with custom options', () => {
      const pool = createWorkerPool<number, number>({ maxWorkers: 4 });
      expect(pool).toBeInstanceOf(WorkerPool);
    });
  });

  describe('complex data types', () => {
    it('should handle complex object types', async () => {
      interface Task {
        id: number;
        name: string;
      }

      interface Result {
        taskId: number;
        processed: boolean;
      }

      const pool = new WorkerPool<Task, Result>({ maxWorkers: 2 });

      const tasks: WorkerTask<Task, Result>[] = [
        {
          id: 'task-1',
          data: { id: 1, name: 'First' },
          execute: async (task) => ({ taskId: task.id, processed: true }),
        },
        {
          id: 'task-2',
          data: { id: 2, name: 'Second' },
          execute: async (task) => ({ taskId: task.id, processed: true }),
        },
      ];

      const results = await pool.executeTasks(tasks);

      expect(results.get('task-1')).toEqual({ taskId: 1, processed: true });
      expect(results.get('task-2')).toEqual({ taskId: 2, processed: true });
    });
  });
});
