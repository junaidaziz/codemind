/**
 * AI Test Generator
 * 
 * Generates comprehensive test suites using AI based on code analysis.
 * Supports multiple testing frameworks and test types.
 * 
 * @module testing/ai-test-generator
 */

import OpenAI from 'openai';
import type { CodeFunction, FileCoverage } from './coverage-analyzer';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Test generation options
 */
export interface TestGenerationOptions {
  framework: 'jest' | 'vitest' | 'playwright';
  testType: 'unit' | 'integration' | 'e2e';
  includeEdgeCases: boolean;
  includeMocks: boolean;
  includeTypeTests: boolean;
  coverageTarget?: number;
}

/**
 * Generated test suite
 */
export interface GeneratedTestSuite {
  filePath: string;
  testFilePath: string;
  content: string;
  testCount: number;
  framework: string;
  testType: string;
  imports: string[];
  testCases: TestCase[];
}

/**
 * Individual test case
 */
export interface TestCase {
  name: string;
  description: string;
  code: string;
  targetFunction?: string;
  type: 'positive' | 'negative' | 'edge' | 'performance';
}

/**
 * AI Test Generator
 */
export class AITestGenerator {
  private openai: OpenAI;
  private projectRoot: string;

  constructor(projectRoot: string, apiKey?: string) {
    this.projectRoot = projectRoot;
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate test suite for a file
   */
  async generateTests(
    fileCoverage: FileCoverage,
    options: TestGenerationOptions
  ): Promise<GeneratedTestSuite> {
    // Read source file content
    const sourceContent = await fs.readFile(fileCoverage.filePath, 'utf-8');

    // Analyze functions to test
    const functionsToTest = options.includeEdgeCases
      ? fileCoverage.functions
      : fileCoverage.untestedFunctions;

    // Generate test content using AI
    const testContent = await this.generateTestContent(
      sourceContent,
      functionsToTest,
      fileCoverage.relativePath,
      options
    );

    // Parse generated content to extract test cases
    const testCases = this.parseTestCases(testContent);

    // Determine test file path
    const testFilePath = this.getTestFilePath(fileCoverage.filePath, options.framework);

    // Extract imports
    const imports = this.extractImports(testContent);

    return {
      filePath: fileCoverage.filePath,
      testFilePath,
      content: testContent,
      testCount: testCases.length,
      framework: options.framework,
      testType: options.testType,
      imports,
      testCases,
    };
  }

  /**
   * Generate test content using OpenAI
   */
  private async generateTestContent(
    sourceContent: string,
    functions: CodeFunction[],
    relativePath: string,
    options: TestGenerationOptions
  ): Promise<string> {
    const prompt = this.buildPrompt(sourceContent, functions, relativePath, options);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(options),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Build AI prompt for test generation
   */
  private buildPrompt(
    sourceContent: string,
    functions: CodeFunction[],
    relativePath: string,
    options: TestGenerationOptions
  ): string {
    let prompt = `Generate comprehensive ${options.testType} tests for the following code:\n\n`;
    prompt += `**File:** ${relativePath}\n\n`;
    prompt += `**Source Code:**\n\`\`\`typescript\n${sourceContent}\n\`\`\`\n\n`;

    prompt += `**Functions to test:**\n`;
    functions.forEach(fn => {
      prompt += `- ${fn.name} (complexity: ${fn.complexity}, params: ${fn.params.join(', ')})\n`;
    });

    prompt += `\n**Requirements:**\n`;
    prompt += `- Framework: ${options.framework}\n`;
    prompt += `- Test type: ${options.testType}\n`;
    
    if (options.includeEdgeCases) {
      prompt += `- Include edge cases and boundary conditions\n`;
    }
    
    if (options.includeMocks) {
      prompt += `- Generate necessary mocks and stubs\n`;
    }
    
    if (options.includeTypeTests) {
      prompt += `- Include type safety tests\n`;
    }

    if (options.coverageTarget) {
      prompt += `- Target coverage: ${options.coverageTarget}%\n`;
    }

    prompt += `\n**Output Requirements:**\n`;
    prompt += `- Complete, runnable test file\n`;
    prompt += `- Proper imports and setup\n`;
    prompt += `- Descriptive test names\n`;
    prompt += `- Use arrange-act-assert pattern\n`;
    prompt += `- Include comments for complex assertions\n`;

    return prompt;
  }

  /**
   * Get system prompt based on options
   */
  private getSystemPrompt(options: TestGenerationOptions): string {
    let systemPrompt = `You are an expert software testing engineer specializing in ${options.framework}. `;
    systemPrompt += `Generate high-quality, comprehensive ${options.testType} tests that follow best practices.\n\n`;

    systemPrompt += `Key principles:\n`;
    systemPrompt += `1. Tests should be clear, maintainable, and focused\n`;
    systemPrompt += `2. Use descriptive test names that explain what is being tested\n`;
    systemPrompt += `3. Follow the Arrange-Act-Assert (AAA) pattern\n`;
    systemPrompt += `4. Cover happy paths, error cases, and edge cases\n`;
    systemPrompt += `5. Keep tests isolated and independent\n`;
    systemPrompt += `6. Use appropriate matchers and assertions\n`;
    systemPrompt += `7. Mock external dependencies appropriately\n`;
    systemPrompt += `8. Include setup and teardown when needed\n`;

    if (options.framework === 'jest') {
      systemPrompt += `\nJest-specific:\n`;
      systemPrompt += `- Use describe() blocks for grouping\n`;
      systemPrompt += `- Use it() or test() for individual tests\n`;
      systemPrompt += `- Leverage jest.fn() for mocks\n`;
      systemPrompt += `- Use beforeEach/afterEach for setup/teardown\n`;
    } else if (options.framework === 'vitest') {
      systemPrompt += `\nVitest-specific:\n`;
      systemPrompt += `- Use describe() blocks for grouping\n`;
      systemPrompt += `- Use it() or test() for individual tests\n`;
      systemPrompt += `- Leverage vi.fn() for mocks\n`;
      systemPrompt += `- Use beforeEach/afterEach for setup/teardown\n`;
    } else if (options.framework === 'playwright') {
      systemPrompt += `\nPlaywright-specific:\n`;
      systemPrompt += `- Use test.describe() for grouping\n`;
      systemPrompt += `- Use test() for individual tests\n`;
      systemPrompt += `- Include page fixtures\n`;
      systemPrompt += `- Use appropriate selectors and assertions\n`;
    }

    return systemPrompt;
  }

  /**
   * Parse test cases from generated content
   */
  private parseTestCases(content: string): TestCase[] {
    const testCases: TestCase[] = [];
    
    // Match test cases using regex (works for Jest/Vitest)
    const testRegex = /(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*{([^}]+(?:{[^}]*}[^}]*)*?)}\s*\)/g;
    
