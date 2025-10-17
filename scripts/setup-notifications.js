#!/usr/bin/env node

/**
 * Deployment Notifications Setup Script
 * 
 * This script helps configure Slack or Discord webhooks for deployment notifications.
 * It validates webhook URLs and provides integration examples for CI/CD workflows.
 * 
 * Usage:
 *   node scripts/setup-notifications.js --platform slack --webhook-url <url>
 *   node scripts/setup-notifications.js --platform discord --webhook-url <url>
 *   node scripts/setup-notifications.js --test
 * 
 * Options:
 *   --platform <slack|discord>  Notification platform
 *   --webhook-url <url>         Webhook URL for notifications
 *   --test                      Test existing webhook configuration
 *   --generate-template         Generate GitHub Actions workflow template
 */

require('dotenv').config();
const https = require('https');
const { URL } = require('url');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const platform = getArg('--platform');
const webhookUrl = getArg('--webhook-url');
const testMode = args.includes('--test');
const generateTemplate = args.includes('--generate-template');

// Environment variables
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

/**
 * Send notification to Slack
 */
async function sendSlackNotification(webhookUrl, message) {
  const payload = {
    text: message.text,
    attachments: message.attachments || [],
    blocks: message.blocks || []
  };

  return sendWebhook(webhookUrl, payload);
}

/**
 * Send notification to Discord
 */
async function sendDiscordNotification(webhookUrl, message) {
  const payload = {
    content: message.text,
    embeds: message.embeds || []
  };

  return sendWebhook(webhookUrl, payload);
}

/**
 * Generic webhook sender
 */
function sendWebhook(url, payload) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          reject(new Error(`Webhook failed with status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

/**
 * Validate webhook URL format
 */
function validateWebhookUrl(url, platform) {
  try {
    const urlObj = new URL(url);
    
    if (platform === 'slack' && !urlObj.hostname.includes('slack.com')) {
      throw new Error('Slack webhook URL must be from slack.com');
    }
    
    if (platform === 'discord' && !urlObj.hostname.includes('discord.com')) {
      throw new Error('Discord webhook URL must be from discord.com');
    }
    
    return true;
  } catch (error) {
    throw new Error(`Invalid webhook URL: ${error.message}`);
  }
}

/**
 * Test existing webhook configuration
 */
async function testWebhooks() {
  console.log('🧪 Testing webhook configuration...\n');

  const results = [];

  // Test Slack
  if (SLACK_WEBHOOK_URL) {
    console.log('📨 Testing Slack webhook...');
    try {
      const message = {
        text: '✅ Test notification from CodeMind',
        attachments: [{
          color: 'good',
          text: 'This is a test message to verify Slack integration is working correctly.',
          footer: 'CodeMind Deployment Bot',
          ts: Math.floor(Date.now() / 1000)
        }]
      };
      
      await sendSlackNotification(SLACK_WEBHOOK_URL, message);
      console.log('✅ Slack webhook test successful!\n');
      results.push({ platform: 'Slack', status: 'success' });
    } catch (error) {
      console.error('❌ Slack webhook test failed:', error.message, '\n');
      results.push({ platform: 'Slack', status: 'failed', error: error.message });
    }
  } else {
    console.log('⚠️  SLACK_WEBHOOK_URL not configured\n');
    results.push({ platform: 'Slack', status: 'not configured' });
  }

  // Test Discord
  if (DISCORD_WEBHOOK_URL) {
    console.log('📨 Testing Discord webhook...');
    try {
      const message = {
        text: '✅ Test notification from CodeMind',
        embeds: [{
          title: 'Test Notification',
          description: 'This is a test message to verify Discord integration is working correctly.',
          color: 3066993, // Green
          footer: { text: 'CodeMind Deployment Bot' },
          timestamp: new Date().toISOString()
        }]
      };
      
      await sendDiscordNotification(DISCORD_WEBHOOK_URL, message);
      console.log('✅ Discord webhook test successful!\n');
      results.push({ platform: 'Discord', status: 'success' });
    } catch (error) {
      console.error('❌ Discord webhook test failed:', error.message, '\n');
      results.push({ platform: 'Discord', status: 'failed', error: error.message });
    }
  } else {
    console.log('⚠️  DISCORD_WEBHOOK_URL not configured\n');
    results.push({ platform: 'Discord', status: 'not configured' });
  }

  // Summary
  console.log('📊 Test Results:');
  results.forEach(result => {
    const icon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
    console.log(`   ${icon} ${result.platform}: ${result.status}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });

  return results;
}

/**
 * Configure webhook in .env
 */
