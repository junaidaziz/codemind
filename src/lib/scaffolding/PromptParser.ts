/**
 * PromptParser
 * 
 * Parses natural language prompts to extract intent, entities, modifiers,
 * and references. Uses pattern matching and NLP techniques.
 */

import type {
  ParsedIntent,
  IntentType,
  Entity,
  EntityType,
  Modifier,
  ModifierType,
  Reference,
  ReferenceType,
} from './types';

export class PromptParser {
  // Intent keywords mapping
  private intentKeywords: Record<IntentType, string[]> = {
    create: ['create', 'make', 'new', 'add', 'build'],
    generate: ['generate', 'gen', 'scaffold'],
    add: ['add', 'include', 'insert'],
    scaffold: ['scaffold'],
    update: ['update', 'modify', 'change', 'edit'],
    extend: ['extend', 'expand', 'enhance'],
    duplicate: ['duplicate', 'copy', 'clone'],
    unknown: [],
  };

  // Entity type keywords
  private entityKeywords: Record<EntityType, string[]> = {
    module: ['module'],
    component: ['component', 'comp'],
    route: ['route', 'endpoint', 'api', 'handler'],
    model: ['model', 'schema', 'entity'],
    service: ['service', 'provider'],
    utility: ['utility', 'util', 'helper', 'function'],
    test: ['test', 'spec', 'testing'],
    migration: ['migration', 'migrate'],
    config: ['config', 'configuration', 'settings'],
  };

  // Modifier keywords
  private modifierKeywords: Record<ModifierType, string[]> = {
    'with-tests': ['with tests', 'with testing', 'including tests'],
    'with-types': ['with types', 'typed', 'with typescript'],
    'with-docs': ['with docs', 'documented', 'with documentation'],
    'with-auth': ['with auth', 'authenticated', 'with authentication'],
    'with-validation': ['with validation', 'validated'],
    'typescript': ['typescript', 'ts'],
    'javascript': ['javascript', 'js'],
    'functional': ['functional', 'function component'],
    'class-based': ['class', 'class component', 'class-based'],
  };

  /**
   * Parse a natural language prompt
   */
  async parse(prompt: string): Promise<ParsedIntent> {
    const normalized = this.normalizePrompt(prompt);
    
    const intent = this.extractIntent(normalized);
    const entities = this.extractEntities(normalized);
    const modifiers = this.extractModifiers(normalized);
    const references = this.extractReferences(normalized);
    
    return {
      raw: prompt,
      intent,
      entities,
      modifiers,
      references,
      confidence: this.calculateConfidence(normalized, intent, entities),
      ambiguities: this.detectAmbiguities(normalized, intent, entities),
    };
  }

  /**
   * Suggest file paths for generated files based on entities and conventions
   */
  suggestFilePaths(intent: ParsedIntent, projectRoot: string): string[] {
    const paths: string[] = [];
    
    for (const entity of intent.entities) {
      const basePath = this.getBasePath(entity.type);
      const fileName = this.getFileName(entity.name, entity.type);
      paths.push(`${projectRoot}/${basePath}/${fileName}`);
      
      // Add test file if requested
      if (intent.modifiers.some(m => m.type === 'with-tests')) {
        const testPath = this.getTestPath(entity.type);
        const testFileName = this.getTestFileName(entity.name, entity.type);
        paths.push(`${projectRoot}/${testPath}/${testFileName}`);
      }
    }
    
    return paths;
  }

  /**
   * Match prompt to appropriate template(s)
   */
  matchTemplates(intent: ParsedIntent): string[] {
    const templates: string[] = [];
    
    for (const entity of intent.entities) {
      switch (entity.type) {
        case 'component':
          templates.push('react-component');
          break;
        case 'route':
          templates.push('nextjs-api-route');
          break;
        case 'module':
          templates.push('nextjs-crud-module');
          break;
        case 'utility':
          templates.push('utility-function');
          break;
        case 'test':
          templates.push('test-suite');
          break;
        default:
          templates.push('generic-file');
      }
    }
    
    // Check for full module generation
    if (intent.intent === 'scaffold' || intent.intent === 'generate') {
      if (intent.entities.length > 0) {
        templates.push('nextjs-crud-module');
      }
    }
    
    return [...new Set(templates)]; // Remove duplicates
  }

  /**
   * Extract variables from prompt for template rendering
   */
  extractVariables(intent: ParsedIntent): Record<string, unknown> {
    const variables: Record<string, unknown> = {};
    
    // Add entity names
    for (const entity of intent.entities) {
      variables[`${entity.type}Name`] = entity.name;
      
      // Add common naming variants
      if (entity.name) {
        variables.componentName = entity.name;
        variables.moduleName = entity.name;
        variables.fileName = entity.name;
      }
    }
    
    // Add modifiers as boolean flags
    for (const modifier of intent.modifiers) {
      variables[modifier.type.replace(/-/g, '')] = true;
    }
    
    // Add references
    if (intent.references.length > 0) {
      variables.referenceFiles = intent.references.map(r => r.target);
      variables.similarTo = intent.references[0]?.target;
    }
    
    return variables;
  }

