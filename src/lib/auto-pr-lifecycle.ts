/**
 * Full Auto-PR Lifecycle System (Agentic Workflow)
 * 
 * Autonomous PR creation with:
 * - Pre-PR validation (lint, test, type-check)
 * - AI code review and analysis
 * - Self-healing retry mechanism
 * - Complete audit trail
 * - CI feedback integration
 */

import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import prisma from '@/lib/db';
import { env } from '@/types/env';
import { runValidationSimulation } from './validation-runner';

export interface AutoFixContext {
  projectId: string;
  userId: string;
  issueDescription: string;
  filePaths?: string[];
  targetFiles?: string[];
}

export interface ValidationResult {
  passed: boolean;
  typecheck: { success: boolean; output: string; duration: number };
  lint: { success: boolean; output: string; duration: number };
  tests: { success: boolean; output: string; duration: number };
  allPassed: boolean;
}

export interface AIReviewComment {
  file: string;
  line?: number;
  severity: 'critical' | 'warning' | 'suggestion';
  category: 'performance' | 'security' | 'maintainability' | 'correctness' | 'style';
  message: string;
  suggestion?: string;
  reasoning: string;
}

export interface AutoFixAttempt {
  attemptNumber: number;
  timestamp: Date;
  codeChanges: string;
  validationResult: ValidationResult;
  aiReview: AIReviewComment[];
  success: boolean;
  failureReason?: string;
}

export interface AutoFixHistory {
  sessionId: string;
  projectId: string;
  issueDescription: string;
  attempts: AutoFixAttempt[];
  finalStatus: 'success' | 'failed' | 'manual_intervention_required';
  prNumber?: number;
  prUrl?: string;
  totalAttempts: number;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Main Auto-PR Lifecycle Orchestrator
 */
export class AutoPRLifecycle {
  private openai: OpenAI;
  private octokit: Octokit;
  private maxRetries = 3;
  private history: AutoFixHistory;

  constructor(
    private context: AutoFixContext,
    private githubToken: string,
    private owner: string,
    private repo: string
  ) {
    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.octokit = new Octokit({ auth: githubToken });
    
    this.history = {
      sessionId: this.generateSessionId(),
      projectId: context.projectId,
      issueDescription: context.issueDescription,
      attempts: [],
      finalStatus: 'failed',
      totalAttempts: 0,
      createdAt: new Date()
    };
  }

  /**
   * Execute the full autonomous PR lifecycle
   */
  async execute(): Promise<AutoFixHistory> {
    console.log(`🚀 Starting Auto-PR Lifecycle for: ${this.context.issueDescription}`);
    
    let attempt = 1;
    let lastError: string | undefined;

    while (attempt <= this.maxRetries) {
      console.log(`\n📍 Attempt ${attempt}/${this.maxRetries}`);
      
      try {
        // Step 1: Analyze issue and generate fix
        const codeChanges = await this.analyzeAndGenerateFix(lastError);
        
        // Step 2: Run pre-PR validation
        const validationResult = await this.runPrePRValidation(codeChanges);
        
        // Step 3: AI code review
        const aiReview = await this.performAICodeReview(codeChanges);
        
        // Record attempt
        const attemptRecord: AutoFixAttempt = {
          attemptNumber: attempt,
          timestamp: new Date(),
          codeChanges,
          validationResult,
          aiReview,
          success: validationResult.allPassed,
          failureReason: validationResult.allPassed ? undefined : this.summarizeValidationFailures(validationResult)
        };
        
        this.history.attempts.push(attemptRecord);
        this.history.totalAttempts = attempt;
        
        // Step 4: Check if validation passed
        if (validationResult.allPassed) {
          console.log('✅ Validation passed! Creating PR...');
          
          // Step 5: Create PR with all context
          const prResult = await this.createEnhancedPR(codeChanges, aiReview, validationResult);
          
          this.history.prNumber = prResult.number;
          this.history.prUrl = prResult.url;
          this.history.finalStatus = 'success';
          this.history.completedAt = new Date();
          
          // Step 6: Store history in database
          await this.storeHistory();
          
          console.log(`🎉 Auto-PR created successfully: ${prResult.url}`);
          return this.history;
        }
        
        // Step 5: Self-healing - ask AI to fix validation failures
        console.log('⚠️  Validation failed. Attempting self-healing...');
        lastError = this.formatValidationErrorsForAI(validationResult);
        
        attempt++;
        
      } catch (error) {
        console.error(`❌ Error in attempt ${attempt}:`, error);
        lastError = error instanceof Error ? error.message : String(error);
        attempt++;
      }
    }
    
    // All retries exhausted
    console.log('❌ Max retries exhausted. Manual intervention required.');
    this.history.finalStatus = 'manual_intervention_required';
    this.history.completedAt = new Date();
    
    // Create PR anyway with warnings
    try {
      const lastAttempt = this.history.attempts[this.history.attempts.length - 1];
      if (lastAttempt) {
        const prResult = await this.createFailedPR(lastAttempt);
        this.history.prNumber = prResult.number;
        this.history.prUrl = prResult.url;
      }
    } catch (error) {
      console.error('Failed to create fallback PR:', error);
    }
    
    await this.storeHistory();
    return this.history;
  }

