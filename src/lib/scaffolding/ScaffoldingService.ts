/**
 * ScaffoldingService
 * 
 * Main orchestrator for the Smart Scaffolder Mode.
 * Coordinates prompt parsing, convention analysis, template selection,
 * file generation, and application of changes.
 * 
 * @server-only This module uses Node.js fs APIs and should only run on the server
 */

import type {
  ScaffoldRequest,
  ScaffoldResult,
  GeneratedFile,
  PreviewData,
  ParsedIntent,
  ProjectConventions,
  DependencyGraph,
} from './types';
import { ConventionAnalyzer } from './ConventionAnalyzer';
import { PromptParser } from './PromptParser';
import { TemplateEngine } from './TemplateEngine';
import { DependencyGraphBuilder } from './DependencyGraphBuilder';
import { registerAllTemplates } from './templates';

export class ScaffoldingService {
  private conventionAnalyzer: ConventionAnalyzer;
  private promptParser: PromptParser;
  private templateEngine: TemplateEngine;
  private graphBuilder: DependencyGraphBuilder;
  private scaffoldCache: Map<string, ScaffoldResult>;

  constructor() {
    this.conventionAnalyzer = new ConventionAnalyzer();
    this.promptParser = new PromptParser();
    this.templateEngine = new TemplateEngine();
    this.graphBuilder = new DependencyGraphBuilder();
    this.scaffoldCache = new Map();
    
    // Register all production templates
    registerAllTemplates(this.templateEngine);
  }

