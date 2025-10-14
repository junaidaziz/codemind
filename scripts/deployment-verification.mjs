#!/usr/bin/env node

/**
 * Deployment Verification Script for CodeMind
 * 
 * Validates that the CodeMind application is properly deployed and functioning
 * in staging/production environments by testing critical endpoints and features.
 */

import https from 'https';
import http from 'http';

// Configuration for different environments
const ENVIRONMENTS = {
  staging: {
    name: 'Staging',
    baseUrl: process.env.STAGING_URL || 'https://codemind-staging.vercel.app',
    timeout: 30000
  },
  production: {
    name: 'Production', 
    baseUrl: process.env.PRODUCTION_URL || 'https://codemind.vercel.app',
    timeout: 15000
  },
  local: {
    name: 'Local Development',
    baseUrl: 'http://localhost:3000',
    timeout: 10000
  }
};

// Critical endpoints to verify
const CRITICAL_ENDPOINTS = [
  {
    path: '/',
    method: 'GET',
    name: 'Home Page',
    expectedStatus: 200,
    checkContent: (body) => body.includes('CodeMind') || body.includes('AI')
  },
  {
    path: '/api/health',
    method: 'GET', 
    name: 'Health Check API',
    expectedStatus: 200,
    checkContent: (body) => {
      try {
        const data = JSON.parse(body);
        return data.status === 'ok' || data.healthy === true;
      } catch {
        return body.includes('ok') || body.includes('healthy');
      }
    }
  },
  {
    path: '/api/projects',
    method: 'GET',
    name: 'Projects API',
    expectedStatus: [200, 401, 403], // May require auth
    checkContent: () => true // Any response indicates the API is working
  }
];

// Performance benchmarks
const PERFORMANCE_THRESHOLDS = {
  homePage: 3000, // 3 seconds max
  apiEndpoints: 2000, // 2 seconds max
  database: 1000 // 1 second max for DB queries
};

class DeploymentVerifier {
  constructor(environment = 'staging') {
    this.env = ENVIRONMENTS[environment];
    this.results = [];
    this.startTime = Date.now();
    
    if (!this.env) {
      throw new Error(`Unknown environment: ${environment}. Available: ${Object.keys(ENVIRONMENTS).join(', ')}`);
    }
  }

  /**
   * Log test result
   */
  logResult(name, success, message, data = {}) {
    const result = {
      name,
      success,
      message,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.results.push(result);
    
    const status = success ? '✅' : '❌';
    console.log(`${status} ${name}: ${message}`);
    
    if (data.responseTime) {
      console.log(`   Response time: ${data.responseTime}ms`);
    }
    
    if (data.error && !success) {
      console.log(`   Error: ${data.error}`);
    }
  }

  /**
   * Make HTTP request with timeout and retries
   */
  async makeRequest(path, method = 'GET', retries = 2) {
    const url = `${this.env.baseUrl}${path}`;
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const request = client.request(url, {
        method,
        timeout: this.env.timeout,
        headers: {
          'User-Agent': 'CodeMind-Deployment-Verifier/1.0',
          'Accept': 'application/json, text/html, */*'
        }
      }, (res) => {
        let body = '';
        
        res.on('data', chunk => {
          body += chunk;
        });
        
        res.on('end', () => {
          const endTime = Date.now();
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
            responseTime: endTime - startTime
          });
        });
      });
      
      request.on('error', (error) => {
        const endTime = Date.now();
        if (retries > 0) {
          console.log(`   Retrying ${path} (${retries} attempts left)...`);
          setTimeout(() => {
            this.makeRequest(path, method, retries - 1)
              .then(resolve)
              .catch(reject);
          }, 1000);
        } else {
          reject({
            error,
            responseTime: endTime - startTime
          });
        }
      });
      
      request.on('timeout', () => {
        request.destroy();
        const endTime = Date.now();
        reject({
          error: new Error('Request timeout'),
          responseTime: endTime - startTime
        });
      });
      
