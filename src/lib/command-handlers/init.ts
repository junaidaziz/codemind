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

let initialized = false;

/**
 * Initialize all command handlers
 * 
 * Call this once during app startup to register all handlers.
 */
export async function initializeCommandHandlers(): Promise<void> {
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
  
  // Only register scaffold handler on server-side (uses Node.js fs APIs)
  if (typeof window === 'undefined') {
    try {
      const { ScaffoldCommandHandler } = await import('./scaffold-handler');
      registry.register(CommandType.SCAFFOLD, new ScaffoldCommandHandler());
    } catch (error) {
      console.warn('Could not load ScaffoldCommandHandler (server-only module):', error);
    }
  }

  initialized = true;

  const handlers = [
    'help',
    'fix',
    'generate',
    'test',
    'refactor',
    'explain',
  ];
  
  if (typeof window === 'undefined') {
    handlers.push('scaffold (server-only)');
  }

  console.log('✅ Command handlers initialized:', handlers);
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
