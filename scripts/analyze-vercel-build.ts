#!/usr/bin/env ts-node

/**
 * Auto-Analyze Failed Vercel Builds
 * 
 * This script automatically:
 * 1. Fetches the latest failed Vercel deployment
 * 2. Retrieves the build logs via the Vercel API
 * 3. Stores them locally (vercel-fail.json)
 * 4. Sends them to OpenAI API for automated analysis
 * 5. Prints a human-readable summary of the root cause and suggested fix
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

// TypeScript interfaces for Vercel API responses
interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state: 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
  type: 'LAMBDAS';
  target: 'production' | 'staging' | null;
  createdAt: number;
  buildingAt?: number;
  ready?: number;
  source: 'git' | 'cli' | 'import';
  creator: {
    uid: string;
    username: string;
  };
  inspectorUrl?: string;
}

interface VercelDeploymentsResponse {
  deployments: VercelDeployment[];
  pagination: {
    count: number;
    next?: number;
    prev?: number;
  };
}

interface VercelBuildEvent {
  type: 'command' | 'stdout' | 'stderr';
  created: number;
  payload: {
    text: string;
  };
}

interface VercelBuildEventsResponse {
  builds: Array<{
    id: string;
    events: VercelBuildEvent[];
  }>;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface AnalyzedBuildFailure {
  deployment: VercelDeployment;
  buildLogs: string;
  analysis: {
    rootCause: string;
    suggestedFix: string;
    confidence: number;
    category: string;
  };
  timestamp: string;
}

// Environment variables with validation
interface EnvConfig {
  VERCEL_TOKEN: string;
  VERCEL_PROJECT: string;
  VERCEL_TEAM: string;
  OPENAI_API_KEY: string;
}

function validateEnvironment(): EnvConfig {
  const requiredVars = ['VERCEL_TOKEN', 'VERCEL_PROJECT', 'VERCEL_TEAM', 'OPENAI_API_KEY'];
  const missing: string[] = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return {
    VERCEL_TOKEN: process.env.VERCEL_TOKEN!,
    VERCEL_PROJECT: process.env.VERCEL_PROJECT!,
    VERCEL_TEAM: process.env.VERCEL_TEAM!,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  };
}

class VercelBuildAnalyzer {
  private env: EnvConfig;
  private vercelBaseUrl = 'https://api.vercel.com';
  private openaiBaseUrl = 'https://api.openai.com/v1';

  constructor() {
    this.env = validateEnvironment();
  }

  /**
   * Fetch the latest failed deployment from Vercel
   */
  async getLatestFailedDeployment(): Promise<VercelDeployment | null> {
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

      const data: VercelDeploymentsResponse = await response.json();
      
      if (data.deployments.length === 0) {
        console.log('✅ No failed deployments found!');
        return null;
      }

      // Sort by creation time to get the latest
      const latestFailed = data.deployments
        .filter((deployment: VercelDeployment) => deployment.state === 'ERROR')
        .sort((a: VercelDeployment, b: VercelDeployment) => b.createdAt - a.createdAt)[0];

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
   * Fetch build logs for a specific deployment
   */
  async getBuildLogs(deploymentId: string): Promise<string> {
    console.log('📄 Fetching build logs...');
    
    try {
      const url = `${this.vercelBaseUrl}/v1/deployments/${deploymentId}/events`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.env.VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Vercel API error: ${response.status} ${response.statusText}`);
      }

      const data: VercelBuildEventsResponse = await response.json();
      
      // Extract and format build logs
      let buildLogs = '';
      
      for (const build of data.builds) {
        buildLogs += `\n=== Build ${build.id} ===\n`;
        
        for (const event of build.events) {
          const timestamp = new Date(event.created).toISOString();
          buildLogs += `[${timestamp}] ${event.type}: ${event.payload.text}\n`;
        }
      }

      if (!buildLogs.trim()) {
        buildLogs = 'No build logs available for this deployment.';
      }

      console.log(`📄 Retrieved ${buildLogs.length} characters of build logs`);
      return buildLogs;

    } catch (error) {
      console.error('Error fetching build logs:', error);
      throw error;
    }
  }

  /**
   * Save build logs to local file
   */
  async saveBuildLogs(deployment: VercelDeployment, buildLogs: string): Promise<void> {
    console.log('💾 Saving build logs to vercel-fail.json...');
    
    try {
      const failureData = {
        deployment: {
          uid: deployment.uid,
          name: deployment.name,
          url: deployment.url,
          state: deployment.state,
          createdAt: deployment.createdAt,
          timestamp: new Date(deployment.createdAt).toISOString(),
        },
        buildLogs,
        analyzedAt: new Date().toISOString(),
      };

      const filePath = join(process.cwd(), 'vercel-fail.json');
      await fs.writeFile(filePath, JSON.stringify(failureData, null, 2), 'utf-8');
      
      console.log(`💾 Build logs saved to: ${filePath}`);
    } catch (error) {
      console.error('Error saving build logs:', error);
      throw error;
    }
  }

  /**
   * Analyze build logs using OpenAI API
   */
  async analyzeBuildLogs(buildLogs: string): Promise<{ rootCause: string; suggestedFix: string; confidence: number; category: string }> {
    console.log('🤖 Analyzing build logs with OpenAI...');
    
    try {
      const messages: OpenAIMessage[] = [
        {
          role: 'system',
          content: `You are an expert DevOps engineer specializing in debugging Vercel build failures. 
          
          Analyze the provided build logs and identify:
          1. The root cause of the build failure
          2. A specific, actionable fix
          3. Your confidence level (0-100)
          4. The failure category (e.g., "TypeScript Error", "Dependency Issue", "Build Configuration", "Runtime Error")
          
          Respond in this exact JSON format:
          {
            "rootCause": "Clear explanation of what went wrong",
            "suggestedFix": "Step-by-step solution to fix the issue",
            "confidence": 85,
            "category": "TypeScript Error"
          }
          
          Be concise but thorough. Focus on actionable solutions.`,
        },
        {
          role: 'user',
          content: `Please analyze these Vercel build logs and identify the root cause and solution:\n\n${buildLogs}`,
        },
      ];

      const response = await fetch(`${this.openaiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages,
          max_tokens: 1000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenAIResponse = await response.json();
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

        console.log('🤖 Analysis completed successfully');
        return analysis;

      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        // Fallback to manual parsing if JSON parsing fails
        return {
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
   * Print human-readable summary
   */
  printSummary(deployment: VercelDeployment, analysis: { rootCause: string; suggestedFix: string; confidence: number; category: string }): void {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VERCEL BUILD FAILURE ANALYSIS');
    console.log('='.repeat(80));
    
    console.log(`\n📅 Deployment Details:`);
    console.log(`   • ID: ${deployment.uid}`);
    console.log(`   • Project: ${deployment.name}`);
    console.log(`   • Failed At: ${new Date(deployment.createdAt).toLocaleString()}`);
    console.log(`   • URL: ${deployment.url || 'N/A'}`);
    
    console.log(`\n🎯 Analysis Results:`);
    console.log(`   • Category: ${analysis.category}`);
    console.log(`   • Confidence: ${analysis.confidence}%`);
    
    console.log(`\n❌ Root Cause:`);
    console.log(`   ${analysis.rootCause}`);
    
    console.log(`\n🔧 Suggested Fix:`);
    const fixLines = analysis.suggestedFix.split('\n');
    for (const line of fixLines) {
      console.log(`   ${line}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Analysis complete! Check vercel-fail.json for full details.');
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
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
      await this.saveBuildLogs(failedDeployment, buildLogs);

      // Step 4: Analyze with OpenAI
      const analysis = await this.analyzeBuildLogs(buildLogs);

      // Step 5: Save complete analysis
      const completeAnalysis: AnalyzedBuildFailure = {
        deployment: failedDeployment,
        buildLogs,
        analysis,
        timestamp: new Date().toISOString(),
      };

      await fs.writeFile(
        join(process.cwd(), 'vercel-fail.json'),
        JSON.stringify(completeAnalysis, null, 2),
        'utf-8'
      );

      // Step 6: Print summary
      this.printSummary(failedDeployment, analysis);

    } catch (error) {
      console.error('\n❌ Analysis failed:', error);
      process.exit(1);
    }
  }
}

// Execute the script when run directly
const isMainModule = process.argv[1] && process.argv[1].endsWith('analyze-vercel-build.ts');
if (isMainModule) {
  const analyzer = new VercelBuildAnalyzer();
  analyzer.run().catch((error: Error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { VercelBuildAnalyzer };