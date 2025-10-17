#!/usr/bin/env node

/**
 * Deployment Health Monitoring Script
 * 
 * This script monitors deployment health by checking:
 * - Recent deployment status
 * - Error rates and patterns
 * - Repeated failures
 * - API endpoint health
 * 
 * Can be run as:
 * - GitHub Actions cron job
 * - Manual health check
 * - External monitoring service
 * 
 * Usage:
 *   node scripts/monitor-deployment-health.js
 *   node scripts/monitor-deployment-health.js --alert-threshold 3
 *   node scripts/monitor-deployment-health.js --timeframe 24h
 */

require('dotenv').config();
const https = require('https');

// Configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const PRODUCTION_URL = process.env.PRODUCTION_URL || process.env.VERCEL_URL;

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const ALERT_THRESHOLD = parseInt(getArg('--alert-threshold') || '3', 10);
const TIMEFRAME = getArg('--timeframe') || '24h';

/**
 * Parse timeframe to milliseconds
 */
function parseTimeframe(timeframe) {
  const match = timeframe.match(/^(\d+)([hdm])$/);
  if (!match) {
    throw new Error('Invalid timeframe format. Use: 1h, 24h, 7d, 30d');
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  const multipliers = {
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000
  };
  
  return value * multipliers[unit];
}

/**
 * Make HTTPS request to Vercel API
 */
function makeVercelRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vercel.com',
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
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
    req.end();
  });
}

/**
 * Check health endpoint
 */
function checkHealthEndpoint(url) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'CodeMind-Health-Monitor/1.0'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          healthy: res.statusCode >= 200 && res.statusCode < 300,
          responseTime,
          body: body.substring(0, 500)
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        statusCode: 0,
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        statusCode: 0,
        healthy: false,
        responseTime: 10000,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}

/**
 * Fetch recent deployments
 */
async function fetchRecentDeployments() {
  const timeframeMs = parseTimeframe(TIMEFRAME);
  const since = Date.now() - timeframeMs;
  
  let path = `/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=100&since=${since}`;
  if (VERCEL_TEAM_ID) {
    path += `&teamId=${VERCEL_TEAM_ID}`;
  }

  const response = await makeVercelRequest(path);
  return response.deployments || [];
}

/**
 * Analyze deployment health
 */
function analyzeDeployments(deployments) {
  const stats = {
    total: deployments.length,
    ready: 0,
    error: 0,
    building: 0,
    queued: 0,
    canceled: 0,
    production: 0,
    preview: 0,
    consecutiveFailures: 0,
    errorRate: 0,
    recentErrors: []
  };

  let currentFailureStreak = 0;
  let maxFailureStreak = 0;

  // Sort by creation time (most recent first)
  const sortedDeployments = [...deployments].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  sortedDeployments.forEach((deployment) => {
    // Count by state
    const state = deployment.state || deployment.readyState;
    if (state === 'READY') {
      stats.ready++;
      currentFailureStreak = 0;
    } else if (state === 'ERROR') {
      stats.error++;
      currentFailureStreak++;
      maxFailureStreak = Math.max(maxFailureStreak, currentFailureStreak);
      stats.recentErrors.push({
        id: deployment.id,
        url: deployment.url,
        created: deployment.createdAt,
        target: deployment.target,
        state: state
      });
    } else if (state === 'BUILDING') {
      stats.building++;
    } else if (state === 'QUEUED') {
      stats.queued++;
    } else if (state === 'CANCELED') {
      stats.canceled++;
    }

    // Count by target
    if (deployment.target === 'production') stats.production++;
    else stats.preview++;
  });

  stats.consecutiveFailures = maxFailureStreak;
  stats.errorRate = stats.total > 0 ? ((stats.error / stats.total) * 100).toFixed(2) : 0;
  
  return stats;
}

/**
 * Send alert notification
 */
async function sendAlert(stats, healthCheck) {
  const message = generateAlertMessage(stats, healthCheck);
  
  const notifications = [];
  
  if (SLACK_WEBHOOK_URL) {
    notifications.push(sendSlackAlert(message));
  }
  
  if (DISCORD_WEBHOOK_URL) {
    notifications.push(sendDiscordAlert(message));
  }
  
  if (notifications.length === 0) {
    console.log('⚠️  No notification webhooks configured');
    return;
  }
  
  try {
    await Promise.all(notifications);
    console.log('✅ Alerts sent successfully');
  } catch (error) {
    console.error('❌ Failed to send alerts:', error.message);
  }
}

/**
 * Generate alert message
 */
function generateAlertMessage(stats, healthCheck) {
  const severity = stats.consecutiveFailures >= ALERT_THRESHOLD ? 'critical' : 'warning';
  const emoji = severity === 'critical' ? '🚨' : '⚠️';
  
  return {
    severity,
    title: `${emoji} Deployment Health Alert`,
    summary: `${stats.consecutiveFailures} consecutive deployment failures detected`,
    stats: {
      'Total Deployments': stats.total,
      'Failed': stats.error,
      'Success Rate': `${(100 - parseFloat(stats.errorRate)).toFixed(1)}%`,
      'Consecutive Failures': stats.consecutiveFailures,
      'Production Healthy': healthCheck.healthy ? '✅' : '❌'
    },
    recentErrors: stats.recentErrors.slice(0, 3)
  };
}

