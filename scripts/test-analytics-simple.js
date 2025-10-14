#!/usr/bin/env node

/**
 * Simple Analytics System Test
 * Tests basic functionality of the analytics system
 */

const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

const prisma = new PrismaClient();

async function testAnalyticsSystem() {
  console.log('🧪 Testing Analytics System\n');

  try {
    // Test 1: Check if we have any projects
    const projects = await prisma.project.findMany({
      take: 2,
      orderBy: { createdAt: 'desc' }
    });

    console.log(`✅ Found ${projects.length} projects in database`);

    if (projects.length === 0) {
      console.log('⚠️  No projects found - creating test data would be needed');
      return;
    }

    // Test 2: Test analytics API for first project
    const project = projects[0];
    console.log(`📊 Testing analytics for project: ${project.name}`);

    const response = await fetch(`http://localhost:3001/api/projects/${project.id}/analytics?timeframe=30d`);
    
    if (!response.ok) {
      console.log(`❌ Analytics API failed: ${response.status} ${response.statusText}`);
      return;
    }

    const analytics = await response.json();
    
    console.log(`✅ Analytics API working:`);
    console.log(`   - Total commits: ${analytics.summary?.totalCommits || 0}`);
    console.log(`   - Total contributors: ${analytics.summary?.totalContributors || 0}`);
    console.log(`   - Total PRs: ${analytics.summary?.totalPullRequests || 0}`);
    
    // Test 3: Check AI metrics
    if (analytics.aiMetrics) {
      console.log(`✅ AI metrics included:`);
      console.log(`   - AI sessions: ${analytics.aiMetrics.summary?.totalSessions || 0}`);
      console.log(`   - AI fixes: ${analytics.aiMetrics.summary?.totalFixes || 0}`);
      console.log(`   - Success rate: ${analytics.aiMetrics.summary?.successRate?.toFixed(1) || 0}%`);
    } else {
      console.log(`⚠️  AI metrics not found in response`);
    }

    // Test 4: Test filtering
    console.log(`\n🔍 Testing filters...`);
    const filteredResponse = await fetch(`http://localhost:3001/api/projects/${project.id}/analytics?timeframe=30d&search=test`);
    
    if (filteredResponse.ok) {
      const filteredData = await filteredResponse.json();
      console.log(`✅ Search filter working - ${filteredData.summary?.hasFilters ? 'filters applied' : 'no filters detected'}`);
    } else {
      console.log(`❌ Filter test failed: ${filteredResponse.status}`);
    }

    // Test 5: Test multiple projects if available
    if (projects.length > 1) {
      console.log(`\n🔒 Testing data isolation...`);
      
      const project2 = projects[1];
      const analytics2Response = await fetch(`http://localhost:3001/api/projects/${project2.id}/analytics?timeframe=30d`);
      
      if (analytics2Response.ok) {
        const analytics2 = await analytics2Response.json();
        
        // Simple check - projects should have different commit counts or data
        const commits1 = analytics.summary?.totalCommits || 0;
        const commits2 = analytics2.summary?.totalCommits || 0;
        
        console.log(`✅ Project isolation test:`);
        console.log(`   - Project 1: ${commits1} commits`);
        console.log(`   - Project 2: ${commits2} commits`);
        
        if (commits1 !== commits2 || analytics.recentCommits?.length !== analytics2.recentCommits?.length) {
          console.log(`✅ Projects appear to have isolated data`);
        } else {
          console.log(`⚠️  Projects may be sharing data (needs verification)`);
        }
      }
    }

    console.log(`\n🎉 Analytics system tests completed successfully!`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  testAnalyticsSystem();
}

module.exports = { testAnalyticsSystem };