#!/usr/bin/env tsx

/**
 * GitHub Integration Test Script
 * Tests all GitHub API endpoints and AI fix generation workflow
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test configuration
const TEST_CONFIG = {
  // Use the actual CodeMind repository for testing
  owner: 'junaidaziz',
  repo: 'codemind',
  baseUrl: 'http://localhost:3000',
};

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

class GitHubIntegrationTester {
  private results: TestResult[] = [];

  private async logResult(name: string, success: boolean, message: string, data?: any, error?: string) {
    const result: TestResult = { name, success, message, data, error };
    this.results.push(result);
    
    const status = success ? '✅' : '❌';
    console.log(`${status} ${name}: ${message}`);
    if (error) {
      console.log(`   Error: ${error}`);
    }
    if (data && success) {
      console.log(`   Data: ${JSON.stringify(data).slice(0, 100)}...`);
    }
  }

  private async makeApiCall(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
    const url = `${TEST_CONFIG.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // In a real test, we would need proper authentication headers
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async testDatabaseConnection() {
    try {
      // Test basic database connection
      await prisma.$connect();
      
      // Check if PullRequest and Issue tables exist
      const pullRequestCount = await prisma.pullRequest.count();
      const issueCount = await prisma.issue.count();
      
      await this.logResult(
        'Database Connection',
        true,
        `Connected successfully. PRs: ${pullRequestCount}, Issues: ${issueCount}`,
        { pullRequestCount, issueCount }
      );
    } catch (error) {
      await this.logResult(
        'Database Connection',
        false,
        'Failed to connect to database',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async testCreateTestProject() {
    try {
      // Create a test user first
      const testUser = await prisma.user.upsert({
        where: { email: 'test@codemind.dev' },
        update: {},
        create: {
          email: 'test@codemind.dev',
          name: 'Test User',
          role: 'user',
        },
      });

      // Create a test project
      const testProject = await prisma.project.upsert({
        where: { githubUrl: `https://github.com/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}` },
        update: {},
        create: {
          name: 'Test CodeMind Project',
          githubUrl: `https://github.com/${TEST_CONFIG.owner}/${TEST_CONFIG.repo}`,
          ownerId: testUser.id,
          status: 'active',
        },
      });

      await this.logResult(
        'Create Test Project',
        true,
        'Test project created successfully',
        { projectId: testProject.id, userId: testUser.id }
      );

      return { testProject, testUser };
    } catch (error) {
      await this.logResult(
        'Create Test Project',
        false,
        'Failed to create test project',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async testGitHubEnvironmentVariables() {
    const requiredVars = [
      'GITHUB_TOKEN',
      'GITHUB_CLIENT_ID', 
      'GITHUB_CLIENT_SECRET',
      'GITHUB_APP_ID',
      'GITHUB_PRIVATE_KEY',
      'GITHUB_INSTALLATION_ID',
      'OPENAI_API_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length === 0) {
      await this.logResult(
        'Environment Variables',
        true,
        'All required GitHub environment variables are set',
        { requiredVars }
      );
      return true;
    } else {
      await this.logResult(
        'Environment Variables',
        false,
        'Missing required environment variables',
        undefined,
        `Missing: ${missingVars.join(', ')}`
      );
      return false;
    }
  }

  async testPullRequestsEndpoint() {
    try {
      const data = await this.makeApiCall('/api/github/pull-requests');
      
      await this.logResult(
        'Pull Requests API',
        true,
        `Successfully fetched pull requests`,
        { count: data.pullRequests?.length || 0 }
      );
      return data;
    } catch (error) {
      await this.logResult(
        'Pull Requests API',
        false,
        'Failed to fetch pull requests',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async testIssuesEndpoint() {
    try {
      const data = await this.makeApiCall('/api/github/issues');
      
      await this.logResult(
        'Issues API',
        true,
        `Successfully fetched issues`,
        { count: data.issues?.length || 0 }
      );
      return data;
    } catch (error) {
      await this.logResult(
        'Issues API',
        false,
        'Failed to fetch issues',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async testAIResolveEndpoint() {
    try {
      // This would need a real issue to test with
      const testPayload = {
        issueNumber: 1, // This would need to be a real issue number
        projectId: 'test-project-id'
      };

      const data = await this.makeApiCall('/api/github/resolve', 'POST', testPayload);
      
      await this.logResult(
        'AI Resolve API',
        true,
        'AI resolve endpoint is accessible',
        data
      );
      return data;
    } catch (error) {
      await this.logResult(
        'AI Resolve API',
        false,
        'AI resolve endpoint test failed (expected without real issue)',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  async testWebhookEndpoint() {
    try {
      // Test webhook endpoint accessibility (not signature verification)
      const testPayload = {
        action: 'opened',
        pull_request: {
          number: 1,
          title: 'Test PR'
        }
      };

      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/github/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'pull_request',
          'X-Hub-Signature-256': 'sha256=test' // This will fail signature verification, which is expected
        },
        body: JSON.stringify(testPayload),
      });

      // We expect this to fail due to signature verification, but endpoint should be accessible
      await this.logResult(
        'Webhook Endpoint',
        response.status === 401 || response.status === 403,
        response.status === 401 || response.status === 403 
          ? 'Webhook endpoint accessible with proper signature verification'
          : `Unexpected response: ${response.status}`,
        { status: response.status }
      );
    } catch (error) {
      await this.logResult(
        'Webhook Endpoint',
        false,
        'Webhook endpoint test failed',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async runAllTests() {
    console.log('🚀 Starting GitHub Integration Tests...\n');

    // Test 1: Database connectivity
    await this.testDatabaseConnection();

    // Test 2: Environment variables
    const envVarsOk = await this.testGitHubEnvironmentVariables();

    // Test 3: Create test project
    const projectData = await this.createTestProject();

    // Only run API tests if environment is properly configured
    if (envVarsOk) {
      // Test 4: Pull Requests API
      await this.testPullRequestsEndpoint();

      // Test 5: Issues API  
      await this.testIssuesEndpoint();

      // Test 6: AI Resolve API
      await this.testAIResolveEndpoint();

      // Test 7: Webhook endpoint
      await this.testWebhookEndpoint();
    } else {
      console.log('\n⚠️  Skipping API tests due to missing environment variables');
    }

    // Print summary
    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 Test Results Summary');
    console.log('========================');

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`   • ${result.name}: ${result.error || result.message}`);
      });
    }

    console.log('\n✅ Next Steps:');
    if (failed === 0) {
      console.log('   • All tests passed! Ready for end-to-end testing.');
      console.log('   • Create a test issue and add "ai-fix" label to test workflow.');
    } else {
      console.log('   • Fix failing tests before proceeding to end-to-end testing.');
      console.log('   • Check environment variables and database connectivity.');
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new GitHubIntegrationTester();
  tester.runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test runner failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

export { GitHubIntegrationTester };