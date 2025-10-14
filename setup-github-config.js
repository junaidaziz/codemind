const { PrismaClient } = require('@prisma/client');

async function createProjectConfig() {
  const prisma = new PrismaClient();
  
  try {
    // Create a project configuration for the codemind project
    const projectConfig = await prisma.projectConfig.create({
      data: {
        projectId: 'cmgozze6z0001xos16qpcefg1',
        // Add your GitHub token here
        githubToken: 'your_github_personal_access_token_here',
        
        // OR add GitHub App credentials (recommended)
        // githubAppId: 'your_app_id',
        // githubPrivateKey: 'your_private_key',
        // githubInstallationId: 'your_installation_id',
      }
    });

    console.log('Project configuration created:', projectConfig);
    
  } catch (error) {
    console.error('Error creating config:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Uncomment and run this when you have your GitHub credentials
// createProjectConfig();