/**
 * Command Parser for Developer Command Console
 * 
 * Parses slash commands from chat messages and extracts:
 * - Command type (/fix, /gen, /test, /refactor, /explain)
 * - Arguments (file paths, descriptions, options)
 * - Context (surrounding text)
 */

export enum CommandType {
  FIX = 'fix',
  GENERATE = 'generate',
  TEST = 'test',
  REFACTOR = 'refactor',
  EXPLAIN = 'explain',
  SCAFFOLD = 'scaffold',
  HELP = 'help',
}

export interface Command {
  type: CommandType;
  args: string[];
  rawArgs: string;
  context: string;
  originalMessage: string;
}

export interface ParsedMessage {
  hasCommand: boolean;
  command?: Command;
  plainText: string;
}

/**
 * CommandParser
 * 
 * Main parser class for detecting and extracting slash commands from messages.
 */
export class CommandParser {
  // Regex patterns for each command type
  private static readonly COMMAND_PATTERNS = {
    fix: /^\/fix(?:\s+(.+))?$/im,
    gen: /^\/gen(?:erate)?(?:\s+(.+))?$/im,
    test: /^\/test(?:\s+(.*))?$/im,
    refactor: /^\/refactor(?:\s+(.+))?$/im,
    explain: /^\/explain(?:\s+(.+))?$/im,
    scaffold: /^\/scaf(?:fold)?(?:\s+(.+))?$/im,
    help: /^\/help(?:\s+(.*))?$/im,
  };

  // Combined pattern to detect any slash command
  private static readonly ANY_COMMAND = /^\/(fix|gen|generate|test|refactor|explain|scaffold|scaf|help)(?:\s|$)/im;

  /**
   * Parse a message to detect and extract slash commands
   * 
   * @param message - The raw message from chat input
   * @returns ParsedMessage with command data if detected
   */
  static parse(message: string): ParsedMessage {
    const trimmedMessage = message.trim();

    // Check if message contains any command
    if (!this.ANY_COMMAND.test(trimmedMessage)) {
      return {
        hasCommand: false,
        plainText: message,
      };
    }

    // Try to match each command type
    for (const [cmdName, pattern] of Object.entries(this.COMMAND_PATTERNS)) {
      const match = trimmedMessage.match(pattern);
      
      if (match) {
        const commandType = this.mapCommandName(cmdName);
        const rawArgs = match[1]?.trim() || '';
        const args = this.parseArguments(rawArgs);

        return {
          hasCommand: true,
          command: {
            type: commandType,
            args,
            rawArgs,
            context: this.extractContext(trimmedMessage),
            originalMessage: message,
          },
          plainText: rawArgs || '', // For commands like /help with no args
        };
      }
    }

    // If we detected a slash but couldn't parse it, return as plain text
    return {
      hasCommand: false,
      plainText: message,
    };
  }

  /**
   * Map command name string to CommandType enum
   */
  private static mapCommandName(name: string): CommandType {
    switch (name.toLowerCase()) {
      case 'fix':
        return CommandType.FIX;
      case 'gen':
      case 'generate':
        return CommandType.GENERATE;
      case 'test':
        return CommandType.TEST;
      case 'refactor':
        return CommandType.REFACTOR;
      case 'explain':
        return CommandType.EXPLAIN;
      case 'scaf':
      case 'scaffold':
        return CommandType.SCAFFOLD;
      case 'help':
        return CommandType.HELP;
      default:
        throw new Error(`Unknown command: ${name}`);
    }
  }

  /**
   * Parse command arguments into an array
   * 
   * Supports:
   * - File paths: /fix src/components/Button.tsx
   * - Quoted strings: /gen "create a login form"
   * - Multiple args: /test src/utils/math.ts --coverage
   */
  private static parseArguments(rawArgs: string): string[] {
    if (!rawArgs) {
      return [];
    }

    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < rawArgs.length; i++) {
      const char = rawArgs[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        // Start quoted string
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        // End quoted string
        inQuotes = false;
        quoteChar = '';
        if (current) {
          args.push(current);
          current = '';
        }
      } else if (char === ' ' && !inQuotes) {
        // Space separator (not in quotes)
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    // Add final argument
    if (current) {
      args.push(current);
    }

    return args;
  }

  /**
   * Extract context from message (text after the command)
   */
  private static extractContext(message: string): string {
    // For now, context is just the arguments
    // In future, we could support multi-line context like:
    // /fix src/file.tsx
    // Here's what I'm trying to do: ...
    return message;
  }

  /**
   * Validate if a command is well-formed
   */
  static validate(command: Command): { valid: boolean; error?: string } {
    switch (command.type) {
      case CommandType.FIX:
        if (command.args.length === 0) {
          return { valid: false, error: 'Fix command requires a file path or description' };
        }
        break;

      case CommandType.GENERATE:
        if (command.args.length === 0) {
          return { valid: false, error: 'Generate command requires a description' };
        }
        break;

      case CommandType.EXPLAIN:
        if (command.args.length === 0) {
          return { valid: false, error: 'Explain command requires a file path or code snippet' };
        }
        break;

      case CommandType.TEST:
        // Test can work with or without args
        break;

      case CommandType.REFACTOR:
        if (command.args.length === 0) {
          return { valid: false, error: 'Refactor command requires a file path or description' };
        }
        break;

      case CommandType.HELP:
        // Help doesn't need args
        break;
    }

    return { valid: true };
  }

  /**
   * Get help text for all commands
   */
  static getHelpText(): string {
    return `
**Available Commands:**

• \`/fix <file or description>\` - Automatically fix errors in a file
  Example: \`/fix src/components/Button.tsx\`
  Example: \`/fix "the login form validation"\`

• \`/gen <description>\` or \`/generate <description>\` - Generate new code
  Example: \`/gen "create a user profile component"\`
  Example: \`/generate api endpoint for user authentication\`

• \`/test [file]\` - Generate or run tests
  Example: \`/test src/utils/math.ts\`
  Example: \`/test\` (runs all tests)

• \`/refactor <file or description>\` - Get refactoring suggestions
  Example: \`/refactor src/services/api.ts\`
  Example: \`/refactor "extract repeated validation logic"\`

• \`/explain <file or code>\` - Explain code functionality
  Example: \`/explain src/hooks/useAuth.ts\`
  Example: \`/explain "how does the caching work?"\`

• \`/help\` - Show this help message

**Pro Tips:**
- Use quotes for multi-word descriptions
- Commands are case-insensitive
- You can add context after the command on new lines
    `.trim();
  }

  /**
   * Format command for display
   */
  static formatCommand(command: Command): string {
    const argsStr = command.args.length > 0 ? command.args.join(' ') : '(no arguments)';
    return `/${command.type} ${argsStr}`;
  }
}

/**
 * Helper function to check if a message contains a command
 */
export function hasCommand(message: string): boolean {
  const parsed = CommandParser.parse(message);
  return parsed.hasCommand;
}

/**
 * Helper function to parse and validate a command
 */
export function parseCommand(message: string): { success: boolean; command?: Command; error?: string } {
  const parsed = CommandParser.parse(message);

  if (!parsed.hasCommand || !parsed.command) {
    return { success: false, error: 'No command found in message' };
  }

  const validation = CommandParser.validate(parsed.command);
  
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return { success: true, command: parsed.command };
}