  // ============================================================================
  // Private Extraction Methods
  // ============================================================================

  private normalizePrompt(prompt: string): string {
    return prompt.toLowerCase().trim();
  }

  private extractIntent(prompt: string): IntentType {
    // Check each intent type for keyword matches
    for (const [intent, keywords] of Object.entries(this.intentKeywords)) {
      for (const keyword of keywords) {
        if (prompt.startsWith(keyword) || prompt.includes(` ${keyword} `)) {
          return intent as IntentType;
        }
      }
    }
    
    return 'unknown';
  }

  private extractEntities(prompt: string): Entity[] {
    const entities: Entity[] = [];
    
    // Common prepositions and conjunctions that should stop entity name extraction
    const stopWords = ['with', 'that', 'for', 'using', 'including', 'having', 'containing', 'and', 'or'];
    
    // Look for entity type keywords
    for (const [type, keywords] of Object.entries(this.entityKeywords)) {
      for (const keyword of keywords) {
        // Updated regex to capture entity name but stop at prepositions
        const regex = new RegExp(`${keyword}\\s+(?:called|named)?\\s*([a-zA-Z0-9_-]+(?:\\s+[A-Z][a-zA-Z0-9_-]+)*)`, 'gi');
        const matches = [...prompt.matchAll(regex)];
        
        for (const match of matches) {
          let name = match[1].trim();
          const position: [number, number] = [match.index || 0, (match.index || 0) + match[0].length];
          
          // Remove any stop words from the end of the name
          for (const stopWord of stopWords) {
            const lowerName = name.toLowerCase();
            if (lowerName.endsWith(` ${stopWord}`) || lowerName === stopWord) {
              name = name.substring(0, name.length - stopWord.length).trim();
              break;
            }
          }
          
          // Only add if we have a valid name after stop word removal
          if (name.length > 0) {
            entities.push({
              type: type as EntityType,
              name: this.normalizeName(name),
              position,
            });
          }
        }
      }
    }

    // If no entities found, try to extract name after intent
    if (entities.length === 0) {
      const simpleMatch = prompt.match(/(?:create|generate|add|make|build)\s+(?:a|an)?\s*([a-zA-Z0-9_-]+)/i);
      if (simpleMatch) {
        const name = simpleMatch[1];
        
        // Check if the extracted name is a stop word
        const stopWords = ['with', 'that', 'for', 'using', 'including', 'having', 'containing'];
        if (!stopWords.includes(name.toLowerCase())) {
          entities.push({
            type: this.inferEntityType(prompt),
            name: this.normalizeName(name),
            position: [simpleMatch.index || 0, (simpleMatch.index || 0) + simpleMatch[0].length],
          });
        }
      }
    }

    return entities;
  }

  private extractModifiers(prompt: string): Modifier[] {
    const modifiers: Modifier[] = [];
    
    for (const [type, keywords] of Object.entries(this.modifierKeywords)) {
      for (const keyword of keywords) {
        if (prompt.includes(keyword)) {
          modifiers.push({
            type: type as ModifierType,
          });
        }
      }
    }

    return modifiers;
  }

  private extractReferences(prompt: string): Reference[] {
    const references: Reference[] = [];
    
    // Look for "similar to X", "like X", "based on X"
    const referencePatterns: Array<{ type: ReferenceType; patterns: RegExp[] }> = [
      {
        type: 'file',
        patterns: [
          /similar\s+to\s+([a-zA-Z0-9_/-]+)/gi,
          /like\s+([a-zA-Z0-9_/-]+)/gi,
          /based\s+on\s+([a-zA-Z0-9_/-]+)/gi,
        ],
      },
      {
        type: 'pattern',
        patterns: [
          /following\s+(?:the\s+)?pattern\s+of\s+([a-zA-Z0-9_/-]+)/gi,
          /using\s+(?:the\s+)?pattern\s+from\s+([a-zA-Z0-9_/-]+)/gi,
        ],
      },
    ];

    for (const { type, patterns } of referencePatterns) {
      for (const pattern of patterns) {
        const matches = [...prompt.matchAll(pattern)];
        for (const match of matches) {
          references.push({
            type,
            target: match[1],
            relationship: this.inferRelationship(match[0]),
          });
        }
      }
    }

    return references;
  }

  private calculateConfidence(prompt: string, intent: IntentType, entities: Entity[]): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for clear intent
    if (intent !== 'unknown') {
      confidence += 0.2;
    }

    // Increase confidence for detected entities
    const entityCount = entities.length;
    confidence += Math.min(entityCount * 0.1, 0.2);

