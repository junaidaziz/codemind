/**
 * React Custom Hook Template
 * 
 * Generates a custom React hook with TypeScript
 */

import type { Template } from '../types';

export const reactHookTemplate: Template = {
  id: 'react-hook',
  name: 'React Custom Hook',
  description: 'Custom React hook with TypeScript',
  category: 'utility',
  framework: 'react',
  tags: ['react', 'hook', 'typescript', 'custom'],
  version: '1.0.0',
  
  variables: [
    {
      name: 'hookName',
      type: 'string',
      required: true,
      description: 'Name of the hook (use prefix, e.g., useAuth)',
    },
    {
      name: 'returnType',
      type: 'string',
      required: false,
      description: 'Return type of the hook',
    },
  ],

  files: [
    {
      path: 'src/hooks/{{camelCase hookName}}.ts',
      content: `import { useState, useEffect } from 'react';

/**
 * {{camelCase hookName}} Hook
 * 
 * @description Add your hook description here
 */
export function {{camelCase hookName}}(){{#if returnType}}: {{returnType}}{{/if}} {
  // State
  const [state, setState] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Effects
  useEffect(() => {
    // Add your effect logic here
    setLoading(true);
    
    // Cleanup
    return () => {
      // Add cleanup logic
    };
  }, []);

  // Return hook values
  return {
    state,
    loading,
    error,
    setState,
  };
}
`,
      language: 'typescript',
      optional: false,
    },
  ],

  examples: [
    '/scaffold "create useAuth hook"',
    '/scaffold "add useFetch hook for API calls"',
  ],
};
