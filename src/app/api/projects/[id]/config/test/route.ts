/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

interface TestParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: TestParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { service, credentials } = body;

    const results: Record<string, any> = {};

    if (service === 'github' || service === 'all') {
      try {
        if (credentials.githubToken) {
          const octokit = new Octokit({ auth: credentials.githubToken });
          const { data: user } = await octokit.rest.users.getAuthenticated();
          results.github = {
            success: true,
            message: `Connected as ${user.login}`,
            user: {
              login: user.login,
              name: user.name,
              avatar_url: user.avatar_url
            }
          };
        } else {
          results.github = {
            success: false,
            message: 'GitHub token not provided'
          };
        }
      } catch (error) {
        results.github = {
          success: false,
          message: error instanceof Error ? error.message : 'GitHub API test failed'
        };
      }
    }

    if (service === 'vercel' || service === 'all') {
      try {
        if (credentials.vercelToken) {
          const response = await fetch('https://api.vercel.com/v2/user', {
            headers: {
              Authorization: `Bearer ${credentials.vercelToken}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            results.vercel = {
              success: true,
              message: `Connected as ${userData.user.name || userData.user.username}`,
              user: {
                username: userData.user.username,
                name: userData.user.name,
                avatar: userData.user.avatar
              }
            };
          } else {
            results.vercel = {
              success: false,
              message: `Vercel API responded with status ${response.status}`
            };
          }
        } else {
          results.vercel = {
            success: false,
            message: 'Vercel token not provided'
          };
        }
      } catch (error) {
        results.vercel = {
          success: false,
          message: error instanceof Error ? error.message : 'Vercel API test failed'
        };
      }
    }

    if (service === 'openai' || service === 'all') {
      try {
        if (credentials.openaiApiKey) {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              Authorization: `Bearer ${credentials.openaiApiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const modelsData = await response.json();
            results.openai = {
              success: true,
              message: `Connected successfully. ${modelsData.data.length} models available.`,
              modelCount: modelsData.data.length
            };
          } else {
            results.openai = {
              success: false,
              message: `OpenAI API responded with status ${response.status}`
            };
          }
        } else {
          results.openai = {
            success: false,
            message: 'OpenAI API key not provided'
          };
        }
      } catch (error) {
        results.openai = {
          success: false,
          message: error instanceof Error ? error.message : 'OpenAI API test failed'
        };
      }
    }

    return NextResponse.json({
      projectId: id,
      testResults: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Config test error:', error);
    return NextResponse.json(
      { error: 'Failed to test configuration' }, 
      { status: 500 }
    );
  }
}