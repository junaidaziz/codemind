import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../types/env';
import prisma from '../app/lib/db';

export type AIProvider = 'openai' | 'anthropic' | 'mistral' | 'local';

export type AIModel = 
  // OpenAI Models
  | 'gpt-4-turbo-preview'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-16k'
  // Anthropic Models
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  // Mistral Models
  | 'mistral-large-latest'
  | 'mistral-medium-latest'
  | 'mistral-small-latest'
  // Local Models
  | 'local-llama-3'
  | 'local-mistral-7b';

export interface ModelConfig {
  name: AIModel;
  provider: AIProvider;
  maxTokens: number;
  costPerPromptToken: number;
  costPerCompletionToken: number;
  contextWindow: number;
}

export const MODEL_CONFIGS: Record<AIModel, ModelConfig> = {
  // OpenAI Models
  'gpt-4-turbo-preview': {
    name: 'gpt-4-turbo-preview',
    provider: 'openai',
    maxTokens: 4096,
    costPerPromptToken: 0.00001,
    costPerCompletionToken: 0.00003,
    contextWindow: 128000,
  },
  'gpt-4': {
    name: 'gpt-4',
    provider: 'openai',
    maxTokens: 8192,
    costPerPromptToken: 0.00003,
    costPerCompletionToken: 0.00006,
    contextWindow: 8192,
  },
  'gpt-3.5-turbo': {
    name: 'gpt-3.5-turbo',
    provider: 'openai',
    maxTokens: 4096,
    costPerPromptToken: 0.0000005,
    costPerCompletionToken: 0.0000015,
    contextWindow: 16385,
  },
  'gpt-3.5-turbo-16k': {
    name: 'gpt-3.5-turbo-16k',
    provider: 'openai',
    maxTokens: 16384,
    costPerPromptToken: 0.000003,
    costPerCompletionToken: 0.000004,
    contextWindow: 16385,
  },
  // Anthropic Models
  'claude-3-opus-20240229': {
    name: 'claude-3-opus-20240229',
    provider: 'anthropic',
    maxTokens: 4096,
    costPerPromptToken: 0.000015,
    costPerCompletionToken: 0.000075,
    contextWindow: 200000,
  },
  'claude-3-sonnet-20240229': {
    name: 'claude-3-sonnet-20240229',
    provider: 'anthropic',
    maxTokens: 4096,
    costPerPromptToken: 0.000003,
    costPerCompletionToken: 0.000015,
    contextWindow: 200000,
  },
  'claude-3-haiku-20240307': {
    name: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    maxTokens: 4096,
    costPerPromptToken: 0.00000025,
    costPerCompletionToken: 0.00000125,
    contextWindow: 200000,
  },
  // Mistral Models
  'mistral-large-latest': {
    name: 'mistral-large-latest',
    provider: 'mistral',
    maxTokens: 4096,
    costPerPromptToken: 0.000008,
    costPerCompletionToken: 0.000024,
    contextWindow: 32000,
  },
  'mistral-medium-latest': {
    name: 'mistral-medium-latest',
    provider: 'mistral',
    maxTokens: 4096,
    costPerPromptToken: 0.0000027,
    costPerCompletionToken: 0.0000081,
    contextWindow: 32000,
  },
  'mistral-small-latest': {
    name: 'mistral-small-latest',
    provider: 'mistral',
    maxTokens: 4096,
    costPerPromptToken: 0.000001,
    costPerCompletionToken: 0.000003,
    contextWindow: 32000,
  },
  // Local Models (no cost)
  'local-llama-3': {
    name: 'local-llama-3',
    provider: 'local',
    maxTokens: 4096,
    costPerPromptToken: 0,
    costPerCompletionToken: 0,
    contextWindow: 8192,
  },
  'local-mistral-7b': {
    name: 'local-mistral-7b',
    provider: 'local',
    maxTokens: 4096,
    costPerPromptToken: 0,
    costPerCompletionToken: 0,
    contextWindow: 8192,
  },
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: AIModel;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  projectId?: string;
  userId?: string;
  operation?: string;
}

export interface ChatCompletionResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  model: AIModel;
  provider: AIProvider;
}

export class AIModelService {
  private openai: OpenAI;
  private anthropic: Anthropic | null = null;

