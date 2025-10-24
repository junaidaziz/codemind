/**
 * Smart Scaffolder Integration Tests
 * 
 * End-to-end tests for the complete scaffolding pipeline:
 * - Prompt parsing
 * - Convention analysis
 * - Template matching
 * - File generation
 * - Dependency graph building
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PromptParser } from '../PromptParser';
import { TemplateEngine } from '../TemplateEngine';
import { DependencyGraphBuilder } from '../DependencyGraphBuilder';
import { registerAllTemplates } from '../templates';
import type { TemplateContext, ProjectConventions } from '../types';

describe('Smart Scaffolder - Integration Tests', () => {
  let promptParser: PromptParser;
  let templateEngine: TemplateEngine;
  let graphBuilder: DependencyGraphBuilder;

  beforeEach(() => {
    promptParser = new PromptParser();
    templateEngine = new TemplateEngine();
    graphBuilder = new DependencyGraphBuilder();
    
    // Register all templates
    registerAllTemplates(templateEngine);
  });

  describe('End-to-End Scaffold Flow', () => {
    it('should scaffold a React component from natural language', async () => {
      // Step 1: Parse natural language prompt
      const prompt = 'create a UserProfile component with avatar';
      const intent = await promptParser.parse(prompt);

      expect(intent.intent).toBe('create');
      expect(intent.entities).toHaveLength(1);
      expect(intent.entities[0].type).toBe('component');
      expect(intent.entities[0].name).toContain('UserProfile');
      expect(intent.confidence).toBeGreaterThan(0.5);

      // Step 2: Match templates
      const matchedTemplates = promptParser.matchTemplates(intent);
      expect(matchedTemplates).toContain('react-component');

      // Step 3: Extract variables
      const variables = promptParser.extractVariables(intent);
      expect(variables.componentName).toBeDefined();

      // Step 4: Get template
      const template = templateEngine.getTemplate('react-component');
      expect(template).toBeDefined();
      expect(template?.name).toBe('React Component');

      // Step 5: Generate files
      if (template) {
        const mockConventions: ProjectConventions = createMockConventions();
        const context: TemplateContext = {
          variables,
          conventions: mockConventions,
          projectId: 'test-project',
          template,
          parsedIntent: intent,
        };

        const generatedFiles = await templateEngine.generate(template, context);
        
        expect(generatedFiles).toHaveLength(1);
        expect(generatedFiles[0].path).toContain('UserProfile');
        expect(generatedFiles[0].content).toContain('UserProfile');
        expect(generatedFiles[0].language).toBe('tsx');
      }
    });

    it('should scaffold a Next.js API route with auth', async () => {
      const prompt = 'add posts API route with authentication';
      const intent = await promptParser.parse(prompt);

      expect(intent.intent).toBe('add');
      expect(intent.entities.some(e => e.type === 'route')).toBe(true);
      expect(intent.modifiers.some(m => m.type === 'with-auth')).toBe(true);

      const matchedTemplates = promptParser.matchTemplates(intent);
      expect(matchedTemplates).toContain('nextjs-api-route');

      const variables = promptParser.extractVariables(intent);
      const template = templateEngine.getTemplate('nextjs-api-route');

      if (template) {
        const mockConventions: ProjectConventions = createMockConventions();
        const context: TemplateContext = {
          variables: {
            ...variables,
            withAuth: true,
            methods: ['GET', 'POST'],
          },
          conventions: mockConventions,
          projectId: 'test-project',
          template,
          parsedIntent: intent,
        };

        const generatedFiles = await templateEngine.generate(template, context);
        
        expect(generatedFiles).toHaveLength(1);
        expect(generatedFiles[0].content).toContain('auth');
        expect(generatedFiles[0].content).toContain('GET');
        expect(generatedFiles[0].content).toContain('POST');
      }
    });

    it('should scaffold a custom React hook', async () => {
      const prompt = 'create useAuth hook for authentication';
      const intent = await promptParser.parse(prompt);

      expect(intent.intent).toBe('create');
      expect(intent.entities.some(e => e.name.includes('useAuth'))).toBe(true);

      const matchedTemplates = promptParser.matchTemplates(intent);
      expect(matchedTemplates).toContain('react-hook');

      const variables = promptParser.extractVariables(intent);
      const template = templateEngine.getTemplate('react-hook');

      if (template) {
        const mockConventions: ProjectConventions = createMockConventions();
        const context: TemplateContext = {
          variables,
          conventions: mockConventions,
          projectId: 'test-project',
          template,
          parsedIntent: intent,
        };

        const generatedFiles = await templateEngine.generate(template, context);
        
        expect(generatedFiles).toHaveLength(1);
        expect(generatedFiles[0].path).toContain('hooks');
        expect(generatedFiles[0].content).toContain('useState');
        expect(generatedFiles[0].content).toContain('useEffect');
      }
    });

    it('should scaffold a Prisma model', async () => {
      const prompt = 'generate Prisma model for Product';
      const intent = await promptParser.parse(prompt);

      expect(intent.intent).toBe('generate');
      expect(intent.entities.some(e => e.type === 'model')).toBe(true);
      expect(intent.entities.some(e => e.name === 'Product')).toBe(true);

      const matchedTemplates = promptParser.matchTemplates(intent);
      expect(matchedTemplates).toContain('prisma-model');

      const variables = promptParser.extractVariables(intent);
      const template = templateEngine.getTemplate('prisma-model');

      if (template) {
        const mockConventions: ProjectConventions = createMockConventions();
        const context: TemplateContext = {
          variables,
          conventions: mockConventions,
          projectId: 'test-project',
          template,
          parsedIntent: intent,
        };

        const generatedFiles = await templateEngine.generate(template, context);
        
        expect(generatedFiles).toHaveLength(1);
        expect(generatedFiles[0].content).toContain('model Product');
        expect(generatedFiles[0].language).toBe('prisma');
      }
    });
  });

  describe('Dependency Graph Building', () => {
    it('should build dependency graph for generated files', () => {
      const files = [
        {
          path: 'src/components/UserProfile.tsx',
          content: 'import { Button } from "./Button";\nexport default function UserProfile() {}',
          language: 'tsx' as const,
          imports: [{ from: './Button', items: ['Button'], isRelative: true }],
          exports: [{ name: 'UserProfile', type: 'default' as const }],
          dependencies: [],
          template: 'react-component',
          isNew: true,
        },
        {
          path: 'src/components/Button.tsx',
          content: 'export default function Button() {}',
          language: 'tsx' as const,
          imports: [],
          exports: [{ name: 'Button', type: 'default' as const }],
          dependencies: [],
          template: 'react-component',
          isNew: true,
        },
      ];

      const graph = graphBuilder.build(files);

      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0].from).toBe('src/components/UserProfile.tsx');
      expect(graph.edges[0].to).toBe('src/components/Button.tsx');
    });

    it('should detect circular dependencies', () => {
      const files = [
        {
          path: 'src/A.ts',
          content: 'import { B } from "./B";',
          language: 'typescript' as const,
          imports: [{ from: './B', items: ['B'], isRelative: true }],
          exports: [{ name: 'A', type: 'named' as const }],
          dependencies: [],
          template: 'utility',
          isNew: true,
        },
        {
          path: 'src/B.ts',
          content: 'import { A } from "./A";',
          language: 'typescript' as const,
          imports: [{ from: './A', items: ['A'], isRelative: true }],
          exports: [{ name: 'B', type: 'named' as const }],
          dependencies: [],
          template: 'utility',
          isNew: true,
        },
      ];

      const graph = graphBuilder.build(files);
      const circles = graphBuilder.detectCircularDependencies(graph);

      expect(circles.length).toBeGreaterThan(0);
    });
  });

  describe('Template Validation', () => {
    it('should have all required templates registered', () => {
      const templates = templateEngine.getAllTemplates();
      
      expect(templates.length).toBeGreaterThanOrEqual(4);
      
      const templateIds = templates.map(t => t.id);
      expect(templateIds).toContain('react-component');
      expect(templateIds).toContain('nextjs-api-route');
      expect(templateIds).toContain('react-hook');
      expect(templateIds).toContain('prisma-model');
    });

    it('should validate template structure', () => {
      const templates = templateEngine.getAllTemplates();
      
      for (const template of templates) {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.category).toBeDefined();
        expect(template.version).toBeDefined();
        expect(template.tags).toBeInstanceOf(Array);
        expect(template.files).toBeInstanceOf(Array);
        expect(template.variables).toBeInstanceOf(Array);
        expect(template.files.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Prompt Parser Accuracy', () => {
    it('should correctly parse various component prompts', async () => {
      const prompts = [
        'create UserDashboard component',
        'add navigation component with routing',
        'scaffold ProductCard component with props',
      ];

      for (const prompt of prompts) {
        const intent = await promptParser.parse(prompt);
        expect(intent.entities.some(e => e.type === 'component')).toBe(true);
        expect(intent.confidence).toBeGreaterThan(0.5);
      }
    });

    it('should correctly parse API route prompts', async () => {
      const prompts = [
        'create API route for users',
        'add authentication endpoint',
        'generate REST API for products',
      ];

      for (const prompt of prompts) {
        const intent = await promptParser.parse(prompt);
        expect(intent.entities.some(e => e.type === 'route')).toBe(true);
        expect(intent.confidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect modifiers correctly', async () => {
      const intent1 = await promptParser.parse('create component with tests');
      expect(intent1.modifiers.some(m => m.type === 'with-tests')).toBe(true);

      const intent2 = await promptParser.parse('add API route with auth');
      expect(intent2.modifiers.some(m => m.type === 'with-auth')).toBe(true);

      const intent3 = await promptParser.parse('generate TypeScript service');
      expect(intent3.modifiers.some(m => m.type === 'typescript')).toBe(true);
    });
  });
});

/**
 * Helper function to create mock conventions for testing
 */
function createMockConventions(): ProjectConventions {
  return {
    naming: {
      files: 'kebab-case',
      directories: 'kebab-case',
      components: 'PascalCase',
      functions: 'camelCase',
      variables: 'camelCase',
      constants: 'SCREAMING_SNAKE_CASE',
      types: 'PascalCase',
      examples: {},
    },
    imports: {
      style: 'named',
      pathAlias: { '@': 'src' },
      preferredQuotes: 'single',
      grouping: 'by-type',
      sortOrder: 'alphabetical',
    },
    structure: {
      rootDir: '.',
      sourceDir: 'src',
      componentDir: 'src/components',
      utilsDir: 'src/lib',
      typesDir: 'src/types',
      testPattern: '**/*.test.ts',
      configLocation: '.',
      flatStructure: false,
    },
    framework: {
      name: 'nextjs',
      version: '15.0.0',
      features: ['app-router', 'server-actions'],
      router: 'app-router',
      stateManagement: 'zustand',
    },
    typescript: {
      enabled: true,
      strict: true,
      version: '5.0.0',
      compilerOptions: {},
      pathMapping: {},
    },
    cacheKey: 'test-cache-key',
    analyzedAt: new Date(),
    confidence: 0.9,
  };
}
