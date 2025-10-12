#!/usr/bin/env ts-node

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

interface VercelDeploymentEventsResponse {
  builds: Array<{
    id: string;
    events: VercelBuildEvent[];
  }>;
}

// GitHub Actions API interfaces
interface GitHubWorkflowJob {
  id: number;
  run_id: number;
  workflow_name: string;
  head_branch: string;
  run_url: string;
  run_attempt: number;
  node_id: string;
  head_sha: string;
  url: string;
  html_url: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  started_at: string;
  completed_at: string | null;
  name: string;
  steps: GitHubWorkflowStep[];
  check_run_url: string;
  labels: string[];
  runner_id: number | null;
  runner_name: string | null;
  runner_group_id: number | null;
  runner_group_name: string | null;
}

interface GitHubWorkflowStep {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  number: number;
  started_at: string | null;
  completed_at: string | null;
}

interface GitHubJobsResponse {
  total_count: number;
  jobs: GitHubWorkflowJob[];
}

// Unified failure analysis types
type FailureSource = 'vercel' | 'github';

interface GitHubBuildFailure {
  source: 'github';
  workflow_run_id: number;
  job_id: number;
  job_name: string;
  logs: string;
  conclusion: string;
  head_sha: string;
  head_branch: string;
  workflow_name: string;
  html_url: string;
  started_at: string;
  completed_at: string | null;
}

interface VercelBuildFailure {
  source: 'vercel';
  deployment: VercelDeployment;
  buildLogs: string;
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

// Unified analysis report interface
interface UnifiedAnalysisReport {
  source: FailureSource;
  failure: GitHubBuildFailure | VercelBuildFailure;
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

      const data: VercelDeploymentEventsResponse = await response.json();
      
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
   * Fetch failed GitHub Actions workflow job logs
   */
  async getGitHubJobLogs(workflowRunId: number, jobId: number): Promise<string> {
    if (!this.env.GITHUB_TOKEN || !this.env.GITHUB_REPO) {
      throw new Error('GitHub integration not configured');
    }

    console.log(`🔍 Fetching GitHub Actions job logs for job ${jobId}...`);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.env.GITHUB_REPO}/actions/jobs/${jobId}/logs`,
        {
          headers: {
            'Authorization': `token ${this.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const logs = await response.text();
      console.log(`📝 Retrieved ${logs.length} characters of logs`);
      return logs;
    } catch (error) {
      console.error('Error fetching GitHub job logs:', error);
      throw error;
    }
  }