  constructor() {
    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    
    // Initialize Anthropic if API key exists
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  async getProjectModelConfig(projectId: string): Promise<{
    model: AIModel;
    maxTokens: number;
    temperature: number;
  }> {
    const config = await prisma.projectConfig.findUnique({
      where: { projectId },
      select: {
        preferredModel: true,
        maxTokens: true,
        temperature: true,
      },
    });

    return {
      model: (config?.preferredModel as AIModel) || 'gpt-4-turbo-preview',
      maxTokens: config?.maxTokens || 4096,
      temperature: config?.temperature || 0.7,
    };
  }

  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const startTime = Date.now();
    
    // Get model config from project if projectId provided
    let model = options.model || 'gpt-4-turbo-preview';
    let maxTokens = options.maxTokens || 4096;
    let temperature = options.temperature || 0.7;

    if (options.projectId) {
      const projectConfig = await this.getProjectModelConfig(options.projectId);
      model = projectConfig.model;
      maxTokens = projectConfig.maxTokens;
      temperature = projectConfig.temperature;
    }

    const modelConfig = MODEL_CONFIGS[model];
    
    try {
      let response: ChatCompletionResponse;

      switch (modelConfig.provider) {
        case 'openai':
          response = await this.openaiChatCompletion(
            model,
            options.messages,
            temperature,
            maxTokens
          );
          break;
        
        case 'anthropic':
          response = await this.anthropicChatCompletion(
            model,
            options.messages,
            temperature,
            maxTokens
          );
          break;
        
        default:
          throw new Error(`Provider ${modelConfig.provider} not yet implemented`);
      }

      const durationMs = Date.now() - startTime;
      response.durationMs = durationMs;

      // Track usage in database
      if (options.projectId) {
        await this.trackUsage({
          projectId: options.projectId,
          userId: options.userId,
          modelName: model,
          provider: modelConfig.provider,
          operation: options.operation || 'chat',
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
          costUsd: response.costUsd,
          durationMs: response.durationMs,
          success: true,
        });
      }

      return response;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Track failed usage
      if (options.projectId) {
        await this.trackUsage({
          projectId: options.projectId,
          userId: options.userId,
          modelName: model,
          provider: modelConfig.provider,
          operation: options.operation || 'chat',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          durationMs,
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      throw error;
    }
  }

  private async openaiChatCompletion(
    model: AIModel,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number
  ): Promise<ChatCompletionResponse> {
    const modelConfig = MODEL_CONFIGS[model];

    const completion = await this.openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const usage = completion.usage;
    if (!usage) {
      throw new Error('No usage data returned from OpenAI');
    }

    const costUsd =
      usage.prompt_tokens * modelConfig.costPerPromptToken +
      usage.completion_tokens * modelConfig.costPerCompletionToken;

    return {
      content: completion.choices[0]?.message?.content || '',
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      costUsd,
      durationMs: 0, // Will be set by caller
      model,
      provider: 'openai',
    };
  }

  private async anthropicChatCompletion(
    model: AIModel,
    messages: ChatMessage[],
    temperature: number,
    maxTokens: number
  ): Promise<ChatCompletionResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    const modelConfig = MODEL_CONFIGS[model];

    // Convert messages format for Anthropic
    const systemMessage = messages.find((m) => m.role === 'system');
    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const completion = await this.anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemMessage?.content,
      messages: conversationMessages,
    });

    const usage = completion.usage;
    const costUsd =
      usage.input_tokens * modelConfig.costPerPromptToken +
      usage.output_tokens * modelConfig.costPerCompletionToken;

    return {
      content: completion.content[0]?.type === 'text' ? completion.content[0].text : '',
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
      costUsd,
      durationMs: 0, // Will be set by caller
      model,
      provider: 'anthropic',
    };
  }

  private async trackUsage(data: {
    projectId: string;
    userId?: string;
    modelName: string;
    provider: string;
    operation: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    durationMs: number;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await prisma.aIModelUsage.create({
        data: {
          projectId: data.projectId,
          userId: data.userId || null,
          modelName: data.modelName,
          provider: data.provider,
          operation: data.operation,
          promptTokens: data.promptTokens,
          completionTokens: data.completionTokens,
          totalTokens: data.totalTokens,
          costUsd: data.costUsd,
          durationMs: data.durationMs,
          success: data.success,
          errorMessage: data.errorMessage || null,
        },
      });
    } catch (error) {
      console.error('Failed to track AI usage:', error);
      // Don't throw - tracking failures shouldn't break the main flow
    }
  }

  async getUsageStats(
    projectId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalCost: number;
    totalTokens: number;
    totalRequests: number;
    byModel: Record<string, { cost: number; tokens: number; requests: number }>;
    byProvider: Record<string, { cost: number; tokens: number; requests: number }>;
  }> {
    const whereClause: {
      projectId: string;
      createdAt?: { gte: Date; lte: Date };
    } = { projectId };
    
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    const usage = await prisma.aIModelUsage.findMany({
      where: whereClause,
      select: {
        modelName: true,
        provider: true,
        totalTokens: true,
        costUsd: true,
      },
    });

    const stats = {
      totalCost: 0,
      totalTokens: 0,
      totalRequests: usage.length,
      byModel: {} as Record<string, { cost: number; tokens: number; requests: number }>,
      byProvider: {} as Record<string, { cost: number; tokens: number; requests: number }>,
    };

    usage.forEach((record) => {
      stats.totalCost += record.costUsd;
      stats.totalTokens += record.totalTokens;

      // By model
      if (!stats.byModel[record.modelName]) {
        stats.byModel[record.modelName] = { cost: 0, tokens: 0, requests: 0 };
      }
      stats.byModel[record.modelName].cost += record.costUsd;
      stats.byModel[record.modelName].tokens += record.totalTokens;
      stats.byModel[record.modelName].requests += 1;

      // By provider
      if (!stats.byProvider[record.provider]) {
        stats.byProvider[record.provider] = { cost: 0, tokens: 0, requests: 0 };
      }
      stats.byProvider[record.provider].cost += record.costUsd;
      stats.byProvider[record.provider].tokens += record.totalTokens;
      stats.byProvider[record.provider].requests += 1;
    });

    return stats;
  }
}

export const aiModelService = new AIModelService();
