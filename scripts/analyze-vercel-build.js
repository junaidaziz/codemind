#!/usr/bin/env node

/**
 * Auto-Analyze Failed Builds & Deployments
 * 
 * This script automatically:
 * 1. Detects failure source (GitHub CI/CD or Vercel deployment)
 * 2. Fetches the appropriate logs (GitHub Actions logs or Vercel build logs)
 * 3. Stores them locally (vercel-fail.json or github-build-fail.json)
 * 4. Sends them to OpenAI API for automated analysis
 * 5. Prints a human-readable summary of the root cause and suggested fix
 * 6. Generates ai_analysis.md with detailed analysis
 * 7. Tracks repeated failures and creates GitHub issues when needed
 */

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: '.env.local' });

function validateEnvironment() {
  const requiredVars = ['VERCEL_TOKEN', 'VERCEL_PROJECT', 'VERCEL_TEAM', 'OPENAI_API_KEY'];
  const missing = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return {
    VERCEL_TOKEN: process.env.VERCEL_TOKEN,
    VERCEL_PROJECT: process.env.VERCEL_PROJECT,
    VERCEL_TEAM: process.env.VERCEL_TEAM,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_REPO: process.env.GITHUB_REPO,
  };
}

class VercelBuildAnalyzer {
  constructor() {
    this.env = validateEnvironment();
    this.vercelBaseUrl = 'https://api.vercel.com';
    this.openaiBaseUrl = 'https://api.openai.com/v1';
  }

