#!/usr/bin/env tsx

/**
 * Multi-Project Analytics Testing Script
 * 
 * This script validates analytics functionality across multiple GitHub repositories
 * to ensure the system can handle various project types and scales.
 */

import { PrismaClient } from '@prisma/client';
import { ProjectConfigService } from '../src/lib/project-config-service';

const prisma = new PrismaClient();

// Test configuration for multiple projects
const TEST_PROJECTS = [
  {
    name: 'CodeMind Main Repository',
    githubUrl: 'https://github.com/junaidaziz/codemind',
    owner: 'junaidaziz',
    repo: 'codemind',
    description: 'AI-powered development assistant'
  },
  {
    name: 'Sample React App',
    githubUrl: 'https://github.com/facebook/react',
    owner: 'facebook',
    repo: 'react',
    description: 'Large-scale React.js project for stress testing'
  },
  {
    name: 'TypeScript Compiler',
    githubUrl: 'https://github.com/microsoft/TypeScript',
    owner: 'microsoft',
    repo: 'TypeScript',
    description: 'High-activity TypeScript project'
  },
  {
    name: 'Next.js Framework',
    githubUrl: 'https://github.com/vercel/next.js',
    owner: 'vercel',
    repo: 'next.js',
    description: 'Popular web framework with many contributors'
  }
];

interface TestResult {
  projectName: string;
  testName: string;
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
  executionTime?: number;
}

class MultiProjectTester {
  private results: TestResult[] = [];
  private configService: ProjectConfigService;

  constructor() {
    this.configService = new ProjectConfigService();
  }

  private async logResult(
    projectName: string,
    testName: string,
    success: boolean,
    message: string,
    data?: unknown,
    error?: string,
    executionTime?: number
  ) {
    const result: TestResult = {
      projectName,
      testName,
      success,
      message,
      data,
      error,
      executionTime
    };
    
    this.results.push(result);
    
    const status = success ? '✅' : '❌';
    const time = executionTime ? ` (${executionTime}ms)` : '';
    console.log(`${status} [${projectName}] ${testName}: ${message}${time}`);
    
    if (error && !success) {
      console.log(`   Error: ${error}`);
    }
  }