/**
 * Send Slack alert
 */
function sendSlackAlert(message) {
  return new Promise((resolve, reject) => {
    const url = new URL(SLACK_WEBHOOK_URL);
    
    const payload = {
      text: message.title,
      attachments: [{
        color: message.severity === 'critical' ? 'danger' : 'warning',
        title: message.summary,
        fields: Object.entries(message.stats).map(([key, value]) => ({
          title: key,
          value: String(value),
          short: true
        })),
        footer: 'CodeMind Health Monitor',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`Slack notification failed: ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

/**
 * Send Discord alert
 */
function sendDiscordAlert(message) {
  return new Promise((resolve, reject) => {
    const url = new URL(DISCORD_WEBHOOK_URL);
    
    const payload = {
      content: message.title,
      embeds: [{
        title: message.summary,
        color: message.severity === 'critical' ? 15158332 : 16776960,
        fields: Object.entries(message.stats).map(([key, value]) => ({
          name: key,
          value: String(value),
          inline: true
        })),
        footer: { text: 'CodeMind Health Monitor' },
        timestamp: new Date().toISOString()
      }]
    };

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 204 || res.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`Discord notification failed: ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

/**
 * Main monitoring function
 */
async function monitor() {
  console.log('🔍 CodeMind Deployment Health Monitor\n');
  console.log(`📊 Checking deployments from last ${TIMEFRAME}`);
  console.log(`⚠️  Alert threshold: ${ALERT_THRESHOLD} consecutive failures\n`);

  try {
    // Check if environment is configured
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      console.error('❌ Missing required environment variables:');
      if (!VERCEL_TOKEN) console.error('   - VERCEL_TOKEN');
      if (!VERCEL_PROJECT_ID) console.error('   - VERCEL_PROJECT_ID');
      process.exit(1);
    }

    // Fetch deployments
    console.log('📥 Fetching deployment data...');
    const deployments = await fetchRecentDeployments();
    console.log(`✅ Found ${deployments.length} deployments\n`);

    // Analyze health
    const stats = analyzeDeployments(deployments);
    
    console.log('📊 Deployment Statistics:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   ✅ Ready: ${stats.ready}`);
    console.log(`   ❌ Failed: ${stats.error}`);
    console.log(`   🔄 Building: ${stats.building}`);
    console.log(`   📦 Production: ${stats.production}`);
    console.log(`   🔬 Preview: ${stats.preview}`);
    console.log(`   📈 Success Rate: ${(100 - parseFloat(stats.errorRate)).toFixed(1)}%`);
    console.log(`   🔥 Consecutive Failures: ${stats.consecutiveFailures}\n`);

    // Check production health endpoint
    let healthCheck = { healthy: false, statusCode: 0 };
    if (PRODUCTION_URL) {
      console.log('🏥 Checking production health endpoint...');
      const healthUrl = PRODUCTION_URL.startsWith('http') 
        ? `${PRODUCTION_URL}/api/health`
        : `https://${PRODUCTION_URL}/api/health`;
      
      healthCheck = await checkHealthEndpoint(healthUrl);
      
      if (healthCheck.healthy) {
        console.log(`✅ Health check passed (${healthCheck.statusCode}) - Response time: ${healthCheck.responseTime}ms\n`);
      } else {
        console.log(`❌ Health check failed: ${healthCheck.error || `HTTP ${healthCheck.statusCode}`}\n`);
      }
    } else {
      console.log('⚠️  PRODUCTION_URL not configured, skipping health check\n');
    }

    // Determine if alert should be sent
    const shouldAlert = stats.consecutiveFailures >= ALERT_THRESHOLD || !healthCheck.healthy;

    if (shouldAlert) {
      console.log('🚨 ALERT: Issues detected!');
      console.log(`   - Consecutive failures: ${stats.consecutiveFailures}/${ALERT_THRESHOLD}`);
      console.log(`   - Production healthy: ${healthCheck.healthy ? 'Yes' : 'No'}\n`);
      
      if (stats.recentErrors.length > 0) {
        console.log('Recent failed deployments:');
        stats.recentErrors.slice(0, 3).forEach((error, i) => {
          console.log(`   ${i + 1}. ${error.url} (${error.target})`);
          console.log(`      ID: ${error.id}`);
          console.log(`      Time: ${new Date(error.created).toLocaleString()}`);
        });
        console.log('');
      }

      // Send notifications
      if (SLACK_WEBHOOK_URL || DISCORD_WEBHOOK_URL) {
        console.log('📨 Sending alert notifications...');
        await sendAlert(stats, healthCheck);
      } else {
        console.log('⚠️  No notification webhooks configured - alerts not sent\n');
      }
    } else {
      console.log('✅ All systems healthy!\n');
    }

    // Exit with appropriate code
    process.exit(shouldAlert ? 1 : 0);

  } catch (error) {
    console.error('❌ Monitoring failed:', error.message);
    process.exit(1);
  }
}

// Run monitor
monitor();
