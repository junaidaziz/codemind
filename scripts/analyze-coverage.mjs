#!/usr/bin/env node

/**
 * Coverage Analysis CLI
 * 
 * Command-line tool for analyzing test coverage and generating recommendations.
 * 
 * Usage:
 *   node scripts/analyze-coverage.js [options]
 * 
 * Options:
 *   --path <path>      Analyze specific directory (default: entire project)
 *   --export           Export report to markdown file
 *   --json             Output results as JSON
 *   --high-priority    Show only high priority recommendations
 */

import { TestAutomationService } from '../src/lib/testing/test-automation-service.js';
import { resolve } from 'path';

const args = process.argv.slice(2);
const pathIndex = args.indexOf('--path');
const options = {
  path: pathIndex >= 0 && args[pathIndex + 1] ? args[pathIndex + 1] : undefined,
  export: args.includes('--export'),
  json: args.includes('--json'),
  highPriority: args.includes('--high-priority'),
};

async function main() {
  try {
    console.log('🔍 Starting coverage analysis...\n');

    const projectRoot = process.cwd();
    const service = new TestAutomationService(projectRoot);

    // Start analysis session
    const session = await service.startSession('cli-project', options.path);

    if (session.status === 'error') {
      console.error('❌ Analysis failed:', session.error);
      process.exit(1);
    }

    if (!session.report) {
      console.error('❌ No report generated');
      process.exit(1);
    }

    const { report } = session;

    if (options.json) {
      // Output JSON
      console.log(JSON.stringify({
        sessionId: session.id,
        report,
        recommendations: session.recommendations,
      }, null, 2));
      return;
    }

    // Console output
    console.log('📊 Coverage Analysis Results\n');
    console.log('═'.repeat(60));
    console.log(`Total Files:          ${report.totalFiles}`);
    console.log(`Tested Files:         ${report.testedFiles} (${((report.testedFiles / report.totalFiles) * 100).toFixed(1)}%)`);
    console.log(`Untested Files:       ${report.untestedFiles}`);
    console.log(`Total Functions:      ${report.totalFunctions}`);
    console.log(`Tested Functions:     ${report.testedFunctions}`);
    console.log(`Untested Functions:   ${report.untestedFunctions}`);
    console.log(`Overall Coverage:     ${report.overallCoverage.toFixed(1)}%`);
    console.log('═'.repeat(60));
    console.log('');

    // High priority files
    const highPriority = session.recommendations?.filter(r => r.priority === 'high') || [];
    
    if (highPriority.length > 0) {
      console.log(`🚨 High Priority Files (${highPriority.length})\n`);
      
      const displayCount = options.highPriority ? highPriority.length : Math.min(highPriority.length, 10);
      
      for (let i = 0; i < displayCount; i++) {
        const rec = highPriority[i];
        console.log(`${i + 1}. ${rec.file.relativePath}`);
        console.log(`   Functions: ${rec.file.functions.length} | Tests needed: ${rec.estimatedTestCount}`);
        console.log(`   Complexity: ${rec.estimatedComplexity} | Framework: ${rec.framework}`);
        console.log(`   Reason: ${rec.reason}`);
        console.log('');
      }

      if (!options.highPriority && highPriority.length > 10) {
        console.log(`   ... and ${highPriority.length - 10} more high priority files`);
        console.log(`   (use --high-priority to see all)\n`);
      }
    } else {
      console.log('✅ No high priority files found!\n');
    }

    // Medium priority summary
    const mediumPriority = session.recommendations?.filter(r => r.priority === 'medium') || [];
    if (mediumPriority.length > 0) {
      console.log(`⚠️  Medium Priority: ${mediumPriority.length} files\n`);
    }

    // Export option
    if (options.export) {
      const outputPath = resolve(projectRoot, `coverage-report-${Date.now()}.md`);
      await service.exportReport(session.id, outputPath);
      console.log(`📝 Report exported to: ${outputPath}\n`);
    }

    // Summary recommendations
    console.log('💡 Recommendations:\n');
    if (highPriority.length > 0) {
      console.log(`   1. Start with ${Math.min(highPriority.length, 5)} high priority files`);
      console.log(`   2. Focus on API routes and core business logic`);
      console.log(`   3. Use AI test generation: /test <file>`);
    } else if (mediumPriority.length > 0) {
      console.log(`   1. Work on medium priority files`);
      console.log(`   2. Improve coverage for components and utilities`);
    } else {
      console.log(`   ✅ Great coverage! Consider edge cases and integration tests`);
    }

    console.log('');
    console.log('✨ Analysis complete!');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
