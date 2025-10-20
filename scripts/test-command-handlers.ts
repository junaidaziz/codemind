/**
 * Command Handlers Tests
 * 
 * Comprehensive test for all command handlers.
 * Run with: npx tsx scripts/test-command-handlers.ts
 */

import { CommandParser } from '../src/lib/command-parser';
import { initializeCommandHandlers, getCommandRegistry } from '../src/lib/command-handlers';

console.log('🧪 Testing Command Handlers System\n');

// Initialize handlers
initializeCommandHandlers();

console.log('=== Handler Registration ===\n');
const registry = getCommandRegistry();
console.log('Registered handlers:', registry.listCommands());
console.log('');

// Test cases for each command
const testCases = [
  // Help commands
  { cmd: '/help', expected: 'HELP' },
  { cmd: '/help fix', expected: 'HELP with args' },
  
  // Fix commands
  { cmd: '/fix src/components/Button.tsx', expected: 'FIX file' },
  { cmd: '/fix "the login validation"', expected: 'FIX description' },
  
  // Generate commands
  { cmd: '/gen "create a user profile component"', expected: 'GENERATE component' },
  { cmd: '/generate api endpoint for auth', expected: 'GENERATE api' },
  
  // Test commands
  { cmd: '/test', expected: 'TEST all' },
  { cmd: '/test src/utils/math.ts', expected: 'TEST file' },
  { cmd: '/test --coverage', expected: 'TEST with coverage' },
  
  // Refactor commands
  { cmd: '/refactor src/services/api.ts', expected: 'REFACTOR file' },
  { cmd: '/refactor "extract validation logic"', expected: 'REFACTOR description' },
  
  // Explain commands
  { cmd: '/explain src/hooks/useAuth.ts', expected: 'EXPLAIN file' },
  { cmd: '/explain "how does caching work?"', expected: 'EXPLAIN concept' },
];

console.log('=== Command Execution Tests ===\n');

async function runTests() {
  let passCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.expected}`);
    console.log(`Input: "${testCase.cmd}"`);
    
    const parsed = CommandParser.parse(testCase.cmd);
    
    if (!parsed.hasCommand || !parsed.command) {
      console.log(`❌ FAIL: Command not parsed\n`);
      failCount++;
      continue;
    }

    console.log(`✓ Parsed as: ${parsed.command.type}`);
    
    try {
      const result = await registry.execute(parsed.command, {
        userId: 'test-user',
        projectId: 'test-project',
      });
      
      if (result.success) {
        console.log(`✅ PASS: ${result.message}`);
        if (result.data) {
          console.log(`   Data keys: ${Object.keys(result.data).join(', ')}`);
        }
        if (result.changes) {
          console.log(`   Changes: ${result.changes.length} files`);
        }
        if (result.actions) {
          console.log(`   Actions: ${result.actions.map(a => a.label).join(', ')}`);
        }
        passCount++;
      } else {
        console.log(`⚠️  FAIL: ${result.error || result.message}`);
        failCount++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown'}`);
      failCount++;
    }
    
    console.log('');
  }

  console.log('=== Test Summary ===\n');
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / testCases.length) * 100).toFixed(1)}%`);
  console.log('');

  // Test specific command help
  console.log('=== Command Help Examples ===\n');
  
  const helpCmd = CommandParser.parse('/help fix');
  if (helpCmd.command) {
    const helpResult = await registry.execute(helpCmd.command, { userId: 'test-user' });
    if (helpResult.success && helpResult.data && typeof helpResult.data === 'object' && 'commandHelp' in helpResult.data) {
      console.log('Help for /fix command:');
      console.log((helpResult.data as { commandHelp: string }).commandHelp.substring(0, 300) + '...\n');
    }
  }

  console.log('✅ All handler tests completed!\n');
}

runTests().catch(console.error);
