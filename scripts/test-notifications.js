#!/usr/bin/env node
/**
 * Test Notification System
 * Sends test notifications to configured Slack/Discord webhooks
 * 
 * Usage: node scripts/test-notifications.js
 */

const testNotifications = async () => {
  console.log('🧪 Testing Notification System\n');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  try {
    // Step 1: Check configuration status
    console.log('1️⃣ Checking notification provider configuration...');
    const statusResponse = await fetch(`${apiUrl}/api/notifications/send`);
    const statusData = await statusResponse.json();

    console.log(`   Configured providers: ${statusData.configured.join(', ') || 'none'}`);
    console.log(`   Status: ${statusData.isConfigured ? '✅ Ready' : '❌ Not configured'}\n`);

    if (!statusData.isConfigured) {
      console.log('⚠️  No notification providers configured.');
      console.log('   Set SLACK_WEBHOOK_URL or DISCORD_WEBHOOK_URL in .env.local\n');
      console.log('   See docs/SLACK_DISCORD_SETUP.md for setup instructions');
      process.exit(1);
    }

    // Step 2: Send test code review notification
    console.log('2️⃣ Sending test code review notification...');
    const reviewNotification = {
      type: 'review_completed',
      severity: 'info',
      title: 'Code Review Completed (TEST)',
      message: 'This is a test notification from CodeMind notification system',
      url: 'https://github.com/example/repo/pull/123',
      metadata: {
        repository: 'example/repo',
        branch: 'feature/test-notifications',
        suggestions: 5,
        highRisk: 0,
      },
    };

    const reviewResponse = await fetch(`${apiUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewNotification),
    });

    const reviewResult = await reviewResponse.json();
    
    if (reviewResult.success) {
      console.log('   ✅ Code review notification sent successfully');
      reviewResult.results.forEach(r => {
        console.log(`      ${r.provider}: ${r.success ? '✅' : '❌'} ${r.error || ''}`);
      });
    } else {
      console.log('   ❌ Failed to send notification');
      console.log(`      Error: ${reviewResult.error}`);
    }
    console.log('');

    // Step 3: Send test deployment notification
    console.log('3️⃣ Sending test deployment notification...');
    const deployNotification = {
      type: 'deployment_ready',
      severity: 'info',
      title: 'Deployment Ready (TEST)',
      message: 'Test deployment to production completed successfully',
      url: 'https://example-app.vercel.app',
      metadata: {
        project: 'codemind-test',
        environment: 'production',
        commit: 'abc1234',
        branch: 'main',
      },
    };

    const deployResponse = await fetch(`${apiUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deployNotification),
    });

    const deployResult = await deployResponse.json();
    
    if (deployResult.success) {
      console.log('   ✅ Deployment notification sent successfully');
      deployResult.results.forEach(r => {
        console.log(`      ${r.provider}: ${r.success ? '✅' : '❌'} ${r.error || ''}`);
      });
    } else {
      console.log('   ❌ Failed to send notification');
      console.log(`      Error: ${deployResult.error}`);
    }
    console.log('');

    // Step 4: Send test health check failure notification
    console.log('4️⃣ Sending test health check failure notification...');
    const healthNotification = {
      type: 'health_check_failed',
      severity: 'critical',
      title: 'Health Check Failed (TEST)',
      message: 'Test health check detected an issue',
      url: 'https://example-app.vercel.app',
      metadata: {
        project: 'codemind-test',
        environment: 'production',
        statusCode: '500',
        error: 'Connection timeout (simulated)',
      },
    };

    const healthResponse = await fetch(`${apiUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(healthNotification),
    });

    const healthResult = await healthResponse.json();
    
    if (healthResult.success) {
      console.log('   ✅ Health check notification sent successfully');
      healthResult.results.forEach(r => {
        console.log(`      ${r.provider}: ${r.success ? '✅' : '❌'} ${r.error || ''}`);
      });
    } else {
      console.log('   ❌ Failed to send notification');
      console.log(`      Error: ${healthResult.error}`);
    }
    console.log('');

    console.log('✅ Notification system test complete!');
    console.log('   Check your Slack/Discord channels for test messages\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Make sure the development server is running (pnpm dev)\n');
    process.exit(1);
  }
};

// Run tests
testNotifications();
