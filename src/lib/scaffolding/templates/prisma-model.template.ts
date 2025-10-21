/**
 * Prisma Model Template
 * 
 * Generates a Prisma schema model with:
 * - Fields with types
 * - Relations
 * - Indexes
 * - Constraints
 */

import type { Template } from '../types';

export const prismaModelTemplate: Template = {
  id: 'prisma-model',
  name: 'Prisma Model',
  description: 'Prisma database model with relations',
  category: 'model',
  tags: ['prisma', 'database', 'model', 'orm'],
  version: '1.0.0',
  
  variables: [
    {
      name: 'modelName',
      type: 'string',
      required: true,
      description: 'Name of the model (PascalCase)',
    },
    {
      name: 'fields',
      type: 'array',
      required: false,
      description: 'Model fields with types',
    },
    {
      name: 'relations',
      type: 'array',
      required: false,
      description: 'Relations to other models',
    },
    {
      name: 'withTimestamps',
      type: 'boolean',
      required: false,
      description: 'Include createdAt and updatedAt',
    },
  ],

  files: [
    {
      path: 'prisma/schema.prisma',
      content: `// {{pascalCase modelName}} Model
// Add this to your existing schema.prisma file

model {{pascalCase modelName}} {
  id        String   @id @default(uuid())
{{#if fields}}{{#each fields}}  {{this.name}}  {{this.type}}{{#if this.optional}}?{{/if}}{{#if this.unique}} @unique{{/if}}{{#if this.default}} @default({{this.default}}){{/if}}
{{/each}}{{else}}  // Add your fields here
  name      String
  email     String   @unique
{{/if}}{{#if withTimestamps}}  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
{{/if}}{{#if relations}}{{#each relations}}  {{this.name}}  {{this.type}}{{#if this.optional}}?{{/if}}  @relation(fields: [{{this.foreignKey}}], references: [id])
  {{this.foreignKey}}  String{{#if this.optional}}?{{/if}}
{{/each}}{{/if}}

  @@map("{{snakeCase modelName}}")
}
`,
      language: 'prisma',
      optional: false,
    },
  ],

  examples: [
    '/scaffold "create Prisma model for User"',
    '/scaffold "add Product model with Category relation"',
  ],
};
