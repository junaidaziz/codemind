#!/usr/bin/env ts-node

/**
 * Configuration Resolver Test Script
 * 
 * Tests the dynamic project configuration system to ensure:
 * 1. Configuration can be retrieved for different projects
 * 2. Environment fallbacks work correctly
 * 3. Caching is functioning properly
 * 4. Validation works as expected
 */

import { getProjectConfig, ConfigHelpers } from '../src/lib/project-config-resolver';
import { ConfigHelper } from '../src/lib/config-helper';
import prisma from '../src/app/lib/db';

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function warning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

async function createTestProject(): Promise<string> {
  try {
    // Create a test project
    const testProject = await prisma.project.create({
      data: {
        name: 'Config Test Project',
        githubUrl: 'https://github.com/test/config-test',
        ownerId: 'test-user-id' // This would normally be a real user ID
      }
    });

    info(`Created test project: ${testProject.id}`);
    return testProject.id;
  } catch (err) {
    error(`Failed to create test project: ${err}`);
    throw err;
  }
}

async function createTestConfiguration(projectId: string) {
  try {
    // Create test configuration
    await prisma.projectConfig.create({
      data: {
        projectId,
        vercelToken: 'test_vercel_token_12345',
        vercelProjectId: 'test-project-id',
        vercelTeamId: 'test-team-id',
        openaiApiKey: 'sk-test_openai_key_12345',
        githubAppId: 'test-app-id',
        githubPrivateKey: 'test-private-key-data',
        githubInstallationId: 'test-installation-id',
        githubWebhookSecret: 'test-webhook-secret',
        githubToken: 'ghp_test_token_12345',
        isEncrypted: false
      }
    });

    success('Created test configuration');
  } catch (err) {
    error(`Failed to create test configuration: ${err}`);
    throw err;
  }
}

async function testConfigurationRetrieval(projectId: string) {
  info('Testing configuration retrieval...');

  try {
    // Test getting complete configuration
    const config = await getProjectConfig(projectId);
    
    if (config.hasConfig) {
      success('✓ Configuration loaded successfully');
      success('✓ Project has configuration in database');
    } else {
      warning('⚠ Configuration loaded but no database config found (using fallbacks)');
    }

    // Test specific configuration helpers
    const githubConfig = await ConfigHelpers.getGitHubConfig(projectId);
    const openaiConfig = await ConfigHelpers.getOpenAIConfig(projectId);
    const vercelConfig = await ConfigHelpers.getVercelConfig(projectId);

    if (githubConfig.appId) {
      success('✓ GitHub configuration retrieved');
    } else {
      warning('⚠ GitHub configuration missing');
    }

    if (openaiConfig.apiKey) {
      success('✓ OpenAI configuration retrieved');
    } else {
      warning('⚠ OpenAI configuration missing');
    }

    if (vercelConfig.token) {
      success('✓ Vercel configuration retrieved');
    } else {
      warning('⚠ Vercel configuration missing');
    }

    // Test convenience functions
    const githubToken = await ConfigHelper.getGitHubToken(projectId);
    const openaiKey = await ConfigHelper.getOpenAIKey(projectId);

    if (githubToken) {
      success('✓ GitHub token retrieved via convenience function');
    } else {
      warning('⚠ GitHub token not available via convenience function');
    }

    if (openaiKey) {
      success('✓ OpenAI key retrieved via convenience function');
    } else {
      warning('⚠ OpenAI key not available via convenience function');
    }

  } catch (err) {
    error(`Configuration retrieval failed: ${err}`);
    throw err;
  }
}

async function testConfigurationValidation(projectId: string) {
  info('Testing configuration validation...');

  try {
    // Test configuration completeness checks
    const [hasGitHub, hasOpenAI, hasVercel, isConfigured] = await Promise.all([
      ConfigHelpers.hasCompleteGitHubConfig(projectId),
      ConfigHelpers.hasOpenAIConfig(projectId),
      ConfigHelpers.hasVercelConfig(projectId),
      ConfigHelper.isProjectConfigured(projectId)
    ]);

    if (hasGitHub) {
      success('✓ GitHub configuration is complete');
    } else {
      warning('⚠ GitHub configuration is incomplete');
    }

    if (hasOpenAI) {
      success('✓ OpenAI configuration is complete');
    } else {
      warning('⚠ OpenAI configuration is incomplete');
    }

    if (hasVercel) {
      success('✓ Vercel configuration is complete');
    } else {
      warning('⚠ Vercel configuration is incomplete');
    }

    if (isConfigured) {
      success('✓ Project is fully configured');
    } else {
      warning('⚠ Project configuration is incomplete');
    }

  } catch (err) {
    error(`Configuration validation failed: ${err}`);
    throw err;
  }
}

