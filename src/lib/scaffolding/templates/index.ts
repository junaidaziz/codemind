/**
 * Template Registry
 * 
 * Central registry for all code templates.
 * Automatically registers templates with the TemplateEngine.
 */

import { TemplateEngine } from '../TemplateEngine';
import { nextjsApiRouteTemplate } from './nextjs-api-route.template';
import { reactComponentTemplate } from './react-component.template';
import { prismaModelTemplate } from './prisma-model.template';
import { reactHookTemplate } from './react-hook.template';

/**
 * All available templates
 */
export const ALL_TEMPLATES = [
  nextjsApiRouteTemplate,
  reactComponentTemplate,
  prismaModelTemplate,
  reactHookTemplate,
] as const;

/**
 * Register all templates with a TemplateEngine instance
 */
export function registerAllTemplates(engine: TemplateEngine): void {
  for (const template of ALL_TEMPLATES) {
    engine.registerTemplate(template);
  }
  
  console.log(`✅ Registered ${ALL_TEMPLATES.length} templates`);
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string) {
  return ALL_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string) {
  return ALL_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get templates by framework
 */
export function getTemplatesByFramework(framework: string) {
  return ALL_TEMPLATES.filter(t => t.framework === framework);
}

/**
 * Get templates by tag
 */
export function getTemplatesByTag(tag: string) {
  return ALL_TEMPLATES.filter(t => t.tags.includes(tag));
}

/**
 * Search templates by query
 */
export function searchTemplates(query: string) {
  const lowerQuery = query.toLowerCase();
  return ALL_TEMPLATES.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}
