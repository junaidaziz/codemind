/**
 * Simple GitHub Integration Validation Script
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testDatabaseConnection() {
  console.log('🔗 Testing database connection...')
  try {
    await prisma.$connect()
    
    // Test if our new models exist
    const pullRequestCount = await prisma.pullRequest.count()
    const issueCount = await prisma.issue.count()
    const projectCount = await prisma.project.count()
    
    console.log('✅ Database connection successful!')
    console.log(`   Projects: ${projectCount}`)
    console.log(`   Pull Requests: ${pullRequestCount}`)
    console.log(`   Issues: ${issueCount}`)
    
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

async function testEnvironmentVariables() {
  console.log('\n🔧 Checking environment variables...')
  
  const requiredVars = [
    'GITHUB_TOKEN',
    'GITHUB_CLIENT_ID', 
    'GITHUB_CLIENT_SECRET',
    'GITHUB_APP_ID',
    'GITHUB_PRIVATE_KEY',
    'GITHUB_INSTALLATION_ID',
    'OPENAI_API_KEY',
    'DATABASE_URL'
  ]

  const missingVars = requiredVars.filter(varName => !process.env[varName])
  
  if (missingVars.length === 0) {
    console.log('✅ All required environment variables are set!')
    return true
  } else {
    console.log('❌ Missing environment variables:', missingVars.join(', '))
    return false
  }
}

async function testServerEndpoints() {
  console.log('\n🌐 Testing server endpoints...')
  
  // Check if the server is running
  try {
    const response = await fetch('http://localhost:3000/api/health', {
      method: 'GET',
    })
    
    if (response.ok) {
      console.log('✅ Server is running and accessible!')
      return true
    } else {
      console.log('⚠️  Server responded with status:', response.status)
      return false
    }
  } catch (error) {
    console.log('⚠️  Server is not running at localhost:3000')
    console.log('   Start the server with: npm run dev')
    return false
  }
}

async function createTestProject() {
  console.log('\n📁 Creating test project...')
  
  try {
    // Create or find test user
    const testUser = await prisma.user.upsert({
      where: { email: 'test@codemind.dev' },
      update: {},
      create: {
        email: 'test@codemind.dev',
        name: 'Test User',
        role: 'user',
      },
    })

    // Create or find test project
    const testProject = await prisma.project.upsert({
      where: { githubUrl: 'https://github.com/junaidaziz/codemind' },
      update: {},
      create: {
        name: 'CodeMind Test Project',
        githubUrl: 'https://github.com/junaidaziz/codemind',
        ownerId: testUser.id,
        status: 'active',
      },
    })

    console.log('✅ Test project created/updated successfully!')
    console.log(`   Project ID: ${testProject.id}`)
    console.log(`   User ID: ${testUser.id}`)
    
    return { testProject, testUser }
  } catch (error) {
    console.error('❌ Failed to create test project:', error)
    return null
  }
}

async function runValidation() {
  console.log('🚀 CodeMind GitHub Integration Validation')
  console.log('=========================================\n')

  const results = {
    database: false,
    environment: false,
    server: false,
    project: false
  }

  // Test database connection
  results.database = await testDatabaseConnection()

  // Test environment variables
  results.environment = await testEnvironmentVariables()

  // Test server
  results.server = await testServerEndpoints()

  // Create test project
  if (results.database) {
    const projectResult = await createTestProject()
    results.project = !!projectResult
  }

  // Print summary
  console.log('\n📊 Validation Summary')
  console.log('=====================')
  
  const passed = Object.values(results).filter(Boolean).length
  const total = Object.keys(results).length
  
  console.log(`Database Connection: ${results.database ? '✅' : '❌'}`)
  console.log(`Environment Setup: ${results.environment ? '✅' : '❌'}`)
  console.log(`Server Running: ${results.server ? '✅' : '❌'}`)
  console.log(`Test Project: ${results.project ? '✅' : '❌'}`)
  
  console.log(`\nOverall: ${passed}/${total} tests passed`)
  
  if (passed === total) {
    console.log('\n🎉 All validations passed!')
    console.log('   Ready to test GitHub API endpoints!')
    console.log('   Next: Start the server and test API routes manually.')
  } else {
    console.log('\n⚠️  Some validations failed.')
    console.log('   Fix the issues above before proceeding.')
  }

  await prisma.$disconnect()
}

// Run validation
runValidation().catch(console.error)