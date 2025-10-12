/**
 * OpenAI Usage Monitoring Utility
 * Tracks token usage and costs across the application
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  timestamp: Date;
  requestId?: string;
  userId?: string;
  projectId?: string;
}

export interface CostCalculation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

// Model pricing per 1M tokens (as of October 2024)
const MODEL_PRICING = {
  'gpt-4o': {
    input: 2.50,
    output: 10.00,
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.60,
  },
  'text-embedding-3-small': {
    input: 0.02,
    output: 0.02, // Embeddings don't have separate output pricing
  },
  'text-embedding-3-large': {
    input: 0.13,
    output: 0.13,
  },
} as const;

export type ModelName = keyof typeof MODEL_PRICING;

export class OpenAIUsageTracker {
  private static instance: OpenAIUsageTracker;
  private usageLog: TokenUsage[] = [];
  private dailyLimit: number = 1000000; // 1M tokens per day
  private hourlyLimit: number = 100000; // 100K tokens per hour

  static getInstance(): OpenAIUsageTracker {
    if (!OpenAIUsageTracker.instance) {
      OpenAIUsageTracker.instance = new OpenAIUsageTracker();
    }
    return OpenAIUsageTracker.instance;
  }

  /**
   * Calculate cost for token usage
   */
  calculateCost(usage: TokenUsage): CostCalculation {
    const model = usage.model as ModelName;
    const pricing = MODEL_PRICING[model];
    
    if (!pricing) {
      console.warn(`Unknown model pricing: ${model}`);
      return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        currency: 'USD',
      };
    }

    const inputCost = (usage.promptTokens / 1000000) * pricing.input;
    const outputCost = (usage.completionTokens / 1000000) * pricing.output;
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD',
    };
  }

  /**
   * Record token usage
   */
  recordUsage(usage: TokenUsage): void {
    this.usageLog.push({
      ...usage,
      timestamp: new Date(),
    });

    const cost = this.calculateCost(usage);
    
    console.log(`💰 OpenAI Usage: ${usage.totalTokens} tokens, $${cost.totalCost.toFixed(4)} (${usage.model})`);
    
    // Check limits
    this.checkUsageLimits();
  }

  /**
   * Check if usage is within limits
   */
  private checkUsageLimits(): void {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const dailyUsage = this.usageLog
      .filter(log => log.timestamp > oneDayAgo)
      .reduce((sum, log) => sum + log.totalTokens, 0);

    const hourlyUsage = this.usageLog
      .filter(log => log.timestamp > oneHourAgo)
      .reduce((sum, log) => sum + log.totalTokens, 0);

    if (dailyUsage > this.dailyLimit) {
      console.warn(`⚠️ Daily token limit exceeded: ${dailyUsage}/${this.dailyLimit}`);
    }

    if (hourlyUsage > this.hourlyLimit) {
      console.warn(`⚠️ Hourly token limit exceeded: ${hourlyUsage}/${this.hourlyLimit}`);
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(timeframe: 'hour' | 'day' | 'week' = 'day') {
    const now = new Date();
    let cutoff: Date;

    switch (timeframe) {
      case 'hour':
        cutoff = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    const relevantLogs = this.usageLog.filter(log => log.timestamp > cutoff);
    
    const totalTokens = relevantLogs.reduce((sum, log) => sum + log.totalTokens, 0);
    const totalCost = relevantLogs.reduce((sum, log) => {
      const cost = this.calculateCost(log);
      return sum + cost.totalCost;
    }, 0);

    const modelUsage = relevantLogs.reduce((acc, log) => {
      if (!acc[log.model]) acc[log.model] = 0;
      acc[log.model] += log.totalTokens;
      return acc;
    }, {} as Record<string, number>);

    return {
      timeframe,
      totalTokens,
      totalCost,
      requestCount: relevantLogs.length,
      modelUsage,
      averageTokensPerRequest: relevantLogs.length > 0 ? totalTokens / relevantLogs.length : 0,
    };
  }

  /**
   * Set usage limits
   */
  setLimits(daily: number, hourly: number): void {
    this.dailyLimit = daily;
    this.hourlyLimit = hourly;
  }

  /**
   * Clear old usage logs (keep last 7 days)
   */
  cleanupLogs(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.usageLog = this.usageLog.filter(log => log.timestamp > oneWeekAgo);
  }
}

// Export singleton instance
export const usageTracker = OpenAIUsageTracker.getInstance();

// Utility function for easy tracking
export function trackOpenAIUsage(
  model: ModelName,
  promptTokens: number,
  completionTokens: number,
  metadata?: {
    requestId?: string;
    userId?: string;
    projectId?: string;
  }
): CostCalculation {
  const usage: TokenUsage = {
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    timestamp: new Date(),
    ...metadata,
  };

  usageTracker.recordUsage(usage);
  return usageTracker.calculateCost(usage);
}

// Environment-based limits
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

if (isDevelopment) {
  // Stricter limits for development
  usageTracker.setLimits(100000, 10000); // 100K daily, 10K hourly
} else if (isProduction) {
  // More generous limits for production
  usageTracker.setLimits(1000000, 100000); // 1M daily, 100K hourly
}

// Cleanup logs periodically
setInterval(() => {
  usageTracker.cleanupLogs();
}, 60 * 60 * 1000); // Every hour