    let match;
    while ((match = testRegex.exec(content)) !== null) {
      const name = match[1];
      const code = match[2];
      
      testCases.push({
        name,
        description: name,
        code: code.trim(),
        type: this.determineTestType(name, code),
      });
    }

    return testCases;
  }

  /**
   * Determine test type from name and code
   */
  private determineTestType(name: string, code: string): 'positive' | 'negative' | 'edge' | 'performance' {
    const lowerName = name.toLowerCase();
    const lowerCode = code.toLowerCase();

    if (lowerName.includes('error') || lowerName.includes('throw') || lowerName.includes('fail')) {
      return 'negative';
    }

    if (
      lowerName.includes('edge') ||
      lowerName.includes('boundary') ||
      lowerName.includes('empty') ||
      lowerName.includes('null') ||
      lowerName.includes('undefined')
    ) {
      return 'edge';
    }

    if (lowerName.includes('performance') || lowerCode.includes('performance')) {
      return 'performance';
    }

    return 'positive';
  }

  /**
   * Extract imports from test content
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+(?:{[^}]+}|[\w]+)\s+from\s+['"`]([^'"`]+)['"`]/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * Get test file path
   */
  private getTestFilePath(sourceFile: string, framework: string): string {
    const dir = path.dirname(sourceFile);
    const ext = path.extname(sourceFile);
    const baseName = path.basename(sourceFile, ext);
    
    if (framework === 'playwright') {
      return path.join(dir, `${baseName}.e2e${ext}`);
    }

    // For Jest/Vitest, prefer __tests__ directory
    return path.join(dir, '__tests__', `${baseName}.test${ext}`);
  }

  /**
   * Generate mock objects for dependencies
   */
  async generateMocks(imports: string[]): Promise<string> {
    if (imports.length === 0) return '';

    const prompt = `Generate Jest/Vitest mocks for the following imports:\n${imports.join('\n')}\n\nProvide complete mock implementations with realistic return values.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating test mocks. Generate realistic, useful mocks that help isolate the code under test.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Generate fixtures for test data
   */
  async generateFixtures(functions: CodeFunction[]): Promise<string> {
    let prompt = `Generate test fixtures (sample data) for testing these functions:\n\n`;
    functions.forEach(fn => {
      prompt += `- ${fn.name}(${fn.params.join(', ')})\n`;
    });
    prompt += `\nProvide realistic, comprehensive test data that covers various scenarios.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating test fixtures. Generate comprehensive, realistic test data.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    return response.choices[0].message.content || '';
  }

  /**
   * Write test file to disk
   */
  async writeTestFile(testSuite: GeneratedTestSuite): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(testSuite.testFilePath);
    await fs.mkdir(dir, { recursive: true });

    // Write test file
    await fs.writeFile(testSuite.testFilePath, testSuite.content, 'utf-8');
  }

  /**
   * Validate generated test syntax
   */
  async validateTests(testSuite: GeneratedTestSuite): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      // Basic syntax validation
      const errors: string[] = [];

      // Check for required imports
      if (!testSuite.content.includes('import') && !testSuite.content.includes('require')) {
        errors.push('Missing imports');
      }

      // Check for test blocks
      const hasTests = testSuite.content.includes('it(') || 
                       testSuite.content.includes('test(') ||
                       testSuite.content.includes('describe(');
      
      if (!hasTests) {
        errors.push('No test blocks found');
      }

      // Check for assertions
      const hasAssertions = testSuite.content.includes('expect(') ||
                           testSuite.content.includes('assert');
      
      if (!hasAssertions) {
        errors.push('No assertions found');
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      };
    }
  }
}
