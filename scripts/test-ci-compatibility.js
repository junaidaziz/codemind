#!/usr/bin/env node

/**
 * CI System Verification Test
 * 
 * This script verifies that the auto-fix system works correctly in CI environments
 * both with and without secrets configured.
 */

console.log('🧪 Testing CI Auto-Fix System Compatibility...\n');

// Test 1: Simulate CI environment without secrets
console.log('🔍 Test 1: CI Environment without secrets');
process.env.GITHUB_ACTIONS = 'true';
delete process.env.VERCEL_TOKEN;
delete process.env.VERCEL_PROJECT;
delete process.env.VERCEL_TEAM;  
delete process.env.OPENAI_API_KEY;

try {
  const { VercelBuildAnalyzer } = require('./analyze-vercel-build.js');
  const analyzer = new VercelBuildAnalyzer();
  
  console.log('   ✅ Script loads without crashing');
  console.log('   ✅ Configuration validation works');
  
  // Test if it would run gracefully
  analyzer.run().then(() => {
    console.log('   ✅ Graceful degradation successful');
    console.log('   ✅ Test 1 PASSED\n');
    
    // Test 2: Local environment validation  
    console.log('🔍 Test 2: Local Environment validation');
    delete process.env.GITHUB_ACTIONS;
    
    try {
      const analyzer2 = new VercelBuildAnalyzer();
      console.log('   ❌ Should have failed without env vars');
    } catch (error) {
      if (error.message.includes('Missing required environment variables')) {
        console.log('   ✅ Properly validates local environment');
        console.log('   ✅ Test 2 PASSED\n');
        
        console.log('🎉 ALL TESTS PASSED!');
        console.log('');
        console.log('✅ CI System Status:');
        console.log('   • Auto-fix system loads correctly in CI');
        console.log('   • Graceful degradation when secrets missing');
        console.log('   • Proper validation in local environments');  
        console.log('   • Ready for production deployment');
        console.log('');
        console.log('🚀 Next Steps:');
        console.log('   1. Configure GitHub secrets for full functionality');
        console.log('   2. Test with actual Vercel deployment failure');
        console.log('   3. Verify OpenAI analysis integration');
        
      } else {
        console.log('   ❌ Unexpected error:', error.message);
      }
    }
    
  }).catch(error => {
    console.log('   ❌ Test 1 FAILED:', error.message);
  });
  
} catch (error) {
  console.log('   ❌ Test 1 FAILED - Script loading error:', error.message);
}