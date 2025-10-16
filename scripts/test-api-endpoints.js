#!/usr/bin/env node

/**
 * API Endpoints Test
 * Tests all API routes to ensure they're working correctly
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3000';

// Test endpoints configuration
const endpoints = [
  // Core API endpoints
  { method: 'GET', path: '/api/health', description: 'Health check' },
  { method: 'GET', path: '/api/projects', description: 'List projects' },
  { method: 'GET', path: '/api/issues', description: 'List issues' },
  
  // Auto-fix endpoints
  { method: 'GET', path: '/api/github/auto-fix', description: 'GitHub auth test' },
  { method: 'GET', path: '/api/auto-fix/sessions', description: 'Auto-fix sessions' },
  
  // Analytics endpoints
  { method: 'GET', path: '/api/analytics/overview', description: 'Analytics overview' },
  
  // Admin endpoints
  { method: 'GET', path: '/api/admin/schema-drift', description: 'Schema drift check' },
];

async function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const options = {
      method,
      timeout: 5000,
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData,
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            parseError: true,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function getStatusEmoji(status) {
  if (status >= 200 && status < 300) return '✅';
  if (status >= 300 && status < 400) return '🔄';
  if (status >= 400 && status < 500) return '⚠️';
  return '❌';
}

async function testEndpoints() {
  console.log('🔍 Testing API endpoints...\n');
  
  let totalTests = 0;
  let passedTests = 0;
  const results = [];

  for (const endpoint of endpoints) {
    totalTests++;
    
    try {
      console.log(`Testing ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
      
      const result = await makeRequest(endpoint.method, endpoint.path);
      const emoji = getStatusEmoji(result.status);
      
      console.log(`${emoji} ${result.status} ${endpoint.path}`);
      
      if (result.parseError) {
        console.log('   📄 Response: Non-JSON data');
      } else if (result.data.error) {
        console.log(`   ❌ Error: ${result.data.error}`);
      } else if (result.data.success !== undefined) {
        console.log(`   ✨ Success: ${result.data.success}`);
      }
      
      if (result.status >= 200 && result.status < 400) {
        passedTests++;
      }
      
      results.push({
        ...endpoint,
        ...result,
        passed: result.status >= 200 && result.status < 400,
      });
      
    } catch (error) {
      console.log(`❌ ${endpoint.path} - ${error.message}`);
      results.push({
        ...endpoint,
        error: error.message,
        passed: false,
      });
    }
    
    console.log(''); // Empty line for readability
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All API endpoints are working!');
  } else {
    console.log('\n⚠️  Some endpoints need attention:');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`   - ${r.method} ${r.path}: ${r.error || `Status ${r.status}`}`);
      });
  }

  return { total: totalTests, passed: passedTests, results };
}

// Check if server is running first
async function checkServerRunning() {
  try {
    await makeRequest('GET', '/');
    return true;
  } catch (error) {
    console.log('❌ Development server is not running!');
    console.log('💡 Please start the server with: npm run dev');
    console.log('   Then run this test again.');
    return false;
  }
}

async function main() {
  const serverRunning = await checkServerRunning();
  if (!serverRunning) {
    process.exit(1);
  }

  await testEndpoints();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testEndpoints, makeRequest };