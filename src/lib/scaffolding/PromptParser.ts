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
    
    return {
      raw: prompt,
      intent: this.extractIntent(normalized),
      entities: this.extractEntities(normalized),
      modifiers: this.extractModifiers(normalized),
      references: this.extractReferences(normalized),
      confidence: this.calculateConfidence(normalized),
      ambiguities: this.detectAmbiguities(normalized),
    };
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
    
    // Look for entity type keywords
    for (const [type, keywords] of Object.entries(this.entityKeywords)) {
      for (const keyword of keywords) {
        const regex = new RegExp(`${keyword}\\s+(?:called|named)?\\s*([a-zA-Z0-9_-]+)`, 'gi');
        const matches = [...prompt.matchAll(regex)];
        
        for (const match of matches) {
          const name = match[1];
          const position: [number, number] = [match.index || 0, (match.index || 0) + match[0].length];
          
          entities.push({
            type: type as EntityType,
            name: this.normalizeName(name),
            position,
          });
        }
      }
    }

    // If no entities found, try to extract name after intent
    if (entities.length === 0) {
      const simpleMatch = prompt.match(/(?:create|generate|add|make|build)\s+(?:a|an)?\s*([a-zA-Z0-9_-]+)/i);
      if (simpleMatch) {
        entities.push({
          type: this.inferEntityType(prompt),
          name: this.normalizeName(simpleMatch[1]),
          position: [simpleMatch.index || 0, (simpleMatch.index || 0) + simpleMatch[0].length],
        });
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

  private calculateConfidence(prompt: string): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for clear intent
    if (this.extractIntent(prompt) !== 'unknown') {
      confidence += 0.2;
    }

    // Increase confidence for detected entities
    const entityCount = this.extractEntities(prompt).length;
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

  private detectAmbiguities(prompt: string): string[] {
    const ambiguities: string[] = [];

    // Check for missing entity name
    const entities = this.extractEntities(prompt);
    if (entities.length === 0) {
      ambiguities.push('No entity name detected. What should it be called?');
    }

    // Check for ambiguous intent
    const intent = this.extractIntent(prompt);
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
  // Helper Methods
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
