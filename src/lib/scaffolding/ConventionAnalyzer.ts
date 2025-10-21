/**
 * ConventionAnalyzer
 * 
 * Analyzes project codebases to detect naming conventions, import styles,
 * folder structures, and framework patterns. Results are cached per project.
 */

import fs from 'fs';
import path from 'path';
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
    // Get project root path - in production this would come from database
    const projectPath = this.getProjectPath(projectId);
    
    const conventions: ProjectConventions = {
      naming: await this.analyzeNamingConventions(projectPath),
      imports: await this.analyzeImportConventions(projectPath),
      structure: await this.analyzeStructureConventions(projectPath),
      framework: await this.detectFramework(projectPath),
      typescript: await this.detectTypeScript(projectPath),
      testing: await this.detectTesting(projectPath),
      styling: await this.detectStyling(projectPath),
      cacheKey: `${projectId}_${Date.now()}`,
      analyzedAt: new Date(),
      confidence: 0.85,
    };

    return conventions;
  }

  private getProjectPath(projectId: string): string {
    // In production, this would fetch from database
    // For now, use current workspace
    return process.cwd();
  }

  // ============================================================================
  // Naming Convention Analysis
  // ============================================================================

  private async analyzeNamingConventions(projectPath: string): Promise<NamingConventions> {
    const samples = await this.collectCodeSamples(projectPath);
    
    return {
      files: this.detectFileNamingStyle(samples.fileNames),
      directories: this.detectDirectoryNamingStyle(samples.dirNames),
      components: this.detectComponentNamingStyle(samples.componentNames),
      functions: this.detectFunctionNamingStyle(samples.functionNames),
      variables: this.detectVariableNamingStyle(samples.variableNames),
      constants: this.detectConstantNamingStyle(samples.constantNames),
      types: this.detectTypeNamingStyle(),
      examples: {
        file: samples.fileNames[0] || 'example-file.ts',
        component: samples.componentNames[0] || 'ExampleComponent',
        function: samples.functionNames[0] || 'exampleFunction',
        variable: samples.variableNames[0] || 'exampleVariable',
        constant: samples.constantNames[0] || 'EXAMPLE_CONSTANT',
        type: samples.typeNames[0] || 'ExampleType',
      },
    };
  }

  private async collectCodeSamples(projectPath: string): Promise<{
    fileNames: string[];
    dirNames: string[];
    componentNames: string[];
    functionNames: string[];
    variableNames: string[];
    constantNames: string[];
    typeNames: string[];
  }> {
    const samples = {
      fileNames: [] as string[],
      dirNames: [] as string[],
      componentNames: [] as string[],
      functionNames: [] as string[],
      variableNames: [] as string[],
      constantNames: [] as string[],
      typeNames: [] as string[],
    };

    try {
      const srcPath = path.join(projectPath, 'src');
      if (fs.existsSync(srcPath)) {
        await this.scanDirectory(srcPath, samples, 0, 3); // Max depth 3
      }
    } catch (error) {
      console.error('Error collecting code samples:', error);
    }

    return samples;
  }

  private async scanDirectory(
    dirPath: string,
    samples: Record<string, string[]>,
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth >= maxDepth) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip node_modules, .git, etc.
        if (this.shouldSkipEntry(entry.name)) continue;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          samples.dirNames.push(entry.name);
          await this.scanDirectory(fullPath, samples, depth + 1, maxDepth);
        } else if (entry.isFile() && this.isCodeFile(entry.name)) {
          samples.fileNames.push(entry.name.replace(/\.(tsx?|jsx?)$/, ''));
          
          // Analyze file contents for naming patterns
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            this.extractNamingPatterns(content, samples);
          } catch (readError) {
            // Skip files that can't be read
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  private shouldSkipEntry(name: string): boolean {
    const skipList = [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      'coverage',
      '.turbo',
      '__tests__',
      '*.test.*',
    ];
    return skipList.some(skip => 
      skip.includes('*') ? name.includes(skip.replace('*', '')) : name === skip
    );
  }

  private isCodeFile(filename: string): boolean {
    return /\.(tsx?|jsx?)$/.test(filename);
  }

  private extractNamingPatterns(content: string, samples: Record<string, string[]>): void {
    // Extract component names (function/class components)
    const componentMatches = content.matchAll(/(?:export\s+)?(?:function|const|class)\s+([A-Z][a-zA-Z0-9]*)/g);
    for (const match of componentMatches) {
      if (samples.componentNames.length < 20) {
        samples.componentNames.push(match[1]);
      }
    }

    // Extract function names
    const functionMatches = content.matchAll(/(?:export\s+)?(?:function|const)\s+([a-z][a-zA-Z0-9]*)\s*[=(:]/g);
    for (const match of functionMatches) {
      if (samples.functionNames.length < 20) {
        samples.functionNames.push(match[1]);
      }
    }

    // Extract variable names
    const variableMatches = content.matchAll(/(?:const|let|var)\s+([a-z][a-zA-Z0-9]*)\s*=/g);
    for (const match of variableMatches) {
      if (samples.variableNames.length < 20) {
        samples.variableNames.push(match[1]);
      }
    }

    // Extract constant names (all caps)
    const constantMatches = content.matchAll(/(?:const|export\s+const)\s+([A-Z][A-Z0-9_]*)\s*=/g);
    for (const match of constantMatches) {
      if (samples.constantNames.length < 20) {
        samples.constantNames.push(match[1]);
      }
    }

    // Extract type/interface names
    const typeMatches = content.matchAll(/(?:type|interface)\s+([A-Z][a-zA-Z0-9]*)/g);
    for (const match of typeMatches) {
      if (samples.typeNames.length < 20) {
        samples.typeNames.push(match[1]);
      }
    }
  }

  private detectFileNamingStyle(files: string[]): NamingStyle {
    if (files.length === 0) return 'kebab-case';
    
    const kebabCount = files.filter(f => /^[a-z]+(-[a-z]+)*$/.test(f)).length;
    const camelCount = files.filter(f => /^[a-z][a-zA-Z0-9]*$/.test(f)).length;
    const pascalCount = files.filter(f => /^[A-Z][a-zA-Z0-9]*$/.test(f)).length;
    
    const total = files.length;
    if (kebabCount / total > 0.5) return 'kebab-case';
    if (pascalCount / total > 0.5) return 'PascalCase';
    if (camelCount / total > 0.5) return 'camelCase';
    
    return 'kebab-case'; // Default
  }

  private detectDirectoryNamingStyle(dirs: string[]): NamingStyle {
    if (dirs.length === 0) return 'kebab-case';
    
    const kebabCount = dirs.filter(d => /^[a-z]+(-[a-z]+)*$/.test(d)).length;
    const camelCount = dirs.filter(d => /^[a-z][a-zA-Z0-9]*$/.test(d)).length;
    
    return kebabCount > camelCount ? 'kebab-case' : 'camelCase';
  }

  private detectComponentNamingStyle(components: string[]): NamingStyle {
    // Components should almost always be PascalCase
    return 'PascalCase';
  }

  private detectFunctionNamingStyle(functions: string[]): NamingStyle {
    // Functions should almost always be camelCase
    return 'camelCase';
  }

  private detectVariableNamingStyle(variables: string[]): NamingStyle {
    // Variables should almost always be camelCase
    return 'camelCase';
  }

  private detectConstantNamingStyle(constants: string[]): NamingStyle {
    if (constants.length === 0) return 'SCREAMING_SNAKE_CASE';
    
    const screamingCount = constants.filter(c => /^[A-Z][A-Z0-9_]*$/.test(c)).length;
    return screamingCount / constants.length > 0.5 ? 'SCREAMING_SNAKE_CASE' : 'PascalCase';
  }

  private detectTypeNamingStyle(): NamingStyle {
    // Types should almost always be PascalCase
    return 'PascalCase';
  }

  // ============================================================================
  // Import Convention Analysis
  // ============================================================================

  private async analyzeImportConventions(projectPath: string): Promise<ImportConventions> {
    const imports = await this.collectImportSamples(projectPath);
    
    return {
      style: this.detectImportStyle(imports),
      pathAlias: await this.detectPathAliases(projectPath),
      preferredQuotes: this.detectQuoteStyle(imports),
      grouping: 'by-type',
      sortOrder: 'alphabetical',
    };
  }

  private async collectImportSamples(projectPath: string): Promise<string[]> {
    const importLines: string[] = [];
    
    try {
      const srcPath = path.join(projectPath, 'src');
      if (fs.existsSync(srcPath)) {
        await this.scanForImports(srcPath, importLines, 0, 2);
      }
    } catch {
      // Ignore errors
    }
    
    return importLines.slice(0, 50); // Take first 50 samples
  }

  private async scanForImports(
    dirPath: string,
    importLines: string[],
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth >= maxDepth || importLines.length >= 50) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (this.shouldSkipEntry(entry.name)) continue;
        if (importLines.length >= 50) break;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.scanForImports(fullPath, importLines, depth + 1, maxDepth);
        } else if (entry.isFile() && this.isCodeFile(entry.name)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const matches = content.matchAll(/^import\s+.+$/gm);
            for (const match of matches) {
              importLines.push(match[0]);
              if (importLines.length >= 50) break;
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  private detectImportStyle(imports: string[]): 'named' | 'default' | 'namespace' | 'mixed' {
    if (imports.length === 0) return 'named';
    
    const namedCount = imports.filter(i => i.includes('{')).length;
    const defaultCount = imports.filter(i => !i.includes('{') && !i.includes('*')).length;
    
    if (namedCount > defaultCount * 2) return 'named';
    if (defaultCount > namedCount * 2) return 'default';
    return 'mixed';
  }

  private async detectPathAliases(projectPath: string): Promise<Record<string, string>> {
    const aliases: Record<string, string> = {};
    
    // Try to read tsconfig.json
    try {
      const tsconfigPath = path.join(projectPath, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        const content = fs.readFileSync(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(content);
        const paths = tsconfig?.compilerOptions?.paths || {};
        
        for (const [alias, targets] of Object.entries(paths)) {
          if (Array.isArray(targets) && targets.length > 0) {
            aliases[alias] = targets[0] as string;
          }
        }
      }
    } catch {
      // Fallback to common aliases
      aliases['@/*'] = './src/*';
    }
    
    return aliases;
  }

  private detectQuoteStyle(imports: string[]): 'single' | 'double' {
    if (imports.length === 0) return 'single';
    
    const singleCount = imports.filter(i => i.includes("'")).length;
    const doubleCount = imports.filter(i => i.includes('"')).length;
    
    return singleCount > doubleCount ? 'single' : 'double';
  }

  // ============================================================================
  // Structure Convention Analysis
  // ============================================================================

  private async analyzeStructureConventions(projectPath: string): Promise<StructureConventions> {
    const structure = await this.detectProjectStructure(projectPath);
    
    return {
      rootDir: '.',
      sourceDir: structure.hasSourceDir ? 'src/' : './',
      componentDir: structure.componentDir || 'src/components',
      utilsDir: structure.utilsDir || 'src/lib',
      typesDir: structure.typesDir || 'src/types',
      testPattern: structure.testPattern || '*.test.ts',
      configLocation: '.',
      flatStructure: structure.flatStructure,
    };
  }

  private async detectProjectStructure(projectPath: string): Promise<{
    hasSourceDir: boolean;
    componentDir: string | null;
    utilsDir: string | null;
    typesDir: string | null;
    testPattern: string;
    flatStructure: boolean;
  }> {
    const srcPath = path.join(projectPath, 'src');
    const hasSourceDir = fs.existsSync(srcPath);
    
    let componentDir: string | null = null;
    let utilsDir: string | null = null;
    let typesDir: string | null = null;
    let flatStructure = false;
    
    if (hasSourceDir) {
      const srcEntries = fs.readdirSync(srcPath, { withFileTypes: true });
      
      for (const entry of srcEntries) {
        if (entry.isDirectory()) {
          if (entry.name === 'components') componentDir = 'src/components';
          if (entry.name === 'lib' || entry.name === 'utils') utilsDir = `src/${entry.name}`;
          if (entry.name === 'types') typesDir = 'src/types';
        }
      }
      
      // Detect flat structure (many files at src root)
      const filesAtRoot = srcEntries.filter(e => e.isFile()).length;
      flatStructure = filesAtRoot > 10;
    }
    
    return {
      hasSourceDir,
      componentDir,
      utilsDir,
      typesDir,
      testPattern: '*.test.ts',
      flatStructure,
    };
  }

  // ============================================================================
  // Framework & Tool Detection
  // ============================================================================

  private async detectFramework(projectPath: string): Promise<FrameworkInfo> {
    const packageJson = await this.readPackageJson(projectPath);
    const dependencies = packageJson?.dependencies as Record<string, string> | undefined;
    const devDependencies = packageJson?.devDependencies as Record<string, string> | undefined;
    
    // Detect Next.js
    if (dependencies?.next || devDependencies?.next) {
      const version = dependencies?.next || devDependencies?.next || '';
      const hasAppDir = fs.existsSync(path.join(projectPath, 'src', 'app'));
      
      return {
        name: 'nextjs',
        version: version.replace(/[\^~]/, ''),
        features: hasAppDir ? ['app-router', 'server-actions', 'api-routes'] : ['pages-router', 'api-routes'],
        router: hasAppDir ? 'app-router' : 'pages-router',
        serverComponents: hasAppDir,
        stateManagement: this.detectStateManagement(packageJson) as 'redux' | 'zustand' | 'jotai' | 'recoil' | 'none' | undefined,
      };
    }
    
    // Detect React
    if (dependencies?.react || devDependencies?.react) {
      return {
        name: 'react',
        version: dependencies?.react?.replace(/[\^~]/, '') || '18.0.0',
        features: [],
        stateManagement: this.detectStateManagement(packageJson) as 'redux' | 'zustand' | 'jotai' | 'recoil' | 'none' | undefined,
      };
    }
    
    // Default
    return {
      name: 'unknown',
      version: '0.0.0',
      features: [],
    };
  }

  private detectStateManagement(packageJson: Record<string, unknown> | null): string {
    if (!packageJson) return 'none';
    
    const deps = { 
      ...(packageJson?.dependencies as Record<string, string>), 
      ...(packageJson?.devDependencies as Record<string, string>) 
    };
    
    if (deps?.redux || deps?.['@reduxjs/toolkit']) return 'redux';
    if (deps?.zustand) return 'zustand';
    if (deps?.jotai) return 'jotai';
    if (deps?.recoil) return 'recoil';
    
    return 'none';
  }

  private async detectTypeScript(projectPath: string): Promise<TypeScriptConfig> {
    try {
      const tsconfigPath = path.join(projectPath, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        const content = fs.readFileSync(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(content);
        
        return {
          enabled: true,
          strict: tsconfig.compilerOptions?.strict ?? false,
          version: '5.0.0', // Could be parsed from package.json
          compilerOptions: {
            target: tsconfig.compilerOptions?.target || 'ES2022',
            lib: tsconfig.compilerOptions?.lib || ['ES2022'],
            jsx: tsconfig.compilerOptions?.jsx || 'preserve',
          },
          pathMapping: tsconfig.compilerOptions?.paths || {},
        };
      }
    } catch {
      // Fallback
    }
    
    return {
      enabled: false,
      strict: false,
      version: '5.0.0',
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022'],
        jsx: 'preserve',
      },
      pathMapping: {},
    };
  }

  private async detectTesting(projectPath: string): Promise<TestingConfig | undefined> {
    const packageJson = await this.readPackageJson(projectPath);
    if (!packageJson) return undefined;
    
    const deps = { 
      ...(packageJson.dependencies as Record<string, string> || {}), 
      ...(packageJson.devDependencies as Record<string, string> || {}) 
    };
    
    if (deps?.jest || deps?.['@jest/core']) {
      return {
        framework: 'jest',
        coverage: !!deps?.['@jest/coverage'],
        testDir: '__tests__',
        setupFiles: fs.existsSync(path.join(projectPath, 'jest.setup.js')) ? ['jest.setup.js'] : [],
      };
    }
    
    if (deps?.vitest) {
      return {
        framework: 'vitest',
        coverage: true,
        testDir: '__tests__',
        setupFiles: [],
      };
    }
    
    return undefined;
  }

  private async detectStyling(projectPath: string): Promise<StylingConfig | undefined> {
    const packageJson = await this.readPackageJson(projectPath);
    if (!packageJson) return undefined;
    
    const deps = { 
      ...(packageJson.dependencies as Record<string, string> || {}), 
      ...(packageJson.devDependencies as Record<string, string> || {}) 
    };
    
    if (deps?.tailwindcss) {
      return {
        approach: 'tailwind',
        framework: 'tailwindcss',
        cssModules: false,
      };
    }
    
    if (deps?.['styled-components']) {
      return {
        approach: 'styled-components',
        framework: 'styled-components',
        cssModules: false,
      };
    }
    
    // Check for CSS modules
    try {
      const srcPath = path.join(projectPath, 'src');
      if (fs.existsSync(srcPath)) {
        const files = fs.readdirSync(srcPath, { recursive: true });
        const hasCssModules = files.some((file) => 
          typeof file === 'string' && file.endsWith('.module.css')
        );
        
        if (hasCssModules) {
          return {
            approach: 'css-modules',
            framework: 'css-modules',
            cssModules: true,
          };
        }
      }
    } catch {
      // Ignore errors
    }
    
    return undefined;
  }

  private async readPackageJson(projectPath: string): Promise<Record<string, unknown> | null> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        return JSON.parse(content) as Record<string, unknown>;
      }
    } catch {
      // Fallback
    }
    return null;
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
