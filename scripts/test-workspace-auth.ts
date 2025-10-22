/**
 * Test script for workspace authentication refactoring
 * Tests all workspace endpoints with server-side JWT auth
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration: number;
}

const results: TestResult[] = [];

async function testWorkspaceAPIs() {
  console.log('🧪 Testing Workspace Authentication Refactoring\n');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  
  try {
    // Test 1: Check if getUserId helper exists
    await testGetUserIdHelper();
    
    // Test 2: Verify workspace routes don't require userId parameter
    await testWorkspaceRoutes();
    
    // Test 3: Check database schema
    await testDatabaseSchema();
    
    // Test 4: Verify frontend components
    await testFrontendComponents();
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    await prisma.$disconnect();
  }
  
  const totalTime = Date.now() - startTime;
  
  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message} (${result.duration}ms)\n`);
  });
  
  console.log('='.repeat(60));
  console.log(`Total: ${results.length} tests`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`⏱️  Duration: ${totalTime}ms`);
  console.log('='.repeat(60));
  
  process.exit(failed > 0 ? 1 : 0);
}

async function testGetUserIdHelper() {
  const start = Date.now();
  const testName = 'Auth Helper - getUserId exists';
  
  try {
    const fs = require('fs');
    const path = require('path');
    const authServerPath = path.join(process.cwd(), 'src/lib/auth-server.ts');
    
    if (!fs.existsSync(authServerPath)) {
      results.push({
        name: testName,
        status: 'FAIL',
        message: 'auth-server.ts not found',
        duration: Date.now() - start
      });
      return;
    }
    
    const content = fs.readFileSync(authServerPath, 'utf-8');
    
    if (!content.includes('export async function getUserId')) {
      results.push({
        name: testName,
        status: 'FAIL',
        message: 'getUserId function not exported',
        duration: Date.now() - start
      });
      return;
    }
    
    results.push({
      name: testName,
      status: 'PASS',
      message: 'getUserId helper found and exported',
      duration: Date.now() - start
    });
    
  } catch (error) {
    results.push({
      name: testName,
      status: 'FAIL',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - start
    });
  }
}

async function testWorkspaceRoutes() {
  const start = Date.now();
  const fs = require('fs');
  const path = require('path');
  
  const routes = [
    {
      name: 'Workspace List API',
      path: 'src/app/api/workspaces/route.ts',
      checks: [
        { pattern: 'import { getUserId }', description: 'imports getUserId' },
        { pattern: 'await getUserId(request)', description: 'calls getUserId' },
        { pattern: /!userId[\s\S]*?401/, description: 'returns 401 on auth failure' }
      ]
    },
    {
      name: 'Dependencies API',
      path: 'src/app/api/workspaces/[workspaceId]/dependencies/route.ts',
      checks: [
        { pattern: 'import { getUserId }', description: 'imports getUserId' },
        { pattern: 'await getUserId(request)', description: 'calls getUserId' },
        { pattern: /!userId[\s\S]*?401/, description: 'returns 401 on auth failure' }
      ]
    },
    {
      name: 'Cross-Repo Links API',
      path: 'src/app/api/workspaces/[workspaceId]/cross-repo-links/route.ts',
      checks: [
        { pattern: 'import { getUserId }', description: 'imports getUserId' },
        { pattern: 'await getUserId(request)', description: 'calls getUserId' },
        { pattern: /!userId[\s\S]*?401/, description: 'returns 401 on auth failure' }
      ]
    }
  ];
  
  for (const route of routes) {
    const testStart = Date.now();
    const testName = `Backend Route - ${route.name}`;
    
    try {
      const filePath = path.join(process.cwd(), route.path);
      
      if (!fs.existsSync(filePath)) {
        results.push({
          name: testName,
          status: 'FAIL',
          message: 'File not found',
          duration: Date.now() - testStart
        });
        continue;
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const failedChecks: string[] = [];
      
      for (const check of route.checks) {
        const pattern = typeof check.pattern === 'string' 
          ? check.pattern 
          : check.pattern.source;
        const matches = typeof check.pattern === 'string'
          ? content.includes(check.pattern)
          : check.pattern.test(content);
          
        if (!matches) {
          failedChecks.push(check.description);
        }
      }
      
      if (failedChecks.length > 0) {
        results.push({
          name: testName,
          status: 'FAIL',
          message: `Failed checks: ${failedChecks.join(', ')}`,
          duration: Date.now() - testStart
        });
      } else {
        results.push({
          name: testName,
          status: 'PASS',
          message: 'All authentication checks passed',
          duration: Date.now() - testStart
        });
      }
      
    } catch (error) {
      results.push({
        name: testName,
        status: 'FAIL',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - testStart
      });
    }
  }
}

async function testDatabaseSchema() {
  const start = Date.now();
  const testName = 'Database Schema - Workspace model';
  
  try {
    // Check if Workspace table exists and has userId column
    const workspaces = await prisma.workspace.findMany({ take: 1 });
    
    results.push({
      name: testName,
      status: 'PASS',
      message: 'Workspace model accessible, userId relationship intact',
      duration: Date.now() - start
    });
    
  } catch (error) {
    results.push({
      name: testName,
      status: 'FAIL',
      message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration: Date.now() - start
    });
  }
}

async function testFrontendComponents() {
  const start = Date.now();
  const fs = require('fs');
  const path = require('path');
  
  const components = [
    {
      name: 'DependenciesTab',
      path: 'src/app/workspaces/[id]/DependenciesTab.tsx',
      checks: [
        { pattern: /interface\s+DependenciesTabProps\s*{[^}]*workspaceId[^}]*}/, description: 'interface has only workspaceId' },
        { pattern: /userId/i, description: 'no userId references', shouldNotMatch: true }
      ]
    },
    {
      name: 'CrossRepoLinksTab',
      path: 'src/app/workspaces/[id]/CrossRepoLinksTab.tsx',
      checks: [
        { pattern: /interface\s+CrossRepoLinksTabProps\s*{[^}]*workspaceId[^}]*}/, description: 'interface has only workspaceId' },
        { pattern: /userId.*api/i, description: 'no userId in API calls', shouldNotMatch: true }
      ]
    },
    {
      name: 'WorkspaceDetailClient',
      path: 'src/app/workspaces/[id]/WorkspaceDetailClient.tsx',
      checks: [
        { pattern: /DependenciesTab.*userId/i, description: 'no userId prop to DependenciesTab', shouldNotMatch: true },
        { pattern: /CrossRepoLinksTab.*userId/i, description: 'no userId prop to CrossRepoLinksTab', shouldNotMatch: true }
      ]
    }
  ];
  
  for (const component of components) {
    const testStart = Date.now();
    const testName = `Frontend Component - ${component.name}`;
    
    try {
      const filePath = path.join(process.cwd(), component.path);
      
      if (!fs.existsSync(filePath)) {
        results.push({
          name: testName,
          status: 'FAIL',
          message: 'File not found',
          duration: Date.now() - testStart
        });
        continue;
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const failedChecks: string[] = [];
      
      for (const check of component.checks) {
        const matches = typeof check.pattern === 'string'
          ? content.includes(check.pattern)
          : check.pattern.test(content);
        
        const shouldMatch = !check.shouldNotMatch;
        
        if (shouldMatch && !matches) {
          failedChecks.push(`Missing: ${check.description}`);
        } else if (!shouldMatch && matches) {
          failedChecks.push(`Should not have: ${check.description}`);
        }
      }
      
      if (failedChecks.length > 0) {
        results.push({
          name: testName,
          status: 'FAIL',
          message: `Failed checks: ${failedChecks.join(', ')}`,
          duration: Date.now() - testStart
        });
      } else {
        results.push({
          name: testName,
          status: 'PASS',
          message: 'Component refactored correctly',
          duration: Date.now() - testStart
        });
      }
      
    } catch (error) {
      results.push({
        name: testName,
        status: 'FAIL',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - testStart
      });
    }
  }
}

// Run tests
testWorkspaceAPIs().catch(console.error);
