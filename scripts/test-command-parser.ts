/**
 * Command Parser Tests
 * 
 * Manual test file to verify command parsing functionality.
 * Run with: npx tsx scripts/test-command-parser.ts
 */

import { CommandParser, CommandType } from '../src/lib/command-parser';
import { getCommandRegistry } from '../src/lib/command-handlers/registry';
import { HelpCommandHandler } from '../src/lib/command-handlers/help-handler';

console.log('🧪 Testing Command Parser\n');

// Test cases
const testCases = [
  // Fix commands
  '/fix src/components/Button.tsx',
  '/fix "the login form validation"',
  '/fix',
  
  // Generate commands
  '/gen "create a user profile component"',
  '/generate api endpoint for authentication',
  '/gen',
  
  // Test commands
  '/test src/utils/math.ts',
  '/test --coverage',
  '/test',
  
  // Refactor commands
  '/refactor src/services/api.ts',
  '/refactor "extract repeated validation logic"',
  
  // Explain commands
  '/explain src/hooks/useAuth.ts',
  '/explain "how does caching work?"',
  
  // Help commands
  '/help',
  '/help fix',
  
  // Invalid/plain text
  'This is just a normal message',
  '/unknown command',
  '/ fix (space before command)',
];

console.log('=== Command Parsing Tests ===\n');

for (const testCase of testCases) {
  console.log(`Input: "${testCase}"`);
  
  const parsed = CommandParser.parse(testCase);
  
  if (parsed.hasCommand && parsed.command) {
    console.log(`✅ Detected command: ${parsed.command.type}`);
    console.log(`   Args: [${parsed.command.args.join(', ')}]`);
    console.log(`   Raw args: "${parsed.command.rawArgs}"`);
    
    // Validate the command
    const validation = CommandParser.validate(parsed.command);
    if (validation.valid) {
      console.log(`   ✓ Valid command`);
    } else {
      console.log(`   ✗ Invalid: ${validation.error}`);
    }
  } else {
    console.log(`ℹ️  Plain text (no command)`);
  }
  
  console.log('');
}

console.log('\n=== Command Registry Tests ===\n');

// Register the help handler
const registry = getCommandRegistry();
registry.register(CommandType.HELP, new HelpCommandHandler());

console.log('Registered handlers:', registry.listCommands());
console.log('Has HELP handler:', registry.hasHandler(CommandType.HELP));
console.log('Has FIX handler:', registry.hasHandler(CommandType.FIX));

console.log('\n=== Executing Help Command ===\n');

const helpCommand = CommandParser.parse('/help');
if (helpCommand.hasCommand && helpCommand.command) {
  registry.execute(helpCommand.command, {
    userId: 'test-user',
  }).then((result) => {
    console.log('Result:', result.success ? '✅ Success' : '❌ Failed');
    console.log('Message:', result.message);
    if (result.data && typeof result.data === 'object' && 'helpText' in result.data) {
      const helpText = (result.data as { helpText: string }).helpText;
      console.log('Help text preview:', helpText.substring(0, 200) + '...');
    }
  });
}

console.log('\n=== Command Help Text ===\n');
console.log(CommandParser.getHelpText());

console.log('\n✅ All tests completed!\n');
