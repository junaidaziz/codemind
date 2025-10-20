/**
 * Command Handler Registry
 * 
 * Central registry for all slash command handlers.
 * Routes commands to appropriate handlers and manages execution.
 */

import { Command, CommandType } from '../command-parser';
import { ICommandHandler, CommandContext, CommandResult } from './types';

/**
 * CommandRegistry
 * 
 * Manages registration and execution of command handlers.
 */
export class CommandRegistry {
  private handlers: Map<CommandType, ICommandHandler> = new Map();
  private static instance: CommandRegistry;

  /**
   * Get singleton instance
   */
  static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  /**
   * Register a command handler
   */
  register(type: CommandType, handler: ICommandHandler): void {
    if (this.handlers.has(type)) {
      console.warn(`Handler for command type ${type} is being overwritten`);
    }
    this.handlers.set(type, handler);
  }

  /**
   * Unregister a command handler
   */
  unregister(type: CommandType): void {
    this.handlers.delete(type);
  }

  /**
   * Check if a handler is registered for a command type
   */
  hasHandler(type: CommandType): boolean {
    return this.handlers.has(type);
  }

  /**
   * Get a registered handler
   */
  getHandler(type: CommandType): ICommandHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Execute a command
   * 
   * @param command - The parsed command to execute
   * @param context - Execution context (user, project, etc.)
   * @returns Promise resolving to command result
   */
  async execute(command: Command, context: CommandContext): Promise<CommandResult> {
    const handler = this.handlers.get(command.type);

    if (!handler) {
      return {
        success: false,
        message: `No handler registered for command: ${command.type}`,
        error: `Command /${command.type} is not implemented yet`,
      };
    }

    // Validate command before execution
    const validation = handler.validate(command);
    if (!validation.valid) {
      return {
        success: false,
        message: 'Command validation failed',
        error: validation.error || 'Invalid command',
      };
    }

    try {
      // Execute the command
      const result = await handler.execute(command, context);
      return result;
    } catch (error) {
      console.error(`Error executing command ${command.type}:`, error);
      
      return {
        success: false,
        message: 'Command execution failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get help text for a specific command
   */
  getCommandHelp(type: CommandType): string | undefined {
    const handler = this.handlers.get(type);
    return handler?.getHelp();
  }

  /**
   * Get help text for all registered commands
   */
  getAllHelp(): string {
    const helpTexts: string[] = ['**Available Commands:**\n'];

    for (const [type, handler] of this.handlers.entries()) {
      helpTexts.push(`\n**/${type}**`);
      helpTexts.push(handler.getHelp());
    }

    return helpTexts.join('\n');
  }

  /**
   * List all registered command types
   */
  listCommands(): CommandType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all registered handlers (mainly for testing)
   */
  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Get the global command registry instance
 */
export function getCommandRegistry(): CommandRegistry {
  return CommandRegistry.getInstance();
}

/**
 * Helper function to execute a command
 */
export async function executeCommand(
  command: Command,
  context: CommandContext
): Promise<CommandResult> {
  const registry = getCommandRegistry();
  return registry.execute(command, context);
}
