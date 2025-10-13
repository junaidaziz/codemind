import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const checks = {
      database: {
        status: 'checking',
        message: 'Checking database connection...'
      },
      openai: {
        status: 'checking', 
        message: 'Checking OpenAI API...'
      },
      github: {
        status: 'checking',
        message: 'Checking GitHub integration...'
      }
    }

    // Check Database
    const dbUrl = process.env.DATABASE_URL
    if (dbUrl && dbUrl !== 'postgresql://localhost:5432/codemind') {
      checks.database = {
        status: 'success',
        message: 'Database URL configured'
      }
    } else {
      checks.database = {
        status: 'warning',
        message: 'Using default database URL'
      }
    }

    // Check OpenAI
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey && openaiKey !== 'sk-placeholder-key') {
      if (openaiKey.startsWith('sk-')) {
        checks.openai = {
          status: 'success',
          message: 'OpenAI API key configured'
        }
      } else {
        checks.openai = {
          status: 'error',
          message: 'Invalid OpenAI API key format'
        }
      }
    } else {
      checks.openai = {
        status: 'error',
        message: 'OpenAI API key not configured'
      }
    }

    // Check GitHub
    const githubToken = process.env.GITHUB_TOKEN
    const githubAppId = process.env.GITHUB_APP_ID
    const githubKey = process.env.GITHUB_PRIVATE_KEY
    
    if (githubToken || (githubAppId && githubKey)) {
      checks.github = {
        status: 'success',
        message: 'GitHub credentials configured'
      }
    } else {
      checks.github = {
        status: 'error',
        message: 'GitHub credentials not configured'
      }
    }

    const allGood = Object.values(checks).every(check => check.status === 'success')

    return NextResponse.json({
      overall: allGood ? 'ready' : 'needs_setup',
      checks,
      recommendations: allGood ? [
        'System is ready for testing!',
        'Try the Test Auto Fix button',
        'Check the API endpoints'
      ] : [
        'Set up missing environment variables',
        'Check the SETUP_GUIDE.md file', 
        'Restart the development server'
      ]
    })

  } catch (error) {
    return NextResponse.json({
      overall: 'error',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}