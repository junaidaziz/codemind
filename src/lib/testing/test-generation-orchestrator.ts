/**
 * Test Generation Orchestrator
 * 
 * Coordinates test generation across multiple files using coverage analysis and AI.
 * Manages batch generation, validation, and reporting.
 * 
 * @module testing/test-generation-orchestrator
 */

import { TestAutomationService, type TestRecommendation } from './test-automation-service';
import { AITestGenerator, type TestGenerationOptions, type GeneratedTestSuite } from './ai-test-generator';
import type { FileCoverage } from './coverage-analyzer';

/**
 * Generation result for a single file
 */
export interface FileGenerationResult {
  file: FileCoverage;
  success: boolean;
  testSuite?: GeneratedTestSuite;
  error?: string;
  duration: number;
}

/**
 * Batch generation result
 */
export interface BatchGenerationResult {
  totalFiles: number;
  successCount: number;
  failureCount: number;
  totalTests: number;
  results: FileGenerationResult[];
  duration: number;
  summary: string;
}

/**
 * Generation progress callback
 */
export type ProgressCallback = (current: number, total: number, file: string) => void;

/**
 * Test Generation Orchestrator
 */
export class TestGenerationOrchestrator {
  private automationService: TestAutomationService;
  private testGenerator: AITestGenerator;
  private projectRoot: string;

  constructor(projectRoot: string, openAIKey?: string) {
    this.projectRoot = projectRoot;
    this.automationService = new TestAutomationService(projectRoot);
    this.testGenerator = new AITestGenerator(projectRoot, openAIKey);
  }

  /**
   * Generate tests for high priority files
   */
  async generateForHighPriority(
    options: Partial<TestGenerationOptions> = {},
    onProgress?: ProgressCallback
  ): Promise<BatchGenerationResult> {
    // Run coverage analysis
    const session = await this.automationService.startSession('orchestrator');
    
    if (!session.recommendations) {
      throw new Error('No recommendations available');
    }

    // Get high priority recommendations
    const highPriority = session.recommendations.filter(r => r.priority === 'high');

    // Generate tests for each high priority file
    return this.generateForRecommendations(highPriority, options, onProgress);
  }

  /**
   * Generate tests for specific files
   */
  async generateForFiles(
    filePaths: string[],
    options: Partial<TestGenerationOptions> = {},
    onProgress?: ProgressCallback
  ): Promise<BatchGenerationResult> {
    const startTime = Date.now();
    const results: FileGenerationResult[] = [];

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      
      if (onProgress) {
        onProgress(i + 1, filePaths.length, filePath);
      }

      try {
        const fileAnalysis = await this.automationService.analyzeFile(filePath);
        
        if (!fileAnalysis) {
          results.push({
            file: {} as FileCoverage,
            success: false,
            error: 'File not found or could not be analyzed',
            duration: 0,
          });
          continue;
        }

        // Create full options with defaults
        const fullOptions: TestGenerationOptions = {
          framework: options.framework || 'jest',
          testType: options.testType || 'unit',
          includeEdgeCases: options.includeEdgeCases ?? true,
          includeMocks: options.includeMocks ?? true,
          includeTypeTests: options.includeTypeTests ?? true,
          coverageTarget: options.coverageTarget || 80,
        };

        const result = await this.generateForFile(fileAnalysis, fullOptions);
        results.push(result);
      } catch (error) {
        results.push({
          file: {} as FileCoverage,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0,
        });
      }
    }

