#!/usr/bin/env node

/**
 * Vercel Webhook Configuration Script
 * 
 * This script automates the setup of Vercel deployment webhooks using the Vercel API.
 * It configures webhooks to trigger on deployment events (created, succeeded, failed, error).
 * 
 * Usage:
 *   node scripts/configure-vercel-webhook.js [options]
 * 
 * Options:
 *   --url <webhook-url>     The webhook endpoint URL (required)
 *   --list                  List existing webhooks
 *   --delete <webhook-id>   Delete a webhook by ID
 *   --test <webhook-id>     Test a webhook by ID
 * 
 * Environment Variables Required:
 *   VERCEL_TOKEN          - Vercel API token
 *   VERCEL_PROJECT_ID     - Vercel project ID
 *   VERCEL_WEBHOOK_SECRET - Secret for webhook signature verification
 *   VERCEL_TEAM_ID        - Vercel team/org ID (optional)
 */

require('dotenv').config();
const https = require('https');

// Configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_WEBHOOK_SECRET = process.env.VERCEL_WEBHOOK_SECRET;

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const webhookUrl = getArg('--url');
const listWebhooks = args.includes('--list');
const deleteWebhookId = getArg('--delete');
const testWebhookId = getArg('--test');

// Validate environment variables
function validateEnv() {
  const missing = [];
  if (!VERCEL_TOKEN) missing.push('VERCEL_TOKEN');
  if (!VERCEL_PROJECT_ID) missing.push('VERCEL_PROJECT_ID');
  if (!VERCEL_WEBHOOK_SECRET && !listWebhooks && !deleteWebhookId && !testWebhookId) {
    missing.push('VERCEL_WEBHOOK_SECRET');
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nAdd them to your .env file.');
    process.exit(1);
  }
}

// Make HTTPS request to Vercel API
function makeVercelRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: 'api.vercel.com',
      port: 443,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = https.request(requestOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${response.error?.message || body}`));
          }
        } catch {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// List all webhooks
async function listWebhooksForProject() {
  console.log('📋 Fetching webhooks...\n');

  const path = VERCEL_TEAM_ID 
    ? `/v1/webhooks?projectId=${VERCEL_PROJECT_ID}&teamId=${VERCEL_TEAM_ID}`
    : `/v1/webhooks?projectId=${VERCEL_PROJECT_ID}`;

  try {
    const response = await makeVercelRequest({ path });
    
    if (!response.webhooks || response.webhooks.length === 0) {
      console.log('No webhooks found for this project.');
      return;
    }

    console.log(`Found ${response.webhooks.length} webhook(s):\n`);
    response.webhooks.forEach((webhook, index) => {
      console.log(`${index + 1}. ID: ${webhook.id}`);
      console.log(`   URL: ${webhook.url}`);
      console.log(`   Events: ${webhook.events.join(', ')}`);
      console.log(`   Created: ${new Date(webhook.createdAt).toLocaleString()}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to list webhooks:', error.message);
    process.exit(1);
  }
}

// Create webhook
async function createWebhook(url) {
  console.log('🔧 Creating webhook...\n');

  const webhookData = {
    name: 'CodeMind Auto-Fix Webhook',
    url: url,
    events: [
      'deployment.created',
      'deployment.succeeded', 
      'deployment.failed',
      'deployment.error'
    ],
    projectIds: [VERCEL_PROJECT_ID],
    secret: VERCEL_WEBHOOK_SECRET
  };

  const path = VERCEL_TEAM_ID
    ? `/v1/webhooks?teamId=${VERCEL_TEAM_ID}`
    : `/v1/webhooks`;

  try {
    const response = await makeVercelRequest(
      { path, method: 'POST' },
      webhookData
    );

    console.log('✅ Webhook created successfully!\n');
    console.log('Webhook Details:');
    console.log(`  ID: ${response.id}`);
    console.log(`  URL: ${response.url}`);
    console.log(`  Events: ${response.events.join(', ')}`);
    console.log(`  Secret: ${response.secret ? '[CONFIGURED]' : '[NOT SET]'}`);
    console.log('\n🎉 Webhook is ready to receive deployment events!');
    
    return response;
  } catch (error) {
    console.error('❌ Failed to create webhook:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n💡 Tip: Use --list to see existing webhooks');
      console.log('      Use --delete <webhook-id> to remove a webhook');
    }
    
    process.exit(1);
  }
}

// Delete webhook
async function deleteWebhook(webhookId) {
  console.log(`🗑️  Deleting webhook ${webhookId}...\n`);

  const path = VERCEL_TEAM_ID
    ? `/v1/webhooks/${webhookId}?teamId=${VERCEL_TEAM_ID}`
    : `/v1/webhooks/${webhookId}`;

  try {
    await makeVercelRequest({ path, method: 'DELETE' });
    console.log('✅ Webhook deleted successfully!');
  } catch (error) {
    console.error('❌ Failed to delete webhook:', error.message);
    process.exit(1);
  }
}

// Test webhook
async function testWebhook(webhookId) {
  console.log(`🧪 Testing webhook ${webhookId}...\n`);

  const path = VERCEL_TEAM_ID
    ? `/v1/webhooks/${webhookId}/events?teamId=${VERCEL_TEAM_ID}`
    : `/v1/webhooks/${webhookId}/events`;

  try {
    await makeVercelRequest({ path, method: 'POST' }, {
      type: 'deployment.created',
      payload: {
        deployment: {
          id: 'test-deployment-id',
          name: 'test-deployment',
          url: 'test.vercel.app',
          state: 'BUILDING'
        }
      }
    });

    console.log('✅ Test webhook sent successfully!');
    console.log('Check your webhook endpoint logs for the test event.');
  } catch (error) {
    console.error('❌ Failed to test webhook:', error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('🚀 Vercel Webhook Configuration Tool\n');

  validateEnv();

  // List webhooks
  if (listWebhooks) {
    await listWebhooksForProject();
    return;
  }

  // Delete webhook
  if (deleteWebhookId) {
    await deleteWebhook(deleteWebhookId);
    return;
  }

  // Test webhook
  if (testWebhookId) {
    await testWebhook(testWebhookId);
    return;
  }

  // Create webhook
  if (webhookUrl) {
    // Validate webhook URL
    try {
      const url = new URL(webhookUrl);
      if (!url.protocol.startsWith('https')) {
        console.error('❌ Webhook URL must use HTTPS');
        process.exit(1);
      }
    } catch (err) {
      console.error('❌ Invalid webhook URL:', err.message);
      process.exit(1);
    }

    await createWebhook(webhookUrl);
    return;
  }

  // Show usage if no valid option provided
  console.log('Usage:');
  console.log('  List webhooks:    node scripts/configure-vercel-webhook.js --list');
  console.log('  Create webhook:   node scripts/configure-vercel-webhook.js --url https://your-domain.com/api/webhooks/vercel-deployment');
  console.log('  Delete webhook:   node scripts/configure-vercel-webhook.js --delete <webhook-id>');
  console.log('  Test webhook:     node scripts/configure-vercel-webhook.js --test <webhook-id>');
  console.log('\nEnvironment variables required: VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_WEBHOOK_SECRET');
}

// Run the script
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
