/**
 * TemplateEngine
 * 
 * Renders templates with variables, applies conventions, and manages
 * the template registry. Supports conditional rendering and multi-file templates.
 */

import type {
  Template,
  TemplateContext,
  GeneratedFile,
  ParsedIntent,
  ProjectConventions,
  TemplateCategory,
} from './types';

export class TemplateEngine {
  private templates: Map<string, Template>;

  constructor() {
    this.templates = new Map();
    this.initializeBaseTemplates();
  }

  /**
   * Select the best template for a given intent and conventions
   */
  async selectTemplate(
    intent: ParsedIntent,
    conventions: ProjectConventions
  ): Promise<Template | null> {
    // Try to find template by intent
    const category = this.intentToCategory(intent.intent);
    const entityType = intent.entities[0]?.type;

    // Look for matching templates
    const candidates = Array.from(this.templates.values()).filter(t => {
      // Match category
      if (t.category !== category && category !== 'full-module') return false;
      
      // Match framework if specified
      if (t.framework && t.framework !== conventions.framework.name) return false;
      
      return true;
    });

    // Return the first match (could be improved with scoring)
    return candidates[0] || null;
  }

  /**
   * Generate files from a template
   */
  async generate(
    template: Template,
    context: TemplateContext
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Process each template file
    for (const templateFile of template.files) {
      // Check if file is conditional
      if (templateFile.optional && templateFile.condition) {
        const shouldGenerate = context.variables[templateFile.condition];
        if (!shouldGenerate) continue;
      }

      // Render the template
      const content = await this.renderTemplate(templateFile.content, context);
      const path = this.renderPath(templateFile.path, context);

      // Parse imports and exports
      const imports = this.extractImports(content);
      const exports = this.extractExports(content);

      files.push({
        path,
        content,
        language: templateFile.language,
        imports,
        exports,
        dependencies: [],
        template: template.id,
        isNew: true, // TODO: Check if file exists
      });
    }

    return files;
  }

