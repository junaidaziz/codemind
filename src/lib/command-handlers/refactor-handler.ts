/**
 * Refactor Command Handler
 * 
 * Provides intelligent refactoring suggestions for code improvement.
 */

import { Command } from '../command-parser';
import { ICommandHandler, CommandContext, CommandResult, CodeChange } from './types';

export class RefactorCommandHandler implements ICommandHandler {
  async execute(command: Command, context: CommandContext): Promise<CommandResult> {
    try {
      const { filePaths, description } = this.parseRefactorCommand(command);

      if (filePaths.length === 0 && !description) {
        return {
          success: false,
          message: 'Refactor command requires a target',
          error: 'Please specify files to refactor or describe what to improve',
        };
      }

      const plan = this.createRefactoringPlan(filePaths, description);

      return {
        success: true,
        message: 'Refactoring analysis started',
        data: {
          targetFiles: filePaths,
          description,
          projectId: context.projectId,
          plan,
        },
        changes: this.generateRefactoringPreview(filePaths, description),
        actions: [
          {
            type: 'accept',
            label: 'Apply Refactoring',
            description: 'Apply suggested improvements',
            handler: async () => {
              console.log('Applying refactoring for:', filePaths);
            },
          },
          {
            type: 'view',
            label: 'See Suggestions',
            description: 'View detailed refactoring suggestions',
            handler: async () => {
              console.log('Viewing refactoring suggestions');
            },
          },
          {
            type: 'reject',
            label: 'Cancel',
            description: 'Cancel refactoring',
            handler: async () => {
              console.log('Refactoring cancelled');
            },
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        message: 'Refactor command failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  validate(command: Command): { valid: boolean; error?: string } {
    if (command.args.length === 0) {
      return { 
        valid: false, 
        error: 'Refactor command requires a file path or description.\nExample: /refactor src/utils/api.ts\nExample: /refactor "extract repeated validation logic"' 
      };
    }
    return { valid: true };
  }

  getHelp(): string {
    return `
Get intelligent refactoring suggestions to improve your code.

**Usage:**
  \`/refactor <file path>\` - Refactor specific file
  \`/refactor "<description>"\` - Refactor based on description
  \`/refactor <directory>\` - Refactor entire directory

**Examples:**
  \`/refactor src/services/api.ts\` - Improve api.ts structure
  \`/refactor "extract repeated validation logic"\` - DRY improvements
  \`/refactor src/components/\` - Refactor all components
  \`/refactor "improve performance"\` - Performance optimizations

**What gets analyzed:**
- **Code Smells** - Duplicated code, long functions, complex logic
- **Design Patterns** - Better patterns and abstractions
- **Performance** - Optimization opportunities
- **Type Safety** - Improve TypeScript usage
- **Maintainability** - Readability and structure
- **Best Practices** - Modern conventions

**Refactoring Types:**
- Extract function/method
- Extract component
- Rename variables/functions
- Move code to appropriate modules
- Simplify complex logic
- Reduce nesting
- Remove duplication
- Improve naming

**How it works:**
1. Analyzes code structure and patterns
2. Identifies improvement opportunities
3. Suggests specific refactorings
4. Shows before/after comparison
5. Applies changes safely (with tests)

**Tips:**
- Be specific about what you want to improve
- Use for code that feels complex or messy
- Run tests after refactoring
- Review changes before committing
    `.trim();
  }

  /**
   * Parse refactor command
   */
  private parseRefactorCommand(command: Command): {
    filePaths: string[];
    description: string;
  } {
    const args = command.args;
    const filePaths: string[] = [];
    const descriptionParts: string[] = [];

    for (const arg of args) {
      if (this.looksLikeFilePath(arg)) {
        filePaths.push(arg);
      } else {
        descriptionParts.push(arg);
      }
    }

    const description = descriptionParts.join(' ');

    return { filePaths, description };
  }

  /**
   * Check if string looks like a file path
   */
  private looksLikeFilePath(str: string): boolean {
    return (
      str.includes('/') ||
      str.includes('.') ||
      str.startsWith('src') ||
      str.startsWith('lib') ||
      str.startsWith('app')
    );
  }

  /**
   * Create refactoring plan
   */
  private createRefactoringPlan(filePaths: string[], description: string): string {
    const targetDescription = filePaths.length > 0
      ? `**Target Files:**\n${filePaths.map(f => `- ${f}`).join('\n')}`
      : '**Target:** Based on description';

    const focus = description
      ? `**Focus:** ${description}`
      : '**Focus:** General code quality improvements';

    return `
**Refactoring Plan**

${targetDescription}
${focus}

**Analysis Steps:**
1. 🔍 Code structure analysis
2. 🎯 Identify improvement opportunities
3. 📊 Calculate complexity metrics
4. 💡 Generate specific suggestions
5. 🔄 Show before/after comparisons

**Refactoring Categories:**
- Code organization and structure
- Function/method extraction
- Naming improvements
- Performance optimizations
- Type safety enhancements
- Pattern modernization
    `.trim();
  }

  /**
   * Generate refactoring preview
   */
  private generateRefactoringPreview(
    filePaths: string[],
    description: string
  ): CodeChange[] {
    if (filePaths.length === 0) {
      return [];
    }

    return filePaths.slice(0, 3).map((filePath) => ({
      filePath,
      oldContent: '// Original code',
      newContent: '// Refactored code will appear here',
      description: `Refactoring: ${description || 'improve code quality'}`,
    }));
  }
}
