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
    summary: string;
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
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
}

// GitHub API interfaces
interface GitHubIssue {
  title: string;
  body: string;
  labels: string[];
}

interface GitHubCreateIssueResponse {
  id: number;
  number: number;
  html_url: string;
  title: string;
  state: 'open' | 'closed';
}

// Failure tracking for repeated issues
interface FailureRecord {
  commitSha?: string;
  deploymentId: string;
  timestamp: string;
  category: string;
  summary: string;
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
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_REPO: process.env.GITHUB_REPO,
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
   * Fetch build logs for a specific deployment using v2 API
   */
  async getBuildLogs(deploymentId: string): Promise<string> {
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

      const data: VercelBuildEventsResponse = await response.json();
      
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
  async saveBuildLogs(deployment: VercelDeployment, buildLogs: string): Promise<string> {
    console.log('💾 Saving build logs to /logs/vercel-fail.json...');
    
    try {
      // Ensure logs directory exists
      const logsDir = join(process.cwd(), 'logs');
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

      const filePath = join(logsDir, 'vercel-fail.json');
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
  async analyzeBuildLogs(buildLogs: string): Promise<{ rootCause: string; suggestedFix: string; confidence: number; category: string; summary: string }> {
    console.log('🤖 Analyzing build logs with OpenAI gpt-4o-mini...');
    
    try {
      const messages: OpenAIMessage[] = [
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
  printSummary(deployment: VercelDeployment, analysis: { summary: string; rootCause: string; suggestedFix: string; confidence: number; category: string }): void {
    console.log('\n' + '='.repeat(80));
    
    // Main summary line
    console.log(`❌ Build failed: ${analysis.summary}`);
    console.log(`🔍 Cause: ${analysis.rootCause}`);
    
    // Format the fix suggestions
    const fixLines = analysis.suggestedFix.split('\n').filter((line: string) => line.trim());
    console.log(`�️ Fix:`);
    
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
   * Track failure and check for repeated issues
   */
  async trackFailure(deployment: VercelDeployment, analysis: { summary: string; category: string }): Promise<boolean> {
    try {
      const logsDir = join(process.cwd(), 'logs');
      const trackingFile = join(logsDir, 'failure-tracking.json');
      
      // Get commit SHA from deployment if available
      const commitSha = deployment.source === 'git' ? 'unknown' : 'unknown'; // Would need more API calls to get exact SHA
      
      const newFailure: FailureRecord = {
        commitSha,
        deploymentId: deployment.uid,
        timestamp: new Date().toISOString(),
        category: analysis.category,
        summary: analysis.summary,
      };
      
      let failures: FailureRecord[] = [];
      
      // Read existing failures
      try {
        const existingData = await fs.readFile(trackingFile, 'utf-8');
        failures = JSON.parse(existingData);
      } catch {
        // File doesn't exist yet, start fresh
        failures = [];
      }
      
      // Add new failure
      failures.push(newFailure);
      
      // Keep only last 50 failures to prevent file bloat
      if (failures.length > 50) {
        failures = failures.slice(-50);
      }
      
      // Save updated failures
      await fs.writeFile(trackingFile, JSON.stringify(failures, null, 2), 'utf-8');
      
      // Check for repeated failures (same category and similar summary in last 10 failures)
      const recentFailures = failures.slice(-10);
      const similarFailures = recentFailures.filter(f => 
        f.category === analysis.category && 
        f.summary.includes(analysis.summary.split(' ')[0]) // Check first word match
      );
      
      if (similarFailures.length >= 3) {
        console.log(`⚠️  Detected ${similarFailures.length} similar failures recently`);
        return true; // Indicates repeated failure
      }
      
      return false;
      
    } catch (error) {
      console.error('Error tracking failure:', error);
      return false;
    }
  }

  /**
   * Create GitHub issue for repeated failures
   */
  async createGitHubIssue(deployment: VercelDeployment, analysis: { summary: string; rootCause: string; suggestedFix: string; category: string }): Promise<void> {
    if (!this.env.GITHUB_TOKEN || !this.env.GITHUB_REPO) {
      console.log('ℹ️  GitHub integration not configured - skipping issue creation');
      return;
    }

    console.log('🐙 Creating GitHub issue for repeated failure...');

    try {
      const issueTitle = `[Auto] Repeated Build Failure: ${analysis.summary}`;
      const issueBody = `## 🚨 Repeated Build Failure Detected

**Summary:** ${analysis.summary}

**Category:** ${analysis.category}

**Root Cause:**
${analysis.rootCause}

**Suggested Fix:**
${analysis.suggestedFix}

---

**Deployment Details:**
- **ID:** ${deployment.uid}
- **Failed At:** ${new Date(deployment.createdAt).toLocaleString()}
- **URL:** ${deployment.url || 'N/A'}
- **Target:** ${deployment.target || 'N/A'}

**Analysis:**
- **Confidence:** High (automated detection of repeated failure)
- **Generated:** ${new Date().toISOString()}

---

*This issue was automatically created by the Vercel Build Analyzer after detecting 3+ similar failures.*`;

      const issue: GitHubIssue = {
        title: issueTitle,
        body: issueBody,
        labels: ['bug', 'build-failure', 'automated'],
      };

      const response = await fetch(`https://api.github.com/repos/${this.env.GITHUB_REPO}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${this.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json',
        },
        body: JSON.stringify(issue),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const createdIssue: GitHubCreateIssueResponse = await response.json();
      console.log(`🐙 GitHub issue created: ${createdIssue.html_url}`);
      
    } catch (error) {
      console.error('Error creating GitHub issue:', error);
    }
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
      const savedFilePath = await this.saveBuildLogs(failedDeployment, buildLogs);

      // Step 4: Analyze with OpenAI
      const analysis = await this.analyzeBuildLogs(buildLogs);

      // Step 5: Save complete analysis to logs directory
      const completeAnalysis: AnalyzedBuildFailure = {
        deployment: failedDeployment,
        buildLogs,
        analysis,
        timestamp: new Date().toISOString(),
      };

      await fs.writeFile(savedFilePath, JSON.stringify(completeAnalysis, null, 2), 'utf-8');

      // Step 6: Track failure and check for repeated issues
      const isRepeatedFailure = await this.trackFailure(failedDeployment, analysis);

      // Step 7: Create GitHub issue if repeated failure detected
      if (isRepeatedFailure) {
        await this.createGitHubIssue(failedDeployment, analysis);
      }

      // Step 8: Print enhanced summary
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