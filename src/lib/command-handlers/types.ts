/**
 * Command Handler Type Definitions
 */

import { Command } from '../command-parser';

/**
 * Result of command execution
 */
export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
  
  // For commands that produce code changes
  changes?: CodeChange[];
  
  // For commands that need user actions
  actions?: CommandAction[];
}

/**
 * Code change that can be applied
 */
export interface CodeChange {
  filePath: string;
  oldContent?: string;
  newContent: string;
  description: string;
  lineStart?: number;
  lineEnd?: number;
}

/**
 * Action user can take on command result
 */
export interface CommandAction {
  type: 'accept' | 'reject' | 'modify' | 'view';
  label: string;
  description?: string;
  handler: () => Promise<void>;
}

/**
 * Context passed to command handlers
 */
export interface CommandContext {
  projectId?: string;
  userId: string;
  sessionId?: string;
  workspacePath?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

/**
 * Base interface for all command handlers
 */
export interface ICommandHandler {
  /**
   * Execute the command
   */
  execute(command: Command, context: CommandContext): Promise<CommandResult>;

  /**
   * Get help text for this command
   */
  getHelp(): string;

  /**
   * Validate command arguments
   */
  validate(command: Command): { valid: boolean; error?: string };
}