  /**
   * Main entry point: Generate a full scaffold from a natural language prompt
   */
  async scaffold(request: ScaffoldRequest): Promise<ScaffoldResult> {
    const scaffoldId = this.generateScaffoldId();
    
    try {
      // Initialize result
      const result: ScaffoldResult = {
        id: scaffoldId,
        projectId: request.projectId,
        userId: request.userId,
        prompt: request.prompt,
        parsedIntent: {} as ParsedIntent,
        files: [],
        dependencyGraph: { nodes: [], edges: [], entryPoints: [], layers: [] },
        appliedConventions: {} as ProjectConventions,
        preview: this.createEmptyPreview(),
        status: 'parsing',
        createdAt: new Date(),
      };

      // Step 1: Parse the prompt
      result.status = 'parsing';
      result.parsedIntent = await this.parsePrompt(request.prompt);

      // Validate parsed intent
      if (result.parsedIntent.confidence < 0.5) {
        throw new Error('Unable to understand prompt. Please be more specific.');
      }

      // Step 2: Analyze project conventions
      result.status = 'analyzing';
      result.appliedConventions = await this.analyzeConventions(request.projectId);

      // Step 3: Generate files
      result.status = 'generating';
      result.files = await this.generateFiles(
        result.parsedIntent,
        result.appliedConventions,
        request.projectId
      );

      // Step 4: Build dependency graph
      result.dependencyGraph = this.buildDependencyGraph(result.files);

      // Step 5: Create preview
      result.status = 'previewing';
      result.preview = await this.createPreview(result.files, request.projectId);

      // Step 6: Handle preview-only or apply
      if (request.previewOnly || request.dryRun) {
        result.status = 'pending';
      } else {
        await this.applyChanges(result);
        result.status = 'applied';
        result.appliedAt = new Date();
      }

      // Cache the result
      this.scaffoldCache.set(scaffoldId, result);

      return result;

    } catch (error) {
      return {
        id: scaffoldId,
        projectId: request.projectId,
        userId: request.userId,
        prompt: request.prompt,
        parsedIntent: {} as ParsedIntent,
        files: [],
        dependencyGraph: { nodes: [], edges: [], entryPoints: [], layers: [] },
        appliedConventions: {} as ProjectConventions,
        preview: this.createEmptyPreview(),
        status: 'failed',
        createdAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate preview without applying changes
   */
  async preview(request: ScaffoldRequest): Promise<ScaffoldResult> {
    return this.scaffold({ ...request, previewOnly: true });
  }

  /**
   * Apply a previously previewed scaffold
   */
  async apply(scaffoldId: string): Promise<ScaffoldResult> {
    const scaffold = this.scaffoldCache.get(scaffoldId);
    
    if (!scaffold) {
      throw new Error(`Scaffold ${scaffoldId} not found in cache`);
    }

    if (scaffold.status !== 'pending') {
      throw new Error(`Scaffold ${scaffoldId} is not in pending state`);
    }

    try {
      scaffold.status = 'applying';
      await this.applyChanges(scaffold);
      scaffold.status = 'applied';
      scaffold.appliedAt = new Date();
      return scaffold;
    } catch (error) {
      scaffold.status = 'failed';
      scaffold.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Cancel a pending scaffold
   */
  async cancel(scaffoldId: string): Promise<void> {
    const scaffold = this.scaffoldCache.get(scaffoldId);
    
    if (!scaffold) {
      throw new Error(`Scaffold ${scaffoldId} not found`);
    }

    scaffold.status = 'cancelled';
    this.scaffoldCache.delete(scaffoldId);
  }

  /**
   * Rollback an applied scaffold
   */
  async rollback(scaffoldId: string): Promise<void> {
    const scaffold = this.scaffoldCache.get(scaffoldId);
    
    if (!scaffold) {
      throw new Error(`Scaffold ${scaffoldId} not found`);
    }

    if (scaffold.status !== 'applied') {
      throw new Error(`Cannot rollback scaffold that hasn't been applied`);
    }

    try {
      // Restore original files or delete new files
      for (const file of scaffold.files) {
        if (file.isNew) {
          // Delete newly created file
          await this.deleteFile(file.path, scaffold.projectId);
        } else if (file.originalContent) {
          // Restore original content
          await this.writeFile(file.path, file.originalContent, scaffold.projectId);
        }
      }

      scaffold.status = 'rolled_back';
      
    } catch (error) {
      throw new Error(`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async parsePrompt(prompt: string): Promise<ParsedIntent> {
    return this.promptParser.parse(prompt);
  }

  private async analyzeConventions(projectId: string): Promise<ProjectConventions> {
    return this.conventionAnalyzer.analyzeProject(projectId);
  }

  private async generateFiles(
    intent: ParsedIntent,
    conventions: ProjectConventions,
    projectId: string
  ): Promise<GeneratedFile[]> {
    // Select appropriate template based on intent
    const template = await this.templateEngine.selectTemplate(intent, conventions);
    
    if (!template) {
      throw new Error(`No suitable template found for intent: ${intent.intent}`);
    }

    // Generate files from template
    const files = await this.templateEngine.generate(template, {
      variables: this.extractVariables(intent),
      conventions,
      projectId,
      template,
      parsedIntent: intent,
    });

    return files;
  }

  private buildDependencyGraph(files: GeneratedFile[]): DependencyGraph {
    return this.graphBuilder.build(files);
  }

  private async createPreview(files: GeneratedFile[], _projectId: string): Promise<PreviewData> {
    // TODO: Implement preview creation
    // - Build file tree
    // - Calculate summary statistics
    // - Detect warnings and conflicts
    
    return {
      fileTree: {
        name: 'project',
        path: '/',
        type: 'directory',
        children: [],
      },
      summary: {
        filesCreated: files.filter(f => f.isNew).length,
        filesModified: files.filter(f => !f.isNew).length,
        linesAdded: files.reduce((sum, f) => sum + f.content.split('\n').length, 0),
        linesRemoved: 0,
        importsAdded: files.reduce((sum, f) => sum + f.imports.length, 0),
        estimatedDuration: files.length * 100, // 100ms per file estimate
      },
      warnings: [],
      conflicts: [],
    };
  }

  private async applyChanges(scaffold: ScaffoldResult): Promise<void> {
    // TODO: Implement actual file writing
    // - Create backups
    // - Write files
    // - Handle errors
    // - Log to activity
    
    for (const file of scaffold.files) {
      await this.writeFile(file.path, file.content, scaffold.projectId);
    }
  }

  private extractVariables(intent: ParsedIntent): Record<string, unknown> {
    const variables: Record<string, unknown> = {};
    
    // Extract entity names as variables
    intent.entities.forEach(entity => {
      variables[`${entity.type}Name`] = entity.name;
      if (entity.attributes) {
        Object.assign(variables, entity.attributes);
      }
    });

    // Extract modifiers as boolean flags
    intent.modifiers.forEach(modifier => {
      variables[modifier.type] = true;
      if (modifier.value) {
        variables[`${modifier.type}Value`] = modifier.value;
      }
    });

    return variables;
  }

  private async writeFile(path: string, content: string, _projectId: string): Promise<void> {
    // TODO: Implement actual file writing to the project
    console.log(`Would write file: ${path} (${content.length} bytes)`);
  }

  private async deleteFile(path: string, _projectId: string): Promise<void> {
    // TODO: Implement actual file deletion
    console.log(`Would delete file: ${path}`);
  }

  private createEmptyPreview(): PreviewData {
    return {
      fileTree: {
        name: 'project',
        path: '/',
        type: 'directory',
      },
      summary: {
        filesCreated: 0,
        filesModified: 0,
        linesAdded: 0,
        linesRemoved: 0,
        importsAdded: 0,
        estimatedDuration: 0,
      },
      warnings: [],
      conflicts: [],
    };
  }

  private generateScaffoldId(): string {
    return `scaffold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all scaffolds for a project
   */
  async getScaffoldHistory(projectId: string): Promise<ScaffoldResult[]> {
    return Array.from(this.scaffoldCache.values())
      .filter(s => s.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get a specific scaffold by ID
   */
  async getScaffold(scaffoldId: string): Promise<ScaffoldResult | null> {
    return this.scaffoldCache.get(scaffoldId) || null;
  }

  /**
   * Clear old scaffolds from cache
   */
  clearOldScaffolds(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.scaffoldCache.forEach((scaffold, id) => {
      const age = now - scaffold.createdAt.getTime();
      if (age > maxAge) {
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => this.scaffoldCache.delete(id));
  }
}

// Singleton instance
let instance: ScaffoldingService | null = null;

export function getScaffoldingService(): ScaffoldingService {
  if (!instance) {
    instance = new ScaffoldingService();
  }
  return instance;
}
