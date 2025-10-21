/**
 * Coverage Analysis Engine
 * 
 * Analyzes test coverage across the codebase and identifies untested files and functions.
 * Provides detailed insights into coverage gaps for AI-powered test generation.
 * 
 * @module testing/coverage-analyzer
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';

/**
 * Represents a function or method in the codebase
 */
export interface CodeFunction {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  params: string[];
  isAsync: boolean;
  isExported: boolean;
  complexity: number;
  type: 'function' | 'method' | 'arrow' | 'class';
}

/**
 * Represents a file's coverage information
 */
export interface FileCoverage {
  filePath: string;
  relativePath: string;
  hasTests: boolean;
  testFilePath?: string;
  functions: CodeFunction[];
  untestedFunctions: CodeFunction[];
  coveragePercentage: number;
  linesOfCode: number;
  priority: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Overall coverage report
 */
export interface CoverageReport {
  totalFiles: number;
  testedFiles: number;
  untestedFiles: number;
  totalFunctions: number;
  testedFunctions: number;
  untestedFunctions: number;
  overallCoverage: number;
  files: FileCoverage[];
  highPriorityFiles: FileCoverage[];
  timestamp: Date;
}

/**
 * Coverage Analysis Engine
 */
export class CoverageAnalyzer {
  private projectRoot: string;
  private testPatterns: RegExp[];
  private sourcePatterns: RegExp[];
  private ignorePatterns: RegExp[];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    
    // Test file patterns
    this.testPatterns = [
      /\.test\.(ts|tsx|js|jsx)$/,
      /\.spec\.(ts|tsx|js|jsx)$/,
      /__tests__\/.*\.(ts|tsx|js|jsx)$/,
      /\.e2e\.(ts|tsx|js|jsx)$/,
      /\.integration\.(ts|tsx|js|jsx)$/,
    ];

    // Source file patterns
    this.sourcePatterns = [
      /\.(ts|tsx|js|jsx)$/,
    ];

    // Ignore patterns
    this.ignorePatterns = [
      /node_modules/,
      /\.next/,
      /dist/,
      /build/,
      /coverage/,
      /\.config\.(ts|js)$/,
      /\.d\.ts$/,
      /types\//,
      /__mocks__/,
    ];
  }

  /**
   * Analyze coverage for the entire project
   */
  async analyze(targetDir?: string): Promise<CoverageReport> {
    const scanDir = targetDir || this.projectRoot;
    const sourceFiles = await this.findSourceFiles(scanDir);
    const testFiles = await this.findTestFiles(scanDir);
    
    const testFileSet = new Set(testFiles.map(f => path.basename(f, path.extname(f))));
    const fileCoverages: FileCoverage[] = [];

    for (const sourceFile of sourceFiles) {
      const coverage = await this.analyzeFile(sourceFile, testFileSet);
      fileCoverages.push(coverage);
    }

    // Sort by priority
    fileCoverages.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const testedFiles = fileCoverages.filter(f => f.hasTests).length;
    const totalFunctions = fileCoverages.reduce((sum, f) => sum + f.functions.length, 0);
    const untestedFunctions = fileCoverages.reduce((sum, f) => sum + f.untestedFunctions.length, 0);
    const testedFunctions = totalFunctions - untestedFunctions;

    return {
      totalFiles: fileCoverages.length,
      testedFiles,
      untestedFiles: fileCoverages.length - testedFiles,
      totalFunctions,
      testedFunctions,
      untestedFunctions,
      overallCoverage: totalFunctions > 0 ? (testedFunctions / totalFunctions) * 100 : 0,
      files: fileCoverages,
      highPriorityFiles: fileCoverages.filter(f => f.priority === 'high'),
      timestamp: new Date(),
    };
  }

