/**
 * Test Failure Analyzer
 * 
 * Analyzes test failures, identifies root causes, and suggests fixes.
 * Uses AI to understand failure patterns and recommend solutions.
 * 
 * @module testing/failure-analyzer
 */

import OpenAI from 'openai';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Test failure information
 */
export interface TestFailure {
  testName: string;
  testFile: string;
  errorMessage: string;
  stackTrace: string;
  failureType: 'assertion' | 'timeout' | 'error' | 'unknown';
  line?: number;
  column?: number;
}

/**
 * Failure analysis result
 */
export interface FailureAnalysis {
  failure: TestFailure;
  rootCause: string;
  category: 'logic-error' | 'async-issue' | 'dependency-issue' | 'environment' | 'flaky' | 'data-issue';
  confidence: number;
  suggestedFixes: SuggestedFix[];
  relatedCode: string[];
  documentation: string[];
}

/**
 * Suggested fix
 */
export interface SuggestedFix {
  description: string;
  code?: string;
  file?: string;
  priority: 'high' | 'medium' | 'low';
  effort: 'trivial' | 'easy' | 'moderate' | 'complex';
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoff: 'linear' | 'exponential';
  conditions?: string[];
}

/**
 * Retry result
 */
export interface RetryResult {
  success: boolean;
  attempts: number;
  failures: TestFailure[];
  finalResult?: {
    passed: boolean;
    output: string;
  };
}

/**
 * Batch analysis result
 */
export interface BatchAnalysisResult {
  totalFailures: number;
  analyzed: number;
  categories: Record<string, number>;
  commonPatterns: string[];
  analyses: FailureAnalysis[];
  summary: string;
}

/**
 * Test Failure Analyzer
 */
