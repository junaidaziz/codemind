/**
 * OpenAI Function Calling Integration for Chat
 * Enables the AI to execute tools like creating GitHub issues, assigning tasks, etc.
 */

import OpenAI from 'openai';
import { chatTools, executeTool, type ToolContext } from './chat-tools';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ToolCallResult {
  tool: string;
  arguments: Record<string, unknown>;
  result: unknown;
}

export interface FunctionCallingMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | null;
  function_call?: {
    name: string;
    arguments: string;
  };
  name?: string;
}

export interface ChatWithFunctionsInput {
  projectId: string;
  userId: string;
  sessionId: string;
  messages: FunctionCallingMessage[];
  onChunk?: (chunk: string) => void;
  onToolCall?: (toolName: string, result: unknown) => void;
}

/**
 * Chat with function calling support
 * The AI can decide to call tools to accomplish tasks
 */
export async function chatWithFunctions(
  input: ChatWithFunctionsInput
): Promise<{ response: string; toolCalls: ToolCallResult[] }> {
  const { projectId, userId, sessionId, messages, onChunk, onToolCall } = input;

  const context: ToolContext = {
    projectId,
    userId,
    sessionId
  };

  // Convert tools to OpenAI function format
  const functions = chatTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));

  const conversationMessages = [...messages];
  const toolCalls: ToolCallResult[] = [];
  let finalResponse = '';
  let maxIterations = 5; // Prevent infinite loops

  while (maxIterations > 0) {
    maxIterations--;

    // Call OpenAI with function definitions
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: conversationMessages as OpenAI.Chat.ChatCompletionMessageParam[],
      functions,
      function_call: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
      stream: false
    });

    const message = response.choices[0].message;

    // Check if AI wants to call a function
    if (message.function_call) {
      const toolName = message.function_call.name;
      const toolArgs = JSON.parse(message.function_call.arguments);

      console.log(`AI calling function: ${toolName}`, toolArgs);

      try {
        // Execute the tool
        const result = await executeTool(toolName, toolArgs, context);
        
        toolCalls.push({
          tool: toolName,
          arguments: toolArgs,
          result
        });

        // Notify about tool call
        if (onToolCall) {
          onToolCall(toolName, result);
        }

        // Add function call and result to conversation
        conversationMessages.push({
          role: 'assistant',
          content: null,
          function_call: message.function_call
        });

        conversationMessages.push({
          role: 'function',
          name: toolName,
          content: JSON.stringify(result)
        });

        // Continue conversation with function result
        continue;

      } catch (error) {
        console.error(`Error executing function ${toolName}:`, error);
        
        // Add error to conversation
        conversationMessages.push({
          role: 'function',
          name: toolName,
          content: JSON.stringify({
            error: true,
            message: (error as Error).message
          })
        });

        // Let AI respond with error info
        continue;
      }
    }

    // No function call - this is the final response
    if (message.content) {
      finalResponse = message.content;
      
      if (onChunk) {
        onChunk(message.content);
      }
    }

    break;
  }

  return {
    response: finalResponse,
    toolCalls
  };
}

/**
 * Streaming version with function calling
 */
export async function* chatWithFunctionsStream(
  input: ChatWithFunctionsInput
): AsyncGenerator<string | { type: 'tool_call'; data: { tool: string; status: string; result?: unknown; error?: string } }> {
  const { projectId, userId, sessionId, messages } = input;

  const context: ToolContext = {
    projectId,
    userId,
    sessionId
  };

  // Convert tools to OpenAI function format
  const functions = chatTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));

  const conversationMessages = [...messages];
  let maxIterations = 5;

  while (maxIterations > 0) {
    maxIterations--;

    // Call OpenAI with streaming
    const stream = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: conversationMessages as OpenAI.Chat.ChatCompletionMessageParam[],
      functions,
      function_call: 'auto',
      temperature: 0.7,
      max_tokens: 1000,
      stream: true
    });

    let functionCallName = '';
    let functionCallArgs = '';
    let contentBuffer = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // Collect function call if present
      if (delta?.function_call) {
        if (delta.function_call.name) {
          functionCallName = delta.function_call.name;
        }
        if (delta.function_call.arguments) {
          functionCallArgs += delta.function_call.arguments;
        }
      }

      // Stream content
      if (delta?.content) {
        contentBuffer += delta.content;
        yield delta.content;
      }

      // Check if stream is done
      if (chunk.choices[0]?.finish_reason) {
        break;
      }
    }

    // Execute function if called
    if (functionCallName) {
      yield { 
        type: 'tool_call' as const, 
        data: { 
          tool: functionCallName, 
          status: 'executing' 
        } 
      };

      try {
        const toolArgs = JSON.parse(functionCallArgs);
        const result = await executeTool(functionCallName, toolArgs, context);

        yield { 
          type: 'tool_call' as const, 
          data: { 
            tool: functionCallName, 
            status: 'completed',
            result 
          } 
        };

        // Add to conversation
        conversationMessages.push({
          role: 'assistant',
          content: null,
          function_call: {
            name: functionCallName,
            arguments: functionCallArgs
          }
        });

        conversationMessages.push({
          role: 'function',
          name: functionCallName,
          content: JSON.stringify(result)
        });

        // Continue to get final response
        continue;

      } catch (error) {
        yield { 
          type: 'tool_call' as const, 
          data: { 
            tool: functionCallName, 
            status: 'error',
            error: (error as Error).message 
          } 
        };

        conversationMessages.push({
          role: 'function',
          name: functionCallName,
          content: JSON.stringify({
            error: true,
            message: (error as Error).message
          })
        });

        continue;
      }
    }

    // No function call - done
    if (contentBuffer) {
      break;
    }
  }
}
