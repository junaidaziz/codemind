/**
 * GitHub Service Direct Test
 * Tests the GitHub service directly without API authentication
 */

import { GitHubService } from '../src/lib/github-service.js'

async function testGitHubService() {
  console.log('🔧 Testing GitHub Service Direct Connection')
  console.log('==========================================\n')

  try {
    const githubService = new GitHubService()
    
    // Test 1: Basic GitHub API connectivity
    console.log('1. Testing basic GitHub API connectivity...')
    const repoInfo = await githubService.getRepository('junaidaziz', 'codemind')
    console.log('✅ Successfully connected to GitHub API')
    console.log(`   Repository: ${repoInfo.full_name}`)
    console.log(`   Stars: ${repoInfo.stargazers_count}`)
    console.log(`   Language: ${repoInfo.language}`)
    
    // Test 2: Fetch Pull Requests
    console.log('\n2. Testing Pull Requests fetching...')
    const pullRequests = await githubService.getPullRequests('junaidaziz', 'codemind')
    console.log(`✅ Successfully fetched ${pullRequests.length} pull requests`)
    
    if (pullRequests.length > 0) {
      console.log(`   Latest PR: #${pullRequests[0].number} - ${pullRequests[0].title}`)
    }
    
    // Test 3: Fetch Issues
    console.log('\n3. Testing Issues fetching...')
    const issues = await githubService.getIssues('junaidaziz', 'codemind')
    console.log(`✅ Successfully fetched ${issues.length} issues`)
    
    if (issues.length > 0) {
      console.log(`   Latest Issue: #${issues[0].number} - ${issues[0].title}`)
    }
    
    // Test 4: Test OpenAI integration
    console.log('\n4. Testing OpenAI connectivity...')
    
    // Import OpenAI
    const { OpenAI } = await import('openai')
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('❌ OpenAI API key not found')
      return
    }
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    
    // Simple test call
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: "Hello! This is a test. Please respond with just 'OK' if you can hear me."
        }
      ],
      max_tokens: 10
    })
    
    console.log('✅ OpenAI API connection successful')
    console.log(`   Response: ${completion.choices[0].message.content}`)
    
    console.log('\n🎉 All GitHub and AI service tests passed!')
    console.log('   The system is ready for end-to-end testing.')
    
  } catch (error) {
    console.error('❌ GitHub service test failed:', error.message)
    if (error.response) {
      console.error('   Status:', error.response.status)
      console.error('   Details:', error.response.data)
    }
  }
}

testGitHubService()