# Performance & Cost Optimization Features

This document describes the performance and cost optimization features added to CodeMind.

## Table of Contents

1. [Cost Tracking & Budgeting](#cost-tracking--budgeting)
2. [Performance Profiling](#performance-profiling)
3. [Auto-Scaling Recommendations](#auto-scaling-recommendations)
4. [Advanced Caching](#advanced-caching)
5. [API Reference](#api-reference)

## Cost Tracking & Budgeting

### Overview

Track AI model usage costs and set budget limits to prevent unexpected expenses.

### Features

- **Budget Types**: Daily, weekly, monthly, yearly, or lifetime budgets
- **Real-time Tracking**: Automatic cost tracking on every AI API call
- **Alerts**: Configurable warning (80%) and critical (95%) thresholds
- **Forecasting**: Predict future spending based on current trends
- **Multi-level**: Set budgets at project, organization, or user level

### Usage

#### Setting a Budget

```typescript
import { costBudgetService } from '@/lib/cost-budget-service';

// Create a monthly budget for a project
await costBudgetService.setBudget('project-id', 'monthly', {
  limitUsd: 100.0,
  warningThreshold: 0.8, // Alert at 80%
  criticalThreshold: 0.95, // Critical alert at 95%
  alertsEnabled: true,
});
```

#### Checking Budget Status

```typescript
const budgets = await costBudgetService.getBudgetStatus('project-id');

budgets.forEach((budget) => {
  console.log(`Budget: ${budget.budgetType}`);
  console.log(`Spent: $${budget.currentSpendUsd} of $${budget.limitUsd}`);
  console.log(`Status: ${budget.status}`); // ok, warning, critical, exceeded
  console.log(`Remaining: $${budget.remainingUsd}`);
});
```

#### Getting Spending Forecast

```typescript
const forecast = await costBudgetService.getForecast('project-id', 'monthly');

if (forecast) {
  console.log(`Current spend: $${forecast.currentSpend}`);
  console.log(`Average daily: $${forecast.averageDaily}`);
  console.log(`Projected total: $${forecast.projectedTotal}`);
  console.log(`Days remaining: ${forecast.daysRemaining}`);
  
  if (forecast.projectedOverage > 0) {
    console.log(`Warning: Projected to exceed budget by $${forecast.projectedOverage}`);
  }
}
```

### API Endpoints

- `POST /api/budgets` - Create or update a budget
- `GET /api/budgets?projectId={id}` - Get budget status
- `GET /api/budgets/forecast?projectId={id}&budgetType=monthly` - Get spending forecast
- `DELETE /api/budgets?budgetId={id}` - Delete a budget

## Performance Profiling

### Overview

Track and analyze application performance metrics to identify bottlenecks.

### Metric Types

- `api_latency` - API endpoint response times
- `db_query_time` - Database query performance
- `cache_hit_rate` - Cache effectiveness
- `ai_response_time` - AI model response times
- `embedding_generation` - Embedding generation time
- `indexing_time` - Code indexing performance
- `search_time` - Search operation performance

### Usage

#### Recording Metrics

```typescript
import { performanceProfiler } from '@/lib/performance-profiler';

// Manual metric recording
await performanceProfiler.recordMetric({
  metricType: 'api_latency',
  metricName: '/api/projects/search',
  value: 250,
  unit: 'ms',
  endpoint: '/api/projects/search',
  projectId: 'project-id',
});

// Using a timer
const timer = performanceProfiler.createTimer('search-operation', {
  metricType: 'search_time',
  endpoint: '/api/search',
  projectId: 'project-id',
});

// ... perform operation ...

const durationMs = await timer.end(); // Automatically records metric
```

#### Automatic Endpoint Tracking

```typescript
// Track any async operation
const result = await performanceProfiler.trackEndpoint(
  '/api/projects',
  'GET',
  async () => {
    // Your endpoint logic here
    return await fetchProjects();
  },
  'project-id'
);
```

#### Analyzing Performance

```typescript
// Get performance statistics
const stats = await performanceProfiler.getMetricStats(
  'api_latency',
  '/api/projects',
  startDate,
  endDate,
  'project-id'
);

console.log(`Average latency: ${stats.average}ms`);
console.log(`P95 latency: ${stats.p95}ms`);
console.log(`P99 latency: ${stats.p99}ms`);

// Identify bottlenecks
const bottlenecks = await performanceProfiler.identifyBottlenecks(
  'project-id',
  startDate,
  endDate
);

bottlenecks.forEach((bottleneck) => {
  if (bottleneck.severity === 'critical' || bottleneck.severity === 'high') {
    console.log(`🚨 ${bottleneck.endpoint}`);
    console.log(`  Avg: ${bottleneck.avgLatency}ms, P95: ${bottleneck.p95Latency}ms`);
    console.log(`  Recommendation: ${bottleneck.recommendation}`);
  }
});
```

#### Cache Performance

```typescript
const cachePerf = await performanceProfiler.getCachePerformance(
  'project-id',
  startDate,
  endDate
);

console.log(`Cache hit rate: ${cachePerf.hitRate}%`);
console.log(`Total requests: ${cachePerf.totalRequests}`);
console.log(`Hits: ${cachePerf.hits}, Misses: ${cachePerf.misses}`);
console.log(`Avg hit latency: ${cachePerf.avgHitLatency}ms`);
console.log(`Avg miss latency: ${cachePerf.avgMissLatency}ms`);
```

### API Endpoints

- `GET /api/performance/metrics?metricType={type}&projectId={id}` - Get performance statistics
- `GET /api/performance/bottlenecks?projectId={id}` - Identify performance bottlenecks

## Auto-Scaling Recommendations

### Overview

Automatically generate optimization recommendations based on usage patterns.

### Recommendation Types

- `scale_up` - Increase resources
- `scale_down` - Reduce resources
- `optimize_cache` - Improve caching strategy
- `reduce_model_usage` - Lower AI model costs
- `upgrade_model` - Use better models for quality
- `downgrade_model` - Use cheaper models
- `add_indexes` - Add database indexes
- `optimize_queries` - Query optimization

### Usage

#### Generate Recommendations

```typescript
import { autoScalingService } from '@/lib/auto-scaling-service';

// Generate new recommendations for a project
await autoScalingService.generateRecommendations('project-id');
```

#### View Recommendations

```typescript
// Get active recommendations
const recommendations = await autoScalingService.getRecommendations('project-id');

recommendations.forEach((rec) => {
  console.log(`[${rec.priority}] ${rec.title}`);
  console.log(rec.description);
  
  if (rec.estimatedSavings) {
    console.log(`💰 Estimated savings: $${rec.estimatedSavings}/month`);
  }
  
  console.log('Actions:', rec.recommendation.actions);
});
```

#### Manage Recommendations

```typescript
// Mark as implemented
await autoScalingService.markImplemented('recommendation-id');

// Dismiss recommendation
await autoScalingService.dismissRecommendation('recommendation-id');
```

### API Endpoints

- `GET /api/performance/recommendations?projectId={id}` - Get recommendations
- `POST /api/performance/recommendations` - Generate new recommendations
- `PATCH /api/performance/recommendations` - Update recommendation status

## Advanced Caching

### Overview

Enhanced caching with LRU eviction, compression, and performance tracking.

### Features

- **LRU Eviction**: Automatically removes least recently used entries
- **Size Limits**: Configurable max cache size (default 100MB)
- **Compression**: Automatic compression for large values (>1KB)
- **Hit Tracking**: Monitors cache effectiveness
- **Pattern Invalidation**: Bulk invalidate by pattern

### Usage

```typescript
import { enhancedCache } from '@/lib/enhanced-cache-service';

// Set a value (with TTL in seconds)
await enhancedCache.set('user:123', userData, 3600); // 1 hour

// Get a value
const user = await enhancedCache.get<User>('user:123');

// Check if exists
const exists = await enhancedCache.has('user:123');

// Delete a value
await enhancedCache.delete('user:123');

// Invalidate by pattern
await enhancedCache.invalidatePattern('user:*'); // Delete all user keys

// Get cache statistics
const stats = enhancedCache.getStats();
console.log(`Cache size: ${stats.size} entries`);
console.log(`Memory usage: ${stats.currentSizeMB.toFixed(2)} MB`);
console.log(`Utilization: ${stats.utilizationPercent.toFixed(1)}%`);
console.log('Top entries:', stats.topEntries);

// Warm cache with frequently accessed data
await enhancedCache.warmCache([
  { key: 'popular:1', value: data1, ttl: 3600 },
  { key: 'popular:2', value: data2, ttl: 3600 },
]);
```

## API Reference

### Budget Management

#### Create Budget
```
POST /api/budgets
Body: {
  projectId: string
  budgetType: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'total'
  limitUsd: number
  warningThreshold?: number (0-1, default 0.8)
  criticalThreshold?: number (0-1, default 0.95)
  alertsEnabled?: boolean (default true)
}
Response: { id: string, status: string }
```

#### Get Budgets
```
GET /api/budgets?projectId={id}
Response: { budgets: BudgetStatus[] }
```

#### Get Forecast
```
GET /api/budgets/forecast?projectId={id}&budgetType={type}
Response: {
  currentSpend: number
  averageDaily: number
  projectedTotal: number
  projectedOverage: number
  daysRemaining: number
}
```

### Performance Metrics

#### Get Metrics
```
GET /api/performance/metrics?metricType={type}&projectId={id}&startDate={date}&endDate={date}
Response: {
  metricType: string
  metricName: string
  count: number
  average: number
  min: number
  max: number
  p50: number
  p95: number
  p99: number
  unit: string
}
```

#### Get Bottlenecks
```
GET /api/performance/bottlenecks?projectId={id}&startDate={date}&endDate={date}
Response: { bottlenecks: BottleneckAnalysis[] }
```

### Auto-Scaling

#### Get Recommendations
```
GET /api/performance/recommendations?projectId={id}&includeImplemented={bool}
Response: { recommendations: Recommendation[] }
```

#### Generate Recommendations
```
POST /api/performance/recommendations
Body: { projectId: string }
Response: { message: string, status: string }
```

#### Update Recommendation
```
PATCH /api/performance/recommendations
Body: { recommendationId: string, action: 'implement' | 'dismiss' }
Response: { message: string, status: string }
```

## Best Practices

1. **Budget Alerts**: Always enable alerts and set appropriate thresholds
2. **Regular Monitoring**: Review performance metrics weekly
3. **Act on Recommendations**: Implement high-priority recommendations promptly
4. **Cache Strategy**: Use longer TTLs for stable data, shorter for dynamic data
5. **Performance Tracking**: Track all critical endpoints automatically
6. **Cost Optimization**: Review model usage monthly and optimize expensive operations

## Examples

### Example 1: Setting Up Cost Monitoring

```typescript
// 1. Set monthly budget
await costBudgetService.setBudget('my-project', 'monthly', {
  limitUsd: 500,
  warningThreshold: 0.8,
  alertsEnabled: true,
});

// 2. Check status daily
const budgets = await costBudgetService.getBudgetStatus('my-project');
const monthlyBudget = budgets.find(b => b.budgetType === 'monthly');

if (monthlyBudget.status === 'critical') {
  // Send alert to team
  console.log('⚠️ Budget critical! Take action!');
}

// 3. Review forecast
const forecast = await costBudgetService.getForecast('my-project', 'monthly');
if (forecast.projectedOverage > 0) {
  console.log(`📊 Projected to exceed budget by $${forecast.projectedOverage}`);
}
```

### Example 2: Tracking API Performance

```typescript
// Track all API routes automatically
export async function GET(req: Request) {
  return await performanceProfiler.trackEndpoint(
    '/api/search',
    'GET',
    async () => {
      // Your logic here
      const results = await searchDatabase(query);
      return NextResponse.json(results);
    },
    projectId,
    userId
  );
}

// Weekly performance review
const bottlenecks = await performanceProfiler.identifyBottlenecks(
  projectId,
  lastWeekStart,
  today
);

// Fix critical issues first
const critical = bottlenecks.filter(b => b.severity === 'critical');
```

### Example 3: Implementing Recommendations

```typescript
// Generate and review recommendations
await autoScalingService.generateRecommendations('my-project');
const recs = await autoScalingService.getRecommendations('my-project');

// Implement high-priority recommendations
const highPriority = recs.filter(r => r.priority === 'high' || r.priority === 'critical');

for (const rec of highPriority) {
  console.log(`Implementing: ${rec.title}`);
  
  if (rec.type === 'downgrade_model') {
    // Update project config to use cheaper models
    await updateProjectConfig(projectId, {
      preferredModel: 'gpt-3.5-turbo'
    });
  }
  
  // Mark as implemented
  await autoScalingService.markImplemented(rec.id);
}
```

## Monitoring Dashboard

Consider creating a dashboard that displays:

1. **Budget Status**: Current spend vs. limit with visual indicators
2. **Cost Trends**: Daily/weekly/monthly spending charts
3. **Performance Metrics**: P95/P99 latencies for key endpoints
4. **Cache Effectiveness**: Hit rate and savings
5. **Active Recommendations**: Prioritized list with estimated savings
6. **Alerts**: Recent budget and performance alerts

## Troubleshooting

### High Costs

1. Check budget forecast for projected spending
2. Review AI model usage by type
3. Implement cache for repeated queries
4. Use cheaper models for simple tasks

### Slow Performance

1. Identify bottlenecks using performance profiler
2. Check cache hit rates
3. Review database query performance
4. Implement recommendations

### Low Cache Hit Rate

1. Increase cache TTL for stable data
2. Warm cache with popular entries
3. Review cache key strategy
4. Consider distributed cache (Redis)

## Future Enhancements

- Real-time alerts via email/Slack/webhooks
- Cost anomaly detection
- Automatic model selection based on query complexity
- A/B testing for performance optimizations
- Integration with external monitoring tools
