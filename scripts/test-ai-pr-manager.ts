// Test script for validating AI PR & Issue Manager implementation

// Test data for validation
const testProject = {
  id: 'test-project-1',
  githubUrl: 'https://github.com/junaidaziz/codemind',
  owner: 'junaidaziz',
  repo: 'codemind'
};

// Test the Pull Requests API endpoint
async function testPullRequestsAPI() {
  console.log('🧪 Testing Pull Requests API...');
  
  try {
    const response = await fetch('http://localhost:3000/api/github/pull-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectId: testProject.id })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Pull Requests API working');
      console.log(`   Found ${data.pullRequests?.length || 0} pull requests`);
      return true;
    } else {
      console.log('❌ Pull Requests API failed:', data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Pull Requests API error:', error.message);
    return false;
  }
}

// Test the Issues API endpoint  
async function testIssuesAPI() {
  console.log('🧪 Testing Issues API...');
  
  try {
    const response = await fetch('http://localhost:3000/api/github/issues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectId: testProject.id })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Issues API working');
      console.log(`   Found ${data.issues?.length || 0} issues`);
      return true;
    } else {
      console.log('❌ Issues API failed:', data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Issues API error:', error.message);
    return false;
  }
}

// Test the AI Resolve API endpoint
async function testResolveAPI() {
  console.log('🧪 Testing AI Resolve API...');
  
  const testIssue = {
    projectId: testProject.id,
    issueNumber: 1,
    title: 'Test Issue',
    body: 'This is a test issue for validation'
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/github/resolve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testIssue)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ AI Resolve API working');
      console.log(`   Resolution result: ${data.success ? 'Success' : 'Failed'}`);
      return true;
    } else {
      console.log('❌ AI Resolve API failed:', data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ AI Resolve API error:', error.message);
    return false;
  }
}

// Test database schema
async function testDatabase() {
  console.log('🧪 Testing Database Schema...');
  
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Test if PullRequest and Issue models exist
    const prCount = await prisma.pullRequest.count();
    const issueCount = await prisma.issue.count();
    
    console.log('✅ Database schema working');
    console.log(`   Pull Requests in DB: ${prCount}`);
    console.log(`   Issues in DB: ${issueCount}`);
    
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.log('❌ Database schema error:', error.message);
    return false;
  }
}

// Test GitHub webhook endpoint
async function testWebhook() {
  console.log('🧪 Testing GitHub Webhook...');
  
  const testPayload = {
    action: 'opened',
    pull_request: {
      number: 1,
      title: 'Test PR',
      body: 'Test body',
      state: 'open',
      html_url: 'https://github.com/test/repo/pull/1',
      head: { ref: 'feature-branch' },
      base: { ref: 'main' },
      user: { login: 'testuser', html_url: 'https://github.com/testuser' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    repository: {
      full_name: 'junaidaziz/codemind'
    }
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/github/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'pull_request'
      },
      body: JSON.stringify(testPayload)
    });
    
    if (response.ok) {
      console.log('✅ GitHub Webhook endpoint working');
      return true;
    } else {
      console.log('❌ GitHub Webhook failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ GitHub Webhook error:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting AI PR & Issue Manager validation tests...\n');
  
  const results = {
    database: await testDatabase(),
    webhook: await testWebhook(),
    pullRequestsAPI: await testPullRequestsAPI(),
    issuesAPI: await testIssuesAPI(),
    resolveAPI: await testResolveAPI()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASS' : 'FAIL'}`);
  });
  
  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! AI PR & Issue Manager is ready for production.');
  } else {
    console.log('⚠️  Some tests failed. Check configuration and dependencies.');
  }
  
  return results;
}

// Export for use in other files
export { runTests, testDatabase, testWebhook, testPullRequestsAPI, testIssuesAPI, testResolveAPI };

// Run tests if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runTests().then(() => process.exit(0)).catch(() => process.exit(1));
}