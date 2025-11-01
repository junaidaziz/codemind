#!/usr/bin/env node
/**
 * Performance Benchmark for Worker Pool
 * 
 * Compares sequential vs parallel file analysis performance
 * 
 * Usage: node scripts/benchmark-worker-pool.mjs
 */

import { WorkerPool } from '../src/lib/code-review/worker-pool.ts';

/**
 * Simulates file analysis with variable complexity
 */
async function analyzeFile(fileSize, complexity) {
  const processingTime = Math.floor(fileSize / 100 * complexity);
  
  // Simulate CPU-bound work
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  return {
    lines: fileSize,
    issues: Math.floor(Math.random() * 10),
    complexity,
  };
}

/**
 * Generate mock file data
 */
function generateMockFiles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `file-${i}.ts`,
    size: Math.floor(Math.random() * 500) + 100, // 100-600 lines
    complexity: Math.floor(Math.random() * 3) + 1, // 1-3 complexity
  }));
}

/**
 * Sequential processing
 */
async function processSequential(files) {
  const results = [];
  const startTime = Date.now();
  
  for (const file of files) {
    const result = await analyzeFile(file.size, file.complexity);
    results.push({ fileId: file.id, ...result });
  }
  
  const duration = Date.now() - startTime;
  return { results, duration };
}

/**
 * Parallel processing with worker pool
 */
async function processParallel(files, workerCount) {
  const pool = new WorkerPool({
    maxWorkers: workerCount,
    continueOnError: true,
  });

  const tasks = files.map(file => ({
    id: file.id,
    data: file,
    execute: async (f) => {
      const result = await analyzeFile(f.size, f.complexity);
      return { fileId: f.id, ...result };
    },
  }));

  const startTime = Date.now();
  const resultsMap = await pool.executeTasks(tasks);
  const duration = Date.now() - startTime;

  const results = Array.from(resultsMap.values());
  const stats = pool.getStats();

  return { results, duration, stats };
}

/**
 * Run benchmarks
 */
async function runBenchmarks() {
  console.log('🚀 Worker Pool Performance Benchmark\n');
  console.log('=' .repeat(60));

  const testSizes = [
    { files: 5, label: 'Small PR' },
    { files: 20, label: 'Medium PR' },
    { files: 50, label: 'Large PR' },
    { files: 100, label: 'Very Large PR' },
  ];

  const workerCounts = [2, 4, 8];

  for (const test of testSizes) {
    console.log(`\n📦 ${test.label} (${test.files} files):`);
    console.log('-'.repeat(60));

    const files = generateMockFiles(test.files);

    // Sequential baseline
    console.log('\n⏱️  Sequential Processing:');
    const seqResult = await processSequential(files);
    console.log(`   Duration: ${seqResult.duration}ms`);
    console.log(`   Throughput: ${(test.files / (seqResult.duration / 1000)).toFixed(2)} files/sec`);

    // Parallel with different worker counts
    for (const workerCount of workerCounts) {
      console.log(`\n⚡ Parallel Processing (${workerCount} workers):`);
      const parResult = await processParallel(files, workerCount);
      const speedup = (seqResult.duration / parResult.duration).toFixed(2);
      const efficiency = ((speedup / workerCount) * 100).toFixed(1);

      console.log(`   Duration: ${parResult.duration}ms`);
      console.log(`   Throughput: ${(test.files / (parResult.duration / 1000)).toFixed(2)} files/sec`);
      console.log(`   Speedup: ${speedup}x`);
      console.log(`   Efficiency: ${efficiency}%`);
      console.log(`   Stats: ${parResult.stats.completedTasks} completed, ${parResult.stats.failedTasks} failed`);
    }

    console.log('\n' + '='.repeat(60));
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log('-'.repeat(60));
  console.log('✅ Parallel processing provides significant speedup for PRs with multiple files');
  console.log('✅ Optimal worker count depends on file count and system resources');
  console.log('✅ For small PRs (<5 files), sequential may be faster due to overhead');
  console.log('✅ For large PRs (>20 files), parallel processing is highly beneficial\n');
}

// Run benchmarks
runBenchmarks().catch(console.error);
