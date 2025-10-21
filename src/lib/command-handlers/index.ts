/**
 * Command Handlers Module
 * 
 * Central export point for command handler infrastructure.
 */

export * from './types';
export * from './registry';
export * from './init';
export * from './help-handler';
export * from './fix-handler';
export * from './generate-handler';
export * from './test-handler';
export * from './refactor-handler';
export * from './explain-handler';
// Note: scaffold-handler is NOT exported here - it uses Node.js fs APIs
// and can only be loaded server-side via dynamic import in init.ts

// Re-export command parser types for convenience
export type { Command } from '../command-parser';
export { CommandType, CommandParser, parseCommand, hasCommand } from '../command-parser';
