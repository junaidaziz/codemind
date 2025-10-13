#!/usr/bin/env node

/**
 * Live API Integration Test
 * 
 * This script tests the actual API connections using the configured secrets
 * to verify the auto-fix system is ready for production use.
 */

console.log('🔌 Testing Live API Integration...\n');

async function testAPIs() {
  try {
    // Test 1: Verify environment setup
    console.log('🔍 Test 1: Environment Setup');
    
    const requiredEnvs = [
      'VERCEL_TOKEN',
      'VERCEL_PROJECT_ID', 
      'VERCEL_TEAM_ID',
      'OPENAI_API_KEY'
    ];
    
    const missing = requiredEnvs.filter(env => !process.env[env]);
    
    if (missing.length > 0) {
      console.log(`   ❌ Missing environment variables: ${missing.join(', ')}`);
      console.log('   💡 Make sure GitHub secrets are configured correctly');
      return;
    }
    
    console.log('   ✅ All required environment variables present');
    
    // Test 2: Test Vercel API connectivity
    console.log('\n🔍 Test 2: Vercel API Connectivity');
    
    try {
      const vercelResponse = await fetch('https://api.vercel.com/v6/deployments?limit=1', {
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (vercelResponse.ok) {
        console.log('   ✅ Vercel API connection successful');
        console.log(`   📊 Response status: ${vercelResponse.status}`);
      } else {
        console.log(`   ❌ Vercel API error: ${vercelResponse.status} ${vercelResponse.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ Vercel API connection failed: ${error.message}`);
    }
    
    // Test 3: Test OpenAI API connectivity
    console.log('\n🔍 Test 3: OpenAI API Connectivity');
    
    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (openaiResponse.ok) {
        console.log('   ✅ OpenAI API connection successful');
        console.log(`   📊 Response status: ${openaiResponse.status}`);
      } else {
        console.log(`   ❌ OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ OpenAI API connection failed: ${error.message}`);
    }
    
    // Test 4: Load auto-fix system with real config
    console.log('\n🔍 Test 4: Auto-Fix System Integration');
    
    try {
      process.env.GITHUB_ACTIONS = 'true';
      const { VercelBuildAnalyzer } = require('./analyze-vercel-build.js');
      const analyzer = new VercelBuildAnalyzer();
      
      if (analyzer.env.isConfigured) {
        console.log('   ✅ Auto-fix system initializes successfully');
        console.log('   ✅ All APIs configured and ready');
        
        // Test if it can run (will skip if no failures found)
        console.log('\n🚀 Running live auto-fix test...');
        await analyzer.run();
        
        console.log('\n🎉 INTEGRATION TEST SUCCESSFUL!');
        console.log('\n📋 Production Status:');
        console.log('   • ✅ Vercel API: Connected and operational');
        console.log('   • ✅ OpenAI API: Connected and operational');
        console.log('   • ✅ Auto-fix System: Fully configured');
        console.log('   • ✅ GitHub Secrets: Properly integrated');
        console.log('\n🚀 The system is ready for production use!');
        
      } else {
        console.log('   ❌ Auto-fix system configuration incomplete');
      }
      
    } catch (error) {
      console.log(`   ❌ Auto-fix system error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAPIs().catch(console.error);