function configureWebhook(platform, url) {
  console.log(`🔧 Configuring ${platform} webhook...\n`);

  // Validate URL
  try {
    validateWebhookUrl(url, platform);
    console.log('✅ Webhook URL is valid\n');
  } catch (error) {
    console.error('❌', error.message);
    process.exit(1);
  }

  const envVar = platform === 'slack' ? 'SLACK_WEBHOOK_URL' : 'DISCORD_WEBHOOK_URL';

  console.log('Add this to your .env file:');
  console.log(`\n${envVar}="${url}"\n`);

  console.log('Add this to your GitHub repository secrets:');
  console.log(`\n1. Go to: https://github.com/junaidaziz/codemind/settings/secrets/actions`);
  console.log(`2. Click "New repository secret"`);
  console.log(`3. Name: ${envVar}`);
  console.log(`4. Value: ${url}\n`);

  console.log('Add this to Vercel environment variables:');
  console.log(`\nvercel env add ${envVar} production`);
  console.log(`# Paste: ${url}\n`);

  console.log('Test the webhook:');
  console.log(`\nnode scripts/setup-notifications.js --test\n`);
}

/**
 * Generate GitHub Actions workflow template
 */
function generateWorkflowTemplate() {
  console.log('📄 Generating GitHub Actions workflow template...\n');

  const template = `
# Add this to your .github/workflows/ci-cd.yml
# In the deploy-production job, after deployment steps:

      - name: Notify deployment success
        if: success()
        run: |
          curl -X POST \${{ secrets.SLACK_WEBHOOK_URL }} \\
            -H 'Content-Type: application/json' \\
            -d '{
              "text": "✅ Production Deployment Successful",
              "attachments": [{
                "color": "good",
                "fields": [
                  {"title": "Environment", "value": "Production", "short": true},
                  {"title": "Branch", "value": "'\${{ github.ref_name }}'", "short": true},
                  {"title": "Commit", "value": "'\${{ github.sha }}'", "short": true},
                  {"title": "Author", "value": "'\${{ github.actor }}'", "short": true}
                ],
                "footer": "CodeMind CI/CD",
                "ts": '\$(date +%s)'
              }]
            }'

      - name: Notify deployment failure
        if: failure()
        run: |
          curl -X POST \${{ secrets.SLACK_WEBHOOK_URL }} \\
            -H 'Content-Type: application/json' \\
            -d '{
              "text": "❌ Production Deployment Failed",
              "attachments": [{
                "color": "danger",
                "fields": [
                  {"title": "Environment", "value": "Production", "short": true},
                  {"title": "Branch", "value": "'\${{ github.ref_name }}'", "short": true},
                  {"title": "Commit", "value": "'\${{ github.sha }}'", "short": true},
                  {"title": "Author", "value": "'\${{ github.actor }}'", "short": true}
                ],
                "footer": "CodeMind CI/CD",
                "ts": '\$(date +%s)'
              }]
            }'

# For Discord, replace with:
#   curl -X POST \${{ secrets.DISCORD_WEBHOOK_URL }} \\
#     -H 'Content-Type: application/json' \\
#     -d '{
#       "content": "✅ Production Deployment Successful",
#       "embeds": [{
#         "title": "Deployment Status",
#         "color": 3066993,
#         "fields": [
#           {"name": "Environment", "value": "Production", "inline": true},
#           {"name": "Branch", "value": "'\${{ github.ref_name }}'", "inline": true}
#         ]
#       }]
#     }'
`;

  console.log(template);
  
  console.log('\n📝 Template generated! Copy the relevant sections to your workflow.\n');
}

/**
 * Show usage
 */
function showUsage() {
  console.log('🚀 Deployment Notifications Setup\n');
  console.log('Usage:');
  console.log('  Configure Slack:    node scripts/setup-notifications.js --platform slack --webhook-url <url>');
  console.log('  Configure Discord:  node scripts/setup-notifications.js --platform discord --webhook-url <url>');
  console.log('  Test webhooks:      node scripts/setup-notifications.js --test');
  console.log('  Generate template:  node scripts/setup-notifications.js --generate-template\n');
  console.log('Examples:');
  console.log('  node scripts/setup-notifications.js --platform slack --webhook-url https://hooks.slack.com/services/...');
  console.log('  node scripts/setup-notifications.js --test\n');
}

/**
 * Main execution
 */
async function main() {
  // Test mode
  if (testMode) {
    await testWebhooks();
    return;
  }

  // Generate template
  if (generateTemplate) {
    generateWorkflowTemplate();
    return;
  }

  // Configure webhook
  if (platform && webhookUrl) {
    if (!['slack', 'discord'].includes(platform)) {
      console.error('❌ Platform must be either "slack" or "discord"');
      process.exit(1);
    }
    configureWebhook(platform, webhookUrl);
    return;
  }

  // Show usage
  showUsage();
}

// Run
main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
