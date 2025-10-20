/**
 * Test Command Handler
 * 
 * Generates and runs tests for specified files or entire project.
 */

import { Command } from '../command-parser';
import { ICommandHandler, CommandContext, CommandResult } from './types';

export class TestCommandHandler implements ICommandHandler {
  async execute(command: Command, context: CommandContext): Promise<CommandResult> {
    try {
      const args = command.args;
      const hasFileArg = args.length > 0 && !args[0]?.startsWith('--');
      const hasCoverageFlag = args.some(arg => arg === '--coverage' || arg === '-c');
      const hasWatchFlag = args.some(arg => arg === '--watch' || arg === '-w');

      const action = this.determineTestAction(args);
      const targetFiles = hasFileArg ? args.filter(arg => !arg.startsWith('--')) : [];

      if (action === 'generate') {
        return this.handleTestGeneration(targetFiles, context);
      } else if (action === 'run') {
        return this.handleTestExecution(targetFiles, hasCoverageFlag, hasWatchFlag, context);
      }

      return {
        success: false,
        message: 'Invalid test command',
        error: 'Could not determine test action (generate or run)',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Test command failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  validate(): { valid: boolean; error?: string } {
    // Test command is always valid (works with or without args)
    return { valid: true };
  }

  getHelp(): string {
    return `
Generate or run tests for your code.

**Usage:**
  \`/test\` - Run all tests
  \`/test <file>\` - Generate/run tests for specific file
  \`/test --coverage\` - Run tests with coverage report
  \`/test --watch\` - Run tests in watch mode

**Examples:**
  \`/test\` - Run entire test suite
  \`/test src/utils/math.ts\` - Generate tests for math.ts
  \`/test src/components/Button.tsx\` - Test Button component
  \`/test --coverage\` - Run with coverage
  \`/test src/utils/*.ts --coverage\` - Test utils with coverage

**Test Generation:**
When you specify a file without existing tests:
- Analyzes the file's functions and logic
- Generates comprehensive test cases
- Covers edge cases and error scenarios
- Creates test file with proper structure

**Test Execution:**
When you run tests (with or without file):
- Runs Jest/Vitest test suite
- Shows pass/fail results
- Displays coverage metrics (if --coverage)
- Provides failure details and suggestions

**Flags:**
- \`--coverage\` or \`-c\` - Include coverage report
- \`--watch\` or \`-w\` - Watch mode (continuous testing)
- \`--verbose\` or \`-v\` - Detailed output

**Smart Detection:**
The command automatically determines whether to:
1. Generate tests (if file has no tests)
2. Run tests (if tests exist or no file specified)
    `.trim();
  }

  /**
   * Determine if we should generate or run tests
   */
  private determineTestAction(args: string[]): 'generate' | 'run' {
    // If no file args or only flags, it's a run command
    const fileArgs = args.filter(arg => !arg.startsWith('--'));
    
    if (fileArgs.length === 0) {
      return 'run';
    }

    // If file path looks like source code (not a test file), generate
    const firstFile = fileArgs[0];
    if (firstFile && !firstFile.includes('.test.') && !firstFile.includes('.spec.')) {
      return 'generate';
    }

    return 'run';
  }

  /**
   * Handle test generation
   */
  private async handleTestGeneration(
    targetFiles: string[],
    context: CommandContext
  ): Promise<CommandResult> {
    if (targetFiles.length === 0) {
      return {
        success: false,
        message: 'Test generation requires a file',
        error: 'Please specify which file to generate tests for',
      };
    }

    const plan = this.createGenerationPlan(targetFiles);

    return {
      success: true,
      message: 'Test generation started',
      data: {
        action: 'generate',
        targetFiles,
        projectId: context.projectId,
        plan,
      },
      changes: targetFiles.map(file => ({
        filePath: this.getTestFilePath(file),
        newContent: this.generatePlaceholderTest(file),
        description: `Generate tests for ${file}`,
      })),
      actions: [
        {
          type: 'accept',
          label: 'Generate Tests',
          description: 'Create comprehensive test suite',
          handler: async () => {
            console.log('Generating tests for:', targetFiles);
          },
        },
        {
          type: 'modify',
          label: 'Customize',
          description: 'Add specific test scenarios',
          handler: async () => {
            console.log('Customize test generation');
          },
        },
        {
          type: 'reject',
          label: 'Cancel',
          description: 'Cancel test generation',
          handler: async () => {
            console.log('Test generation cancelled');
          },
        },
      ],
    };
  }

  /**
   * Handle test execution
   */
  private async handleTestExecution(
    targetFiles: string[],
    coverage: boolean,
    watch: boolean,
    context: CommandContext
  ): Promise<CommandResult> {
    const scope = targetFiles.length > 0 
      ? `for ${targetFiles.join(', ')}`
      : 'for entire project';

    const flags = [
      coverage && 'coverage',
      watch && 'watch mode',
    ].filter(Boolean);

    const flagsStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';

    return {
      success: true,
      message: `Running tests ${scope}${flagsStr}`,
      data: {
        action: 'run',
        targetFiles,
        coverage,
        watch,
        projectId: context.projectId,
        command: this.buildTestCommand(targetFiles, coverage, watch),
      },
      actions: [
        {
          type: 'view',
          label: 'View Results',
          description: 'See detailed test results',
          handler: async () => {
            console.log('Viewing test results');
          },
        },
      ],
    };
  }

  /**
   * Get test file path from source file
   */
  private getTestFilePath(sourceFile: string): string {
    // Remove extension
    const withoutExt = sourceFile.replace(/\.(ts|tsx|js|jsx)$/, '');
    
    // If in src/, create test in __tests__
    if (sourceFile.startsWith('src/')) {
      const relativePath = sourceFile.substring(4); // Remove 'src/'
      const withoutExtRel = relativePath.replace(/\.(ts|tsx|js|jsx)$/, '');
      return `src/__tests__/${withoutExtRel}.test.ts`;
    }
    
    // Otherwise, add .test before extension
    return `${withoutExt}.test.ts`;
  }

  /**
   * Generate placeholder test content
   */
  private generatePlaceholderTest(sourceFile: string): string {
    const fileName = sourceFile.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') || 'module';
    
    return `// AI-generated tests will be created here
// Source: ${sourceFile}

import { describe, it, expect } from '@jest/globals';
// import { functionToTest } from '${sourceFile}';

describe('${fileName}', () => {
  it('should be tested', () => {
    expect(true).toBe(true);
  });

  // Additional test cases will be generated based on:
  // - Function signatures and logic
  // - Edge cases and error scenarios
  // - Integration points
  // - Performance considerations
});
`;
  }

  /**
   * Create test generation plan
   */
  private createGenerationPlan(files: string[]): string {
    return `
**Test Generation Plan**

**Target Files:**
${files.map(f => `- ${f}`).join('\n')}

**AI will generate:**
1. 🧪 Comprehensive test suite
2. ✅ Unit tests for all functions
3. 🔍 Edge case coverage
4. ❌ Error scenario tests
5. 📊 Type safety tests
6. 🔗 Integration tests (if applicable)

**Test Structure:**
- Descriptive test names
- Arrange-Act-Assert pattern
- Proper mocking and fixtures
- Performance benchmarks (if needed)
    `.trim();
  }

  /**
   * Build test execution command
   */
  private buildTestCommand(files: string[], coverage: boolean, watch: boolean): string {
    const parts = ['npm test'];
    
    if (files.length > 0) {
      parts.push(`-- ${files.join(' ')}`);
    }
    
    if (coverage) {
      parts.push('--coverage');
    }
    
    if (watch) {
      parts.push('--watch');
    }
    
    return parts.join(' ');
  }
}