  /**
   * Get failed GitHub Actions workflow job details
   */
  async getFailedWorkflowJob(workflowRunId: number): Promise<GitHubWorkflowJob | null> {
    if (!this.env.GITHUB_TOKEN || !this.env.GITHUB_REPO) {
      throw new Error('GitHub integration not configured');
    }

    console.log(`🔍 Fetching GitHub Actions workflow jobs for run ${workflowRunId}...`);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.env.GITHUB_REPO}/actions/runs/${workflowRunId}/jobs`,
        {
          headers: {
            'Authorization': `token ${this.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data: GitHubJobsResponse = await response.json();
      
      // Find the first failed job
      const failedJob = data.jobs.find(job => job.conclusion === 'failure');
      
      if (!failedJob) {
        console.log('✅ No failed jobs found in workflow run');
        return null;
      }

      console.log(`❌ Found failed job: ${failedJob.name} (${failedJob.id})`);
      return failedJob;
    } catch (error) {
      console.error('Error fetching GitHub workflow jobs:', error);
      throw error;
    }
  }

  /**
   * Analyze GitHub build failure logs using OpenAI
   */
  async analyzeGitHubBuildFailure(failure: GitHubBuildFailure): Promise<{ summary: string; rootCause: string; suggestedFix: string; confidence: number; category: string }> {
    console.log('🤖 Analyzing GitHub build failure with AI...');

    const prompt = `Analyze this GitHub Actions build failure and provide a concise diagnosis:

**Workflow:** ${failure.workflow_name}
**Job:** ${failure.job_name}
**Branch:** ${failure.head_branch}
**Conclusion:** ${failure.conclusion}

**Build Logs:**
\`\`\`
${failure.logs.slice(-8000)} // Last 8k chars to stay within token limits
\`\`\`

Please analyze the failure and respond with a JSON object containing:
{
  "summary": "Brief one-line summary of the issue",
  "rootCause": "Detailed explanation of what caused the failure",
  "suggestedFix": "Specific actionable steps to fix the issue",
  "confidence": 0.85, // confidence level 0-1
  "category": "compilation_error|dependency_issue|test_failure|configuration_error|runtime_error|other"
}`;

    try {
      const messages: OpenAIMessage[] = [
        {
          role: 'system',
          content: 'You are an expert software engineer specializing in debugging build failures. Analyze build logs and provide precise, actionable solutions. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      const response = await fetch(this.openaiBaseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Cost-effective model
          messages,
          max_tokens: 1000,
          temperature: 0.1, // Low temperature for consistent analysis
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenAIResponse = await response.json();
      const analysis = JSON.parse(data.choices[0].message.content);
      
      console.log(`🎯 Analysis complete - Category: ${analysis.category}, Confidence: ${analysis.confidence}`);
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing GitHub build failure:', error);
      
      // Fallback analysis
      return {
        summary: 'Build failure analysis unavailable',
        rootCause: 'Could not analyze logs due to API error',
        suggestedFix: 'Please review the build logs manually and check for common issues like compilation errors, missing dependencies, or configuration problems.',
        confidence: 0.1,
        category: 'other'
      };
    }
  }

  /**
   * Create GitHub issue for GitHub Actions build failure
   */
  async createGitHubIssueForBuildFailure(failure: GitHubBuildFailure, analysis: { summary: string; rootCause: string; suggestedFix: string; confidence: number; category: string }): Promise<void> {
    if (!this.env.GITHUB_TOKEN || !this.env.GITHUB_REPO) {
      console.log('ℹ️  GitHub integration not configured - skipping issue creation');
      return;
    }

    console.log('🐙 Creating GitHub issue for build failure...');

    try {
      const issueTitle = `[Auto] Build Failure: ${analysis.summary}`;
      const issueBody = `## 🚨 Build Failure Detected

**Summary:** ${analysis.summary}

**Category:** ${analysis.category}

**Root Cause:**
${analysis.rootCause}

**Suggested Fix:**
${analysis.suggestedFix}

---

**Build Details:**
- **Workflow:** ${failure.workflow_name}
- **Job:** ${failure.job_name}
- **Branch:** ${failure.head_branch}
- **Commit:** ${failure.head_sha}
- **Failed At:** ${new Date(failure.started_at).toLocaleString()}
- **Run URL:** ${failure.html_url}

**Analysis:**
- **Confidence:** ${Math.round(analysis.confidence * 100)}%
- **Generated:** ${new Date().toISOString()}

---

*This issue was automatically created by the Build Analyzer after detecting a GitHub Actions build failure.*`;

      const issue: GitHubIssue = {
        title: issueTitle,
        body: issueBody,
        labels: ['bug', 'build-failure', 'ci-cd', 'automated'],
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
   * Analyze GitHub Actions build failure (main entry point for GitHub failures)
   */
  async analyzeGitHubFailure(workflowRunId: number, jobId?: number): Promise<void> {
    try {
      console.log('🔍 Starting GitHub Actions build failure analysis...\n');

      // Step 1: Get failed job details
      let failedJob: GitHubWorkflowJob | null;
      if (jobId) {
        // If specific job ID provided, fetch job details directly
        const jobsResponse = await fetch(
          `https://api.github.com/repos/${this.env.GITHUB_REPO}/actions/runs/${workflowRunId}/jobs`,
          {
            headers: {
              'Authorization': `token ${this.env.GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        );
        const jobsData: GitHubJobsResponse = await jobsResponse.json();
        failedJob = jobsData.jobs.find(job => job.id === jobId) || null;
      } else {
        // Find the first failed job
        failedJob = await this.getFailedWorkflowJob(workflowRunId);
      }

      if (!failedJob) {
        console.log('🎉 No failed jobs to analyze!');
        return;
      }

      // Step 2: Get job logs
      const logs = await this.getGitHubJobLogs(workflowRunId, failedJob.id);

      // Step 3: Create failure object
      const failure: GitHubBuildFailure = {
        source: 'github',
        workflow_run_id: workflowRunId,
        job_id: failedJob.id,
        job_name: failedJob.name,
        logs,
        conclusion: failedJob.conclusion || 'failure',
        head_sha: failedJob.head_sha,
        head_branch: failedJob.head_branch,
        workflow_name: failedJob.workflow_name,
        html_url: failedJob.html_url,
        started_at: failedJob.started_at,
        completed_at: failedJob.completed_at,
      };

      // Step 4: Analyze with AI
      const analysis = await this.analyzeGitHubBuildFailure(failure);

      // Step 5: Save analysis report
      const report: UnifiedAnalysisReport = {
        source: 'github',
        failure,
        analysis,
        timestamp: new Date().toISOString(),
      };
      await this.saveAnalysisReport(report);

      // Step 6: Generate AI analysis markdown
      await this.generateAnalysisMarkdown(report);

      // Step 7: Check if we should create GitHub issue (for repeated failures)
      const shouldCreateIssue = await this.shouldCreateGitHubIssue(failure, analysis);
      if (shouldCreateIssue) {
        await this.createGitHubIssueForBuildFailure(failure, analysis);
      }

      console.log('\n✅ GitHub Actions build failure analysis complete!');
    } catch (error) {
      console.error('Error analyzing GitHub failure:', error);
      throw error;
    }
  }

  /**
   * Save unified analysis report to logs directory
   */
  async saveAnalysisReport(report: UnifiedAnalysisReport): Promise<string> {
    const logsDir = join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });

    let filename: string;
    let sourceDetails: string;

    if (report.source === 'github') {
      const ghFailure = report.failure as GitHubBuildFailure;
      sourceDetails = `github-${ghFailure.workflow_run_id}-${ghFailure.job_id}`;
      filename = `build-failure-${sourceDetails}-${Date.now()}.json`;
    } else {
      const vercelFailure = report.failure as VercelBuildFailure;
      sourceDetails = vercelFailure.deployment.uid;
      filename = `build-failure-vercel-${sourceDetails}-${Date.now()}.json`;
    }

    const filePath = join(logsDir, filename);
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
    
    console.log(`💾 Analysis report saved: ${filename}`);
    return filePath;
  }

  /**
   * Check if we should create a GitHub issue based on failure frequency and severity
   */
  async shouldCreateGitHubIssue(
    failure: GitHubBuildFailure | VercelBuildFailure, 
    analysis: { summary: string; rootCause: string; suggestedFix: string; confidence: number; category: string }
  ): Promise<boolean> {
    // For now, create issues for high-confidence failures or critical categories
    const criticalCategories = ['compilation_error', 'dependency_issue', 'configuration_error'];
    const isHighConfidence = analysis.confidence > 0.7;
    const isCriticalCategory = criticalCategories.includes(analysis.category);

    return isHighConfidence || isCriticalCategory;
  }

  /**
   * Generate AI analysis markdown file
   */
  async generateAnalysisMarkdown(report: UnifiedAnalysisReport): Promise<string> {
    const logsDir = join(process.cwd(), 'logs');
    await fs.mkdir(logsDir, { recursive: true });

    let filename: string;
    let sourceSection: string;

    if (report.source === 'github') {
      const ghFailure = report.failure as GitHubBuildFailure;
      filename = `ai_analysis_github_${ghFailure.workflow_run_id}_${ghFailure.job_id}.md`;
      sourceSection = `## Build Details

- **Source:** GitHub Actions
- **Workflow:** ${ghFailure.workflow_name}
- **Job:** ${ghFailure.job_name}
- **Branch:** ${ghFailure.head_branch}
- **Commit:** ${ghFailure.head_sha}
- **Run ID:** ${ghFailure.workflow_run_id}
- **Job ID:** ${ghFailure.job_id}
- **Status:** ${ghFailure.conclusion}
- **Started:** ${new Date(ghFailure.started_at).toLocaleString()}
- **Completed:** ${ghFailure.completed_at ? new Date(ghFailure.completed_at).toLocaleString() : 'N/A'}
- **Run URL:** ${ghFailure.html_url}`;
    } else {
      const vercelFailure = report.failure as VercelBuildFailure;
      filename = `ai_analysis_vercel_${vercelFailure.deployment.uid}.md`;
      sourceSection = `## Deployment Details

- **Source:** Vercel
- **Deployment ID:** ${vercelFailure.deployment.uid}
- **URL:** ${vercelFailure.deployment.url || 'N/A'}
- **State:** ${vercelFailure.deployment.state}
- **Target:** ${vercelFailure.deployment.target || 'N/A'}
- **Created:** ${new Date(vercelFailure.deployment.createdAt).toLocaleString()}
- **State:** ${vercelFailure.deployment.state || 'N/A'}`;
    }

    const markdown = `# 🚨 Build Failure Analysis

**Generated:** ${new Date().toISOString()}

## Summary

${report.analysis.summary}

## Root Cause Analysis

${report.analysis.rootCause}

## Suggested Fix

${report.analysis.suggestedFix}

${sourceSection}

## Analysis Metadata

- **Category:** ${report.analysis.category}
- **Confidence:** ${Math.round(report.analysis.confidence * 100)}%
- **Analyzed by:** OpenAI GPT-4o-mini
- **Analysis Time:** ${report.timestamp}

---

*This analysis was automatically generated by the Build Analyzer.*
`;

    const filePath = join(logsDir, filename);
    await fs.writeFile(filePath, markdown, 'utf-8');
    
    console.log(`📄 AI analysis markdown saved: ${filename}`);
    return filePath;
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
  
  // Parse command line arguments for GitHub failure analysis
  const args = process.argv.slice(2);
  const githubRunId = args.find(arg => arg.startsWith('--github-run-id='))?.split('=')[1];
  const githubJobId = args.find(arg => arg.startsWith('--github-job-id='))?.split('=')[1];
  
  if (githubRunId) {
    // Analyze GitHub Actions failure
    const runId = parseInt(githubRunId, 10);
    const jobId = githubJobId ? parseInt(githubJobId, 10) : undefined;
    
    analyzer.analyzeGitHubFailure(runId, jobId).catch((error: Error) => {
      console.error('Fatal error analyzing GitHub failure:', error);
      process.exit(1);
    });
  } else {
    // Default to Vercel failure analysis
    analyzer.run().catch((error: Error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  }
}

export { VercelBuildAnalyzer };