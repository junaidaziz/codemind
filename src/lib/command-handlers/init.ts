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
import { ScaffoldCommandHandlerClient } from './scaffold-handler-client';

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
  
  // Register scaffold handler (client-side calls API, server-side uses full handler)
  if (typeof window === 'undefined') {
    // Server-side: use full scaffold handler with file system access
    try {
      const { ScaffoldCommandHandler } = await import('./scaffold-handler');
      registry.register(CommandType.SCAFFOLD, new ScaffoldCommandHandler());
      console.log('✅ Scaffold handler registered (server-side)');
    } catch (error) {
      console.error('❌ Failed to load ScaffoldCommandHandler:', error);
    }
  } else {
    // Client-side: use API wrapper
    registry.register(CommandType.SCAFFOLD, new ScaffoldCommandHandlerClient());
    console.log('✅ Scaffold handler registered (client-side API wrapper)');
  }

  initialized = true;

  const handlers = [
    'help',
    'fix',
    'generate',
    'test',
    'refactor',
    'explain',
    typeof window === 'undefined' ? 'scaffold (server-only)' : 'scaffold (API)',
  ];

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
