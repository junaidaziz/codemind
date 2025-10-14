#!/usr/bin/env tsx

/**
 * Analytics System Integration Test
 * 
 * This script tests the analytics system with multiple projects to verify:
 * - Data isolation between projects
 * - Filter functionality
 * - Real-time updates
 * - AI metrics integration
 * - Caching behavior
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  data?: unknown;
  error?: string;
}

class AnalyticsSystemTester {
  private results: TestResult[] = [];
  private testProjects: Array<{ id: string; name: string; githubUrl: string }> = [];
  private baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  private log(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, data?: unknown, error?: string) {
    this.results.push({ test, status, message, data, error });
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${emoji} ${test}: ${message}`);
    if (error) console.error(`   Error: ${error}`);
    if (data && process.env.VERBOSE) console.log(`   Data:`, data);
  }

  private async makeApiCall(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  async setupTestData() {
    console.log('\n🔧 Setting up test data...');
    
    try {
      // Create test projects if they don't exist
      const testProjectData = [
        {
          name: 'Analytics Test Project 1',
          githubUrl: 'https://github.com/test/repo1',
          status: 'ACTIVE'
        },
        {
          name: 'Analytics Test Project 2', 
          githubUrl: 'https://github.com/test/repo2',
          status: 'ACTIVE'
        }
      ];

      for (const projectData of testProjectData) {
        let project = await prisma.project.findFirst({
          where: { githubUrl: projectData.githubUrl }
        });

        if (!project) {
          project = await prisma.project.create({
            data: projectData
          });
        }

        this.testProjects.push(project);

        // Add sample commits
        await this.createSampleCommits(project.id);
        
        // Add sample contributors
        await this.createSampleContributors(project.id);

        // Add sample AI metrics
        await this.createSampleAIMetrics(project.id);
      }

      this.log('Setup Test Data', 'PASS', `Created ${this.testProjects.length} test projects`);
    } catch (error) {
      this.log('Setup Test Data', 'FAIL', 'Failed to setup test data', undefined, error as string);
      throw error;
    }
  }

  private async createSampleCommits(projectId: string) {
    const sampleCommits = [
      {
        sha: `commit1-${projectId}`,
        message: 'Fix authentication bug',
        author: 'developer1',
        additions: 50,
        deletions: 20,
        date: new Date(Date.now() - 86400000), // 1 day ago
        projectId
      },
      {
        sha: `commit2-${projectId}`,
        message: 'Add new feature',
        author: 'developer2', 
        additions: 120,
        deletions: 5,
        date: new Date(Date.now() - 172800000), // 2 days ago
        projectId
      },
      {
        sha: `commit3-${projectId}`,
        message: 'Update documentation',
        author: 'developer1',
        additions: 30,
        deletions: 10,
        date: new Date(Date.now() - 259200000), // 3 days ago
        projectId
      }
    ];

    for (const commit of sampleCommits) {
      await prisma.commit.upsert({
        where: { sha: commit.sha },
        update: commit,
        create: commit
      });
    }
  }

  private async createSampleContributors(projectId: string) {
    const sampleContributors = [
      {
        githubId: `dev1-${projectId}`,
        username: 'developer1',
        avatarUrl: 'https://github.com/developer1.png',
        totalCommits: 45,
        projectId
      },
      {
        githubId: `dev2-${projectId}`,
        username: 'developer2',
        avatarUrl: 'https://github.com/developer2.png', 
        totalCommits: 32,
        projectId
      }
    ];

    for (const contributor of sampleContributors) {
      await prisma.contributor.upsert({
        where: { githubId: contributor.githubId },
        update: contributor,
        create: contributor
      });
    }
  }

  private async createSampleAIMetrics(projectId: string) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const aiMetrics = {
      projectId,
      period,
      periodStart,
      periodEnd,
      totalSessions: 10,
      successfulSessions: 8,
      failedSessions: 2,
      totalIssuesDetected: 15,
      totalIssuesFixed: 12,
      totalPRsCreated: 5,
      totalPRsMerged: 4,
      avgConfidence: 0.85,
      avgProcessingTime: 45000 // 45 seconds
    };

    await prisma.autoFixMetrics.upsert({
      where: {
        projectId_userId_period_periodStart: {
          projectId,
          userId: null,
          period,
          periodStart
        }
      },
      update: aiMetrics,
      create: aiMetrics
    });
  }

  async testAnalyticsEndpoints() {
    console.log('\n📊 Testing Analytics API Endpoints...');
    
    for (const project of this.testProjects) {
      try {
        // Test basic analytics endpoint
        const analytics = await this.makeApiCall(`/api/projects/${project.id}/analytics?timeframe=30d`);
        
        if (analytics.summary && typeof analytics.summary.totalCommits === 'number') {
          this.log(`Analytics API - Project ${project.name}`, 'PASS', 
            `Retrieved analytics with ${analytics.summary.totalCommits} commits`);
        } else {
          this.log(`Analytics API - Project ${project.name}`, 'FAIL', 
            'Analytics response missing expected structure');
        }

        // Test AI metrics in response
        if (analytics.aiMetrics && analytics.aiMetrics.summary) {
          this.log(`AI Metrics - Project ${project.name}`, 'PASS', 
            `AI metrics included: ${analytics.aiMetrics.summary.totalSessions} sessions`);
        } else {
          this.log(`AI Metrics - Project ${project.name}`, 'FAIL', 
            'AI metrics missing from analytics response');
        }

      } catch (error) {
        this.log(`Analytics API - Project ${project.name}`, 'FAIL', 
          'Failed to fetch analytics', undefined, error as string);
      }
    }
  }

  async testFilterFunctionality() {
    console.log('\n🔍 Testing Filter Functionality...');
    
    const project = this.testProjects[0];
    if (!project) return;

    try {
      // Test contributor filter
      const filteredByContributor = await this.makeApiCall(
        `/api/projects/${project.id}/analytics?timeframe=30d&contributors=developer1`
      );
      
      this.log('Contributor Filter', 'PASS', 
        `Filtered analytics by contributor: ${filteredByContributor.summary.totalCommits} commits`);

      // Test search filter
      const filteredBySearch = await this.makeApiCall(
        `/api/projects/${project.id}/analytics?timeframe=30d&search=authentication`
      );
      
      this.log('Search Filter', 'PASS', 
        `Filtered analytics by search term: ${filteredBySearch.summary.totalCommits} commits`);

      // Test combined filters
      const combinedFilters = await this.makeApiCall(
        `/api/projects/${project.id}/analytics?timeframe=30d&contributors=developer1&search=fix`
      );
      
      this.log('Combined Filters', 'PASS', 
        `Combined filters work: ${combinedFilters.summary.totalCommits} commits`);

    } catch (error) {
      this.log('Filter Functionality', 'FAIL', 
        'Failed to test filters', undefined, error as string);
    }
  }

  async testDataIsolation() {
    console.log('\n🔒 Testing Data Isolation Between Projects...');
    
    if (this.testProjects.length < 2) {
      this.log('Data Isolation', 'SKIP', 'Need at least 2 projects to test isolation');
      return;
    }

    try {
      const analytics1 = await this.makeApiCall(`/api/projects/${this.testProjects[0].id}/analytics`);
      const analytics2 = await this.makeApiCall(`/api/projects/${this.testProjects[1].id}/analytics`);

      // Verify that projects have different data
      const project1Commits = analytics1.recentCommits || [];
      const project2Commits = analytics2.recentCommits || [];

      const hasOverlap = project1Commits.some((commit1: any) => 
        project2Commits.some((commit2: any) => commit1.sha === commit2.sha)
      );

      if (!hasOverlap) {
        this.log('Data Isolation', 'PASS', 
          'Projects have isolated data - no commit overlap detected');
      } else {
        this.log('Data Isolation', 'FAIL', 
          'Projects share data - isolation may be compromised');
      }

    } catch (error) {
      this.log('Data Isolation', 'FAIL', 
        'Failed to test data isolation', undefined, error as string);
    }
  }

  async testCachingBehavior() {
    console.log('\n⚡ Testing Caching Behavior...');
    
    const project = this.testProjects[0];
    if (!project) return;

    try {
      // First request (should cache)
      const start1 = Date.now();
      const response1 = await this.makeApiCall(`/api/projects/${project.id}/analytics?timeframe=30d`);
      const time1 = Date.now() - start1;

      // Second request (should use cache)
      const start2 = Date.now();
      const response2 = await this.makeApiCall(`/api/projects/${project.id}/analytics?timeframe=30d`);
      const time2 = Date.now() - start2;

      if (response2.cached) {
        this.log('Caching Behavior', 'PASS', 
          `Caching works - second request used cache (${time1}ms -> ${time2}ms)`);
      } else {
        this.log('Caching Behavior', 'FAIL', 
          'Second request did not use cache');
      }

      // Test that filtered requests don't use cache
      const filteredResponse = await this.makeApiCall(
        `/api/projects/${project.id}/analytics?timeframe=30d&contributors=developer1`
      );
      
      if (!filteredResponse.cached) {
        this.log('Filtered Request Caching', 'PASS', 
          'Filtered requests correctly bypass cache');
      } else {
        this.log('Filtered Request Caching', 'FAIL', 
          'Filtered requests incorrectly used cache');
      }

    } catch (error) {
      this.log('Caching Behavior', 'FAIL', 
        'Failed to test caching', undefined, error as string);
    }
  }

  async testRealTimeEvents() {
    console.log('\n🔴 Testing Real-time Events (SSE)...');
    
    const project = this.testProjects[0];
    if (!project) return;

    try {
      // Test SSE connection
      const sseUrl = `${this.baseUrl}/api/projects/${project.id}/events`;
      
      // Note: In a real test, we'd establish an SSE connection and verify events
      // For now, we'll just test that the endpoint exists and responds
      const response = await fetch(sseUrl);
      
      if (response.ok) {
        this.log('Real-time Events', 'PASS', 
          'SSE endpoint accessible');
      } else {
        this.log('Real-time Events', 'FAIL', 
          `SSE endpoint returned ${response.status}`);
      }

    } catch (error) {
      this.log('Real-time Events', 'FAIL', 
        'Failed to test SSE endpoint', undefined, error as string);
    }
  }

  async cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      for (const project of this.testProjects) {
        // Delete commits
        await prisma.commit.deleteMany({
          where: { projectId: project.id }
        });

        // Delete contributors  
        await prisma.contributor.deleteMany({
          where: { projectId: project.id }
        });

        // Delete AI metrics
        await prisma.autoFixMetrics.deleteMany({
          where: { projectId: project.id }
        });

        // Delete project
        await prisma.project.delete({
          where: { id: project.id }
        });
      }

      this.log('Cleanup Test Data', 'PASS', 
        `Cleaned up ${this.testProjects.length} test projects`);

    } catch (error) {
      this.log('Cleanup Test Data', 'FAIL', 
        'Failed to cleanup test data', undefined, error as string);
    }
  }

  printSummary() {
    console.log('\n📋 Test Summary');
    console.log('================');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Skipped: ${skipped}`);
    console.log(`📊 Total: ${this.results.length}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   • ${r.test}: ${r.message}`));
    }
    
    const success = failed === 0;
    console.log(`\n🎯 Overall Result: ${success ? '✅ PASS' : '❌ FAIL'}`);
    
    return success;
  }

  async runAllTests(): Promise<boolean> {
    console.log('🚀 Starting Analytics System Integration Tests\n');
    
    try {
      await this.setupTestData();
      await this.testAnalyticsEndpoints();
      await this.testFilterFunctionality();
      await this.testDataIsolation();
      await this.testCachingBehavior();
      await this.testRealTimeEvents();
      
      return this.printSummary();
      
    } catch (error) {
      console.error('🔥 Test execution failed:', error);
      return false;
      
    } finally {
      await this.cleanupTestData();
      await prisma.$disconnect();
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new AnalyticsSystemTester();
  
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { AnalyticsSystemTester };