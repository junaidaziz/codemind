/**
 * React Component Template
 * 
 * Generates a React functional component with TypeScript:
 * - Props interface
 * - JSDoc comments
 * - Optional styling
 * - Optional state management
 */

import type { Template } from '../types';

export const reactComponentTemplate: Template = {
  id: 'react-component',
  name: 'React Component',
  description: 'React functional component with TypeScript',
  category: 'component',
  framework: 'react',
  tags: ['react', 'component', 'typescript', 'tsx'],
  version: '1.0.0',
  
  variables: [
    {
      name: 'componentName',
      type: 'string',
      required: true,
      description: 'Name of the component (PascalCase)',
    },
    {
      name: 'props',
      type: 'array',
      required: false,
      description: 'Component props with types',
    },
    {
      name: 'withState',
      type: 'boolean',
      required: false,
      description: 'Include useState hooks',
    },
    {
      name: 'withEffects',
      type: 'boolean',
      required: false,
      description: 'Include useEffect hooks',
    },
    {
      name: 'styled',
      type: 'boolean',
      required: false,
      description: 'Include CSS module',
    },
  ],

  files: [
    {
      path: 'src/components/{{pascalCase componentName}}.tsx',
      content: `{{#if withState}}import { useState{{#if withEffects}}, useEffect{{/if}} } from 'react';
{{/if}}{{#if styled}}import styles from './{{pascalCase componentName}}.module.css';
{{/if}}
/**
 * {{pascalCase componentName}} Props
 */
{{#if props}}interface {{pascalCase componentName}}Props {
{{#each props}}  {{this.name}}{{#unless this.required}}?{{/unless}}: {{this.type}};
{{/each}}}
{{else}}interface {{pascalCase componentName}}Props {
  // Add your props here
  className?: string;
}
{{/if}}

/**
 * {{pascalCase componentName}} Component
 * 
 * @description Add your component description here
 */
export default function {{pascalCase componentName}}({{#if props}}{
{{#each props}}  {{this.name}},
{{/each}}}: {{pascalCase componentName}}Props{{else}}props: {{pascalCase componentName}}Props{{/if}}) {
{{#if withState}}  // State management
  const [value, setValue] = useState('');

{{/if}}{{#if withEffects}}  // Side effects
  useEffect(() => {
    // Add your effect logic here
    console.log('{{pascalCase componentName}} mounted');

    return () => {
      // Cleanup
      console.log('{{pascalCase componentName}} unmounted');
    };
  }, []);

{{/if}}  return (
    <div{{#if styled}} className={styles.container}{{/if}}>
      <h2>{{pascalCase componentName}}</h2>
      {/* Add your component JSX here */}
    </div>
  );
}
`,
      language: 'tsx',
      optional: false,
    },
    {
      path: 'src/components/{{pascalCase componentName}}.module.css',
      content: `.container {
  /* Add your styles here */
  padding: 1rem;
}
`,
      language: 'typescript', // CSS files not in type, using typescript as fallback
      optional: true,
      condition: 'styled',
    },
  ],

  examples: [
    '/scaffold "create UserProfile component"',
    '/scaffold "add Card component with state"',
  ],
};