    return this.createBatchResult(results, Date.now() - startTime);
  }

  /**
   * Generate tests for recommendations
   */
  private async generateForRecommendations(
    recommendations: TestRecommendation[],
    options: Partial<TestGenerationOptions> = {},
    onProgress?: ProgressCallback
  ): Promise<BatchGenerationResult> {
    const startTime = Date.now();
    const results: FileGenerationResult[] = [];

    for (let i = 0; i < recommendations.length; i++) {
      const recommendation = recommendations[i];
      
      if (onProgress) {
        onProgress(i + 1, recommendations.length, recommendation.file.relativePath);
      }

      // Merge recommendation options with provided options
      const generationOptions: TestGenerationOptions = {
        framework: options.framework || recommendation.framework,
        testType: options.testType || recommendation.testType,
        includeEdgeCases: options.includeEdgeCases ?? true,
        includeMocks: options.includeMocks ?? true,
        includeTypeTests: options.includeTypeTests ?? true,
        coverageTarget: options.coverageTarget || 80,
      };

      try {
        const result = await this.generateForFile(recommendation.file, generationOptions);
        results.push(result);
      } catch (error) {
        results.push({
          file: recommendation.file,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0,
        });
      }
    }

    return this.createBatchResult(results, Date.now() - startTime);
  }

  /**
   * Generate tests for a single file
   */
  private async generateForFile(
    file: FileCoverage,
    options: TestGenerationOptions
  ): Promise<FileGenerationResult> {
    const startTime = Date.now();

    try {
      // Generate tests using AI
      const testSuite = await this.testGenerator.generateTests(file, options);

      // Validate generated tests
      const validation = await this.testGenerator.validateTests(testSuite);

      if (!validation.valid) {
        return {
          file,
          success: false,
          error: `Validation failed: ${validation.errors?.join(', ')}`,
          duration: Date.now() - startTime,
        };
      }

      // Write test file
      await this.testGenerator.writeTestFile(testSuite);

      return {
        file,
        success: true,
        testSuite,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        file,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Create batch result from file results
   */
  private createBatchResult(
    results: FileGenerationResult[],
    duration: number
  ): BatchGenerationResult {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    const totalTests = results
      .filter(r => r.testSuite)
      .reduce((sum, r) => sum + (r.testSuite?.testCount || 0), 0);

    const summary = this.generateSummary(results, duration);

    return {
      totalFiles: results.length,
      successCount,
      failureCount,
      totalTests,
      results,
      duration,
      summary,
    };
  }

  /**
   * Generate summary report
   */
  private generateSummary(results: FileGenerationResult[], duration: number): string {
    const successCount = results.filter(r => r.success).length;
    const totalTests = results
      .filter(r => r.testSuite)
      .reduce((sum, r) => sum + (r.testSuite?.testCount || 0), 0);

    let summary = `## Test Generation Summary\n\n`;
    summary += `**Duration:** ${(duration / 1000).toFixed(2)}s\n`;
    summary += `**Files Processed:** ${results.length}\n`;
    summary += `**Successful:** ${successCount} ✅\n`;
    summary += `**Failed:** ${results.length - successCount} ❌\n`;
    summary += `**Total Tests Generated:** ${totalTests}\n\n`;

    // Success breakdown
    if (successCount > 0) {
      summary += `### ✅ Successfully Generated\n\n`;
      results
        .filter(r => r.success && r.testSuite)
        .forEach(r => {
          summary += `- **${r.file.relativePath}**\n`;
          summary += `  - Tests: ${r.testSuite!.testCount}\n`;
          summary += `  - Framework: ${r.testSuite!.framework}\n`;
          summary += `  - Duration: ${(r.duration / 1000).toFixed(2)}s\n`;
        });
      summary += `\n`;
    }

    // Failures
    if (results.length - successCount > 0) {
      summary += `### ❌ Failed\n\n`;
      results
        .filter(r => !r.success)
        .forEach(r => {
          summary += `- **${r.file.relativePath || 'Unknown'}**\n`;
          summary += `  - Error: ${r.error}\n`;
        });
      summary += `\n`;
    }

    // Statistics
    if (totalTests > 0) {
      const avgTestsPerFile = totalTests / successCount;
      const avgDuration = duration / results.length;
      
      summary += `### 📊 Statistics\n\n`;
      summary += `- Average tests per file: ${avgTestsPerFile.toFixed(1)}\n`;
      summary += `- Average generation time: ${(avgDuration / 1000).toFixed(2)}s\n`;
      summary += `- Tests per second: ${(totalTests / (duration / 1000)).toFixed(2)}\n`;
    }

    return summary;
  }

  /**
   * Preview tests without writing to disk
   */
  async previewTests(
    file: FileCoverage,
    options: TestGenerationOptions
  ): Promise<GeneratedTestSuite> {
    return this.testGenerator.generateTests(file, options);
  }

  /**
   * Regenerate tests for a file with different options
   */
  async regenerateTests(
    filePath: string,
    options: TestGenerationOptions
  ): Promise<GeneratedTestSuite> {
    const fileAnalysis = await this.automationService.analyzeFile(filePath);
    
    if (!fileAnalysis) {
      throw new Error('File not found or could not be analyzed');
    }

    return this.testGenerator.generateTests(fileAnalysis, options);
  }

  /**
   * Get test generation statistics
   */
  async getStatistics(): Promise<{
    totalFiles: number;
    testedFiles: number;
    untestedFiles: number;
    highPriorityCount: number;
    estimatedTestCount: number;
  }> {
    const session = await this.automationService.startSession('stats');
    
    if (!session.report || !session.recommendations) {
      throw new Error('Failed to get statistics');
    }

    const highPriority = session.recommendations.filter(r => r.priority === 'high');
    const estimatedTests = session.recommendations.reduce(
      (sum, r) => sum + r.estimatedTestCount,
      0
    );

    return {
      totalFiles: session.report.totalFiles,
      testedFiles: session.report.testedFiles,
      untestedFiles: session.report.untestedFiles,
      highPriorityCount: highPriority.length,
      estimatedTestCount: estimatedTests,
    };
  }
}
