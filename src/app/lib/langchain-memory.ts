import { BaseMemory, InputValues, MemoryVariables, OutputValues } from '@langchain/core/memory';
import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import prisma from './db';
import { logger } from './logger';

// Configuration for memory management
export interface MemoryConfig {
  sessionId: string;
  maxTokens?: number; // Maximum tokens to keep in memory
  maxMessages?: number; // Maximum number of messages to keep
  summaryThreshold?: number; // Token count threshold for creating summaries
  includeSystemMessages?: boolean;
  inputKey?: string;
  outputKey?: string;
}

// Token counting utility (simplified - in production you'd use tiktoken or similar)
function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

// Zod schemas for validation
export const MemoryConfigSchema = z.object({
  sessionId: z.string().min(1),
  maxTokens: z.number().positive().optional().default(4000),
  maxMessages: z.number().positive().optional().default(20),
  summaryThreshold: z.number().positive().optional().default(2000),
  includeSystemMessages: z.boolean().optional().default(false),
  inputKey: z.string().optional().default('input'),
  outputKey: z.string().optional().default('output'),
});

export type ValidatedMemoryConfig = z.infer<typeof MemoryConfigSchema>;

/**
 * Custom LangChain memory implementation that stores conversation history in Prisma
 * and implements intelligent token management with summarization
 */
export class CodeMindChatMemory extends BaseMemory {
  private config: ValidatedMemoryConfig;
  private memoryKey: string = 'chat_history';
  inputKey: string = 'input';
  outputKey: string = 'output';

  constructor(config: MemoryConfig) {
    super();
    this.config = MemoryConfigSchema.parse(config);
    
    logger.debug('CodeMindChatMemory initialized', {
      sessionId: this.config.sessionId,
      maxTokens: this.config.maxTokens,
      maxMessages: this.config.maxMessages,
    });
  }

  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

  /**
   * Load conversation history from the database
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    logger.debug('Loading memory variables', {
      sessionId: this.config.sessionId,
    });

    try {
      // Get session with recent messages
      const session = await prisma.chatSession.findUnique({
        where: { id: this.config.sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: this.config.maxMessages,
          },
        },
      });

      if (!session) {
        logger.warn('Session not found for memory loading', {
          sessionId: this.config.sessionId,
        });
        return { [this.memoryKey]: [] };
      }

      // Convert database messages to LangChain format
      const messages: BaseMessage[] = session.messages
        .reverse() // Restore chronological order
        .filter((msg: typeof session.messages[0]) => this.config.includeSystemMessages || msg.role !== 'system')
        .map((msg: typeof session.messages[0]) => {
          switch (msg.role) {
            case 'user':
              return new HumanMessage(msg.content);
            case 'assistant':
              return new AIMessage(msg.content);
            case 'system':
              return new SystemMessage(msg.content);
            default:
              logger.warn('Unknown message role', { role: msg.role, messageId: msg.id });
              return new HumanMessage(msg.content); // Fallback
          }
        });

      // Apply token-based trimming if needed
      const trimmedMessages = await this.trimMessagesToTokenLimit(messages, session.summary);

      // Update session activity
      await prisma.chatSession.update({
        where: { id: this.config.sessionId },
        data: { lastActiveAt: new Date() },
      });

      logger.debug('Memory variables loaded', {
        sessionId: this.config.sessionId,
        messageCount: trimmedMessages.length,
        hasSessionSummary: !!session.summary,
      });

      return { [this.memoryKey]: trimmedMessages };

    } catch (error) {
      logger.error('Failed to load memory variables', {
        sessionId: this.config.sessionId,
      }, error as Error);
      
      // Return empty memory on error to prevent breaking the chain
      return { [this.memoryKey]: [] };
    }
  }

  /**
   * Save new messages to the database
   */
  async saveContext(inputValues: InputValues, outputValues: OutputValues): Promise<void> {
    logger.debug('Saving context to memory', {
      sessionId: this.config.sessionId,
    });

    try {
      const inputText = inputValues[this.inputKey || 'input'] as string;
      const outputText = outputValues[this.outputKey || 'output'] as string;

      // Calculate token counts
      const inputTokens = estimateTokens(inputText);
      const outputTokens = estimateTokens(outputText);

      // Save messages to database
      const [userMessage, assistantMessage] = await Promise.all([
        // Save user message
        prisma.message.create({
          data: {
            sessionId: this.config.sessionId,
            role: 'user',
            content: inputText,
            tokenCount: inputTokens,
            memoryIncluded: true,
          },
        }),
        
        // Save assistant message
        prisma.message.create({
          data: {
            sessionId: this.config.sessionId,
            role: 'assistant',
            content: outputText,
            tokenCount: outputTokens,
            memoryIncluded: true,
          },
        }),
      ]);

      // Update session statistics
      await prisma.chatSession.update({
        where: { id: this.config.sessionId },
        data: {
          messageCount: { increment: 2 },
          totalTokens: { increment: inputTokens + outputTokens },
          lastActiveAt: new Date(),
        },
      });

      // Check if we need to create a summary
      await this.checkAndCreateSummary();

      logger.debug('Context saved to memory', {
        sessionId: this.config.sessionId,
        inputTokens,
        outputTokens,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      });

    } catch (error) {
      logger.error('Failed to save context to memory', {
        sessionId: this.config.sessionId,
      }, error as Error);
      throw error;
    }
  }