  /**
   * Analyze a single file for coverage
   */
  private async analyzeFile(filePath: string, testFiles: Set<string>): Promise<FileCoverage> {
    const content = await fs.readFile(filePath, 'utf-8');
    const functions = await this.extractFunctions(filePath, content);
    const relativePath = path.relative(this.projectRoot, filePath);
    
    // Check if test file exists
    const hasTests = this.checkTestFileExists(filePath, testFiles);
    const testFilePath = hasTests ? this.getTestFilePath(filePath) : undefined;

    // For files without tests, all functions are untested
    const untestedFunctions = hasTests ? [] : functions;
    const coveragePercentage = hasTests ? 100 : 0;

    // Determine priority
    const priority = this.determinePriority(filePath, functions, hasTests);
    const reason = this.getPriorityReason(filePath, functions, hasTests);

    return {
      filePath,
      relativePath,
      hasTests,
      testFilePath,
      functions,
      untestedFunctions,
      coveragePercentage,
      linesOfCode: content.split('\n').length,
      priority,
      reason,
    };
  }

  /**
   * Extract functions from a file using AST parsing
   */
  private async extractFunctions(filePath: string, content: string): Promise<CodeFunction[]> {
    const functions: CodeFunction[] = [];
    
    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: [
          'typescript',
          'jsx',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
        ],
      });

      traverse(ast, {
        FunctionDeclaration: (path) => {
          const node = path.node;
          functions.push({
            name: node.id?.name || 'anonymous',
            filePath,
            startLine: node.loc?.start.line || 0,
            endLine: node.loc?.end.line || 0,
            params: node.params.map(p => this.getParamName(p)),
            isAsync: node.async || false,
            isExported: this.isExported(path),
            complexity: this.calculateComplexity(path),
            type: 'function',
          });
        },
        ArrowFunctionExpression: (path) => {
          const parent = path.parent;
          if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
            const node = path.node;
            functions.push({
              name: parent.id.name,
              filePath,
              startLine: node.loc?.start.line || 0,
              endLine: node.loc?.end.line || 0,
              params: node.params.map(p => this.getParamName(p)),
              isAsync: node.async || false,
              isExported: (path.parentPath?.parentPath && this.isExported(path.parentPath.parentPath)) || false,
              complexity: this.calculateComplexity(path),
              type: 'arrow',
            });
          }
        },
        ClassMethod: (path) => {
          const node = path.node;
          const className = this.getClassName(path);
          functions.push({
            name: `${className}.${this.getMethodName(node.key)}`,
            filePath,
            startLine: node.loc?.start.line || 0,
            endLine: node.loc?.end.line || 0,
            params: node.params.map(p => this.getParamName(p)),
            isAsync: node.async || false,
            isExported: true, // Methods in exported classes are considered exported
            complexity: this.calculateComplexity(path),
            type: 'method',
          });
        },
        ClassDeclaration: (path) => {
          const node = path.node;
          if (node.id) {
            functions.push({
              name: node.id.name,
              filePath,
              startLine: node.loc?.start.line || 0,
              endLine: node.loc?.end.line || 0,
              params: [],
              isAsync: false,
              isExported: this.isExported(path),
              complexity: 1,
              type: 'class',
            });
          }
        },
      });
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error);
    }

    return functions;
  }

  /**
   * Calculate cyclomatic complexity of a function
   */
  private calculateComplexity(path: NodePath): number {
    let complexity = 1;

    path.traverse({
      IfStatement: () => complexity++,
      ConditionalExpression: () => complexity++,
      ForStatement: () => complexity++,
      WhileStatement: () => complexity++,
      DoWhileStatement: () => complexity++,
      SwitchCase: () => complexity++,
      LogicalExpression: (logicalPath: NodePath) => {
        const node = logicalPath.node as { operator?: string };
        if (node.operator === '&&' || node.operator === '||') {
          complexity++;
        }
      },
      CatchClause: () => complexity++,
    });

    return complexity;
  }

  /**
   * Check if a node is exported
   */
  private isExported(path: NodePath): boolean {
    let current: NodePath | null = path;
    while (current) {
      if (
        current.isExportNamedDeclaration() ||
        current.isExportDefaultDeclaration()
      ) {
        return true;
      }
      current = current.parentPath;
    }
    return false;
  }

  /**
   * Get parameter name from node
   */
  private getParamName(param: { type: string; name?: string; argument?: { type: string; name?: string }; left?: { type: string; name?: string } }): string {
    if (param.type === 'Identifier') {
      return param.name || 'unknown';
    } else if (param.type === 'RestElement' && param.argument?.type === 'Identifier') {
      return `...${param.argument.name || 'unknown'}`;
    } else if (param.type === 'AssignmentPattern' && param.left?.type === 'Identifier') {
      return param.left.name || 'unknown';
    }
    return 'unknown';
  }

  /**
   * Get class name from method path
   */
  private getClassName(path: NodePath): string {
    let current: NodePath | null = path;
    while (current) {
      const node = current.node as { type?: string; id?: { name?: string } };
      if (node.type === 'ClassDeclaration' && node.id) {
        return node.id.name || 'Unknown';
      }
      current = current.parentPath;
    }
    return 'Unknown';
  }

  /**
   * Get method name from key
   */
  private getMethodName(key: unknown): string {
    if (typeof key === 'object' && key !== null) {
      const keyObj = key as { type: string; name?: string; value?: string | boolean };
      if (keyObj.type === 'Identifier' && keyObj.name) {
        return keyObj.name;
      } else if (keyObj.type === 'StringLiteral' && typeof keyObj.value === 'string') {
        return keyObj.value;
      }
    }
    return 'unknown';
  }

  /**
   * Check if test file exists for source file
   */
  private checkTestFileExists(sourceFile: string, testFiles: Set<string>): boolean {
    const baseName = path.basename(sourceFile, path.extname(sourceFile));
    return testFiles.has(baseName);
  }

  /**
   * Get test file path for source file
   */
  private getTestFilePath(sourceFile: string): string {
    const dir = path.dirname(sourceFile);
    const ext = path.extname(sourceFile);
    const baseName = path.basename(sourceFile, ext);
    
    // Common test file patterns
    const patterns = [
      path.join(dir, '__tests__', `${baseName}.test${ext}`),
      path.join(dir, `${baseName}.test${ext}`),
      path.join(dir, `${baseName}.spec${ext}`),
    ];

    return patterns[0]; // Return most common pattern
  }

  /**
   * Determine priority for testing
   */
  private determinePriority(
    filePath: string,
    functions: CodeFunction[],
    hasTests: boolean
  ): 'high' | 'medium' | 'low' {
    if (hasTests) return 'low';

    // High priority: API routes, services, utilities with many exported functions
    if (
      filePath.includes('/api/') ||
      filePath.includes('/services/') ||
      filePath.includes('/lib/')
    ) {
      const exportedFunctions = functions.filter(f => f.isExported);
      if (exportedFunctions.length >= 3) return 'high';
    }

    // High priority: Complex functions
    const complexFunctions = functions.filter(f => f.complexity > 5);
    if (complexFunctions.length > 0) return 'high';

    // Medium priority: Components, hooks
    if (
      filePath.includes('/components/') ||
      filePath.includes('/hooks/') ||
      functions.length >= 2
    ) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get reason for priority
   */
  private getPriorityReason(
    filePath: string,
    functions: CodeFunction[],
    hasTests: boolean
  ): string {
    if (hasTests) return 'Has test coverage';

    const exportedCount = functions.filter(f => f.isExported).length;
    const complexCount = functions.filter(f => f.complexity > 5).length;

    if (filePath.includes('/api/')) {
      return `API route with ${exportedCount} exported functions`;
    }

    if (filePath.includes('/services/') || filePath.includes('/lib/')) {
      return `Core logic with ${exportedCount} exported functions`;
    }

    if (complexCount > 0) {
      return `Contains ${complexCount} complex functions (complexity > 5)`;
    }

    if (filePath.includes('/components/')) {
      return `UI component with ${functions.length} functions`;
    }

    if (filePath.includes('/hooks/')) {
      return `React hook with ${functions.length} functions`;
    }

    return `${functions.length} functions to test`;
  }

  /**
   * Find all source files
   */
  private async findSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const processDirectory = async (currentDir: string) => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        // Skip ignored paths
        if (this.ignorePatterns.some(pattern => pattern.test(fullPath))) {
          continue;
        }

        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          // Include source files but exclude test files
          const isSource = this.sourcePatterns.some(pattern => pattern.test(entry.name));
          const isTest = this.testPatterns.some(pattern => pattern.test(entry.name));
          
          if (isSource && !isTest) {
            files.push(fullPath);
          }
        }
      }
    };

    await processDirectory(dir);
    return files;
  }

  /**
   * Find all test files
   */
  private async findTestFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const processDirectory = async (currentDir: string) => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        // Skip ignored paths
        if (this.ignorePatterns.some(pattern => pattern.test(fullPath))) {
          continue;
        }

        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          if (this.testPatterns.some(pattern => pattern.test(entry.name))) {
            files.push(fullPath);
          }
        }
      }
    };

    await processDirectory(dir);
    return files;
  }

  /**
   * Generate coverage report in markdown format
   */
  generateMarkdownReport(report: CoverageReport): string {
    const { files, totalFiles, testedFiles, untestedFiles, overallCoverage } = report;

    let md = `# Test Coverage Analysis Report\n\n`;
    md += `**Generated:** ${report.timestamp.toISOString()}\n\n`;
    md += `## Summary\n\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Total Files | ${totalFiles} |\n`;
    md += `| Tested Files | ${testedFiles} (${((testedFiles / totalFiles) * 100).toFixed(1)}%) |\n`;
    md += `| Untested Files | ${untestedFiles} (${((untestedFiles / totalFiles) * 100).toFixed(1)}%) |\n`;
    md += `| Total Functions | ${report.totalFunctions} |\n`;
    md += `| Tested Functions | ${report.testedFunctions} |\n`;
    md += `| Untested Functions | ${report.untestedFunctions} |\n`;
    md += `| Overall Coverage | ${overallCoverage.toFixed(1)}% |\n\n`;

    md += `## High Priority Files (Needs Testing)\n\n`;
    const highPriority = files.filter(f => f.priority === 'high' && !f.hasTests);
    if (highPriority.length > 0) {
      md += `| File | Functions | Reason |\n`;
      md += `|------|-----------|--------|\n`;
      highPriority.forEach(file => {
        md += `| \`${file.relativePath}\` | ${file.functions.length} | ${file.reason} |\n`;
      });
    } else {
      md += `✅ No high priority files without tests!\n`;
    }

    md += `\n## Medium Priority Files\n\n`;
    const mediumPriority = files.filter(f => f.priority === 'medium' && !f.hasTests);
    if (mediumPriority.length > 0) {
      md += `| File | Functions | Reason |\n`;
      md += `|------|-----------|--------|\n`;
      mediumPriority.slice(0, 10).forEach(file => {
        md += `| \`${file.relativePath}\` | ${file.functions.length} | ${file.reason} |\n`;
      });
      if (mediumPriority.length > 10) {
        md += `\n*... and ${mediumPriority.length - 10} more files*\n`;
      }
    } else {
      md += `✅ No medium priority files without tests!\n`;
    }

    md += `\n## Coverage by Directory\n\n`;
    const byDirectory = this.groupByDirectory(files);
    md += `| Directory | Files | Tested | Coverage |\n`;
    md += `|-----------|-------|--------|----------|\n`;
    Object.entries(byDirectory).forEach(([dir, stats]) => {
      const coverage = ((stats.tested / stats.total) * 100).toFixed(1);
      md += `| \`${dir}\` | ${stats.total} | ${stats.tested} | ${coverage}% |\n`;
    });

    return md;
  }

  /**
   * Group files by directory for reporting
   */
  private groupByDirectory(files: FileCoverage[]): Record<string, { total: number; tested: number }> {
    const grouped: Record<string, { total: number; tested: number }> = {};

    files.forEach(file => {
      const dir = path.dirname(file.relativePath).split('/')[0] || 'root';
      if (!grouped[dir]) {
        grouped[dir] = { total: 0, tested: 0 };
      }
      grouped[dir].total++;
      if (file.hasTests) {
        grouped[dir].tested++;
      }
    });

    return grouped;
  }
}