  /**
   * Step 1: Analyze issue and generate code fix
   */
  private async analyzeAndGenerateFix(previousError?: string): Promise<string> {
    const systemPrompt = `You are a senior software engineer specializing in debugging and code fixes.
Analyze the issue and generate specific, production-ready code changes.
Focus on: correctness, performance, security, and maintainability.

${previousError ? `IMPORTANT: Previous attempt failed with:\n${previousError}\n\nPlease address these issues in your fix.` : ''}`;

    const userPrompt = `Issue to fix: ${this.context.issueDescription}

${this.context.filePaths ? `Focus on these files: ${this.context.filePaths.join(', ')}` : ''}

Provide a complete fix with:
1. Root cause analysis
2. Specific code changes (file paths and complete code)
3. Explanation of the fix
4. Potential side effects
5. Testing recommendations

Format as JSON:
{
  "rootCause": "detailed analysis",
  "fixes": [
    {
      "file": "path/to/file.ts",
      "changes": "description of changes",
      "code": "complete updated code",
      "reasoning": "why this fixes the issue"
    }
  ],
  "explanation": "overall explanation",
  "sideEffects": ["potential issue 1", "potential issue 2"],
  "testingRecommendations": ["test case 1", "test case 2"]
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    return response.choices[0].message.content || '{}';
  }

  /**
   * Step 2: Run comprehensive pre-PR validation
   */
  private async runPrePRValidation(codeChanges: string): Promise<ValidationResult> {
    console.log('🔍 Running pre-PR validation...');
    
    // Parse code changes to extract file paths
    const changes = JSON.parse(codeChanges);
    const changedFiles = changes.fixes?.map((fix: { file: string }) => fix.file) || [];
    
    // Run validation using existing runner
    const validationSummary = await runValidationSimulation(changedFiles);
    
    const typecheckStep = validationSummary.steps.find(s => s.step === 'typecheck')!;
    const lintStep = validationSummary.steps.find(s => s.step === 'lint')!;
    const testStep = validationSummary.steps.find(s => s.step === 'tests')!;
    
    return {
      passed: validationSummary.allPassed,
      typecheck: {
        success: typecheckStep.success,
        output: typecheckStep.output,
        duration: typecheckStep.durationMs
      },
      lint: {
        success: lintStep.success,
        output: lintStep.output,
        duration: lintStep.durationMs
      },
      tests: {
        success: testStep.success,
        output: testStep.output,
        duration: testStep.durationMs
      },
      allPassed: validationSummary.allPassed
    };
  }

  /**
   * Step 3: AI-powered code review
   */
  private async performAICodeReview(codeChanges: string): Promise<AIReviewComment[]> {
    console.log('🤖 Performing AI code review...');
    
    const reviewPrompt = `Review this code fix for potential issues:

${codeChanges}

Analyze for:
1. Performance issues (N+1 queries, unnecessary loops, memory leaks)
2. Security vulnerabilities (injection, XSS, auth bypasses)
3. Maintainability concerns (code complexity, duplication)
4. Correctness issues (edge cases, error handling)
5. Style inconsistencies

Return JSON array of review comments:
[
  {
    "file": "path/to/file.ts",
    "line": 42,
    "severity": "critical|warning|suggestion",
    "category": "performance|security|maintainability|correctness|style",
    "message": "Brief description of the issue",
    "suggestion": "How to fix it",
    "reasoning": "Why this is an issue"
  }
]

If no issues found, return empty array.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a senior code reviewer with expertise in security, performance, and best practices.' },
        { role: 'user', content: reviewPrompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content || '{"comments": []}');
    return result.comments || [];
  }