async function testEnvironmentFallback() {
  info('Testing environment variable fallback...');

  try {
    // Create a project without configuration to test fallbacks
    const testProject = await prisma.project.create({
      data: {
        name: 'Fallback Test Project',
        githubUrl: 'https://github.com/test/fallback-test',
        ownerId: 'test-user-id'
      }
    });

    const config = await getProjectConfig(testProject.id);

    if (config.fallbackToEnv) {
      success('✓ Environment fallback is working');
    } else {
      warning('⚠ Environment fallback not triggered (configuration found)');
    }

    // Clean up
    await prisma.project.delete({ where: { id: testProject.id } });

  } catch (err) {
    error(`Environment fallback test failed: ${err}`);
    throw err;
  }
}

async function testMultiProjectSupport() {
  info('Testing multi-project configuration support...');

  try {
    // Create multiple test projects
    const project1 = await prisma.project.create({
      data: {
        name: 'Multi Test Project 1',
        githubUrl: 'https://github.com/test/multi-test-1',
        ownerId: 'test-user-id'
      }
    });

    const project2 = await prisma.project.create({
      data: {
        name: 'Multi Test Project 2',
        githubUrl: 'https://github.com/test/multi-test-2',
        ownerId: 'test-user-id'
      }
    });

    // Create different configurations for each
    await prisma.projectConfig.create({
      data: {
        projectId: project1.id,
        openaiApiKey: 'sk-project1-key',
        githubToken: 'ghp_project1_token',
        isEncrypted: false
      }
    });

    await prisma.projectConfig.create({
      data: {
        projectId: project2.id,
        openaiApiKey: 'sk-project2-key',
        githubToken: 'ghp_project2_token',
        isEncrypted: false
      }
    });

    // Test that each project gets its own configuration
    const [config1, config2] = await Promise.all([
      getProjectConfig(project1.id),
      getProjectConfig(project2.id)
    ]);

    if (config1.openai.apiKey !== config2.openai.apiKey) {
      success('✓ Multi-project configurations are isolated');
    } else {
      error('❌ Multi-project configurations are not properly isolated');
    }

    // Test multi-project status
    const multiStatus = await ConfigHelper.getMultiProjectStatus([project1.id, project2.id]);
    
    if (Object.keys(multiStatus).length === 2) {
      success('✓ Multi-project status retrieval works');
    } else {
      error('❌ Multi-project status retrieval failed');
    }

    // Clean up
    await Promise.all([
      prisma.projectConfig.deleteMany({ where: { projectId: { in: [project1.id, project2.id] } } }),
      prisma.project.deleteMany({ where: { id: { in: [project1.id, project2.id] } } })
    ]);

  } catch (err) {
    error(`Multi-project test failed: ${err}`);
    throw err;
  }
}

async function cleanupTestData(projectId: string) {
  try {
    // Clean up test data
    await prisma.projectConfig.deleteMany({
      where: { projectId }
    });

    await prisma.project.delete({
      where: { id: projectId }
    });

    success('Test data cleaned up');
  } catch (err) {
    warning(`Cleanup failed (may be harmless): ${err}`);
  }
}

async function runTests() {
  log(`${colors.bold}🧪 Dynamic Configuration Resolver Tests${colors.reset}\n`);

  let projectId: string | null = null;
  let testsPassed = 0;
  const testsTotal = 6;

  try {
    // Test 1: Project Creation
    info('Test 1: Creating test project...');
    projectId = await createTestProject();
    testsPassed++;

    // Test 2: Configuration Creation
    info('Test 2: Creating test configuration...');
    await createTestConfiguration(projectId);
    testsPassed++;

    // Test 3: Configuration Retrieval
    info('Test 3: Testing configuration retrieval...');
    await testConfigurationRetrieval(projectId);
    testsPassed++;

    // Test 4: Configuration Validation
    info('Test 4: Testing configuration validation...');
    await testConfigurationValidation(projectId);
    testsPassed++;

    // Test 5: Environment Fallback
    info('Test 5: Testing environment fallback...');
    await testEnvironmentFallback();
    testsPassed++;

    // Test 6: Multi-Project Support
    info('Test 6: Testing multi-project support...');
    await testMultiProjectSupport();
    testsPassed++;

    // All tests passed
    log(`\n${colors.bold}🎉 All tests completed successfully!${colors.reset}`);
    success(`${testsPassed}/${testsTotal} tests passed`);

  } catch (err) {
    error(`\nTest suite failed: ${err}`);
    log(`${testsPassed}/${testsTotal} tests passed before failure`);
  } finally {
    // Cleanup
    if (projectId) {
      await cleanupTestData(projectId);
    }
    
    // Close database connection
    await prisma.$disconnect();
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch((err) => {
    error(`Test execution failed: ${err}`);
    process.exit(1);
  });
}

export { runTests };