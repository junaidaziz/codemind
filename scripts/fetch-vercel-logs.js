#!/usr/bin/env node

/**
 * Vercel Deployment Log Fetcher
 * 
 * Fetches deployment logs from Vercel API for failed builds
 * and optionally triggers auto-fix for build failures.
 * 
 * Usage:
 *   node scripts/fetch-vercel-logs.js [options]
 * 
 * Options:
 *   --deployment-id <id>  Specific deployment ID to fetch logs for
 *   --project-id <id>     Project ID (defaults to env var)
 *   --status <status>     Filter by deployment status (error, ready, building)
 *   --limit <number>      Number of deployments to fetch (default: 10)
 *   --auto-fix            Automatically trigger auto-fix for failed builds
 *   --output <file>       Save logs to file (JSON format)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration from environment variables
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  deploymentId: null,
  projectId: VERCEL_PROJECT_ID,
  status: 'error',
  limit: 10,
  autoFix: false,
  output: null,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--deployment-id':
      options.deploymentId = args[++i];
      break;
    case '--project-id':
      options.projectId = args[++i];
      break;
    case '--status':
      options.status = args[++i];
      break;
    case '--limit':
      options.limit = parseInt(args[++i], 10);
      break;
    case '--auto-fix':
      options.autoFix = true;
      break;
    case '--output':
      options.output = args[++i];
      break;
    case '--help':
      console.log(`
Vercel Deployment Log Fetcher

Usage: node scripts/fetch-vercel-logs.js [options]

Options:
  --deployment-id <id>  Specific deployment ID to fetch logs for
  --project-id <id>     Project ID (defaults to VERCEL_PROJECT_ID env var)
  --status <status>     Filter by deployment status (error, ready, building)
  --limit <number>      Number of deployments to fetch (default: 10)
  --auto-fix            Automatically trigger auto-fix for failed builds
  --output <file>       Save logs to file (JSON format)
  --help                Show this help message

Environment Variables:
  VERCEL_TOKEN          Required: Vercel API token
  VERCEL_PROJECT_ID     Required: Vercel project ID
  VERCEL_TEAM_ID        Optional: Vercel team ID

Examples:
  # Fetch latest 5 failed deployments
  node scripts/fetch-vercel-logs.js --status error --limit 5

  # Fetch specific deployment logs
  node scripts/fetch-vercel-logs.js --deployment-id dpl_xxx

  # Fetch and trigger auto-fix
  node scripts/fetch-vercel-logs.js --status error --auto-fix

  # Save logs to file
  node scripts/fetch-vercel-logs.js --status error --output logs/vercel-errors.json
      `);
      process.exit(0);
  }
}

// Validate required environment variables
if (!VERCEL_TOKEN) {
  console.error('❌ Error: VERCEL_TOKEN environment variable is required');
  process.exit(1);
}

if (!options.projectId) {
  console.error('❌ Error: Project ID is required (--project-id or VERCEL_PROJECT_ID env var)');
  process.exit(1);
}

/**
 * Make HTTPS request to Vercel API
 */
function makeVercelRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.vercel.com${path}`);
    if (VERCEL_TEAM_ID) {
      url.searchParams.append('teamId', VERCEL_TEAM_ID);
    }

    const requestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API Error: ${res.statusCode} - ${parsed.error?.message || data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Fetch deployment logs
 */
async function fetchDeploymentLogs(deploymentId) {
  try {
    console.log(`📋 Fetching logs for deployment: ${deploymentId}`);
    const logs = await makeVercelRequest(`/v2/deployments/${deploymentId}/events`);
    return logs;
  } catch (error) {
    console.error(`❌ Failed to fetch logs: ${error.message}`);
    return null;
  }
}

/**
 * Fetch deployments list
 */
async function fetchDeployments() {
  try {
    console.log(`🔍 Fetching deployments for project: ${options.projectId}`);
    const params = new URLSearchParams({
      projectId: options.projectId,
      limit: options.limit.toString(),
    });

    if (options.status) {
      params.append('state', options.status.toUpperCase());
    }

    const response = await makeVercelRequest(`/v6/deployments?${params.toString()}`);
    return response.deployments || [];
  } catch (error) {
    console.error(`❌ Failed to fetch deployments: ${error.message}`);
    return [];
  }
}

/**
 * Parse build logs to extract error information
 */
function parseErrorLogs(logs) {
  const errors = [];
  
  if (!logs || !logs.length) {
    return errors;
  }

  for (const log of logs) {
    if (log.type === 'stderr' || (log.payload && log.payload.type === 'error')) {
      errors.push({
        timestamp: log.createdAt || log.date,
        message: log.payload?.text || log.text || '',
        type: log.type,
      });
    }
  }

  return errors;
}

/**
 * Trigger auto-fix for failed deployment
 */
async function triggerAutoFix(deployment, errorLogs) {
  console.log(`\n🤖 Triggering auto-fix for deployment: ${deployment.id}`);
  
  // Prepare log content for auto-fix
  const logContent = errorLogs.map(log => 
    `[${new Date(log.timestamp).toISOString()}] ${log.message}`
  ).join('\n');

  // Call local auto-fix API
  try {
    const http = require('http');
    const postData = JSON.stringify({
      projectId: options.projectId,
      logContent,
      triggerType: 'ci_failure',
      options: {
        requireApproval: false,
        maxFixesPerHour: 5,
      },
    });

    const requestOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/github/auto-fix',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    return new Promise((resolve, reject) => {
      const req = http.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Auto-fix triggered successfully');
            resolve(JSON.parse(data));
          } else {
            console.error(`❌ Auto-fix failed: ${res.statusCode}`);
            reject(new Error(`Auto-fix failed: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error(`❌ Failed to trigger auto-fix: ${error.message}`);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  } catch (error) {
    console.error(`❌ Auto-fix error: ${error.message}`);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Vercel Deployment Log Fetcher\n');

  const results = {
    timestamp: new Date().toISOString(),
    deployments: [],
    errors: [],
  };

  try {
    let deploymentsToProcess = [];

    if (options.deploymentId) {
      // Fetch specific deployment
      const deployment = await makeVercelRequest(`/v13/deployments/${options.deploymentId}`);
      deploymentsToProcess = [deployment];
    } else {
      // Fetch multiple deployments
      deploymentsToProcess = await fetchDeployments();
    }

    console.log(`\n📊 Found ${deploymentsToProcess.length} deployment(s)\n`);

    for (const deployment of deploymentsToProcess) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📦 Deployment ID: ${deployment.id || deployment.uid}`);
      console.log(`   URL: ${deployment.url}`);
      console.log(`   State: ${deployment.state || deployment.readyState}`);
      console.log(`   Created: ${new Date(deployment.createdAt || deployment.created).toLocaleString()}`);
      
      if (deployment.meta && deployment.meta.githubCommitRef) {
        console.log(`   Branch: ${deployment.meta.githubCommitRef}`);
      }

      // Fetch logs for this deployment
      const logs = await fetchDeploymentLogs(deployment.id || deployment.uid);
      const errorLogs = parseErrorLogs(logs);

      if (errorLogs.length > 0) {
        console.log(`\n❌ Found ${errorLogs.length} error(s):`);
        errorLogs.slice(0, 5).forEach((error, index) => {
          console.log(`   ${index + 1}. ${error.message.substring(0, 100)}...`);
        });

        results.errors.push({
          deploymentId: deployment.id || deployment.uid,
          deploymentUrl: deployment.url,
          errorCount: errorLogs.length,
          errors: errorLogs,
        });

        // Trigger auto-fix if requested
        if (options.autoFix && errorLogs.length > 0) {
          try {
            await triggerAutoFix(deployment, errorLogs);
          } catch (error) {
            console.error(`⚠️  Auto-fix failed: ${error.message}`);
          }
        }
      } else {
        console.log(`\n✅ No errors found`);
      }

      results.deployments.push({
        id: deployment.id || deployment.uid,
        url: deployment.url,
        state: deployment.state || deployment.readyState,
        createdAt: deployment.createdAt || deployment.created,
        errorCount: errorLogs.length,
      });
    }

    // Save to file if requested
    if (options.output) {
      const outputPath = path.resolve(options.output);
      const outputDir = path.dirname(outputPath);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`\n💾 Results saved to: ${outputPath}`);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`\n📈 Summary:`);
    console.log(`   Total deployments: ${results.deployments.length}`);
    console.log(`   Deployments with errors: ${results.errors.length}`);
    console.log(`   Total errors found: ${results.errors.reduce((sum, d) => sum + d.errorCount, 0)}`);

    if (options.autoFix && results.errors.length > 0) {
      console.log(`\n🤖 Auto-fix triggered for ${results.errors.length} failed deployment(s)`);
    }

    console.log('\n✅ Done!\n');
    
    process.exit(results.errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { fetchDeploymentLogs, fetchDeployments, parseErrorLogs };
