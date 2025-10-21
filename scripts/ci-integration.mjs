#!/usr/bin/env node

/**
 * CI/CD Integration CLI
 * 
 * Run testing automation in CI/CD pipelines
 * 
 * Usage:
 *   node scripts/ci-integration.mjs [options]
 * 
 * Options:
 *   --run-tests           Run tests and report results
 *   --generate-tests      Generate tests for high priority files
 *   --analyze-coverage    Analyze code coverage
 *   --update-checks       Update GitHub checks
 *   --comment-pr          Comment on PR with results
 *   --fail-on-error       Exit with non-zero code on failure
 *   --coverage-threshold  Minimum coverage percentage (default: 80)
 */

import { CIIntegrationService } from '../src/lib/testing/ci-integration-service.js';

async function main() {
  const args = process.argv.slice(2);

  // Parse options
  const options = {
    runTests: args.includes('--run-tests'),
    generateTests: args.includes('--generate-tests'),
    analyzeCoverage: args.includes('--analyze-coverage'),
    updateChecks: args.includes('--update-checks'),
    commentOnPR: args.includes('--comment-pr'),
    failOnTestFailure: args.includes('--fail-on-error'),
    failOnLowCoverage: args.includes('--fail-on-error'),
    coverageThreshold: parseInt(
      args[args.indexOf('--coverage-threshold') + 1] || '80'
    ),
    githubToken: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_REPOSITORY_OWNER,
    repo: process.env.GITHUB_REPOSITORY?.split('/')[1],
  };

  // Default to running all if no specific options provided
  if (!options.runTests && !options.generateTests && !options.analyzeCoverage) {
    options.runTests = true;
    options.generateTests = true;
    options.analyzeCoverage = true;
  }

  console.log('🚀 Starting CI/CD Integration');
  console.log('Options:', JSON.stringify(options, null, 2));
  console.log('');

  const service = new CIIntegrationService(options);

  // Detect environment
  const env = service.detectEnvironment();
  console.log(`Environment: ${env.name}`);
  console.log(`Branch: ${env.branch}`);
  console.log(`Commit: ${env.commit?.substring(0, 7)}`);
  if (env.prNumber) {
    console.log(`PR: #${env.prNumber}`);
  }
  console.log('');

  // Run pipeline
  const results = await service.runPipeline();

  // Print results
  console.log('');
  console.log('='.repeat(60));
  console.log('CI/CD PIPELINE RESULTS');
  console.log('='.repeat(60));
  console.log('');

  if (results.testResults) {
    console.log('🧪 Test Results:');
    console.log(`  Total: ${results.testResults.totalTests}`);
    console.log(`  Passed: ${results.testResults.passedTests} ✅`);
    console.log(`  Failed: ${results.testResults.failedTests} ❌`);
    console.log(`  Skipped: ${results.testResults.skippedTests} ⏭️`);
    console.log(`  Duration: ${(results.testResults.duration / 1000).toFixed(2)}s`);
    console.log('');

    if (results.testResults.coverage) {
      console.log('📊 Coverage:');
      console.log(`  Lines: ${results.testResults.coverage.lines.percentage.toFixed(1)}%`);
      console.log(`  Functions: ${results.testResults.coverage.functions.percentage.toFixed(1)}%`);
      console.log(`  Branches: ${results.testResults.coverage.branches.percentage.toFixed(1)}%`);
      console.log('');
    }
  }

  if (results.generationResults) {
    console.log('📝 Test Generation:');
    console.log(`  Files processed: ${results.generationResults.totalFiles}`);
    console.log(`  Tests generated: ${results.generationResults.totalTests}`);
    console.log(`  Success rate: ${((results.generationResults.successCount / results.generationResults.totalFiles) * 100).toFixed(1)}%`);
    console.log('');
  }

  if (results.coverage) {
    console.log('📈 Coverage Analysis:');
    console.log(`  Total files: ${results.coverage.files.length}`);
    console.log(`  Tested files: ${results.coverage.files.filter(f => f.isTested).length}`);
    console.log(`  Untested files: ${results.coverage.files.filter(f => !f.isTested).length}`);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('');

  // Exit with appropriate code
  if (!results.success) {
    console.error('❌ CI/CD pipeline failed');
    process.exit(1);
  } else {
    console.log('✅ CI/CD pipeline completed successfully');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('❌ CI/CD integration error:', error);
  process.exit(1);
});
