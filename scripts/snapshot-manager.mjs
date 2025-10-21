#!/usr/bin/env node

/**
 * Snapshot Management CLI
 * 
 * Detect, analyze, and manage test snapshot changes
 * 
 * Usage:
 *   node scripts/snapshot-manager.mjs [command] [options]
 * 
 * Commands:
 *   analyze        Analyze all snapshots in project
 *   changes        Detect recent snapshot changes
 *   suggest        Get AI-powered update suggestions
 *   update         Update snapshots
 *   obsolete       Find obsolete snapshots
 *   explain        Explain a specific snapshot change
 * 
 * Options:
 *   --path <dir>         Project path (default: current directory)
 *   --since <ref>        Compare changes since git ref
 *   --pattern <pattern>  Test pattern for updates
 *   --all                Update all snapshots
 *   --report             Generate markdown report
 *   --auto-update        Auto-update safe changes
 */

import { SnapshotManager } from '../src/lib/testing/snapshot-manager.js';
import { AISnapshotAdvisor } from '../src/lib/testing/ai-snapshot-advisor.js';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'analyze';

  // Parse options
  const options = {
    path: getOption(args, '--path') || process.cwd(),
    since: getOption(args, '--since'),
    pattern: getOption(args, '--pattern'),
    all: args.includes('--all'),
    report: args.includes('--report'),
    autoUpdate: args.includes('--auto-update'),
  };

  const manager = new SnapshotManager(options.path);
  const advisor = new AISnapshotAdvisor();

  console.log('🔍 Snapshot Manager\n');

  try {
    switch (command) {
      case 'analyze': {
        console.log('Analyzing snapshots...\n');
        const analysis = await manager.analyze();

        console.log(analysis.summary);
        console.log('');

        if (analysis.obsoleteSnapshots.length > 0) {
          console.log('🗑️ Obsolete Snapshots:');
          analysis.obsoleteSnapshots.forEach(snap => {
            console.log(`  - ${snap}`);
          });
          console.log('');
        }

        if (analysis.outdatedSnapshots.length > 0) {
          console.log('📅 Outdated Snapshots (6+ months):');
          analysis.outdatedSnapshots.slice(0, 10).forEach(snap => {
            console.log(`  - ${snap}`);
          });
          if (analysis.outdatedSnapshots.length > 10) {
            console.log(`  ... and ${analysis.outdatedSnapshots.length - 10} more`);
          }
          console.log('');
        }

        if (analysis.recommendations.length > 0) {
          console.log('🔄 Recent Changes:');
          analysis.recommendations.forEach(rec => {
            const icon = rec.autoUpdateSafe ? '✅' : '⚠️';
            console.log(`  ${icon} ${rec.snapshotFile}`);
            console.log(`     ${rec.recommendation}`);
          });
          console.log('');
        }

        if (options.report) {
          const report = manager.generateReport(analysis);
          const reportPath = path.join(options.path, 'snapshot-report.md');
          await fs.writeFile(reportPath, report);
          console.log(`📄 Report saved to: ${reportPath}`);
        }
        break;
      }

      case 'changes': {
        console.log('Detecting snapshot changes...\n');
        const changes = await manager.detectChanges(options.since);

        if (changes.length === 0) {
          console.log('✅ No snapshot changes detected');
          break;
        }

        console.log(`Found ${changes.length} change(s):\n`);
        changes.forEach(change => {
          const emoji = change.changeType === 'added' ? '✨' : 
                       change.changeType === 'modified' ? '📝' : 
                       change.changeType === 'deleted' ? '🗑️' : '⚠️';
          
          console.log(`${emoji} ${change.snapshotFile}`);
          console.log(`   Type: ${change.changeType}`);
          console.log(`   Confidence: ${change.confidence}`);
          console.log(`   Auto-update: ${change.autoUpdateSafe ? 'Yes ✅' : 'No ❌'}`);
          console.log(`   ${change.recommendation}`);
          console.log('');
        });
        break;
      }

      case 'suggest': {
        console.log('Getting AI-powered suggestions...\n');
        const changes = await manager.detectChanges(options.since);

        if (changes.length === 0) {
          console.log('✅ No snapshot changes to analyze');
          break;
        }

        console.log(`Analyzing ${changes.length} change(s)...\n`);
        const result = await advisor.analyzeBatch(changes);

        console.log(result.summary);
        console.log('');

        if (result.safeToAutoUpdate.length > 0) {
          console.log('✅ Safe to Auto-Update:');
          result.safeToAutoUpdate.forEach(snap => {
            const suggestion = result.suggestions.find(s => s.snapshotFile === snap);
            console.log(`  - ${snap}`);
            console.log(`    Reason: ${suggestion?.reason}`);
          });
          console.log('');
        }

        if (result.requiresReview.length > 0) {
          console.log('👁️ Requires Manual Review:');
          result.requiresReview.forEach(snap => {
            const suggestion = result.suggestions.find(s => s.snapshotFile === snap);
            console.log(`  - ${snap}`);
            console.log(`    Reason: ${suggestion?.reason}`);
            if (suggestion?.risks.length) {
              console.log(`    Risks: ${suggestion.risks.join(', ')}`);
            }
          });
          console.log('');
        }

        if (result.shouldReject.length > 0) {
          console.log('❌ Should Not Update:');
          result.shouldReject.forEach(snap => {
            const suggestion = result.suggestions.find(s => s.snapshotFile === snap);
            console.log(`  - ${snap}`);
            console.log(`    Reason: ${suggestion?.reason}`);
          });
          console.log('');
        }

        if (options.autoUpdate && result.safeToAutoUpdate.length > 0) {
          console.log('🔄 Auto-updating safe changes...');
          const updateResult = await manager.updateSnapshots({
            all: true,
          });

          if (updateResult.success) {
            console.log('✅ Snapshots updated successfully');
          } else {
            console.error('❌ Failed to update snapshots:', updateResult.output);
          }
        }
        break;
      }

      case 'update': {
        console.log('Updating snapshots...\n');
        
        const updateResult = await manager.updateSnapshots({
          testPattern: options.pattern,
          updateAll: options.all,
        });

        if (updateResult.success) {
          console.log('✅ Snapshots updated successfully');
          console.log(updateResult.output);
        } else {
          console.error('❌ Failed to update snapshots');
          console.error(updateResult.output);
          process.exit(1);
        }
        break;
      }

      case 'obsolete': {
        console.log('Finding obsolete snapshots...\n');
        const obsolete = await manager.findObsoleteSnapshots();

        if (obsolete.length === 0) {
          console.log('✅ No obsolete snapshots found');
          break;
        }

        console.log(`Found ${obsolete.length} obsolete snapshot(s):\n`);
        obsolete.forEach(snap => {
          console.log(`  🗑️ ${snap}`);
        });
        console.log('');
        console.log('These snapshots have no corresponding test file.');
        console.log('Consider deleting them or creating the missing tests.');
        break;
      }

      case 'explain': {
        const changes = await manager.detectChanges(options.since);

        if (changes.length === 0) {
          console.log('✅ No snapshot changes to explain');
          break;
        }

        console.log('Generating explanation...\n');
        
        for (const change of changes.slice(0, 3)) {
          console.log(`📝 ${change.snapshotFile}\n`);
          const explanation = await advisor.explainChange(change);
          console.log(explanation);
          console.log('');
          console.log('-'.repeat(60));
          console.log('');
        }

        if (changes.length > 3) {
          console.log(`... and ${changes.length - 3} more changes`);
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

function getOption(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function showHelp() {
  console.log(`Usage: node scripts/snapshot-manager.mjs [command] [options]

Commands:
  analyze        Analyze all snapshots in project
  changes        Detect recent snapshot changes
  suggest        Get AI-powered update suggestions
  update         Update snapshots
  obsolete       Find obsolete snapshots
  explain        Explain a specific snapshot change
  help           Show this help message

Options:
  --path <dir>         Project path (default: current directory)
  --since <ref>        Compare changes since git ref
  --pattern <pattern>  Test pattern for updates
  --all                Update all snapshots
  --report             Generate markdown report
  --auto-update        Auto-update safe changes

Examples:
  # Analyze all snapshots
  node scripts/snapshot-manager.mjs analyze

  # Detect changes since last commit
  node scripts/snapshot-manager.mjs changes

  # Get AI suggestions and auto-update safe changes
  node scripts/snapshot-manager.mjs suggest --auto-update

  # Update specific test snapshots
  node scripts/snapshot-manager.mjs update --pattern "components/*.test.ts"

  # Generate analysis report
  node scripts/snapshot-manager.mjs analyze --report

  # Find obsolete snapshots
  node scripts/snapshot-manager.mjs obsolete
`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