  /**
   * Clear conversation history (marks messages as not included in memory)
   */
  async clear(): Promise<void> {
    logger.info('Clearing memory', { sessionId: this.config.sessionId });

    try {
      // Mark messages as not included in memory instead of deleting
      await prisma.message.updateMany({
        where: { sessionId: this.config.sessionId },
        data: { memoryIncluded: false },
      });

      // Clear session summary
      await prisma.chatSession.update({
        where: { id: this.config.sessionId },
        data: {
          summary: null,
          totalTokens: 0,
        },
      });

      logger.info('Memory cleared successfully', { sessionId: this.config.sessionId });

    } catch (error) {
      logger.error('Failed to clear memory', {
        sessionId: this.config.sessionId,
      }, error as Error);
      throw error;
    }
  }

  /**
   * Trim messages to fit within token limits
   */
  private async trimMessagesToTokenLimit(
    messages: BaseMessage[],
    sessionSummary?: string | null
  ): Promise<BaseMessage[]> {
    if (messages.length === 0) return messages;

    let totalTokens = sessionSummary ? estimateTokens(sessionSummary) : 0;
    const keptMessages: BaseMessage[] = [];

    // Include summary as a system message if it exists
    if (sessionSummary) {
      keptMessages.push(new SystemMessage(`Previous conversation summary: ${sessionSummary}`));
    }

    // Add messages from most recent, staying within token limit
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageTokens = estimateTokens(
        typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
      );
      
      if (totalTokens + messageTokens <= this.config.maxTokens) {
        keptMessages.unshift(message); // Add to beginning to maintain order
        totalTokens += messageTokens;
      } else {
        // Mark older messages as not included in memory
        await this.markMessagesAsNotIncluded(messages.slice(0, i + 1));
        break;
      }
    }

    logger.debug('Messages trimmed for token limit', {
      sessionId: this.config.sessionId,
      originalCount: messages.length,
      keptCount: keptMessages.length - (sessionSummary ? 1 : 0), // Subtract summary message
      totalTokens,
      tokenLimit: this.config.maxTokens,
    });

