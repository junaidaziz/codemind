/**
 * Help Command Handler
 * 
 * Displays available commands and usage instructions.
 */

import { Command, CommandType } from '../command-parser';
import { ICommandHandler, CommandResult } from './types';
import { getCommandRegistry } from './registry';

export class HelpCommandHandler implements ICommandHandler {
  async execute(command: Command): Promise<CommandResult> {
    const registry = getCommandRegistry();
    
    // If specific command requested, show its help
    if (command.args.length > 0) {
      const cmdName = command.args[0].toLowerCase().replace('/', '');
      
      // Try to match the command name to a CommandType
      const commandTypes = Object.values(CommandType);
      const matchedType = commandTypes.find((type: string) => type === cmdName);
      
      if (matchedType) {
        const handler = registry.getHandler(matchedType as CommandType);
        
        if (handler) {
          return {
            success: true,
            message: `Help for /${cmdName}`,
            data: {
              commandHelp: handler.getHelp(),
            },
          };
        }
      }
      
      return {
        success: false,
        message: `Unknown command: /${cmdName}`,
        error: `Command /${cmdName} is not registered`,
      };
    }

    // Show help for all commands
    const helpText = this.getFullHelpText();
    
    return {
      success: true,
      message: 'Command Help',
      data: {
        helpText,
      },
    };
  }

  validate(): { valid: boolean; error?: string } {
    // Help command is always valid
    return { valid: true };
  }

  getHelp(): string {
    return `
Shows help for available commands.

**Usage:**
  \`/help\` - Show all available commands
  \`/help <command>\` - Show help for a specific command

**Examples:**
  \`/help\` - Show all commands
  \`/help fix\` - Show help for /fix command
  \`/help gen\` - Show help for /gen command
    `.trim();
  }

  private getFullHelpText(): string {
    return `
# Developer Command Console

Welcome to the CodeMind command console! You can use slash commands to perform common development tasks.

## Available Commands

### \`/fix <file or description>\`
Automatically fix errors, bugs, or issues in your code.

**Examples:**
- \`/fix src/components/Button.tsx\` - Fix errors in specific file
- \`/fix "the login form validation"\` - Fix specific functionality
- \`/fix\` - Fix errors in current context

### \`/gen <description>\` or \`/generate <description>\`
Generate new code based on your description.

**Examples:**
- \`/gen "create a user profile component"\`
- \`/generate api endpoint for authentication\`
- \`/gen tests for math utils\`

### \`/test [file]\`
Generate or run tests for your code.

**Examples:**
- \`/test src/utils/math.ts\` - Test specific file
- \`/test\` - Run all tests in project
- \`/test --coverage\` - Run tests with coverage

### \`/refactor <file or description>\`
Get intelligent refactoring suggestions.

**Examples:**
- \`/refactor src/services/api.ts\`
- \`/refactor "extract repeated validation logic"\`
- \`/refactor utils\` - Refactor entire directory

### \`/explain <file or code>\`
Get explanations of how code works.

**Examples:**
- \`/explain src/hooks/useAuth.ts\`
- \`/explain "how does caching work?"\`
- \`/explain this.complexFunction\`

## Tips

- **Use quotes** for multi-word descriptions: \`/gen "user login form"\`
- **Commands are case-insensitive**: \`/FIX\` = \`/fix\`
- **Add context** by typing more after the command
- **View history** with up/down arrow keys

## Getting Started

1. Try \`/help fix\` to learn about the fix command
2. Use \`/gen\` to create new code quickly
3. Run \`/test\` to generate or run tests
4. Ask \`/explain\` to understand complex code

Need more help? Just ask me in natural language!
    `.trim();
  }
}