    // Increase confidence for specific keywords
    const hasEntityType = Object.values(this.entityKeywords).some(keywords =>
      keywords.some(keyword => prompt.includes(keyword))
    );
    if (hasEntityType) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private detectAmbiguities(prompt: string, intent: IntentType, entities: Entity[]): string[] {
    const ambiguities: string[] = [];

    // Check for missing entity name
    if (entities.length === 0) {
      ambiguities.push('No entity name detected. What should it be called?');
    }

    // Check for ambiguous intent
    if (intent === 'unknown') {
      ambiguities.push('Intent unclear. What do you want to create/generate?');
    }

    // Check for multiple entity types
    const entityTypes = [...new Set(entities.map(e => e.type))];
    if (entityTypes.length > 1) {
      ambiguities.push(`Multiple entity types detected: ${entityTypes.join(', ')}. Which is primary?`);
    }

    return ambiguities;
  }

  // ============================================================================
  // Path and File Name Helpers
  // ============================================================================

  private getBasePath(entityType: EntityType): string {
    const pathMap: Record<EntityType, string> = {
      component: 'src/components',
      route: 'src/app/api',
      model: 'src/models',
      service: 'src/services',
      utility: 'src/lib',
      test: 'src/__tests__',
      migration: 'prisma/migrations',
      config: 'src/config',
      module: 'src/modules',
    };
    
    return pathMap[entityType] || 'src';
  }

  private getTestPath(entityType: EntityType): string {
    const testPathMap: Record<EntityType, string> = {
      component: 'src/components/__tests__',
      route: 'src/app/api/__tests__',
      service: 'src/services/__tests__',
      utility: 'src/lib/__tests__',
      model: 'src/models/__tests__',
      test: 'src/__tests__',
      migration: 'prisma/__tests__',
      config: 'src/config/__tests__',
      module: 'src/modules/__tests__',
    };
    
    return testPathMap[entityType] || 'src/__tests__';
  }

  private getFileName(name: string, entityType: EntityType): string {
    const normalized = this.toCamelCase(name);
    
    switch (entityType) {
      case 'component':
        return `${this.toPascalCase(name)}.tsx`;
      case 'route':
        return `${normalized}/route.ts`;
      case 'model':
        return `${normalized}.ts`;
      case 'service':
        return `${normalized}.service.ts`;
      case 'utility':
        return `${normalized}.ts`;
      case 'test':
        return `${normalized}.test.ts`;
      case 'migration':
        return `${Date.now()}_${normalized}.sql`;
      case 'config':
        return `${normalized}.config.ts`;
      case 'module':
        return `${normalized}/index.ts`;
      default:
        return `${normalized}.ts`;
    }
  }

  private getTestFileName(name: string, entityType: EntityType): string {
    const normalized = this.toCamelCase(name);
    
    switch (entityType) {
      case 'component':
        return `${this.toPascalCase(name)}.test.tsx`;
      case 'service':
        return `${normalized}.service.test.ts`;
      default:
        return `${normalized}.test.ts`;
    }
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

  // ============================================================================
  // Original Helper Methods
  // ============================================================================

  private normalizeName(name: string): string {
    // Remove special characters and normalize spacing
    return name.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  }

  private inferEntityType(prompt: string): EntityType {
    // Try to infer entity type from context
    if (prompt.includes('api') || prompt.includes('route') || prompt.includes('endpoint')) {
      return 'route';
    }
    if (prompt.includes('test') || prompt.includes('spec')) {
      return 'test';
    }
    if (prompt.includes('model') || prompt.includes('schema')) {
      return 'model';
    }
    if (prompt.includes('component') || prompt.includes('page')) {
      return 'component';
    }
    if (prompt.includes('service') || prompt.includes('provider')) {
      return 'service';
    }
    if (prompt.includes('util') || prompt.includes('helper')) {
      return 'utility';
    }
    
    // Default to component for web frameworks
    return 'component';
  }

  private inferRelationship(matchText: string): 'similar' | 'extends' | 'uses' | 'based-on' {
    if (matchText.includes('similar')) return 'similar';
    if (matchText.includes('extends')) return 'extends';
    if (matchText.includes('uses') || matchText.includes('using')) return 'uses';
    if (matchText.includes('based on')) return 'based-on';
    return 'similar';
  }

  /**
   * Format parsed intent as a human-readable string
   */
  formatIntent(intent: ParsedIntent): string {
    const entityNames = intent.entities.map(e => e.name).join(', ');
    const modifierNames = intent.modifiers.map(m => m.type).join(', ');
    
    let result = `Intent: ${intent.intent}`;
    if (entityNames) result += `\nEntities: ${entityNames}`;
    if (modifierNames) result += `\nModifiers: ${modifierNames}`;
    if (intent.references.length > 0) {
      result += `\nReferences: ${intent.references.map(r => r.target).join(', ')}`;
    }
    result += `\nConfidence: ${(intent.confidence * 100).toFixed(0)}%`;
    
    return result;
  }
}

// Singleton instance
let instance: PromptParser | null = null;

export function getPromptParser(): PromptParser {
  if (!instance) {
    instance = new PromptParser();
  }
  return instance;
}
