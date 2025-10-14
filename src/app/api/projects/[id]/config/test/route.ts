/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

interface TestParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: TestParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    
    // Handle both formats: { service, credentials } or the config object itself
    let service = 'all';
    let credentials: any = {};
    
    if (body.service && body.credentials) {
      // New format: { service: 'github', credentials: {...} }
      service = body.service;
      credentials = body.credentials;
    } else {
      // Config object format: { githubAppId, vercelToken, ... }
      service = 'all';
      credentials = body;
    }

    const results: Record<string, any> = {};

    if (service === 'github' || service === 'all') {
      try {
        let octokit: Octokit;

        // Check if GitHub App credentials are provided
        if (credentials.githubAppId && credentials.githubPrivateKey && credentials.githubInstallationId) {
          // Use GitHub App authentication
          octokit = new Octokit({
            authStrategy: createAppAuth,
            auth: {
              appId: parseInt(credentials.githubAppId),
              privateKey: credentials.githubPrivateKey.replace(/\\n/g, '\n'),
              installationId: parseInt(credentials.githubInstallationId),
            },
          });

          // Test repository access since GitHub Apps don't have a user context
          try {
            const { data: installation } = await octokit.rest.apps.getInstallation({
              installation_id: parseInt(credentials.githubInstallationId)
            });
            
            const accountName = installation.account ? 
              ('login' in installation.account ? installation.account.login : installation.account.name) : 
              'Unknown';
              
            results.github = {
              success: true,
              message: `GitHub App connected successfully for ${accountName}`,
              app: {
                account: accountName,
                type: installation.target_type,
                permissions: Object.keys(installation.permissions).join(', ')
              }
            };
          } catch (appError) {
            results.github = {
              success: false,
              message: `GitHub App authentication failed: ${appError instanceof Error ? appError.message : 'Unknown error'}`
            };
          }
        } else if (credentials.githubToken) {
          // Use personal access token authentication
          octokit = new Octokit({ auth: credentials.githubToken });
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
            message: 'GitHub credentials not provided (need either githubToken or GitHub App credentials)'
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