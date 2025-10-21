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

    // Register full-module template
    this.registerTemplate({
      id: 'nextjs-crud-module',
      name: 'Next.js CRUD Module',
      description: 'Complete CRUD module with API routes, components, and types',
      category: 'full-module',
      framework: 'nextjs',
      tags: ['crud', 'module', 'api', 'component', 'typescript'],
      files: [
        {
          path: 'src/app/api/{{moduleName}}/route.ts',
          content: this.getCrudApiTemplate(),
          language: 'typescript',
        },
        {
          path: 'src/components/{{pascalCase moduleName}}/{{pascalCase moduleName}}List.tsx',
          content: this.getListComponentTemplate(),
          language: 'tsx',
        },
        {
          path: 'src/components/{{pascalCase moduleName}}/{{pascalCase moduleName}}Form.tsx',
          content: this.getFormComponentTemplate(),
          language: 'tsx',
        },
        {
          path: 'src/types/{{moduleName}}.ts',
          content: this.getTypeDefinitionsTemplate(),
          language: 'typescript',
        },
      ],
      variables: [
        {
          name: 'moduleName',
          type: 'string',
          description: 'Name of the module (e.g., "users", "posts")',
          required: true,
        },
        {
          name: 'withAuth',
          type: 'boolean',
          description: 'Include authentication',
          required: false,
          default: true,
        },
        {
          name: 'fields',
          type: 'array',
          description: 'List of entity fields',
          required: false,
        },
      ],
      version: '1.0.0',
    });

    // Register utility function template
    this.registerTemplate({
      id: 'utility-function',
      name: 'Utility Function',
      description: 'A typed utility function with tests',
      category: 'utility',
      framework: undefined,
      tags: ['utility', 'function', 'typescript'],
      files: [
        {
          path: 'src/lib/{{fileName}}.ts',
          content: this.getUtilityFunctionTemplate(),
          language: 'typescript',
        },
        {
          path: 'src/lib/__tests__/{{fileName}}.test.ts',
          content: this.getUtilityTestTemplate(),
          language: 'typescript',
          optional: true,
          condition: 'withTests',
        },
      ],
      variables: [
        {
          name: 'fileName',
          type: 'string',
          description: 'Name of the utility file',
          required: true,
        },
        {
          name: 'functionName',
          type: 'string',
          description: 'Name of the main function',
          required: true,
        },
        {
          name: 'withTests',
          type: 'boolean',
          description: 'Include test file',
          required: false,
          default: true,
        },
      ],
      version: '1.0.0',
    });
  }

  private async renderTemplate(content: string, context: TemplateContext): Promise<string> {
    let rendered = content;

    // Process conditional blocks first ({{#if}}...{{/if}})
    rendered = this.processConditionals(rendered, context.variables);

    // Process loops ({{#each}}...{{/each}})
    rendered = this.processLoops(rendered, context.variables);

    // Replace variables with helper functions ({{uppercase name}})
    rendered = this.processHelpers(rendered, context.variables);

    // Replace simple variables {{variableName}}
    for (const [key, value] of Object.entries(context.variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    // Apply naming conventions
    rendered = this.applyConventions(rendered, context.conventions);

    return rendered;
  }

  /**
   * Process conditional blocks: {{#if condition}}...{{else}}...{{/if}}
   */
  private processConditionals(content: string, variables: Record<string, unknown>): string {
    let result = content;
    
    // Match {{#if condition}}...{{else}}...{{/if}} or {{#if condition}}...{{/if}}
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
    
    result = result.replace(conditionalRegex, (_match, condition, ifBlock, elseBlock) => {
      const conditionValue = variables[condition];
      const isTrue = this.isTruthy(conditionValue);
      
      if (isTrue) {
        return ifBlock || '';
      } else {
        return elseBlock || '';
      }
    });
    
    return result;
  }

  /**
   * Process loop blocks: {{#each items}}{{this}}{{/each}}
   */
  private processLoops(content: string, variables: Record<string, unknown>): string {
    let result = content;
    
    // Match {{#each arrayName}}...{{/each}}
    const loopRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    result = result.replace(loopRegex, (_match, arrayName, loopBlock) => {
      const arrayValue = variables[arrayName];
      
      if (!Array.isArray(arrayValue)) {
        return ''; // Skip if not an array
      }
      
      // Render the block for each item
      return arrayValue.map((item, index) => {
        let itemBlock = loopBlock;
        
        // Replace {{this}} with the current item
        itemBlock = itemBlock.replace(/\{\{this\}\}/g, String(item));
        
        // Replace {{@index}} with the current index
        itemBlock = itemBlock.replace(/\{\{@index\}\}/g, String(index));
        
        // Support object properties: {{this.propertyName}}
        if (typeof item === 'object' && item !== null) {
          for (const [key, value] of Object.entries(item)) {
            const propRegex = new RegExp(`\\{\\{this\\.${key}\\}\\}`, 'g');
            itemBlock = itemBlock.replace(propRegex, String(value));
          }
        }
        
        return itemBlock;
      }).join('');
    });
    
    return result;
  }

  /**
   * Process helper functions: {{uppercase name}}, {{pascalCase name}}, etc.
   */
  private processHelpers(content: string, variables: Record<string, unknown>): string {
    let result = content;
    
    // Match {{helperName variableName}}
    const helperRegex = /\{\{(\w+)\s+(\w+)\}\}/g;
    
    result = result.replace(helperRegex, (_match, helper, varName) => {
      const value = variables[varName];
      
      if (value === undefined || value === null) {
        return '';
      }
      
      const stringValue = String(value);
      
      switch (helper) {
        case 'uppercase':
          return stringValue.toUpperCase();
        
        case 'lowercase':
          return stringValue.toLowerCase();
        
        case 'pascalCase':
          return this.toPascalCase(stringValue);
        
        case 'camelCase':
          return this.toCamelCase(stringValue);
        
        case 'kebabCase':
          return this.toKebabCase(stringValue);
        
        case 'snakeCase':
          return this.toSnakeCase(stringValue);
        
        case 'capitalize':
          return stringValue.charAt(0).toUpperCase() + stringValue.slice(1);
        
        default:
          // Unknown helper, return original
          return `{{${helper} ${varName}}}`;
      }
    });
    
    return result;
  }

  /**
   * Check if a value is truthy (for conditionals)
   */
  private isTruthy(value: unknown): boolean {
    if (value === undefined || value === null || value === false) {
      return false;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return false;
    }
    if (typeof value === 'number' && value === 0) {
      return false;
    }
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }
    return true;
  }

  // ============================================================================
  // Naming Convention Helpers
  // ============================================================================

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
      .replace(/^(.)/, (char) => char.toUpperCase());
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toLowerCase();
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
    let result = content;

    // Apply quote style for imports
    if (conventions.imports.preferredQuotes === 'single') {
      // Convert double quotes to single quotes in import statements
      result = result.replace(/import\s+([^;]+)\s+from\s+"([^"]+)"/g, "import $1 from '$2'");
    } else if (conventions.imports.preferredQuotes === 'double') {
      // Convert single quotes to double quotes in import statements
      result = result.replace(/import\s+([^;]+)\s+from\s+'([^']+)'/g, 'import $1 from "$2"');
    }

    // Apply import path aliases if configured
    if (conventions.imports.pathAlias && Object.keys(conventions.imports.pathAlias).length > 0) {
      for (const [alias, realPath] of Object.entries(conventions.imports.pathAlias)) {
        if (typeof realPath === 'string') {
          // Replace relative imports with aliases where appropriate
          // Example: '../../../src/components' -> '@/components'
          const escapedPath = realPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '([^\'\"]+)');
          try {
            const aliasRegex = new RegExp(`from ['"](\\.\\./)+${escapedPath}['"]`, 'g');
            result = result.replace(aliasRegex, `from '${alias}'`);
          } catch {
            // Skip invalid regex
          }
        }
      }
    }

    return result;
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
      const [, defaultImport, namedImports, from] = match;
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

  private getCrudApiTemplate(): string {
    return `import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';{{#if withAuth}}
import { getAuthenticatedUser } from '@/lib/auth-utils';{{/if}}
import type { {{pascalCase moduleName}} } from '@/types/{{moduleName}}';

// GET /api/{{moduleName}} - List all items
export async function GET(request: NextRequest) {
  try {{{#if withAuth}}
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
{{/if}}
    const items = await prisma.{{camelCase moduleName}}.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching {{moduleName}}:', error);
    return NextResponse.json(
      { error: 'Failed to fetch {{moduleName}}' },
      { status: 500 }
    );
  }
}

// POST /api/{{moduleName}} - Create new item
export async function POST(request: NextRequest) {
  try {{{#if withAuth}}
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
{{/if}}
    const body: Partial<{{pascalCase moduleName}}> = await request.json();
    
    const newItem = await prisma.{{camelCase moduleName}}.create({
      data: {
        id: crypto.randomUUID(),
        ...body,{{#if withAuth}}
        userId: user.id,{{/if}}
      },
    });
    
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error('Error creating {{moduleName}}:', error);
    return NextResponse.json(
      { error: 'Failed to create {{moduleName}}' },
      { status: 500 }
    );
  }
}
`;
  }

  private getListComponentTemplate(): string {
    return `'use client';

import React from 'react';
import type { {{pascalCase moduleName}} } from '@/types/{{moduleName}}';

interface {{pascalCase moduleName}}ListProps {
  items: {{pascalCase moduleName}}[];
  onEdit?: (item: {{pascalCase moduleName}}) => void;
  onDelete?: (id: string) => void;
}

export function {{pascalCase moduleName}}List({ items, onEdit, onDelete }: {{pascalCase moduleName}}ListProps) {
  return (
    <div className="{{kebabCase moduleName}}-list">
      <h2 className="text-2xl font-bold mb-4">{{pascalCase moduleName}} List</h2>
      
      {items.length === 0 ? (
        <p className="text-gray-500">No items found</p>
      ) : (
        <div className="space-y-4">
          {{#each items}}
          <div key={item.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{item.name}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
              
              <div className="flex gap-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(item)}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(item.id)}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
          {{/each}}
        </div>
      )}
    </div>
  );
}
`;
  }

  private getFormComponentTemplate(): string {
    return `'use client';

import React, { useState } from 'react';
import type { {{pascalCase moduleName}} } from '@/types/{{moduleName}}';

interface {{pascalCase moduleName}}FormProps {
  initialData?: Partial<{{pascalCase moduleName}}>;
  onSubmit: (data: Partial<{{pascalCase moduleName}}>) => Promise<void>;
  onCancel?: () => void;
}

export function {{pascalCase moduleName}}Form({ initialData, onSubmit, onCancel }: {{pascalCase moduleName}}FormProps) {
  const [formData, setFormData] = useState<Partial<{{pascalCase moduleName}}>>(initialData || {});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="{{kebabCase moduleName}}-form space-y-4">
      <h2 className="text-2xl font-bold">
        {initialData ? 'Edit' : 'Create'} {{pascalCase moduleName}}
      </h2>

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name
        </label>
        <input
          id="name"
          type="text"
          value={formData.name || ''}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          rows={4}
        />
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
`;
  }

  private getTypeDefinitionsTemplate(): string {
    return `/**
 * Type definitions for {{pascalCase moduleName}}
 */

export interface {{pascalCase moduleName}} {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;{{#if withAuth}}
  userId: string;{{/if}}
}

export type {{pascalCase moduleName}}CreateInput = Omit<{{pascalCase moduleName}}, 'id' | 'createdAt' | 'updatedAt'>;

export type {{pascalCase moduleName}}UpdateInput = Partial<{{pascalCase moduleName}}CreateInput>;
`;
  }

  private getUtilityFunctionTemplate(): string {
    return `/**
 * {{functionName}}
 * 
 * TODO: Add description
 */

export function {{functionName}}(input: string): string {
  // TODO: Implement function logic
  return input;
}
`;
  }

  private getUtilityTestTemplate(): string {
    return `import { {{functionName}} } from '../{{fileName}}';

describe('{{functionName}}', () => {
  it('should work correctly', () => {
    const result = {{functionName}}('test input');
    expect(result).toBe('test input');
  });

  it('should handle edge cases', () => {
    const result = {{functionName}}('');
    expect(result).toBe('');
  });
});
`;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let instance: TemplateEngine | null = null;

export function getTemplateEngine(): TemplateEngine {
  if (!instance) {
    instance = new TemplateEngine();
  }
  return instance;
}
