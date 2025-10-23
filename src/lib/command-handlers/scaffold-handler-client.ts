/**
 * Scaffold Command Handler (Client-Side)
 * 
 * Client-side wrapper for the scaffold command that delegates to the API.
 */

import { Command } from '../command-parser';
import { ICommandHandler, CommandContext, CommandResult } from './types';

export class ScaffoldCommandHandlerClient implements ICommandHandler {
  async execute(command: Command, context: CommandContext): Promise<CommandResult> {
    try {
      const description = command.rawArgs;

      if (!description) {
        return {
          success: false,
          message: 'Scaffold command requires a description',
          error: 'Please describe what you want to scaffold',
        };
      }

      if (!context.projectId) {
        return {
          success: false,
          message: 'No project selected',
          error: 'Please select a project from the dropdown before using the scaffold command',
        };
      }

      if (!context.workspacePath) {
        return {
          success: false,
          message: 'Workspace path not configured',
          error: 'The selected project does not have a workspace path configured.\n\n' +
                 '**To fix this:**\n' +
                 '1. Make sure your project has a GitHub URL configured\n' +
                 '2. Contact your administrator to set up workspace paths\n' +
                 '3. For now, the scaffold command requires a local workspace',
        };
      }

      // Call the scaffold API
      const response = await fetch('/api/scaffold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description,
          projectId: context.projectId,
          workspacePath: context.workspacePath,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          message: 'Scaffold command failed',
          error: error.error || error.details || 'Unknown error',
        };
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error executing scaffold command:', error);
      
      return {
        success: false,
        message: 'Failed to execute scaffold command',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  validate(command: Command): { valid: boolean; error?: string } {
    if (!command.rawArgs || command.rawArgs.trim() === '') {
      return {
        valid: false,
        error: 'Scaffold command requires a description of what to generate',
      };
    }

    return { valid: true };
  }

  getHelp(): string {
    return `
**Scaffold Command**

Generate production-ready code that matches your project's conventions.

**Usage:**
\`\`\`
/scaffold <description>
/scaf <description>
\`\`\`

**Examples:**
\`\`\`
/scaffold create UserProfile component with avatar
/scaffold add GET and POST endpoints for /api/posts
/scaffold create Product model with Category relation
/scaffold generate useAuth hook for authentication
\`\`\`

**Features:**
- Analyzes your codebase conventions
- Generates multiple files when needed
- Adds TypeScript types automatically
- Includes tests (when applicable)
- Follows your naming patterns

**What Gets Generated:**
✅ Main files (components, routes, models)
✅ Type definitions (TypeScript)
✅ Tests (Jest, Vitest)
✅ Styles (CSS, Tailwind)
✅ Dependencies (imports, relations)
`;
  }
}