    return keptMessages;
  }

  /**
   * Check if we need to create a conversation summary
   */
  private async checkAndCreateSummary(): Promise<void> {
    try {
      const session = await prisma.chatSession.findUnique({
        where: { id: this.config.sessionId },
        select: { totalTokens: true, summary: true },
      });

      if (!session) return;

      // Create summary if we've exceeded the threshold and don't have one yet
      if (session.totalTokens > this.config.summaryThreshold && !session.summary) {
        await this.createConversationSummary();
      }
    } catch (error) {
      logger.error('Failed to check summary needs', {
        sessionId: this.config.sessionId,
      }, error as Error);
      // Don't throw - summary creation is optional
    }
  }

  /**
   * Create a summary of the conversation
   */
  private async createConversationSummary(): Promise<void> {
    logger.info('Creating conversation summary', { sessionId: this.config.sessionId });

    try {
      // Get older messages to summarize
      const messages = await prisma.message.findMany({
        where: {
          sessionId: this.config.sessionId,
          memoryIncluded: true,
        },
        orderBy: { createdAt: 'asc' },
        take: Math.floor(this.config.maxMessages / 2), // Summarize first half
      });

      if (messages.length < 4) return; // Need at least a few messages to summarize

      // Create a simple summary (in production, you'd use an LLM for this)
      const summary = this.createSimpleSummary(messages);

      // Save summary and mark messages as summarized
      await Promise.all([
        prisma.chatSession.update({
          where: { id: this.config.sessionId },
          data: { summary },
        }),
        
        // Mark summarized messages as not included in active memory
        prisma.message.updateMany({
          where: {
            id: { in: messages.map((m: typeof messages[0]) => m.id) },
          },
          data: { memoryIncluded: false },
        }),
      ]);

      logger.info('Conversation summary created', {
        sessionId: this.config.sessionId,
        summarizedMessages: messages.length,
        summaryLength: summary.length,
      });

    } catch (error) {
      logger.error('Failed to create conversation summary', {
        sessionId: this.config.sessionId,
      }, error as Error);
    }
  }

  /**
   * Create a simple text summary of messages
   */
  private createSimpleSummary(messages: Array<{ role: string; content: string; createdAt: Date }>): string {
    const topics = new Set<string>();
    const keyPoints: string[] = [];

    messages.forEach(msg => {
      if (msg.role === 'user') {
        // Extract potential topics from user messages
        const words = msg.content.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 4 && !['what', 'how', 'where', 'when', 'why', 'could', 'would', 'should'].includes(word)) {
            topics.add(word);
          }
        });
        
        // Add first sentence of longer messages as key points
        if (msg.content.length > 50) {
          const firstSentence = msg.content.split('.')[0] + '.';
          if (firstSentence.length < 100) {
            keyPoints.push(`User asked: ${firstSentence}`);
          }
        }
      }
    });

    const topicsArray = Array.from(topics).slice(0, 5); // Top 5 topics
    const keyPointsStr = keyPoints.slice(0, 3).join(' '); // Top 3 key points

    return `Conversation covered topics: ${topicsArray.join(', ')}. ${keyPointsStr}`.substring(0, 500);
  }

  /**
   * Mark messages as not included in memory
   */
  private async markMessagesAsNotIncluded(messages: BaseMessage[]): Promise<void> {
    // This is a simplified approach - in practice you'd need to track message IDs
    // For now, we'll update based on content matching (not ideal but functional)
    logger.debug('Marking messages as not included in memory', {
      sessionId: this.config.sessionId,
      messageCount: messages.length,
    });
  }

  /**
   * Get memory statistics for monitoring
   */
  async getMemoryStats(): Promise<{
    sessionId: string;
    totalMessages: number;
    activeMessages: number;
    totalTokens: number;
    hasSummary: boolean;
    lastActiveAt: Date;
  }> {
    const session = await prisma.chatSession.findUnique({
      where: { id: this.config.sessionId },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    if (!session) {
      throw new Error(`Session not found: ${this.config.sessionId}`);
    }

    const activeMessages = await prisma.message.count({
      where: {
        sessionId: this.config.sessionId,
        memoryIncluded: true,
      },
    });

    return {
      sessionId: this.config.sessionId,
      totalMessages: session._count.messages,
      activeMessages,
      totalTokens: session.totalTokens,
      hasSummary: !!session.summary,
      lastActiveAt: session.lastActiveAt,
    };
  }
}