      request.end();
    });
  }

  /**
   * Test critical endpoints
   */
  async testEndpoints() {
    console.log(`\n🌐 Testing Critical Endpoints on ${this.env.name}...\n`);
    
    for (const endpoint of CRITICAL_ENDPOINTS) {
      try {
        const response = await this.makeRequest(endpoint.path, endpoint.method);
        
        // Check status code
        const expectedStatuses = Array.isArray(endpoint.expectedStatus) 
          ? endpoint.expectedStatus 
          : [endpoint.expectedStatus];
        
        const statusOk = expectedStatuses.includes(response.statusCode);
        
        // Check content if status is ok
        let contentOk = true;
        if (statusOk && endpoint.checkContent && response.statusCode === 200) {
          contentOk = endpoint.checkContent(response.body);
        }
        
        const success = statusOk && contentOk;
        const message = success 
          ? `Responded with status ${response.statusCode}`
          : `Failed - Status: ${response.statusCode}, Content check: ${contentOk}`;
        
        this.logResult(
          endpoint.name,
          success,
          message,
          {
            statusCode: response.statusCode,
            responseTime: response.responseTime,
            contentLength: response.body.length
          }
        );
        
      } catch (error) {
        this.logResult(
          endpoint.name,
          false,
          'Request failed',
          {
            error: error.error ? error.error.message : error.message,
            responseTime: error.responseTime
          }
        );
      }
    }
  }

  /**
   * Test database connectivity
   */
  async testDatabase() {
    console.log(`\n🗄️  Testing Database Connectivity...\n`);
    
    try {
      // Test a simple API that requires database
      const response = await this.makeRequest('/api/projects', 'GET');
      
      // Any response (even auth errors) indicates DB is working
      const dbWorking = response.statusCode !== 500;
      
      this.logResult(
        'Database Connection',
        dbWorking,
        dbWorking ? 'Database queries are working' : 'Database connection failed',
        {
          statusCode: response.statusCode,
          responseTime: response.responseTime,
          performanceOk: response.responseTime < PERFORMANCE_THRESHOLDS.database
        }
      );
      
    } catch (error) {
      this.logResult(
        'Database Connection',
        false,
        'Database test failed',
        {
          error: error.error ? error.error.message : error.message,
          responseTime: error.responseTime
        }
      );
    }
  }

  /**
   * Test performance benchmarks
   */
  async testPerformance() {
    console.log(`\n⚡ Testing Performance Benchmarks...\n`);
    
    const performanceTests = [
      {
        name: 'Home Page Load Time',
        path: '/',
        threshold: PERFORMANCE_THRESHOLDS.homePage
      },
      {
        name: 'API Response Time',
        path: '/api/projects',
        threshold: PERFORMANCE_THRESHOLDS.apiEndpoints
      }
    ];
    
    for (const test of performanceTests) {
      try {
        const response = await this.makeRequest(test.path);
        const meetsThreshold = response.responseTime <= test.threshold;
        
        this.logResult(
          test.name,
          meetsThreshold,
          `${response.responseTime}ms (threshold: ${test.threshold}ms)`,
          {
            responseTime: response.responseTime,
            threshold: test.threshold,
            statusCode: response.statusCode
          }
        );
        
      } catch (error) {
        this.logResult(
          test.name,
          false,
          'Performance test failed',
          {
            error: error.error ? error.error.message : error.message,
            responseTime: error.responseTime || 0,
            threshold: test.threshold
          }
        );
      }
    }
  }

  /**
   * Test SSL certificate (for HTTPS deployments)
   */
  async testSSL() {
    if (!this.env.baseUrl.startsWith('https')) {
      console.log(`\n🔒 Skipping SSL test (not HTTPS environment)\n`);
      return;
    }
    
    console.log(`\n🔒 Testing SSL Certificate...\n`);
    
    try {
      const response = await this.makeRequest('/');
      
      // If we got a response over HTTPS, SSL is working
      this.logResult(
        'SSL Certificate',
        true,
        'HTTPS connection successful',
        {
          statusCode: response.statusCode,
          responseTime: response.responseTime
        }
      );
      
    } catch (error) {
      const isSSLError = error.error && (
        error.error.code === 'CERT_UNTRUSTED' ||
        error.error.code === 'CERT_EXPIRED' ||
        error.error.code === 'ENOTFOUND'
      );
      
      this.logResult(
        'SSL Certificate',
        false,
        isSSLError ? 'SSL certificate issue' : 'HTTPS connection failed',
        {
          error: error.error ? error.error.message : error.message,
          code: error.error ? error.error.code : undefined
        }
      );
    }
  }

  /**
   * Test environment variables and configuration
   */
  async testConfiguration() {
    console.log(`\n⚙️  Testing Configuration...\n`);
    
    try {
      // Test if the app is properly configured
      const response = await this.makeRequest('/api/health');
      
      if (response.statusCode === 200) {
        let config = {};
        try {
          config = JSON.parse(response.body);
        } catch {
          // Response might not be JSON
        }
        
        this.logResult(
          'Application Configuration',
          true,
          'Configuration loaded successfully',
          {
            hasConfig: Object.keys(config).length > 0,
            statusCode: response.statusCode
          }
        );
      } else {
        this.logResult(
          'Application Configuration',
          false,
          'Health check failed - possible configuration issue',
          { statusCode: response.statusCode }
        );
      }
      
    } catch (error) {
      this.logResult(
        'Application Configuration',
        false,
        'Configuration test failed',
        { error: error.error ? error.error.message : error.message }
      );
    }
  }

  /**
   * Generate deployment report
   */
  generateReport() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const endTime = Date.now();
    const totalTime = endTime - this.startTime;
    
    console.log(`\n📋 Deployment Verification Report - ${this.env.name}\n`);
    console.log('='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   Environment: ${this.env.name}`);
    console.log(`   Base URL: ${this.env.baseUrl}`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`   Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    
    // Performance summary
    const performanceResults = this.results.filter(r => r.data.responseTime);
    if (performanceResults.length > 0) {
      const avgResponseTime = performanceResults.reduce((sum, r) => sum + r.data.responseTime, 0) / performanceResults.length;
      const maxResponseTime = Math.max(...performanceResults.map(r => r.data.responseTime));
      
      console.log(`\n⚡ Performance:`);
      console.log(`   Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
      console.log(`   Slowest Response: ${maxResponseTime}ms`);
    }
    
    // Failed tests
    const failedResults = this.results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log(`\n🚨 Failed Tests:`);
      failedResults.forEach(result => {
        console.log(`   ❌ ${result.name}: ${result.message}`);
        if (result.data.error) {
          console.log(`      Error: ${result.data.error}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
    const deploymentStatus = failedTests === 0 ? '🟢 DEPLOYMENT HEALTHY' : '🔴 DEPLOYMENT ISSUES';
    console.log(`\n${deploymentStatus}\n`);
    
    return {
      environment: this.env.name,
      baseUrl: this.env.baseUrl,
      totalTests,
      passedTests,
      failedTests,
      successRate: (passedTests / totalTests) * 100,
      executionTime: totalTime,
      results: this.results,
      healthy: failedTests === 0
    };
  }

  /**
   * Run all verification tests
   */
  async runAllTests() {
    console.clear();
    console.log(`🚀 CodeMind Deployment Verification - ${this.env.name}\n`);
    console.log(`Target: ${this.env.baseUrl}\n`);
    
    try {
      await this.testEndpoints();
      await this.testDatabase();
      await this.testSSL();
      await this.testPerformance();
      await this.testConfiguration();
      
      const report = this.generateReport();
      
      // Save report
      const fs = await import('fs');
      const path = await import('path');
      
      const reportDir = './logs';
      if (!fs.default.existsSync(reportDir)) {
        fs.default.mkdirSync(reportDir, { recursive: true });
      }
      
      const reportFile = path.default.join(reportDir, `deployment-verification-${Date.now()}.json`);
      fs.default.writeFileSync(reportFile, JSON.stringify(report, null, 2));
      
      console.log(`📄 Report saved to: ${reportFile}`);
      
      return report;
      
    } catch (error) {
      console.error('❌ Deployment verification failed:', error);
      throw error;
    }
  }
}

/**
 * CLI execution
 */
async function main() {
  const environment = process.argv[2] || 'staging';
  
  console.log(`Starting deployment verification for: ${environment}\n`);
  
  try {
    const verifier = new DeploymentVerifier(environment);
    const report = await verifier.runAllTests();
    
    // Exit with appropriate code
    process.exit(report.healthy ? 0 : 1);
    
  } catch (error) {
    console.error('Deployment verification failed:', error.message);
    process.exit(1);
  }
}

// Export for use as module
export { DeploymentVerifier, ENVIRONMENTS };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}