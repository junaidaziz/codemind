/**
 * Fix Command Handler
 * 
 * Triggers auto-fix for errors in specified files or descriptions.
 * Integrates with autonomous PR orchestrator.
 */

import { Command } from '../command-parser';
import { ICommandHandler, CommandContext, CommandResult, CodeChange } from './types';
import prisma from '@/lib/db';

export class FixCommandHandler implements ICommandHandler {
  async execute(command: Command, context: CommandContext): Promise<CommandResult> {
    try {
      if (!context.projectId) {
        return {
          success: false,
          message: 'Project context required',
          error: 'Please specify a project to run fix command',
        };
      }

      // Parse the fix request
      const { filePaths, issueDescription } = this.parseFixCommand(command);

      // Get project details
      const project = await prisma.project.findUnique({
        where: { id: context.projectId },
        select: { id: true, name: true, githubUrl: true, defaultBranch: true },
      });

      if (!project) {
        return {
          success: false,
          message: 'Project not found',
          error: `Project ${context.projectId} not found`,
        };
      }

      // Start auto-fix session (will be implemented in Phase 4)
      // For now, return a structured response indicating what would be done
      
      const sessionMessage = this.createFixPlan(issueDescription, filePaths, project.name);

      return {
        success: true,
        message: 'Fix analysis started',
        data: {
          projectId: context.projectId,
          projectName: project.name,
          issueDescription,
          targetFiles: filePaths,
          plan: sessionMessage,
          // Will add sessionId once integrated with APR
        },
        changes: this.generatePlaceholderChanges(filePaths, issueDescription),
        actions: [
          {
            type: 'accept',
            label: 'Start Auto-Fix',
            description: 'Analyze and fix the issues',
            handler: async () => {
              // Will integrate with APR orchestrator
              console.log('Starting auto-fix for:', issueDescription);
            },
          },
          {
            type: 'reject',
            label: 'Cancel',
            description: 'Cancel the fix operation',
            handler: async () => {
              console.log('Fix cancelled');
            },
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        message: 'Fix command failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  validate(command: Command): { valid: boolean; error?: string } {
    if (command.args.length === 0) {
      return { 
        valid: false, 
        error: 'Fix command requires a file path or issue description.\nExample: /fix src/components/Button.tsx\nExample: /fix "login validation errors"' 
      };
    }
    return { valid: true };
  }

  getHelp(): string {
    return `
Automatically fix errors, bugs, or issues in your code.

**Usage:**
  \`/fix <file path>\` - Fix errors in a specific file
  \`/fix "<description>"\` - Fix issues matching description
  \`/fix\` - Fix errors in current context (requires context)

**Examples:**
  \`/fix src/components/Button.tsx\` - Fix all errors in Button.tsx
  \`/fix "the login form validation"\` - Fix specific functionality
  \`/fix src/utils/*.ts\` - Fix all TypeScript files in utils directory

**How it works:**
1. Analyzes the specified files or issue description
2. Uses AI to generate code fixes
3. Runs validation (lint, typecheck, tests)
4. Creates a pull request with the fixes
5. Provides preview and Accept/Reject options

**Options:**
- File paths can be absolute or relative to project root
- Use quotes for multi-word descriptions
- Supports wildcards in file patterns
    `.trim();
  }

  /**
   * Parse fix command to extract file paths and issue description
   */
  private parseFixCommand(command: Command): { 
    filePaths: string[]; 
    issueDescription: string;
  } {
    const args = command.args;
    const filePaths: string[] = [];
    const descriptionParts: string[] = [];

    for (const arg of args) {
      // Check if it looks like a file path
      if (this.looksLikeFilePath(arg)) {
        filePaths.push(arg);
      } else {
        descriptionParts.push(arg);
      }
    }

    // If no file paths and all args are description, treat first arg as potential file
    if (filePaths.length === 0 && args.length > 0 && !descriptionParts.join(' ').includes(' ')) {
      const firstArg = args[0];
      if (firstArg) {
        // Could be a file without extension or a simple error name
        if (firstArg.includes('/') || firstArg.includes('.')) {
          filePaths.push(firstArg);
        } else {
          descriptionParts.push(firstArg);
        }
      }
    }

    const issueDescription = descriptionParts.length > 0 
      ? descriptionParts.join(' ')
      : filePaths.length > 0
        ? `Fix errors in: ${filePaths.join(', ')}`
        : 'Fix all detected errors';

    return { filePaths, issueDescription };
  }

  /**
   * Check if a string looks like a file path
   */
  private looksLikeFilePath(str: string): boolean {
    // Common file patterns
    return (
      str.includes('/') ||
      str.includes('.') && (
        str.endsWith('.ts') ||
        str.endsWith('.tsx') ||
        str.endsWith('.js') ||
        str.endsWith('.jsx') ||
        str.endsWith('.py') ||
        str.endsWith('.java') ||
        str.endsWith('.go') ||
        str.endsWith('.rs') ||
        str.startsWith('src/') ||
        str.startsWith('lib/') ||
        str.startsWith('app/')
      )
    );
  }

  /**
   * Create a fix plan message
   */
  private createFixPlan(
    issueDescription: string, 
    filePaths: string[], 
    projectName: string
  ): string {
    const fileList = filePaths.length > 0 
      ? `\n**Target Files:**\n${filePaths.map(f => `- ${f}`).join('\n')}`
      : '';

    return `
**Auto-Fix Plan**

**Project:** ${projectName}
**Issue:** ${issueDescription}${fileList}

**Steps:**
1. 🔍 Analyze code and identify root cause
2. 🛠️ Generate fix with AI assistance
3. ✅ Validate with linting and tests
4. 🔄 Self-heal if validation fails
5. 📝 Create pull request with changes

Click **Start Auto-Fix** to begin the automated repair process.
    `.trim();
  }

  /**
   * Generate placeholder changes for preview
   */
  private generatePlaceholderChanges(
    filePaths: string[], 
    issueDescription: string
  ): CodeChange[] {
    if (filePaths.length === 0) {
      return [];
    }

    return filePaths.slice(0, 3).map((filePath) => ({
      filePath,
      newContent: '// AI-generated fix will appear here after analysis',
      description: `Fix for: ${issueDescription}`,
    }));
  }
}
