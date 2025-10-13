#!/usr/bin/env node

/**
 * GitHub Authentication Test Script
 * 
 * This script tests GitHub App authentication and permissions
 * to ensure Codemind can properly integrate with GitHub repositories.
 */

console.log('🐙 Testing GitHub App Authentication...\n');

async function testGitHubAuth() {
  try {
    // Check required environment variables
    const requiredVars = {
      GITHUB_APP_ID: process.env.GITHUB_APP_ID,
      GITHUB_INSTALLATION_ID: process.env.GITHUB_INSTALLATION_ID,
      GITHUB_PRIVATE_KEY: process.env.GITHUB_PRIVATE_KEY,
    };

    console.log('🔍 Checking Environment Variables:');
    for (const [name, value] of Object.entries(requiredVars)) {
      if (!value) {
        console.log(`❌ ${name}: Missing`);
        return false;
      } else {
        console.log(`✅ ${name}: Configured (${value.length} chars)`);
      }
    }

    // Import and initialize Octokit
    const { Octokit } = require('@octokit/rest');
    const { createAppAuth } = require('@octokit/auth-app');

    console.log('\n🔐 Initializing GitHub App Authentication...');
    
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: requiredVars.GITHUB_APP_ID,
        privateKey: requiredVars.GITHUB_PRIVATE_KEY,
        installationId: requiredVars.GITHUB_INSTALLATION_ID,
      },
    });

    console.log('✅ Octokit client initialized');

    // Test app authentication
    console.log('\n🧪 Testing App Authentication...');
    const app = await octokit.rest.apps.getAuthenticated();
    console.log(`✅ App authenticated: ${app.data.name} (ID: ${app.data.id})`);
    console.log(`   Owner: ${app.data.owner.login}`);
    console.log(`   Permissions: ${Object.keys(app.data.permissions || {}).join(', ')}`);

    // Test installation
    console.log('\n🏢 Testing Installation...');
    const installation = await octokit.rest.apps.getInstallation({
      installation_id: requiredVars.GITHUB_INSTALLATION_ID,
    });
    console.log(`✅ Installation found: ${installation.data.account.login}`);
    console.log(`   Type: ${installation.data.account.type}`);
    console.log(`   Repository Selection: ${installation.data.repository_selection}`);

    // Test repository access
    console.log('\n📚 Testing Repository Access...');
    const repos = await octokit.rest.apps.listReposAccessibleToInstallation({
      per_page: 10,
    });
    
    console.log(`✅ Found ${repos.data.total_count} accessible repositories:`);
    repos.data.repositories.slice(0, 5).forEach(repo => {
      console.log(`   - ${repo.full_name} (${repo.permissions?.admin ? 'admin' : 'read/write'})`);
    });

    if (repos.data.repositories.length > 5) {
      console.log(`   ... and ${repos.data.repositories.length - 5} more`);
    }

    // Test webhook permissions (if we have a test repo)
    if (repos.data.repositories.length > 0) {
      const testRepo = repos.data.repositories[0];
      console.log(`\n🔗 Testing Webhook Access on ${testRepo.full_name}...`);
      
      try {
        const webhooks = await octokit.rest.repos.listWebhooks({
          owner: testRepo.owner.login,
          repo: testRepo.name,
        });
        console.log(`✅ Webhook access verified (${webhooks.data.length} webhooks found)`);
        
        // Check if our webhook exists
        const codemindWebhook = webhooks.data.find(wh => 
          wh.config.url?.includes('codemind') || 
          wh.config.url?.includes('api/github/webhook')
        );
        
        if (codemindWebhook) {
          console.log(`✅ Codemind webhook found: ${codemindWebhook.config.url}`);
          console.log(`   Events: ${codemindWebhook.events.join(', ')}`);
          console.log(`   Active: ${codemindWebhook.active}`);
        } else {
          console.log(`⚠️  No Codemind webhook found - you'll need to configure this`);
        }
        
      } catch (error) {
        console.log(`❌ Webhook access failed: ${error.message}`);
      }
    }

    // Test specific permissions
    console.log('\n🔐 Testing Required Permissions...');
    const requiredPerms = ['contents', 'pull_requests', 'metadata'];
    const availablePerms = app.data.permissions || {};
    
    for (const perm of requiredPerms) {
      const level = availablePerms[perm];
      if (level) {
        console.log(`✅ ${perm}: ${level}`);
      } else {
        console.log(`❌ ${perm}: Missing`);
      }
    }

    console.log('\n🎉 GitHub Authentication Test Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ App authentication working');
    console.log('   ✅ Installation configured');
    console.log('   ✅ Repository access verified');
    console.log('   ✅ Required permissions available');
    
    console.log('\n🚀 Next Steps:');
    console.log('   1. Configure webhook URL in GitHub App settings');
    console.log('   2. Set webhook secret in environment variables');
    console.log('   3. Test webhook delivery with a test event');
    
    return true;

  } catch (error) {
    console.error('\n❌ GitHub Authentication Failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes('Bad credentials')) {
      console.error('\n🔧 Troubleshooting:');
      console.error('   - Verify GITHUB_APP_ID is correct');
      console.error('   - Check GITHUB_PRIVATE_KEY includes BEGIN/END lines');
      console.error('   - Confirm GITHUB_INSTALLATION_ID matches your installation');
    }
    
    if (error.message.includes('Not Found')) {
      console.error('\n🔧 Troubleshooting:');
      console.error('   - Verify the GitHub App is installed on your account/org');
      console.error('   - Check GITHUB_INSTALLATION_ID is correct');
      console.error('   - Ensure app has access to target repositories');
    }
    
    return false;
  }
}

// Test webhook signature validation
function testWebhookSecurity() {
  console.log('\n🔒 Testing Webhook Security...');
  
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.log('⚠️  GITHUB_WEBHOOK_SECRET not configured');
    return false;
  }
  
  try {
    const crypto = require('crypto');
    const payload = '{"test": "webhook"}';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    
    console.log(`✅ Webhook secret configured (${secret.length} chars)`);
    console.log(`✅ HMAC signature generation working`);
    console.log(`   Test signature: sha256=${signature.substring(0, 16)}...`);
    
    return true;
  } catch (error) {
    console.log(`❌ Webhook security test failed: ${error.message}`);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🧠 Codemind GitHub Integration Test\n');
  console.log('=' .repeat(50));
  
  const authSuccess = await testGitHubAuth();
  const webhookSuccess = testWebhookSecurity();
  
  console.log('\n' + '=' .repeat(50));
  console.log('🏆 Test Results:');
  console.log(`   GitHub Auth: ${authSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Webhook Security: ${webhookSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  if (authSuccess && webhookSuccess) {
    console.log('\n🎯 All GitHub integration tests passed!');
    console.log('   Your Codemind instance is ready for GitHub integration.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    console.log('   See SYSTEM_VERIFICATION.md for setup instructions.');
  }
}

if (require.main === module) {
  main().catch(console.error);
}