export class FailureAnalyzer {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze a single test failure
   */
  async analyzeFailure(failure: TestFailure): Promise<FailureAnalysis> {
    const prompt = this.buildAnalysisPrompt(failure);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || '';
      return this.parseAnalysis(failure, content);
    } catch (error) {
      console.error('Error analyzing failure:', error);
      return this.getFallbackAnalysis(failure);
    }
  }

  /**
   * Analyze multiple failures in batch
   */
  async analyzeBatch(failures: TestFailure[]): Promise<BatchAnalysisResult> {
    const analyses = await Promise.all(
      failures.map(failure => this.analyzeFailure(failure))
    );

    const categories: Record<string, number> = {};
    analyses.forEach(analysis => {
      categories[analysis.category] = (categories[analysis.category] || 0) + 1;
    });

    const commonPatterns = this.identifyCommonPatterns(analyses);
    const summary = this.generateBatchSummary(analyses, categories, commonPatterns);

    return {
      totalFailures: failures.length,
      analyzed: analyses.length,
      categories,
      commonPatterns,
      analyses,
      summary,
    };
  }

  /**
   * Get system prompt for AI
   */
  private getSystemPrompt(): string {
    return `You are an expert software testing engineer specializing in debugging test failures. Your role is to analyze test failures, identify root causes, and suggest actionable fixes.

When analyzing failures, consider:
1. **Error Type**: Assertion failure, timeout, runtime error, etc.
2. **Root Cause**: What actually caused the test to fail?
3. **Category**: Logic error, async issue, dependency problem, environment, flaky test, or data issue
4. **Context**: Code patterns, common pitfalls, best practices

Provide analysis in this format:
ROOT_CAUSE: [Brief explanation of what went wrong]
CATEGORY: [logic-error|async-issue|dependency-issue|environment|flaky|data-issue]
CONFIDENCE: [0.0-1.0]
FIXES: [Numbered list of fixes, each with PRIORITY and EFFORT]
RELATED: [Comma-separated list of related code areas]
DOCS: [Comma-separated list of relevant documentation]

Guidelines:
- Be specific and actionable in suggested fixes
- Prioritize fixes by impact and ease of implementation
- Consider both immediate fixes and long-term improvements
- Identify patterns that might indicate flaky tests`;
  }

  /**
   * Build analysis prompt
   */
  private buildAnalysisPrompt(failure: TestFailure): string {
    let prompt = `Analyze this test failure:\n\n`;
    prompt += `**Test:** ${failure.testName}\n`;
    prompt += `**File:** ${failure.testFile}\n`;
    prompt += `**Type:** ${failure.failureType}\n\n`;
    
    prompt += `**Error Message:**\n\`\`\`\n${failure.errorMessage}\n\`\`\`\n\n`;
    
    if (failure.stackTrace) {
      const stackLines = failure.stackTrace.split('\n').slice(0, 15);
      prompt += `**Stack Trace:**\n\`\`\`\n${stackLines.join('\n')}\n\`\`\`\n\n`;
    }

    if (failure.line) {
      prompt += `**Location:** Line ${failure.line}${failure.column ? `, Column ${failure.column}` : ''}\n\n`;
    }

    prompt += `Based on this information, provide a detailed analysis of the root cause and suggest fixes.`;

    return prompt;
  }

  /**
   * Parse AI analysis response
   */
  private parseAnalysis(failure: TestFailure, content: string): FailureAnalysis {
    const rootCauseMatch = content.match(/ROOT_CAUSE:\s*([^\n]+)/i);
    const categoryMatch = content.match(/CATEGORY:\s*(logic-error|async-issue|dependency-issue|environment|flaky|data-issue)/i);
    const confidenceMatch = content.match(/CONFIDENCE:\s*([\d.]+)/i);
    const fixesSection = content.match(/FIXES:\s*([\s\S]*?)(?=RELATED:|DOCS:|$)/i);
    const relatedMatch = content.match(/RELATED:\s*([^\n]+)/i);
    const docsMatch = content.match(/DOCS:\s*([^\n]+)/i);

    const rootCause = rootCauseMatch?.[1]?.trim() || 'Unable to determine root cause';
    const category = (categoryMatch?.[1] || 'unknown') as FailureAnalysis['category'];
    const confidence = parseFloat(confidenceMatch?.[1] || '0.5');

    const suggestedFixes = this.parseFixes(fixesSection?.[1] || '');
    const relatedCode = relatedMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const documentation = docsMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean) || [];

    return {
      failure,
      rootCause,
      category,
      confidence,
      suggestedFixes,
      relatedCode,
      documentation,
    };
  }

  /**
   * Parse suggested fixes from text
   */
  private parseFixes(fixesText: string): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];
    const lines = fixesText.split('\n').filter(line => line.trim());

    let currentFix: Partial<SuggestedFix> | null = null;

    for (const line of lines) {
      const numberMatch = line.match(/^\d+\.\s*(.+)/);
      if (numberMatch) {
        if (currentFix) {
          fixes.push(currentFix as SuggestedFix);
        }
        currentFix = {
          description: numberMatch[1].trim(),
          priority: 'medium',
          effort: 'moderate',
        };
      } else if (currentFix) {
        const priorityMatch = line.match(/PRIORITY:\s*(high|medium|low)/i);
        const effortMatch = line.match(/EFFORT:\s*(trivial|easy|moderate|complex)/i);
        
        if (priorityMatch) {
          currentFix.priority = priorityMatch[1].toLowerCase() as SuggestedFix['priority'];
        }
        if (effortMatch) {
          currentFix.effort = effortMatch[1].toLowerCase() as SuggestedFix['effort'];
        }
      }
    }

    if (currentFix) {
      fixes.push(currentFix as SuggestedFix);
    }

    return fixes.length > 0 ? fixes : [{
      description: 'Review test implementation and error message',
      priority: 'medium',
      effort: 'moderate',
    }];
  }

  /**
   * Get fallback analysis when AI fails
   */
  private getFallbackAnalysis(failure: TestFailure): FailureAnalysis {
    let category: FailureAnalysis['category'] = 'unknown' as FailureAnalysis['category'];
    let rootCause = 'Unable to perform AI analysis';

    if (failure.failureType === 'timeout') {
      category = 'async-issue';
      rootCause = 'Test timed out, likely due to unresolved promise or long-running operation';
    } else if (failure.errorMessage.includes('Cannot read property') || failure.errorMessage.includes('undefined')) {
      category = 'logic-error';
      rootCause = 'Null or undefined value access';
    } else if (failure.errorMessage.includes('Expected') && failure.errorMessage.includes('to')) {
      category = 'logic-error';
      rootCause = 'Assertion failed - actual value did not match expected';
    }

    return {
      failure,
      rootCause,
      category,
      confidence: 0.5,
      suggestedFixes: [{
        description: 'Review the error message and stack trace for clues',
        priority: 'high',
        effort: 'easy',
      }],
      relatedCode: [],
      documentation: [],
    };
  }

  /**
   * Identify common patterns across failures
   */
  private identifyCommonPatterns(analyses: FailureAnalysis[]): string[] {
    const patterns: string[] = [];

    // Check for common categories
    const categories = analyses.map(a => a.category);
    const categoryCount: Record<string, number> = {};
    categories.forEach(cat => {
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    Object.entries(categoryCount).forEach(([category, count]) => {
      if (count >= 3) {
        patterns.push(`Multiple ${category} failures detected (${count} occurrences)`);
      }
    });

    // Check for common error patterns
    const errorMessages = analyses.map(a => a.failure.errorMessage.toLowerCase());
    
    if (errorMessages.filter(msg => msg.includes('timeout')).length >= 2) {
      patterns.push('Multiple timeout failures - consider increasing test timeouts or fixing async code');
    }
    
    if (errorMessages.filter(msg => msg.includes('undefined') || msg.includes('null')).length >= 2) {
      patterns.push('Multiple null/undefined errors - check for proper initialization');
    }

    if (errorMessages.filter(msg => msg.includes('network') || msg.includes('fetch')).length >= 2) {
      patterns.push('Multiple network-related failures - check API mocks and network handling');
    }

    return patterns;
  }

  /**
   * Generate batch summary
   */
  private generateBatchSummary(
    analyses: FailureAnalysis[],
    categories: Record<string, number>,
    patterns: string[]
  ): string {
    let summary = `Analyzed ${analyses.length} test failure(s):\n\n`;

    summary += `**Categories:**\n`;
    Object.entries(categories).forEach(([category, count]) => {
      const emoji = this.getCategoryEmoji(category);
      summary += `  ${emoji} ${category}: ${count}\n`;
    });
    summary += '\n';

    if (patterns.length > 0) {
      summary += `**Common Patterns:**\n`;
      patterns.forEach(pattern => {
        summary += `  • ${pattern}\n`;
      });
      summary += '\n';
    }

    const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;
    summary += `**Average Confidence:** ${(avgConfidence * 100).toFixed(1)}%\n`;

    const highPriorityFixes = analyses.flatMap(a => 
      a.suggestedFixes.filter(f => f.priority === 'high')
    ).length;
    
    if (highPriorityFixes > 0) {
      summary += `**High Priority Fixes:** ${highPriorityFixes}`;
    }

    return summary;
  }

  /**
   * Get emoji for category
   */
  private getCategoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
      'logic-error': '🐛',
      'async-issue': '⏱️',
      'dependency-issue': '📦',
      'environment': '🌍',
      'flaky': '🎲',
      'data-issue': '📊',
    };
    return emojis[category] || '❓';
  }

  /**
   * Retry failed test with different conditions
   */
  async retryTest(
    testFile: string,
    testName: string,
    config: RetryConfig
  ): Promise<RetryResult> {
    const failures: TestFailure[] = [];
    let attempts = 0;
    let success = false;

    for (let i = 0; i < config.maxAttempts; i++) {
      attempts++;
      
      try {
        const delay = config.backoff === 'exponential' 
          ? config.delayMs * Math.pow(2, i)
          : config.delayMs * i;

        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await this.runSingleTest(testFile, testName);
        
        if (result.success) {
          success = true;
          return {
            success: true,
            attempts,
            failures,
            finalResult: {
              passed: true,
              output: result.output,
            },
          };
        } else {
          failures.push(...result.failures);
        }
      } catch (error) {
        failures.push({
          testName,
          testFile,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          stackTrace: error instanceof Error ? error.stack || '' : '',
          failureType: 'error',
        });
      }
    }

    return {
      success,
      attempts,
      failures,
    };
  }

  /**
   * Run a single test
   */
  private async runSingleTest(
    testFile: string,
    testName: string
  ): Promise<{ success: boolean; output: string; failures: TestFailure[] }> {
    try {
      const { stdout, stderr } = await execAsync(
        `npm test -- "${testFile}" -t "${testName}"`,
        {
          cwd: process.cwd(),
          timeout: 30000,
        }
      );

      return {
        success: true,
        output: stdout || stderr,
        failures: [],
      };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string };
      return {
        success: false,
        output: execError.stdout || execError.stderr || '',
        failures: [{
          testName,
          testFile,
          errorMessage: execError.stderr || 'Test failed',
          stackTrace: execError.stdout || '',
          failureType: 'error',
        }],
      };
    }
  }

  /**
   * Generate failure report
   */
  generateReport(analysis: FailureAnalysis): string {
    let report = `# Test Failure Analysis\n\n`;
    
    report += `## Test Information\n\n`;
    report += `**Test:** ${analysis.failure.testName}\n`;
    report += `**File:** ${analysis.failure.testFile}\n`;
    report += `**Type:** ${analysis.failure.failureType}\n\n`;

    report += `## Root Cause\n\n`;
    report += `${analysis.rootCause}\n\n`;
    report += `**Category:** ${analysis.category}\n`;
    report += `**Confidence:** ${(analysis.confidence * 100).toFixed(1)}%\n\n`;

    report += `## Error Details\n\n`;
    report += `\`\`\`\n${analysis.failure.errorMessage}\n\`\`\`\n\n`;

    if (analysis.failure.stackTrace) {
      report += `**Stack Trace:**\n\`\`\`\n${analysis.failure.stackTrace.split('\n').slice(0, 10).join('\n')}\n\`\`\`\n\n`;
    }

    report += `## Suggested Fixes\n\n`;
    analysis.suggestedFixes.forEach((fix, index) => {
      const priorityEmoji = fix.priority === 'high' ? '🔴' : fix.priority === 'medium' ? '🟡' : '🟢';
      report += `### ${index + 1}. ${fix.description}\n\n`;
      report += `${priorityEmoji} **Priority:** ${fix.priority} | **Effort:** ${fix.effort}\n\n`;
      if (fix.code) {
        report += `\`\`\`\n${fix.code}\n\`\`\`\n\n`;
      }
    });

    if (analysis.relatedCode.length > 0) {
      report += `## Related Code Areas\n\n`;
      analysis.relatedCode.forEach(code => {
        report += `- ${code}\n`;
      });
      report += '\n';
    }

    if (analysis.documentation.length > 0) {
      report += `## Relevant Documentation\n\n`;
      analysis.documentation.forEach(doc => {
        report += `- ${doc}\n`;
      });
      report += '\n';
    }

    report += `---\n*Generated: ${new Date().toISOString()}*\n`;

    return report;
  }

  /**
   * Generate batch report
   */
  generateBatchReport(result: BatchAnalysisResult): string {
    let report = `# Test Failures Analysis Report\n\n`;
    
    report += `**Total Failures:** ${result.totalFailures}\n`;
    report += `**Analyzed:** ${result.analyzed}\n\n`;

    report += `## Categories\n\n`;
    Object.entries(result.categories).forEach(([category, count]) => {
      const emoji = this.getCategoryEmoji(category);
      const percentage = ((count / result.analyzed) * 100).toFixed(1);
      report += `- ${emoji} **${category}**: ${count} (${percentage}%)\n`;
    });
    report += '\n';

    if (result.commonPatterns.length > 0) {
      report += `## Common Patterns\n\n`;
      result.commonPatterns.forEach(pattern => {
        report += `- ${pattern}\n`;
      });
      report += '\n';
    }

    report += `## Individual Analyses\n\n`;
    result.analyses.forEach((analysis, index) => {
      report += `### ${index + 1}. ${analysis.failure.testName}\n\n`;
      report += `**Root Cause:** ${analysis.rootCause}\n`;
      report += `**Category:** ${analysis.category}\n`;
      report += `**Confidence:** ${(analysis.confidence * 100).toFixed(1)}%\n\n`;
      
      report += `**Top Fix:**\n`;
      const topFix = analysis.suggestedFixes[0];
      if (topFix) {
        report += `- ${topFix.description} (${topFix.priority} priority, ${topFix.effort} effort)\n`;
      }
      report += '\n';
    });

    report += `---\n*Generated: ${new Date().toISOString()}*\n`;

    return report;
  }
}