  private async makeApiCall(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<unknown> {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const url = `${baseUrl}${endpoint}`;
    
    const startTime = Date.now();
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-multi-project' // For testing purposes
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const endTime = Date.now();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { data, executionTime: endTime - startTime };
  }

  /**
   * Test 1: Create multiple test projects
   */
  async testCreateMultipleProjects() {
    console.log('\n🏗️  Testing Multiple Project Creation...\n');

    for (const projectConfig of TEST_PROJECTS) {
      try {
        // Create test user first
        const testUser = await prisma.user.upsert({
          where: { email: `test-${projectConfig.owner}@example.com` },
          update: {},
          create: {
            email: `test-${projectConfig.owner}@example.com`,
            name: `Test User ${projectConfig.owner}`,
            role: 'user'
          }
        });

        // Create project
        let project;
        const existingProject = await prisma.project.findFirst({
          where: { githubUrl: projectConfig.githubUrl }
        });

        if (existingProject) {
          project = existingProject;
        } else {
          project = await prisma.project.create({
            data: {
              name: projectConfig.name,
              githubUrl: projectConfig.githubUrl,
              ownerId: testUser.id,
              status: 'active',
              visibility: 'public'
            }
          });
        }

        await this.logResult(
          projectConfig.name,
          'Create Project',
          true,
          `Project created/found with ID: ${project.id}`,
          { projectId: project.id, userId: testUser.id }
        );

      } catch (error) {
        await this.logResult(
          projectConfig.name,
          'Create Project',
          false,
          'Failed to create project',
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * Test 2: Test analytics API endpoints for each project
   */
  async testAnalyticsEndpoints() {
    console.log('\n📊 Testing Analytics API Endpoints...\n');

    const projects = await prisma.project.findMany({
      where: {
        githubUrl: {
          in: TEST_PROJECTS.map(p => p.githubUrl)
        }
      }
    });

    for (const project of projects) {
      const projectConfig = TEST_PROJECTS.find(p => p.githubUrl === project.githubUrl);
      if (!projectConfig) continue;

      try {
        // Test analytics endpoint
        const result = await this.makeApiCall(`/api/projects/${project.id}/analytics`) as {
          data: unknown;
          executionTime: number;
        };

        await this.logResult(
          projectConfig.name,
          'Analytics API',
          true,
          'Analytics data retrieved successfully',
          result.data,
          undefined,
          result.executionTime
        );

      } catch (error) {
        await this.logResult(
          projectConfig.name,
          'Analytics API',
          false,
          'Failed to retrieve analytics',
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * Test 3: Test contributor endpoints
   */
  async testContributorEndpoints() {
    console.log('\n👥 Testing Contributor Endpoints...\n');

    const projects = await prisma.project.findMany({
      where: {
        githubUrl: {
          in: TEST_PROJECTS.map(p => p.githubUrl)
        }
      }
    });

    for (const project of projects) {
      const projectConfig = TEST_PROJECTS.find(p => p.githubUrl === project.githubUrl);
      if (!projectConfig) continue;

      try {
        // Test contributors list endpoint
        const result = await this.makeApiCall(`/api/projects/${project.id}/contributors`) as {
          data: { contributors?: unknown[] };
          executionTime: number;
        };

        const contributorCount = Array.isArray(result.data.contributors) ? result.data.contributors.length : 0;

        await this.logResult(
          projectConfig.name,
          'Contributors API',
          true,
          `Retrieved ${contributorCount} contributors`,
          { count: contributorCount },
          undefined,
          result.executionTime
        );

        // If contributors exist, test individual contributor endpoint
        if (contributorCount > 0 && Array.isArray(result.data.contributors)) {
          const firstContributor = result.data.contributors[0] as { username?: string };
          if (firstContributor.username) {
            try {
              const contributorResult = await this.makeApiCall(
                `/api/projects/${project.id}/contributors/${firstContributor.username}`
              ) as { executionTime: number };

              await this.logResult(
                projectConfig.name,
                'Contributor Detail API',
                true,
                `Retrieved details for ${firstContributor.username}`,
                undefined,
                undefined,
                contributorResult.executionTime
              );
            } catch (error) {
              await this.logResult(
                projectConfig.name,
                'Contributor Detail API',
                false,
                `Failed to get contributor details for ${firstContributor.username}`,
                undefined,
                error instanceof Error ? error.message : String(error)
              );
            }
          }
        }

      } catch (error) {
        await this.logResult(
          projectConfig.name,
          'Contributors API',
          false,
          'Failed to retrieve contributors',
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * Test 4: Test configuration endpoints with RBAC
   */
  async testConfigurationEndpoints() {
    console.log('\n⚙️  Testing Configuration Endpoints with RBAC...\n');

    const projects = await prisma.project.findMany({
      where: {
        githubUrl: {
          in: TEST_PROJECTS.map(p => p.githubUrl)
        }
      }
    });

    for (const project of projects) {
      const projectConfig = TEST_PROJECTS.find(p => p.githubUrl === project.githubUrl);
      if (!projectConfig) continue;

      try {
        // Test config GET (should work with basic permissions)
        const getResult = await this.makeApiCall(`/api/projects/${project.id}/config`) as {
          executionTime: number;
        };

        await this.logResult(
          projectConfig.name,
          'Config GET API',
          true,
          'Configuration retrieved (may be empty)',
          undefined,
          undefined,
          getResult.executionTime
        );

        // Test config POST (requires write permissions)
        try {
          const testConfig = {
            vercelProjectId: `test-${project.id}`,
            githubAppId: '12345',
            openaiApiKey: 'sk-test-key-for-testing'
          };

          const postResult = await this.makeApiCall(
            `/api/projects/${project.id}/config`,
            'POST',
            testConfig
          ) as { executionTime: number };

          await this.logResult(
            projectConfig.name,
            'Config POST API',
            true,
            'Configuration created successfully',
            undefined,
            undefined,
            postResult.executionTime
          );

        } catch (error) {
          // This might fail due to RBAC or existing config, which is expected
          await this.logResult(
            projectConfig.name,
            'Config POST API',
            false,
            'Config creation failed (may be expected due to RBAC)',
            undefined,
            error instanceof Error ? error.message : String(error)
          );
        }

      } catch (error) {
        await this.logResult(
          projectConfig.name,
          'Config GET API',
          false,
          'Failed to retrieve configuration',
          undefined,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * Test 5: Test concurrent access and performance
   */
  async testConcurrentAccess() {
    console.log('\n🚀 Testing Concurrent Access and Performance...\n');

    const projects = await prisma.project.findMany({
      where: {
        githubUrl: {
          in: TEST_PROJECTS.map(p => p.githubUrl)
        }
      },
      take: 2 // Limit to 2 projects for concurrent testing
    });

    const concurrentPromises = projects.map(async (project) => {
      const projectConfig = TEST_PROJECTS.find(p => p.githubUrl === project.githubUrl);
      if (!projectConfig) return;

      const startTime = Date.now();
      
      try {
        // Make multiple concurrent requests
        const requests = [
          this.makeApiCall(`/api/projects/${project.id}/analytics`),
          this.makeApiCall(`/api/projects/${project.id}/contributors`),
          this.makeApiCall(`/api/projects/${project.id}/config`)
        ];

        await Promise.all(requests);
        const endTime = Date.now();

        await this.logResult(
          projectConfig.name,
          'Concurrent Access',
          true,
          'All concurrent requests completed',
          undefined,
          undefined,
          endTime - startTime
        );

      } catch (error) {
        const endTime = Date.now();
        await this.logResult(
          projectConfig.name,
          'Concurrent Access',
          false,
          'Concurrent access failed',
          undefined,
          error instanceof Error ? error.message : String(error),
          endTime - startTime
        );
      }
    });

    await Promise.all(concurrentPromises);
  }

  /**
   * Test 6: Data integrity and consistency
   */
  async testDataIntegrity() {
    console.log('\n🔍 Testing Data Integrity and Consistency...\n');

    try {
      // Check for orphaned records
      const orphanedCommits = await prisma.commit.count({
        where: {
          project: null
        }
      });

      await this.logResult(
        'System',
        'Orphaned Commits Check',
        orphanedCommits === 0,
        `Found ${orphanedCommits} orphaned commits`,
        { count: orphanedCommits }
      );

      // Check for duplicate projects
      const duplicateProjects = await prisma.project.groupBy({
        by: ['githubUrl'],
        having: {
          githubUrl: {
            _count: {
              gt: 1
            }
          }
        }
      });

      await this.logResult(
        'System',
        'Duplicate Projects Check',
        duplicateProjects.length === 0,
        `Found ${duplicateProjects.length} duplicate project URLs`,
        { duplicates: duplicateProjects }
      );

    } catch (error) {
      await this.logResult(
        'System',
        'Data Integrity Check',
        false,
        'Data integrity check failed',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    console.log('\n📋 Multi-Project Testing Report\n');
    console.log('='.repeat(80));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    // Group results by project
    const byProject = this.results.reduce((acc, result) => {
      if (!acc[result.projectName]) {
        acc[result.projectName] = [];
      }
      acc[result.projectName].push(result);
      return acc;
    }, {} as Record<string, TestResult[]>);

    console.log(`\n📈 Results by Project:`);
    Object.entries(byProject).forEach(([projectName, results]) => {
      const projectPassed = results.filter(r => r.success).length;
      const projectTotal = results.length;
      const rate = ((projectPassed / projectTotal) * 100).toFixed(1);
      console.log(`   ${projectName}: ${projectPassed}/${projectTotal} (${rate}%)`);
    });

    // Performance metrics
    const executionTimes = this.results
      .filter(r => r.executionTime)
      .map(r => r.executionTime!);
    
    if (executionTimes.length > 0) {
      const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      
      console.log(`\n⏱️  Performance Metrics:`);
      console.log(`   Average Response Time: ${avgTime.toFixed(0)}ms`);
      console.log(`   Fastest Response: ${minTime}ms`);
      console.log(`   Slowest Response: ${maxTime}ms`);
    }

    // Failed tests details
    const failedResults = this.results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log(`\n🚨 Failed Tests:`);
      failedResults.forEach(result => {
        console.log(`   ❌ [${result.projectName}] ${result.testName}: ${result.message}`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
      });
    }

    console.log(`\n✨ Multi-project testing completed!`);
    console.log('='.repeat(80));

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: (passedTests / totalTests) * 100,
      averageResponseTime: executionTimes.length > 0 
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length 
        : 0,
      results: this.results
    };
  }

  /**
   * Main test execution
   */
  async runAllTests() {
    console.clear();
    console.log('🧪 CodeMind Multi-Project Analytics Testing\n');
    
    const startTime = Date.now();

    try {
      await this.testCreateMultipleProjects();
      await this.testAnalyticsEndpoints();
      await this.testContributorEndpoints();
      await this.testConfigurationEndpoints();
      await this.testConcurrentAccess();
      await this.testDataIntegrity();

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      console.log(`\n⏱️  Total execution time: ${(totalTime / 1000).toFixed(1)}s`);

      const report = this.generateReport();
      
      // Save report to file
      const reportPath = './logs/multi-project-test-report.json';
      const fs = await import('fs');
      const path = await import('path');
      
      // Ensure logs directory exists
      const logsDir = path.dirname(reportPath);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      fs.writeFileSync(reportPath, JSON.stringify({
        ...report,
        timestamp: new Date().toISOString(),
        totalExecutionTime: totalTime
      }, null, 2));

      console.log(`\n📄 Report saved to: ${reportPath}`);
      
      return report;

    } catch (error) {
      console.error('❌ Test execution failed:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}

/**
 * Command line execution
 */
async function main() {
  const tester = new MultiProjectTester();
  
  try {
    const report = await tester.runAllTests();
    
    // Exit with error code if tests failed
    if (report.failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('Multi-project testing failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { MultiProjectTester };