  /**
   * Step 4: Create enhanced PR with all context
   */
  private async createEnhancedPR(
    codeChanges: string,
    aiReview: AIReviewComment[],
    validationResult: ValidationResult
  ): Promise<{ number: number; url: string }> {
    const changes = JSON.parse(codeChanges);
    const branchName = `autofix/${this.context.issueDescription.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}-${Date.now()}`;
    
    // Get default branch
    const { data: repoData } = await this.octokit.repos.get({
      owner: this.owner,
      repo: this.repo
    });
    
    const defaultBranch = repoData.default_branch;
    
    // Get latest commit
    const { data: refData } = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${defaultBranch}`
    });
    
    // Create branch
    await this.octokit.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branchName}`,
      sha: refData.object.sha
    });
    
    // Build comprehensive PR body
    const prBody = this.buildPRBody(changes, aiReview, validationResult);
    
    // Create PR
    const { data: pr } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: `🤖 Auto-fix: ${this.context.issueDescription.substring(0, 80)}`,
      body: prBody,
      head: branchName,
      base: defaultBranch,
      draft: false // Not draft since it passed all validations
    });
    
    // Add labels
    await this.octokit.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: pr.number,
      labels: ['auto-fix', 'ai-generated', 'validated']
    });
    
    // Post AI review comments if any
    if (aiReview.length > 0) {
      await this.postAIReviewComments(pr.number, aiReview);
    }
    
    // Store in database
    await prisma.pullRequest.create({
      data: {
        projectId: this.context.projectId,
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        state: 'OPEN',
        htmlUrl: pr.html_url,
        headBranch: branchName,
        baseBranch: defaultBranch,
        authorLogin: pr.user?.login || 'codemind-bot',
        authorUrl: pr.user?.html_url || '',
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        draft: false,
        isAiGenerated: true
      }
    });
    
    return { number: pr.number, url: pr.html_url };
  }

  /**
   * Build comprehensive PR description
   */
  private buildPRBody(
    changes: { rootCause: string; fixes: unknown[]; explanation: string; sideEffects?: string[]; testingRecommendations?: string[] },
    aiReview: AIReviewComment[],
    validationResult: ValidationResult
  ): string {
    const criticalIssues = aiReview.filter(r => r.severity === 'critical');
    const warnings = aiReview.filter(r => r.severity === 'warning');
    const suggestions = aiReview.filter(r => r.severity === 'suggestion');
    
    return `## 🤖 Autonomous Auto-Fix PR

**Issue:** ${this.context.issueDescription}

---

### 📋 Root Cause Analysis

${changes.rootCause}

---

### 🔧 Proposed Changes

${Array.isArray(changes.fixes) ? changes.fixes.map((fix: { file: string; changes: string; reasoning: string; code?: string }) => `
**\`${fix.file}\`**

${fix.changes}

*Reasoning:* ${fix.reasoning}

${fix.code ? `\`\`\`typescript\n${fix.code.substring(0, 500)}${fix.code.length > 500 ? '\n...(truncated)' : ''}\n\`\`\`` : ''}
`).join('\n\n') : 'No specific fixes provided'}

---

### 💭 Explanation

${changes.explanation}

---

### ✅ Pre-PR Validation Results

All validations passed before PR creation:

| Check | Status | Duration |
|-------|--------|----------|
| TypeScript | ${validationResult.typecheck.success ? '✅ Passed' : '❌ Failed'} | ${validationResult.typecheck.duration}ms |
| ESLint | ${validationResult.lint.success ? '✅ Passed' : '❌ Failed'} | ${validationResult.lint.duration}ms |
| Tests | ${validationResult.tests.success ? '✅ Passed' : '❌ Failed'} | ${validationResult.tests.duration}ms |

${!validationResult.allPassed ? `\n⚠️ **Validation Warnings:**\n${this.formatValidationOutput(validationResult)}` : ''}

---

### 🤖 AI Code Review

${criticalIssues.length > 0 ? `
#### 🔴 Critical Issues (${criticalIssues.length})
${criticalIssues.map(issue => `
- **${issue.file}${issue.line ? `:${issue.line}` : ''}** [\`${issue.category}\`]
  - ${issue.message}
  - *Reasoning:* ${issue.reasoning}
  ${issue.suggestion ? `- *Suggestion:* ${issue.suggestion}` : ''}
`).join('\n')}
` : ''}

${warnings.length > 0 ? `
#### ⚠️ Warnings (${warnings.length})
${warnings.map(issue => `
- **${issue.file}${issue.line ? `:${issue.line}` : ''}** [\`${issue.category}\`]
  - ${issue.message}
  ${issue.suggestion ? `- *Suggestion:* ${issue.suggestion}` : ''}
`).join('\n')}
` : ''}

${suggestions.length > 0 ? `
#### 💡 Suggestions (${suggestions.length})
${suggestions.map(issue => `
- **${issue.file}${issue.line ? `:${issue.line}` : ''}** [\`${issue.category}\`]
  - ${issue.message}
`).join('\n')}
` : ''}

${aiReview.length === 0 ? '✅ No issues detected by AI review' : ''}

---

### ⚠️ Potential Side Effects

${changes.sideEffects && changes.sideEffects.length > 0 ? changes.sideEffects.map(effect => `- ${effect}`).join('\n') : 'None identified'}

---

### 🧪 Testing Recommendations

${changes.testingRecommendations && changes.testingRecommendations.length > 0 ? changes.testingRecommendations.map(test => `- [ ] ${test}`).join('\n') : '- [ ] Manual testing recommended'}

---

### 📊 Auto-Fix Metadata

- **Session ID:** \`${this.history.sessionId}\`
- **Attempts:** ${this.history.totalAttempts}
- **Validation:** Pre-validated ✅
- **AI Review:** ${aiReview.length} comments
- **Status:** Ready for review

---

### 🔍 Review Checklist

- [ ] Code changes address the root cause
- [ ] No security vulnerabilities introduced
- [ ] Performance impact is acceptable
- [ ] Tests pass and coverage is adequate
- [ ] Documentation is updated if needed
- [ ] Critical AI review comments addressed

---

*🤖 This PR was autonomously generated by CodeMind's Auto-Fix system with full validation and AI review.*

*View full auto-fix history: \`/api/auto-fix/history/${this.history.sessionId}\`*`;
  }

  /**
   * Post AI review comments to PR
   */
  private async postAIReviewComments(prNumber: number, aiReview: AIReviewComment[]): Promise<void> {
    const criticalAndWarnings = aiReview.filter(r => r.severity === 'critical' || r.severity === 'warning');
    
    if (criticalAndWarnings.length === 0) return;
    
    const commentBody = `## 🤖 AI Code Review

${criticalAndWarnings.map(issue => {
  const emoji = issue.severity === 'critical' ? '🔴' : '⚠️';
  return `
### ${emoji} ${issue.severity.toUpperCase()}: ${issue.category}

**File:** \`${issue.file}\`${issue.line ? ` (Line ${issue.line})` : ''}

**Issue:** ${issue.message}

**Reasoning:** ${issue.reasoning}

${issue.suggestion ? `**Suggested Fix:**\n\`\`\`\n${issue.suggestion}\n\`\`\`` : ''}

