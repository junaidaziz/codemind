import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { Document } from '@langchain/core/documents';
import { z } from 'zod';
import { CodeMindVectorStore } from './langchain-vectorstore';
import { CodeMindChatMemory } from './langchain-memory';
import { createEnhancedRAGChain, EnhancedRAGInput, EnhancedRAGOutput } from './langchain-agent';
import { env } from '../../types/env';
import { logger } from './logger';
import prisma from './db';

// Zod schemas for input/output validation
export const GenerateAnswerInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(2000, 'Query too long'),
  projectId: z.string().min(1, 'Project ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  sessionId: z.string().optional(),
});

export const GenerateAnswerOutputSchema = z.object({
  answer: z.string(),
  sources: z.array(z.object({
    path: z.string(),
    startLine: z.number(),
    endLine: z.number(),
    language: z.string(),
    similarity: z.number(),
  })),
  sessionId: z.string(),
  tokenUsage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }),
});

export type GenerateAnswerInput = z.infer<typeof GenerateAnswerInputSchema>;
export type GenerateAnswerOutput = z.infer<typeof GenerateAnswerOutputSchema>;

/**
 * Format documents into a context string for the prompt
 */
function formatDocuments(docs: Document[]): string {
  return docs
    .map((doc, index) => {
      const metadata = doc.metadata;
      return `Source ${index + 1}:
File: ${metadata.path} (lines ${metadata.startLine}-${metadata.endLine})
Language: ${metadata.language}
Code:
${doc.pageContent}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Create the RAG chain using LangChain components with memory
 */
async function createRagChain(projectId: string, sessionId?: string) {
  // Initialize components
  const vectorStore = await CodeMindVectorStore.fromProjectId(projectId);
  const retriever = vectorStore.asRetriever({ k: 8 });
  
  // Initialize memory if we have a session
  let memory: CodeMindChatMemory | null = null;
  if (sessionId) {
    memory = new CodeMindChatMemory({ sessionId });
  }
  
  const model = new ChatOpenAI({
    openAIApiKey: env.OPENAI_API_KEY,
    modelName: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1000,
  });

  // Get project details for context
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, githubUrl: true },
  });

  // Enhanced prompt with conversation history
  const prompt = PromptTemplate.fromTemplate(`You are an AI assistant helping with code analysis and questions about the "${project?.name || 'unknown'}" project.

Use the following code context to answer questions accurately:

{context}

{history}

Current Question: {question}

Guidelines:
- When referencing code, mention the file path and line numbers
- Provide helpful explanations and suggestions based on the codebase
- Consider the conversation history for context and continuity
- If the context doesn't contain relevant information, say so clearly
- Focus on being accurate and helpful

Answer:`);

  // Create the RAG chain with memory integration
  const ragChain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocuments),
      history: async () => {
        if (memory) {
          const memoryVars = await memory.loadMemoryVariables({});
          return memoryVars.history || '';
        }
        return '';
      },
      question: new RunnablePassthrough(),
    },
    prompt,
    model,
    new StringOutputParser(),
  ]);

  return { ragChain, retriever, memory };
}

/**
 * Main function to generate answers using LangChain RAG
 */
export async function generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerOutput> {
  // Validate input
  const validatedInput = GenerateAnswerInputSchema.parse(input);
  const { query, projectId, userId, sessionId } = validatedInput;

  logger.info('Generating answer with LangChain', {
    projectId,
    userId,
    queryLength: query.length,
    sessionId,
  });

  try {
    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Create or use existing chat session
    let finalSessionId: string = sessionId || '';
    if (!finalSessionId) {
      const session = await prisma.chatSession.create({
        data: {
          id: crypto.randomUUID(),
          projectId,
          userId,
          title: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
        },
      });
      finalSessionId = session.id;
    }

    // Save user message
    await prisma.message.create({
      data: {
        id: crypto.randomUUID(),
        sessionId: finalSessionId,
        role: 'user',
        content: query,
      },
    });

    // Create RAG chain with memory
    const { ragChain, retriever, memory } = await createRagChain(projectId, finalSessionId);

    // Get relevant documents for source tracking
    const relevantDocs = await retriever.getRelevantDocuments(query);

    // Generate answer using the RAG chain
    const startTime = Date.now();
    const answer = await ragChain.invoke(query);
    const endTime = Date.now();

    // Save conversation to memory if available
    if (memory) {
      await memory.saveContext(
        { input: query },
        { output: answer }
      );
    }

    // Extract sources from documents
    const sources = relevantDocs.map((doc) => ({
      path: doc.metadata.path,
      startLine: doc.metadata.startLine,
      endLine: doc.metadata.endLine,
      language: doc.metadata.language,
      similarity: doc.metadata.similarity || 0,
    }));

    // Save assistant message
    await prisma.message.create({
      data: {
        id: crypto.randomUUID(),
        sessionId: finalSessionId,
        role: 'assistant',
        content: answer,
        latencyMs: endTime - startTime,
      },
    });

    // Mock token usage (would need to implement proper token counting)
    const tokenUsage = {
      promptTokens: Math.ceil(query.length / 4) + Math.ceil(relevantDocs.reduce((acc, doc) => acc + doc.pageContent.length, 0) / 4),
      completionTokens: Math.ceil(answer.length / 4),
      totalTokens: 0,
    };
    tokenUsage.totalTokens = tokenUsage.promptTokens + tokenUsage.completionTokens;

    const result = {
      answer,
      sources,
      sessionId: finalSessionId,
      tokenUsage,
    };

    // Validate output
    const validatedOutput = GenerateAnswerOutputSchema.parse(result);

    logger.info('Answer generated successfully', {
      projectId,
      userId,
      sessionId: finalSessionId,
      answerLength: answer.length,
      sourceCount: sources.length,
      latencyMs: endTime - startTime,
      tokenUsage,
    });

    return validatedOutput;

  } catch (error) {
    logger.error('Failed to generate answer', {
      projectId,
      userId,
      sessionId,
    }, error as Error);
    throw error;
  }
}

/**
 * Streaming version of generateAnswer for real-time responses
 */
export async function generateAnswerStream(
  input: GenerateAnswerInput,
  onChunk: (chunk: string) => void,
  onComplete: (result: GenerateAnswerOutput) => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const validatedInput = GenerateAnswerInputSchema.parse(input);
    const { query, projectId, userId, sessionId } = validatedInput;

    logger.info('Generating streaming answer with LangChain', {
      projectId,
      userId,
      queryLength: query.length,
      sessionId,
    });

    // Verify project and create/get session
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Create or use existing chat session
    let finalSessionId: string = sessionId || '';
    if (!finalSessionId) {
      const session = await prisma.chatSession.create({
        data: {
          id: crypto.randomUUID(),
          projectId,
          userId,
          title: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
        },
      });
      finalSessionId = session.id;
    }

    // Save user message
    await prisma.message.create({
      data: {
        id: crypto.randomUUID(),
        sessionId: finalSessionId,
        role: 'user',
        content: query,
      },
    });

    // Create RAG chain with streaming model and memory
    const vectorStore = await CodeMindVectorStore.fromProjectId(projectId);
    const retriever = vectorStore.asRetriever({ k: 8 });
    
    // Initialize memory for conversation history
    const memory = new CodeMindChatMemory({ sessionId: finalSessionId });
    
    const streamingModel = new ChatOpenAI({
      openAIApiKey: env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1000,
      streaming: true,
    });

    const prompt = PromptTemplate.fromTemplate(`You are an AI assistant helping with code analysis and questions about the "${project?.name || 'unknown'}" project.

Use the following code context to answer questions accurately:

{context}

{history}

Current Question: {question}

Guidelines:
- When referencing code, mention the file path and line numbers
- Provide helpful explanations and suggestions based on the codebase
- Consider the conversation history for context and continuity
- If the context doesn't contain relevant information, say so clearly
- Focus on being accurate and helpful

Answer:`);

    // Get relevant documents and conversation history
    const relevantDocs = await retriever.getRelevantDocuments(query);
    const context = formatDocuments(relevantDocs);
    
    // Load conversation history
    const memoryVars = await memory.loadMemoryVariables({});
    const history = memoryVars.history || '';

    // Create formatted prompt with history
    const formattedPrompt = await prompt.format({
      context,
      history,
      question: query,
    });

    let fullAnswer = '';

    // Stream the response
    const stream = await streamingModel.stream(formattedPrompt);
    
    for await (const chunk of stream) {
      const content = chunk.content.toString();
      if (content) {
        fullAnswer += content;
        onChunk(content);
      }
    }

    // Save assistant message to database
    const endTime = Date.now();
    const startTime = endTime - 1000; // Approximate start time
    
    await prisma.message.create({
      data: {
        id: crypto.randomUUID(),
        sessionId: finalSessionId,
        role: 'assistant',
        content: fullAnswer,
        latencyMs: endTime - startTime,
      },
    });

    // Save conversation to memory
    await memory.saveContext(
      { input: query },
      { output: fullAnswer }
    );

    // Create final result
    const sources = relevantDocs.map((doc) => ({
      path: doc.metadata.path,
      startLine: doc.metadata.startLine,
      endLine: doc.metadata.endLine,
      language: doc.metadata.language,
      similarity: doc.metadata.similarity || 0,
    }));

    const tokenUsage = {
      promptTokens: Math.ceil(formattedPrompt.length / 4),
      completionTokens: Math.ceil(fullAnswer.length / 4),
      totalTokens: 0,
    };
    tokenUsage.totalTokens = tokenUsage.promptTokens + tokenUsage.completionTokens;

    const result: GenerateAnswerOutput = {
      answer: fullAnswer,
      sources,
      sessionId: finalSessionId,
      tokenUsage,
    };

    const validatedOutput = GenerateAnswerOutputSchema.parse(result);
    onComplete(validatedOutput);

  } catch (error) {
    onError(error as Error);
  }
}

/**
 * Enhanced answer generation using the tool-enabled agent
 */
export async function generateEnhancedAnswer(input: EnhancedRAGInput): Promise<EnhancedRAGOutput> {
  // Validate input
  const validatedInput = input;
  const { projectId, userId, sessionId } = validatedInput;

  logger.info('Generating enhanced answer with tools', {
    projectId,
    userId,
    sessionId,
  });

  try {
    // Create enhanced RAG chain with tools
    const enhancedChain = await createEnhancedRAGChain(
      projectId,
      userId,
      sessionId,
      process.env.GITHUB_TOKEN // Optional GitHub token from environment
    );

    // Generate answer using the enhanced chain
    const result = await enhancedChain.generateAnswer(validatedInput);

    logger.info('Enhanced answer generated successfully', {
      projectId,
      userId,
      sessionId,
      toolsUsedCount: result.toolsUsed.length,
      executionTimeMs: result.executionTimeMs,
    });

    return result;

  } catch (error) {
    logger.error('Failed to generate enhanced answer', {
      projectId,
      userId,
      sessionId,
    }, error as Error);
    throw error;
  }
}