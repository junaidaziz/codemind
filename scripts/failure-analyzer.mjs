#!/usr/bin/env node

/**
 * Failure Analysis CLI
 * 
 * Analyze test failures and get AI-powered debugging suggestions
 * 
 * Usage:
 *   node scripts/failure-analyzer.mjs [command] [options]
 * 
 * Commands:
 *   analyze        Analyze test failures from last run
 *   retry          Retry a failed test with exponential backoff
 *   report         Generate detailed failure report
 * 
 * Options:
 *   --file <path>       Test file path
 *   --test <name>       Test name
 *   --attempts <n>      Number of retry attempts (default: 3)
 *   --delay <ms>        Initial delay between retries (default: 1000)
 *   --backoff <type>    Backoff strategy: linear|exponential (default: exponential)
 *   --output <file>     Save report to file
 */

import { FailureAnalyzer } from '../src/lib/testing/failure-analyzer.js';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'analyze';

  const options = {
    file: getOption(args, '--file'),
    test: getOption(args, '--test'),
    attempts: parseInt(getOption(args, '--attempts') || '3'),
    delay: parseInt(getOption(args, '--delay') || '1000'),
    backoff: getOption(args, '--backoff') || 'exponential',
    output: getOption(args, '--output'),
  };

  const analyzer = new FailureAnalyzer();

  console.log('🔍 Failure Analyzer\n');

  try {
    switch (command) {
      case 'analyze': {
        console.log('Analyzing test failures...\n');

        // Run tests and capture failures
        const failures = await captureFailures(options.file);

        if (failures.length === 0) {
          console.log('✅ No test failures detected!');
          break;
        }

        console.log(`Found ${failures.length} failure(s). Analyzing...\n`);

        const result = await analyzer.analyzeBatch(failures);

        console.log(result.summary);
        console.log('');

        // Show individual analyses
        result.analyses.forEach((analysis, index) => {
          const emoji = getCategoryEmoji(analysis.category);
          console.log(`${index + 1}. ${emoji} ${analysis.failure.testName}`);
          console.log(`   Root Cause: ${analysis.rootCause}`);
          console.log(`   Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
          
          if (analysis.suggestedFixes.length > 0) {
            const topFix = analysis.suggestedFixes[0];
            console.log(`   Top Fix: ${topFix.description}`);
            console.log(`   Priority: ${topFix.priority}, Effort: ${topFix.effort}`);
          }
          console.log('');
        });

        if (options.output) {
          const report = analyzer.generateBatchReport(result);
          await fs.writeFile(options.output, report);
          console.log(`📄 Report saved to: ${options.output}`);
        }

        break;
      }

      case 'retry': {
        if (!options.file || !options.test) {
          console.error('❌ Error: --file and --test are required for retry command');
          process.exit(1);
        }

        console.log(`Retrying test: ${options.test}`);
        console.log(`Max attempts: ${options.attempts}`);
        console.log(`Backoff strategy: ${options.backoff}\n`);

        const retryConfig = {
          maxAttempts: options.attempts,
          delayMs: options.delay,
          backoff: options.backoff,
        };

        const result = await analyzer.retryTest(
          options.file,
          options.test,
          retryConfig
        );

        console.log(`Attempts: ${result.attempts}/${retryConfig.maxAttempts}`);
        
        if (result.success) {
          console.log('✅ Test passed on retry!');
          console.log(result.finalResult?.output);
        } else {
          console.log('❌ Test failed after all retry attempts\n');
          
          if (result.failures.length > 0) {
            console.log('Analyzing failures...\n');
            const batchResult = await analyzer.analyzeBatch(result.failures);
            console.log(batchResult.summary);
          }
        }

        break;
      }

      case 'report': {
        console.log('Generating detailed failure report...\n');

        const failures = await captureFailures(options.file);

        if (failures.length === 0) {
          console.log('✅ No test failures to report!');
          break;
        }

        const result = await analyzer.analyzeBatch(failures);
        const report = analyzer.generateBatchReport(result);

        if (options.output) {
          await fs.writeFile(options.output, report);
          console.log(`📄 Report saved to: ${options.output}`);
        } else {
          console.log(report);
        }

        break;
      }

      case 'help':
        showHelp();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('');
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function captureFailures(testFile) {
  const failures = [];

  try {
    const testCmd = testFile 
      ? `npm test -- "${testFile}" --json`
      : 'npm test -- --json';

    const { stdout } = await execAsync(testCmd, {
      cwd: process.cwd(),
      timeout: 60000,
    });

    const result = JSON.parse(stdout);
    
    result.testResults?.forEach((suite) => {
      suite.assertionResults?.forEach(test => {
        if (test.status === 'failed' && test.failureMessages) {
          const errorMessage = test.failureMessages[0] || 'Test failed';
          const failureType = determineFailureType(errorMessage);

          failures.push({
            testName: test.title,
            testFile: suite.name,
            errorMessage,
            stackTrace: test.failureMessages.join('\n'),
            failureType,
          });
        }
      });
    });
  } catch (error) {
    const execError = error;
    
    if (execError.stdout) {
      try {
        const result = JSON.parse(execError.stdout);
        result.testResults?.forEach((suite) => {
          suite.assertionResults?.forEach(test => {
            if (test.status === 'failed' && test.failureMessages) {
              failures.push({
                testName: test.title,
                testFile: suite.name,
                errorMessage: test.failureMessages[0] || 'Test failed',
                stackTrace: test.failureMessages.join('\n'),
                failureType: determineFailureType(test.failureMessages[0] || ''),
              });
            }
          });
        });
      } catch {
        // If we can't parse JSON, treat it as a single failure
        if (execError.stderr || execError.stdout) {
          failures.push({
            testName: 'Unknown test',
            testFile: testFile || 'unknown',
            errorMessage: execError.stderr || execError.stdout || 'Test failed',
            stackTrace: execError.stdout || '',
            failureType: 'error',
          });
        }
      }
    }
  }

  return failures;
}

function determineFailureType(errorMessage) {
  if (errorMessage.includes('Timeout') || errorMessage.includes('timeout')) {
    return 'timeout';
  }
  if (errorMessage.includes('Expected') || errorMessage.includes('toBe') || errorMessage.includes('toEqual')) {
    return 'assertion';
  }
  if (errorMessage.includes('Error:') || errorMessage.includes('Exception')) {
    return 'error';
  }
  return 'unknown';
}

function getCategoryEmoji(category) {
  const emojis = {
    'logic-error': '🐛',
    'async-issue': '⏱️',
    'dependency-issue': '📦',
    'environment': '🌍',
    'flaky': '🎲',
    'data-issue': '📊',
  };
  return emojis[category] || '❓';
}

function getOption(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function showHelp() {
  console.log(`Usage: node scripts/failure-analyzer.mjs [command] [options]

Commands:
  analyze        Analyze test failures from last run
  retry          Retry a failed test with exponential backoff
  report         Generate detailed failure report
  help           Show this help message

Options:
  --file <path>       Test file path
  --test <name>       Test name
  --attempts <n>      Number of retry attempts (default: 3)
  --delay <ms>        Initial delay between retries (default: 1000)
  --backoff <type>    Backoff strategy: linear|exponential (default: exponential)
  --output <file>     Save report to file

Examples:
  # Analyze all test failures
  node scripts/failure-analyzer.mjs analyze

  # Analyze failures from specific file
  node scripts/failure-analyzer.mjs analyze --file src/components/Button.test.tsx

  # Retry a specific test
  node scripts/failure-analyzer.mjs retry --file src/api.test.ts --test "should fetch data"

  # Retry with custom configuration
  node scripts/failure-analyzer.mjs retry --file test.ts --test "flaky test" --attempts 5 --delay 2000

  # Generate detailed report
  node scripts/failure-analyzer.mjs report --output failure-report.md
`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
