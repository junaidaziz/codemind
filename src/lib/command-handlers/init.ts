/**
 * Command Handler Initialization
 * 
 * Registers all command handlers with the registry on app startup.
 */

import { CommandType } from '../command-parser';
import { getCommandRegistry } from './registry';
import { HelpCommandHandler } from './help-handler';
import { FixCommandHandler } from './fix-handler';
import { GenerateCommandHandler } from './generate-handler';
import { TestCommandHandler } from './test-handler';
import { RefactorCommandHandler } from './refactor-handler';
import { ExplainCommandHandler } from './explain-handler';
import { ScaffoldCommandHandler } from './scaffold-handler';

let initialized = false;

/**
 * Initialize all command handlers
 * 
 * Call this once during app startup to register all handlers.
 */
export function initializeCommandHandlers(): void {
  if (initialized) {
    console.log('Command handlers already initialized');
    return;
  }

  const registry = getCommandRegistry();

  // Register all handlers
  registry.register(CommandType.HELP, new HelpCommandHandler());
  registry.register(CommandType.FIX, new FixCommandHandler());
  registry.register(CommandType.GENERATE, new GenerateCommandHandler());
  registry.register(CommandType.TEST, new TestCommandHandler());
  registry.register(CommandType.REFACTOR, new RefactorCommandHandler());
  registry.register(CommandType.EXPLAIN, new ExplainCommandHandler());
  registry.register(CommandType.SCAFFOLD, new ScaffoldCommandHandler());

  initialized = true;

  console.log('✅ Command handlers initialized:', [
    'help',
    'fix',
    'generate',
    'test',
    'refactor',
    'explain',
    'scaffold',
  ]);
}

/**
 * Check if command handlers are initialized
 */
export function areCommandHandlersInitialized(): boolean {
  return initialized;
}

/**
 * Reset initialization (mainly for testing)
 */
export function resetCommandHandlers(): void {
  const registry = getCommandRegistry();
  registry.clear();
  initialized = false;
}
