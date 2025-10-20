/**
 * Generate Command Handler
 * 
 * Generates new code based on natural language descriptions.
 * Uses AI chat to create components, functions, tests, etc.
 */

import { Command } from '../command-parser';
import { ICommandHandler, CommandContext, CommandResult, CodeChange } from './types';

export class GenerateCommandHandler implements ICommandHandler {
  async execute(command: Command, context: CommandContext): Promise<CommandResult> {
    try {
      const description = command.rawArgs;

      if (!description) {
        return {
          success: false,
          message: 'Generate command requires a description',
          error: 'Please describe what you want to generate',
        };
      }

      // Parse generation request to determine what to create
      const generationType = this.detectGenerationType(description);
      const plan = this.createGenerationPlan(description, generationType);

      return {
        success: true,
        message: 'Code generation started',
        data: {
          description,
          generationType,
          plan,
          projectId: context.projectId,
        },
        changes: this.generatePlaceholderCode(description, generationType),
        actions: [
          {
            type: 'accept',
            label: 'Generate Code',
            description: 'Create the code as described',
            handler: async () => {
              // Will integrate with AI chat/generation service
              console.log('Generating code for:', description);
            },
          },
          {
            type: 'modify',
            label: 'Refine Request',
            description: 'Add more details to the request',
            handler: async () => {
              console.log('Modify request:', description);
            },
          },
          {
            type: 'reject',
            label: 'Cancel',
            description: 'Cancel code generation',
            handler: async () => {
              console.log('Generation cancelled');
            },
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        message: 'Generate command failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  validate(command: Command): { valid: boolean; error?: string } {
    if (command.args.length === 0) {
      return { 
        valid: false, 
        error: 'Generate command requires a description.\nExample: /gen "create a user login form"\nExample: /gen api endpoint for authentication' 
      };
    }
    return { valid: true };
  }

  getHelp(): string {
    return `
Generate new code based on your natural language description.

**Usage:**
  \`/gen "<description>"\` - Generate code from description
  \`/generate <description>\` - Alternative syntax

**Examples:**
  \`/gen "create a user profile component with avatar and bio"\`
  \`/gen api endpoint for user authentication with JWT\`
  \`/gen utility function to format currency\`
  \`/gen tests for the calculator module\`
  \`/gen React hook for form validation\`

**What you can generate:**
- **Components** - UI components with props and styling
- **API Endpoints** - REST or GraphQL endpoints
- **Functions/Utilities** - Helper functions and utilities
- **Tests** - Unit tests, integration tests
- **Hooks** - Custom React hooks
- **Types/Interfaces** - TypeScript types and interfaces
- **Database Models** - Prisma schemas, migrations

**How it works:**
1. AI analyzes your description
2. Determines file structure and patterns
3. Generates complete, working code
4. Provides preview with Accept/Reject options
5. Integrates with your project structure

**Tips:**
- Be specific about functionality and requirements
- Mention technologies/libraries to use
- Include examples of similar existing code
- Specify file location if needed
    `.trim();
  }

  /**
   * Detect what type of code to generate
   */
  private detectGenerationType(description: string): string {
    const lower = description.toLowerCase();

    if (lower.includes('component') || lower.includes('ui') || lower.includes('form')) {
      return 'component';
    }
    if (lower.includes('api') || lower.includes('endpoint') || lower.includes('route')) {
      return 'api';
    }
    if (lower.includes('test') || lower.includes('spec')) {
      return 'test';
    }
    if (lower.includes('hook') && (lower.includes('use') || lower.includes('react'))) {
      return 'hook';
    }
    if (lower.includes('util') || lower.includes('helper') || lower.includes('function')) {
      return 'utility';
    }
    if (lower.includes('type') || lower.includes('interface') || lower.includes('schema')) {
      return 'type';
    }
    if (lower.includes('model') || lower.includes('database') || lower.includes('prisma')) {
      return 'model';
    }

    return 'general';
  }

  /**
   * Create generation plan
   */
  private createGenerationPlan(description: string, type: string): string {
    const typeDescriptions: Record<string, string> = {
      component: 'React component with props, state, and styling',
      api: 'API endpoint with request handling and validation',
      test: 'Test suite with comprehensive test cases',
      hook: 'Custom React hook with proper TypeScript types',
      utility: 'Utility function with documentation and examples',
      type: 'TypeScript types/interfaces with JSDoc comments',
      model: 'Database model with Prisma schema',
      general: 'Code implementation based on description',
    };

    return `
**Code Generation Plan**

**Description:** ${description}
**Type:** ${typeDescriptions[type] || 'General code'}

**AI will generate:**
1. 📄 Complete file(s) with proper structure
2. 📝 Documentation and comments
3. 🎨 Proper styling and formatting
4. ✅ Type-safe code (TypeScript)
5. 🧪 Example usage if applicable

The generated code will follow your project's conventions and best practices.
    `.trim();
  }

  /**
   * Generate placeholder code for preview
   */
  private generatePlaceholderCode(description: string, type: string): CodeChange[] {
    const fileName = this.suggestFileName(description, type);
    
    return [{
      filePath: fileName,
      newContent: this.getPlaceholderContent(description, type),
      description: `Generated: ${description}`,
    }];
  }

  /**
   * Suggest file name based on description and type
   */
  private suggestFileName(description: string, type: string): string {
    // Extract potential name from description
    const words = description.toLowerCase().split(' ').filter(w => w.length > 2);
    const name = words
      .filter(w => !['the', 'and', 'for', 'with', 'that', 'this'].includes(w))
      .slice(0, 3)
      .join('-');

    const baseName = name || 'generated';

    switch (type) {
      case 'component':
        return `src/components/${this.toPascalCase(baseName)}.tsx`;
      case 'api':
        return `src/app/api/${baseName}/route.ts`;
      case 'test':
        return `src/__tests__/${baseName}.test.ts`;
      case 'hook':
        return `src/hooks/use${this.toPascalCase(baseName)}.ts`;
      case 'utility':
        return `src/lib/${baseName}.ts`;
      case 'type':
        return `src/types/${baseName}.ts`;
      case 'model':
        return `prisma/schema.prisma`;
      default:
        return `src/${baseName}.ts`;
    }
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  /**
   * Get placeholder content based on type
   */
  private getPlaceholderContent(description: string, type: string): string {
    switch (type) {
      case 'component':
        return `// AI-generated React component will be created here
// Based on: ${description}

export default function Component() {
  return (
    <div>
      {/* Component implementation */}
    </div>
  );
}`;
      case 'api':
        return `// AI-generated API endpoint will be created here
// Based on: ${description}

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // API implementation
  return NextResponse.json({ success: true });
}`;
      case 'test':
        return `// AI-generated test suite will be created here
// Based on: ${description}

describe('Generated Tests', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});`;
      default:
        return `// AI-generated code will be created here
// Based on: ${description}

// Implementation will follow best practices and project conventions
`;
    }
  }
}