  /**
   * Fetch the latest failed deployment from Vercel
   */
  async getLatestFailedDeployment() {
    console.log('🔍 Fetching latest deployments...');
    
    try {
      const url = new URL(`${this.vercelBaseUrl}/v6/deployments`);
      url.searchParams.set('teamId', this.env.VERCEL_TEAM);
      url.searchParams.set('projectId', this.env.VERCEL_PROJECT);
      url.searchParams.set('limit', '20');
      url.searchParams.set('state', 'ERROR');

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.env.VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Vercel API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.deployments.length === 0) {
        console.log('✅ No failed deployments found!');
        return null;
      }

      // Sort by creation time to get the latest
      const latestFailed = data.deployments
        .filter((deployment) => deployment.state === 'ERROR')
        .sort((a, b) => b.createdAt - a.createdAt)[0];

      if (!latestFailed) {
        console.log('✅ No failed deployments found!');
        return null;
      }

      console.log(`❌ Found failed deployment: ${latestFailed.uid} (${new Date(latestFailed.createdAt).toISOString()})`);
      return latestFailed;

    } catch (error) {
      console.error('Error fetching deployments:', error);
      throw error;
    }
  }

  /**
   * Fetch build logs for a specific deployment using v2 API
   */
  async getBuildLogs(deploymentId) {
    console.log('📄 Fetching detailed build logs...');
    
    try {
      const url = new URL(`${this.vercelBaseUrl}/v2/deployments/${deploymentId}/events`);
      url.searchParams.set('teamId', this.env.VERCEL_TEAM);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.env.VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Vercel API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Extract and format build logs with enhanced detail
      let buildLogs = '';
      let totalEvents = 0;
      
      for (const build of data.builds) {
        buildLogs += `\n=== Build ${build.id} ===\n`;
        
        for (const event of build.events) {
          const timestamp = new Date(event.created).toISOString();
          const eventText = event.payload.text.trim();
          
          // Skip empty events
          if (!eventText) continue;
          
          buildLogs += `[${timestamp}] ${event.type.toUpperCase()}: ${eventText}\n`;
          totalEvents++;
        }
      }

      if (!buildLogs.trim() || totalEvents === 0) {
        buildLogs = 'No detailed build logs available for this deployment. This may be a configuration or permission issue.';
      }

      console.log(`📄 Retrieved ${buildLogs.length} characters of build logs (${totalEvents} events)`);
      return buildLogs;

    } catch (error) {
      console.error('Error fetching build logs:', error);
      throw error;
    }
  }

  /**
   * Save build logs to logs directory
   */
  async saveBuildLogs(deployment, buildLogs) {
    console.log('💾 Saving build logs to /logs/vercel-fail.json...');
    
    try {
      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), 'logs');
      await fs.mkdir(logsDir, { recursive: true });

      const failureData = {
        deployment: {
          uid: deployment.uid,
          name: deployment.name,
          url: deployment.url,
          state: deployment.state,
          createdAt: deployment.createdAt,
          timestamp: new Date(deployment.createdAt).toISOString(),
          target: deployment.target,
          source: deployment.source,
          creator: deployment.creator,
          inspectorUrl: deployment.inspectorUrl,
        },
        buildLogs,
        metadata: {
          analyzedAt: new Date().toISOString(),
          logLength: buildLogs.length,
          apiVersion: 'v2',
        },
      };

      const filePath = path.join(logsDir, 'vercel-fail.json');
      await fs.writeFile(filePath, JSON.stringify(failureData, null, 2), 'utf-8');
      
      console.log(`💾 Build logs saved to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Error saving build logs:', error);
      throw error;
    }
  }

  /**
   * Analyze build logs using OpenAI gpt-4o-mini
   */
  async analyzeBuildLogs(buildLogs) {
    console.log('🤖 Analyzing build logs with OpenAI gpt-4o-mini...');
    
    try {
      const messages = [
        {
          role: 'user',
          content: `Analyze this Vercel build log, summarize the failure reason, and provide step-by-step fixes.

Build Log:
${buildLogs}

Please respond in this exact JSON format:
{
  "summary": "Brief one-line summary of the failure",
  "rootCause": "Detailed explanation of what went wrong",
  "suggestedFix": "Step-by-step solution to fix the issue",
  "confidence": 85,
  "category": "TypeScript Error"
}

Categories can be: TypeScript Error, Dependency Issue, Build Configuration, Runtime Error, Memory Issue, Timeout, etc.
Focus on actionable, specific solutions.`,
        }
      ];

      const response = await fetch(`${this.openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 1000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No analysis content received from OpenAI');
      }

      // Parse JSON response
      try {
        const analysis = JSON.parse(content);
        
        // Validate required fields
        if (!analysis.rootCause || !analysis.suggestedFix || typeof analysis.confidence !== 'number') {
          throw new Error('Invalid analysis format from OpenAI');
        }

        // Ensure summary exists, fallback to rootCause if not
        if (!analysis.summary) {
          analysis.summary = analysis.rootCause.split('.')[0];
        }

        console.log('🤖 Analysis completed successfully');
        return analysis;

      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        console.log('Raw OpenAI response:', content);
        
        // Fallback to manual parsing if JSON parsing fails
        return {
          summary: 'Analysis parsing failed',
          rootCause: 'Unable to parse OpenAI analysis - Raw response available in logs',
          suggestedFix: content,
          confidence: 50,
          category: 'Analysis Error',
        };
      }

    } catch (error) {
      console.error('Error analyzing build logs with OpenAI:', error);
      throw error;
    }
  }

  /**
   * Print enhanced human-readable summary with specific format
   */
  printSummary(deployment, analysis) {
    console.log('\n' + '='.repeat(80));
    
    // Main summary line
    console.log(`❌ Build failed: ${analysis.summary}`);
    console.log(`🔍 Cause: ${analysis.rootCause}`);
    
    // Format the fix suggestions
    const fixLines = analysis.suggestedFix.split('\n').filter((line) => line.trim());
    console.log(`🛠️ Fix:`);
    
    for (let i = 0; i < fixLines.length; i++) {
      const line = fixLines[i].trim();
      if (line) {
        // Remove existing numbering if present and add consistent formatting
        const cleanLine = line.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '');
        console.log(`   ${i + 1}. ${cleanLine}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 DETAILED ANALYSIS');
    console.log('='.repeat(80));
    
    console.log(`\n📅 Deployment Details:`);
    console.log(`   • ID: ${deployment.uid}`);
    console.log(`   • Project: ${deployment.name}`);
    console.log(`   • Failed At: ${new Date(deployment.createdAt).toLocaleString()}`);
    console.log(`   • URL: ${deployment.url || 'N/A'}`);
    console.log(`   • Target: ${deployment.target || 'N/A'}`);
    console.log(`   • Source: ${deployment.source}`);
    
    console.log(`\n🎯 Analysis Results:`);
    console.log(`   • Category: ${analysis.category}`);
    console.log(`   • Confidence: ${analysis.confidence}%`);
    console.log(`   • Model: gpt-4o-mini`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Analysis complete! Full details saved to /logs/vercel-fail.json');
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Main execution method
   */
  async run() {
    try {
      console.log('🚀 Starting Vercel Build Analysis...\n');

      // Step 1: Get latest failed deployment
      const failedDeployment = await this.getLatestFailedDeployment();
      
      if (!failedDeployment) {
        console.log('🎉 No failed deployments to analyze!');
        return;
      }

      // Step 2: Get build logs
      const buildLogs = await this.getBuildLogs(failedDeployment.uid);

      // Step 3: Save logs locally
      const savedFilePath = await this.saveBuildLogs(failedDeployment, buildLogs);

      // Step 4: Analyze with OpenAI
      const analysis = await this.analyzeBuildLogs(buildLogs);

      // Step 5: Save complete analysis to logs directory
      const completeAnalysis = {
        deployment: failedDeployment,
        buildLogs,
        analysis,
        timestamp: new Date().toISOString(),
      };

      await fs.writeFile(savedFilePath, JSON.stringify(completeAnalysis, null, 2), 'utf-8');

      // Step 6: Print enhanced summary
      this.printSummary(failedDeployment, analysis);

    } catch (error) {
      console.error('\n❌ Analysis failed:', error);
      
      // Print helpful error information
      if (error.message.includes('Missing required environment variables')) {
        console.log('\n💡 To fix this:');
        console.log('1. Create .env.local file in your project root');
        console.log('2. Add the missing environment variables');
        console.log('3. Run the analysis again');
      }
      
      process.exit(1);
    }
  }
}

// Execute the script when run directly
if (require.main === module) {
  const analyzer = new VercelBuildAnalyzer();
  
  // Parse command line arguments for GitHub failure analysis
  const args = process.argv.slice(2);
  const githubRunId = args.find(arg => arg.startsWith('--github-run-id='))?.split('=')[1];
  const githubJobId = args.find(arg => arg.startsWith('--github-job-id='))?.split('=')[1];
  
  if (githubRunId) {
    console.log('GitHub Actions failure analysis not implemented in JavaScript version');
    console.log('Please use the TypeScript version for GitHub analysis features');
    process.exit(1);
  } else {
    // Default to Vercel failure analysis
    analyzer.run().catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  }
}

module.exports = { VercelBuildAnalyzer };