---
`;
}).join('\n')}

*Generated by CodeMind AI Code Reviewer*`;

    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body: commentBody
    });
  }

  /**
   * Create PR for failed attempts (requires manual intervention)
   */
  private async createFailedPR(lastAttempt: AutoFixAttempt): Promise<{ number: number; url: string }> {
    const changes = JSON.parse(lastAttempt.codeChanges);
    const branchName = `autofix-failed/${this.context.issueDescription.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}-${Date.now()}`;
    
    const { data: repoData } = await this.octokit.repos.get({
      owner: this.owner,
      repo: this.repo
    });
    
    const defaultBranch = repoData.default_branch;
    const { data: refData } = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${defaultBranch}`
    });
    
    await this.octokit.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branchName}`,
      sha: refData.object.sha
    });
    
    const prBody = `## ⚠️ Auto-Fix Failed - Manual Intervention Required

**Issue:** ${this.context.issueDescription}

**Status:** Validation failed after ${this.history.totalAttempts} attempts

---

### ❌ Final Validation Results

| Check | Status | Output |
|-------|--------|--------|
| TypeScript | ${lastAttempt.validationResult.typecheck.success ? '✅' : '❌'} | ${lastAttempt.validationResult.typecheck.output.substring(0, 100)}... |
| ESLint | ${lastAttempt.validationResult.lint.success ? '✅' : '❌'} | ${lastAttempt.validationResult.lint.output.substring(0, 100)}... |
| Tests | ${lastAttempt.validationResult.tests.success ? '✅' : '❌'} | ${lastAttempt.validationResult.tests.output.substring(0, 100)}... |

---

### 🔄 Attempt History

${this.history.attempts.map((attempt, idx) => `
**Attempt ${idx + 1}:**
- Validation: ${attempt.validationResult.allPassed ? '✅ Passed' : '❌ Failed'}
${attempt.failureReason ? `- Reason: ${attempt.failureReason}` : ''}
`).join('\n')}

---

### 🔧 Last Proposed Changes

${changes.explanation}

---

**⚠️ This PR requires manual review and fixes before merging.**

*Session ID: \`${this.history.sessionId}\`*`;

    const { data: pr } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: `⚠️ Auto-fix failed: ${this.context.issueDescription.substring(0, 70)}`,
      body: prBody,
      head: branchName,
      base: defaultBranch,
      draft: true
    });
    
    await this.octokit.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: pr.number,
      labels: ['auto-fix-failed', 'needs-manual-intervention', 'ai-generated']
    });
    
    return { number: pr.number, url: pr.html_url };
  }

  /**
   * Store auto-fix history in database
   */
  private async storeHistory(): Promise<void> {
    await prisma.autoFixHistory.create({
      data: {
        sessionId: this.history.sessionId,
        projectId: this.history.projectId,
        issueDescription: this.history.issueDescription,
        attempts: JSON.stringify(this.history.attempts),
        finalStatus: this.history.finalStatus,
        prNumber: this.history.prNumber,
        prUrl: this.history.prUrl,
        totalAttempts: this.history.totalAttempts,
        createdAt: this.history.createdAt,
        completedAt: this.history.completedAt
      }
    });
  }

  /**
   * Helper: Generate unique session ID
   */
  private generateSessionId(): string {
    return `autofix-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Helper: Summarize validation failures
   */
  private summarizeValidationFailures(result: ValidationResult): string {
    const failures: string[] = [];
    
    if (!result.typecheck.success) failures.push('TypeScript errors');
    if (!result.lint.success) failures.push('ESLint errors');
    if (!result.tests.success) failures.push('Test failures');
    
    return failures.join(', ');
  }

  /**
   * Helper: Format validation errors for AI
   */
  private formatValidationErrorsForAI(result: ValidationResult): string {
    let errors = '';
    
    if (!result.typecheck.success) {
      errors += `TypeScript Errors:\n${result.typecheck.output}\n\n`;
    }
    if (!result.lint.success) {
      errors += `Lint Errors:\n${result.lint.output}\n\n`;
    }
    if (!result.tests.success) {
      errors += `Test Failures:\n${result.tests.output}\n\n`;
    }
    
    return errors;
  }

  /**
   * Helper: Format validation output for PR
   */
  private formatValidationOutput(result: ValidationResult): string {
    let output = '';
    
    if (!result.typecheck.success) {
      output += `**TypeScript:**\n\`\`\`\n${result.typecheck.output.substring(0, 200)}\n\`\`\`\n\n`;
    }
    if (!result.lint.success) {
      output += `**ESLint:**\n\`\`\`\n${result.lint.output.substring(0, 200)}\n\`\`\`\n\n`;
    }
    if (!result.tests.success) {
      output += `**Tests:**\n\`\`\`\n${result.tests.output.substring(0, 200)}\n\`\`\`\n\n`;
    }
    
    return output;
  }
}

/**
 * Convenience function to execute auto-fix lifecycle
 */
export async function executeAutoFixLifecycle(
  context: AutoFixContext,
  githubToken: string,
  owner: string,
  repo: string
): Promise<AutoFixHistory> {
  const lifecycle = new AutoPRLifecycle(context, githubToken, owner, repo);
  return await lifecycle.execute();
}
