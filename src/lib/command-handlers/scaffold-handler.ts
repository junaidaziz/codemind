/**
 * Scaffold Command Handler
 * 
 * Generates code scaffolds using the Smart Scaffolder system.
 * Uses AI-powered analysis to understand project conventions and generate
 * contextually appropriate code structures.
 * 
 * @server-only This module uses Node.js fs APIs and should only run on the server
 */

import { Command } from '../command-parser';
import { ICommandHandler, CommandContext, CommandResult, CodeChange } from './types';
import { PromptParser } from '../scaffolding/PromptParser';
import { ConventionAnalyzer } from '../scaffolding/ConventionAnalyzer';
import { TemplateEngine } from '../scaffolding/TemplateEngine';
import { registerAllTemplates } from '../scaffolding/templates';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ScaffoldCommandHandler implements ICommandHandler {
  private promptParser: PromptParser;
  private conventionAnalyzer: ConventionAnalyzer;
  private templateEngine: TemplateEngine;

  constructor() {
    this.promptParser = new PromptParser();
    this.conventionAnalyzer = new ConventionAnalyzer();
    this.templateEngine = new TemplateEngine();
    
    // Register all production templates
    registerAllTemplates(this.templateEngine);
  }

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
          message: 'Project ID is required',
          error: 'Please select a project before using the scaffold command',
        };
      }

      if (!context.workspacePath) {
        return {
          success: false,
          message: 'Workspace path not configured',
          error: 'This project does not have a workspace path configured. Please:\n' +
                 '1. Ensure your project has a GitHub URL set\n' +
                 '2. The system will attempt to derive the workspace path\n' +
                 '3. For production use, configure workspace paths in project settings',
          data: {
            projectId: context.projectId,
            suggestion: 'Configure workspace path in project settings or ensure GitHub URL is set'
          }
        };
      }

      // Step 1: Parse the natural language prompt
      const parsedIntent = await this.promptParser.parse(description);

      if (parsedIntent.confidence < 0.5) {
        return {
          success: false,
          message: 'Unable to understand the scaffold request',
          error: `Could not parse: ${description}\n\nAmbiguities: ${parsedIntent.ambiguities.join(', ')}`,
        };
      }

      // Step 2: Analyze project conventions
      const conventions = await this.conventionAnalyzer.analyzeProject(context.projectId);

      // Step 3: Match templates
      const matchedTemplates = this.promptParser.matchTemplates(parsedIntent);

      if (matchedTemplates.length === 0) {
        return {
          success: false,
          message: 'No suitable templates found',
          error: `Could not find templates for: ${parsedIntent.intent}`,
        };
      }

      // Step 4: Extract variables for template rendering
      const variables = this.promptParser.extractVariables(parsedIntent);

      // Step 5: Generate code using template engine
      const generatedFiles: CodeChange[] = [];
      
      for (let i = 0; i < matchedTemplates.length; i++) {
        const templateId = matchedTemplates[i];
        
        const template = this.templateEngine.getTemplate(templateId);
        if (!template) continue;

        try {
          const templateContext = {
            variables,
            conventions,
            projectId: context.projectId,
            template,
            parsedIntent,
          };
          
          const generatedFileObjects = await this.templateEngine.generate(
            template,
            templateContext
          );

          // Convert GeneratedFile objects to CodeChange objects
          for (const genFile of generatedFileObjects) {
            // Check if file already exists
            let oldContent: string | undefined;
            try {
              const fullPath = path.join(context.workspacePath, genFile.path);
              oldContent = await fs.readFile(fullPath, 'utf-8');
            } catch {
              // File doesn't exist, that's okay
              oldContent = undefined;
            }

            generatedFiles.push({
              filePath: genFile.path,
              oldContent,
              newContent: genFile.content,
              description: `Generated from template: ${template.name}`,
            });
          }
        } catch (error) {
          console.error(`Error generating code for template ${templateId}:`, error);
        }
      }

      if (generatedFiles.length === 0) {
        return {
          success: false,
          message: 'Code generation failed',
          error: 'Unable to generate any files',
        };
      }

      // Get primary entity name for messaging
      const entityName = parsedIntent.entities[0]?.name || 'code';

      return {
        success: true,
        message: `Generated ${generatedFiles.length} file(s) for ${entityName}`,
        data: {
          intent: parsedIntent,
          conventions,
          templates: matchedTemplates,
          variables,
          confidence: parsedIntent.confidence,
        },
        changes: generatedFiles,
        actions: [
          {
            type: 'accept',
            label: 'Apply Changes',
            description: `Create ${generatedFiles.length} file(s)`,
            handler: async () => {
              await this.applyChanges(generatedFiles, context.workspacePath!);
            },
          },
          {
            type: 'modify',
            label: 'Refine Request',
            description: 'Adjust the scaffold request',
            handler: async () => {
              console.log('Modify scaffold request:', description);
            },
          },
          {
            type: 'view',
            label: 'Preview Files',
            description: 'View generated code before applying',
            handler: async () => {
              console.log('Preview:', generatedFiles);
            },
          },
          {
            type: 'reject',
            label: 'Cancel',
            description: 'Discard generated code',
            handler: async () => {
              console.log('Scaffold cancelled');
            },
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        message: 'Scaffold command failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  validate(command: Command): { valid: boolean; error?: string } {
    if (command.args.length === 0) {
      return {
        valid: false,
        error: 'Scaffold command requires a description.\nExample: /scaffold "create a user authentication service"\nExample: /scaffold component UserProfile with avatar',
      };
    }
    return { valid: true };
  }

  getHelp(): string {
    return `
Scaffold new code using AI-powered convention analysis and template generation.

**Usage:**
  \`/scaffold "<description>"\` - Generate code scaffold from description
  \`/scaf <description>\` - Short alias

**Examples:**
  \`/scaffold "create a user authentication service"\`
  \`/scaffold component UserProfile with avatar and bio\`
  \`/scaffold api endpoint for user management\`
  \`/scaffold React hook for form validation\`
  \`/scaffold database model for Product with price and inventory\`

**How Smart Scaffolder works:**
1. 🧠 **Analyzes your prompt** - Understands intent, entities, and context
2. 📊 **Scans project conventions** - Learns your folder structure, naming patterns, and coding style
3. 🎯 **Matches templates** - Selects appropriate templates based on your project type
4. 🔧 **Generates context-aware code** - Creates code that follows YOUR conventions
5. 👀 **Provides preview** - Shows you exactly what will be created

**What makes it smart:**
- **Convention-aware** - Adapts to your project's structure (React, Next.js, Express, etc.)
- **Context-sensitive** - Understands relationships between entities
- **Multi-file generation** - Creates complete features with all necessary files
- **Configurable** - Respects your ESLint, Prettier, and project settings
- **Safe** - Shows preview with Accept/Reject options

**Supported scaffolds:**
- **Components** - React/Vue components with props and styling
- **Services** - Business logic with dependency injection
- **API Endpoints** - REST/GraphQL with validation
- **Database Models** - Prisma schemas with relations
- **Hooks** - Custom React hooks with TypeScript
- **Tests** - Jest/Vitest test suites
- **Utilities** - Helper functions and utilities
- **Full Features** - Complete modules with all files

**Advanced features:**
- Infers file paths from your project structure
- Detects and uses your naming conventions (camelCase, PascalCase, kebab-case)
- Generates proper imports based on your module system
- Includes TypeScript types automatically
- Creates test files alongside implementation
- Supports template variables and conditionals

**Tips:**
- Be specific: "UserProfile component with avatar, name, and bio fields"
- Mention technologies: "Express API endpoint with Joi validation"
- Reference existing patterns: "similar to existing PostService"
- Include relationships: "Product model with Category relation"
    `.trim();
  }

  /**
   * Apply generated code changes to the file system
   */
  private async applyChanges(changes: CodeChange[], workspacePath: string): Promise<void> {
    for (const change of changes) {
      const fullPath = path.join(workspacePath, change.filePath);
      const directory = path.dirname(fullPath);

      // Create directory if it doesn't exist
      await fs.mkdir(directory, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, change.newContent, 'utf-8');

      console.log(`✅ Created: ${change.filePath}`);
    }
  }
}