  /**
   * Register a new template
   */
  registerTemplate(template: Template): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): Template | null {
    return this.templates.get(id) || null;
  }

  /**
   * Get all templates
   */
  getAllTemplates(): Template[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: TemplateCategory): Template[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private initializeBaseTemplates(): void {
    // Register basic component template
    this.registerTemplate({
      id: 'react-component',
      name: 'React Component',
      description: 'A basic React functional component with TypeScript',
      category: 'component',
      framework: 'nextjs',
      tags: ['react', 'component', 'typescript'],
      files: [
        {
          path: '{{componentPath}}/{{componentName}}.tsx',
          content: this.getReactComponentTemplate(),
          language: 'tsx',
        },
      ],
      variables: [
        {
          name: 'componentName',
          type: 'string',
          description: 'Name of the component',
          required: true,
        },
        {
          name: 'componentPath',
          type: 'string',
          description: 'Path to component directory',
          required: true,
          default: 'src/components',
        },
      ],
      version: '1.0.0',
    });

    // Register API route template
    this.registerTemplate({
      id: 'nextjs-api-route',
      name: 'Next.js API Route',
      description: 'A Next.js 15 API route handler with TypeScript',
      category: 'route',
      framework: 'nextjs',
      tags: ['api', 'route', 'nextjs', 'typescript'],
      files: [
        {
          path: 'src/app/api/{{routePath}}/route.ts',
          content: this.getApiRouteTemplate(),
          language: 'typescript',
        },
      ],
      variables: [
        {
          name: 'routePath',
          type: 'string',
          description: 'API route path',
          required: true,
        },
        {
          name: 'withAuth',
          type: 'boolean',
          description: 'Include authentication',
          required: false,
          default: false,
        },
      ],
      version: '1.0.0',
    });

    // Register more templates...
  }

  private async renderTemplate(content: string, context: TemplateContext): Promise<string> {
    let rendered = content;

    // Replace simple variables {{variableName}}
    for (const [key, value] of Object.entries(context.variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    // Apply naming conventions
    rendered = this.applyConventions(rendered, context.conventions);

    return rendered;
  }

  private renderPath(path: string, context: TemplateContext): string {
    let rendered = path;

    // Replace variables in path
    for (const [key, value] of Object.entries(context.variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    return rendered;
  }

  private applyConventions(content: string, conventions: ProjectConventions): string {
    // Apply quote style
    if (conventions.imports.preferredQuotes === 'single') {
      content = content.replace(/import\s+.*from\s+"([^"]+)"/g, "import $1 from '$1'");
    }

    // TODO: Apply more conventions (semicolons, spacing, etc.)

    return content;
  }

  private extractImports(content: string): Array<{
    from: string;
    items: string[];
    default?: string;
    isType?: boolean;
    isRelative: boolean;
  }> {
    const imports: Array<{
      from: string;
      items: string[];
      default?: string;
      isType?: boolean;
      isRelative: boolean;
    }> = [];

    // Match import statements
    const importRegex = /import\s+(?:type\s+)?(?:(\w+)|{([^}]+)})\s+from\s+['"]([^'"]+)['"]/g;
    const matches = content.matchAll(importRegex);

    for (const match of matches) {
      const [_, defaultImport, namedImports, from] = match;
      const isType = match[0].includes('type');
      const isRelative = from.startsWith('.');

      imports.push({
        from,
        items: namedImports ? namedImports.split(',').map(s => s.trim()) : [],
        default: defaultImport,
        isType,
        isRelative,
      });
    }

    return imports;
  }

  private extractExports(content: string): Array<{
    name: string;
    type: 'default' | 'named' | 'type';
    signature?: string;
  }> {
    const exports: Array<{
      name: string;
      type: 'default' | 'named' | 'type';
      signature?: string;
    }> = [];

    // Match export statements
    const exportRegex = /export\s+(?:default\s+)?(?:type\s+)?(?:const|let|var|function|class|interface)\s+(\w+)/g;
    const matches = content.matchAll(exportRegex);

    for (const match of matches) {
      const name = match[1];
      const isDefault = match[0].includes('default');
      const isType = match[0].includes('type') || match[0].includes('interface');

      exports.push({
        name,
        type: isDefault ? 'default' : isType ? 'type' : 'named',
      });
    }

    return exports;
  }

  private intentToCategory(intent: string): TemplateCategory {
    // Map intent to template category
    const mapping: Record<string, TemplateCategory> = {
      create: 'component',
      generate: 'full-module',
      add: 'utility',
      scaffold: 'full-module',
      update: 'component',
    };

    return mapping[intent] || 'component';
  }

  // ============================================================================
  // Template Content
  // ============================================================================

  private getReactComponentTemplate(): string {
    return `'use client';

import React from 'react';

interface {{componentName}}Props {
  // Add your props here
}

export function {{componentName}}({ }: {{componentName}}Props) {
  return (
    <div className="{{componentName}}">
      <h1>{{componentName}}</h1>
      <p>Component content goes here</p>
    </div>
  );
}
`;
  }

  private getApiRouteTemplate(): string {
    return `import { NextRequest, NextResponse } from 'next/server';{{#if withAuth}}
import { getAuthenticatedUser } from '@/lib/auth-utils';{{/if}}

export async function GET(request: NextRequest) {
  try {{{#if withAuth}}
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
{{/if}}
    // TODO: Implement GET logic
    
    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {{{#if withAuth}}
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
{{/if}}
    const body = await request.json();
    
    // TODO: Implement POST logic
    
    return NextResponse.json({ message: 'Created' }, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
`;
  }
}

// Singleton instance
let instance: TemplateEngine | null = null;

export function getTemplateEngine(): TemplateEngine {
  if (!instance) {
    instance = new TemplateEngine();
  }
  return instance;
}
