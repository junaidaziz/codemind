/**
 * ConventionAnalyzer
 * 
 * Analyzes project codebases to detect naming conventions, import styles,
 * folder structures, and framework patterns. Results are cached per project.
 */

import type {
  ProjectConventions,
  NamingConventions,
  ImportConventions,
  StructureConventions,
  FrameworkInfo,
  TypeScriptConfig,
  TestingConfig,
  StylingConfig,
  NamingStyle,
  Framework,
} from './types';

export class ConventionAnalyzer {
  private conventionCache: Map<string, ProjectConventions>;

  constructor() {
    this.conventionCache = new Map();
  }

  /**
   * Analyze all conventions in a project
   */
  async analyzeProject(projectId: string): Promise<ProjectConventions> {
    // Check cache first
    const cached = this.conventionCache.get(projectId);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    // Perform analysis
    const conventions = await this.performAnalysis(projectId);
    
    // Cache result
    this.conventionCache.set(projectId, conventions);
    
    return conventions;
  }

  /**
   * Clear cache for a specific project
   */
  clearCache(projectId: string): void {
    this.conventionCache.delete(projectId);
  }

  /**
   * Clear all cached conventions
   */
  clearAllCache(): void {
    this.conventionCache.clear();
  }

  // ============================================================================
  // Private Analysis Methods
  // ============================================================================

  private async performAnalysis(projectId: string): Promise<ProjectConventions> {
    // TODO: Implement actual project analysis
    // For now, return mock data to allow other services to work
    
    const mockConventions: ProjectConventions = {
      naming: this.createMockNamingConventions(),
      imports: this.createMockImportConventions(),
      structure: this.createMockStructureConventions(),
      framework: this.detectFramework(projectId),
      typescript: this.detectTypeScript(projectId),
      testing: this.detectTesting(projectId),
      styling: this.detectStyling(projectId),
      cacheKey: `${projectId}_${Date.now()}`,
      analyzedAt: new Date(),
      confidence: 0.85, // Mock confidence score
    };

    return mockConventions;
  }

  private createMockNamingConventions(): NamingConventions {
    return {
      files: 'kebab-case',
      directories: 'kebab-case',
      components: 'PascalCase',
      functions: 'camelCase',
      variables: 'camelCase',
      constants: 'SCREAMING_SNAKE_CASE',
      types: 'PascalCase',
      examples: {
        file: 'user-profile.tsx',
        component: 'UserProfile',
        function: 'getUserProfile',
        variable: 'userProfile',
        constant: 'MAX_RETRY_COUNT',
        type: 'UserProfile',
      },
    };
  }

  private createMockImportConventions(): ImportConventions {
    return {
      style: 'named',
      pathAlias: {
        '@/': 'src/',
        '@components/': 'src/components/',
        '@lib/': 'src/lib/',
      },
      preferredQuotes: 'single',
      grouping: 'by-type',
      sortOrder: 'alphabetical',
    };
  }

  private createMockStructureConventions(): StructureConventions {
    return {
      rootDir: '.',
      sourceDir: 'src/',
      componentDir: 'src/components',
      utilsDir: 'src/lib',
      typesDir: 'src/types',
      testPattern: '*.test.ts',
      configLocation: '.',
      flatStructure: false,
    };
  }

  private detectFramework(_projectId: string): FrameworkInfo {
    // TODO: Actually detect framework from package.json and file structure
    return {
      name: 'nextjs',
      version: '15.0.0',
      features: ['app-router', 'server-actions', 'api-routes'],
      router: 'app-router',
      serverComponents: true,
      stateManagement: 'none',
    };
  }

  private detectTypeScript(_projectId: string): TypeScriptConfig {
    // TODO: Read from tsconfig.json
    return {
      enabled: true,
      strict: true,
      version: '5.0.0',
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022'],
        jsx: 'preserve',
      },
      pathMapping: {
        '@/*': ['./src/*'],
      },
    };
  }

  private detectTesting(_projectId: string): TestingConfig | undefined {
    // TODO: Detect testing framework from package.json
    return {
      framework: 'jest',
      coverage: true,
      testDir: '__tests__',
      setupFiles: ['jest.setup.js'],
    };
  }

  private detectStyling(_projectId: string): StylingConfig | undefined {
    // TODO: Detect styling approach from files and config
    return {
      approach: 'tailwind',
      framework: 'tailwindcss',
      cssModules: false,
    };
  }

  private isCacheValid(conventions: ProjectConventions): boolean {
    const ONE_HOUR = 60 * 60 * 1000;
    const age = Date.now() - conventions.analyzedAt.getTime();
    return age < ONE_HOUR;
  }

  // ============================================================================
  // Public Helper Methods
  // ============================================================================

  /**
   * Get naming style for a specific category
   */
  getNamingStyle(conventions: ProjectConventions, category: keyof NamingConventions): NamingStyle {
    return conventions.naming[category] as NamingStyle;
  }

  /**
   * Check if project uses TypeScript
   */
  isTypeScriptProject(conventions: ProjectConventions): boolean {
    return conventions.typescript.enabled;
  }

  /**
   * Get framework name
   */
  getFramework(conventions: ProjectConventions): Framework {
    return conventions.framework.name;
  }

  /**
   * Check if project has a specific feature
   */
  hasFeature(conventions: ProjectConventions, feature: string): boolean {
    return conventions.framework.features.includes(feature as never);
  }
}

// Singleton instance
let instance: ConventionAnalyzer | null = null;

export function getConventionAnalyzer(): ConventionAnalyzer {
  if (!instance) {
    instance = new ConventionAnalyzer();
  }
  return instance;
}
