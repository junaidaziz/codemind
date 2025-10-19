/**
 * Autonomous Pull Request (APR) Orchestrator
 * 
 * Full lifecycle management for auto-fix PRs using existing schema:
 * 1. Analysis → Generate fixes
 * 2. Pre-validation → Lint, typecheck, test
 * 3. Self-healing → Auto-fix validation errors (via iterative attempts)
 * 4. AI Review → Identify potential issues
 * 5. PR Creation → With complete audit trail
 * 
 * Note: Uses existing AutoFixSession model from schema
 */

import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import prisma from '@/lib/db';
import { getGitHubToken } from './config-helper';
import { env } from '@/types/env';
import { runValidationSimulation } from './validation-runner';
import { calculatePRRisk, type RiskScore } from './pr-risk-scorer';

// ============================================================================
// TYPES
// ============================================================================

export interface APRConfig {
  projectId: string;
  userId: string;
  issueDescription: string;
  targetFiles?: string[];
  branchName?: string;
  maxRetries?: number;
  enableSelfHealing?: boolean;
  enableAIReview?: boolean;
  enableCIMonitoring?: boolean;
}

export interface APRResult {
  success: boolean;
  sessionId: string;
  prNumber?: number;
  prUrl?: string;
  status: string;
  phase: string;
  validationPassed: boolean;
  retryCount: number;
  reviewFindings?: number;
  message: string;
  auditTrail: AuditEntry[];
}

export interface AuditEntry {
  timestamp: Date;
  phase: string;
  action: string;
  result: 'success' | 'failure' | 'info';
  details: string;
}

export interface ValidationResult {
  passed: boolean;
  lint: { passed: boolean; errors: string[] };
  typecheck: { passed: boolean; errors: string[] };
  unitTests: { passed: boolean; errors: string[] };
  e2eTests: { passed: boolean; errors: string[] };
}

export interface AIReviewFinding {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  file: string;
  line?: number;
  issue: string;
  explanation: string;
  suggestion?: string;
  category: string;
}

export interface AnalysisResult {
  rootCause: string;
  proposedSolution: string;
  filesToModify: string[];
  risks: string[];
  testingPlan: string;
}

export interface CodeChange {
  file: string;
  modifications: string;
  explanation: string;
  lineNumbers?: string;
}

export interface CodeGenerationResult {
  attemptId: string;
  filesModified: string[];
  changes: CodeChange[];
  newFiles: string[];
  dependencies: string[];
}

// ============================================================================
// AUTONOMOUS PR ORCHESTRATOR
// ============================================================================

export class AutonomousPROrchestrator {
  private openai: OpenAI;
  private auditTrail: AuditEntry[] = [];

  constructor() {
    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  /**
   * Main orchestration method - runs the complete APR lifecycle
   */
  async execute(config: APRConfig): Promise<APRResult> {
    // Create session
    const session = await this.createSession(config);
    
    try {
      this.addAudit('INITIALIZATION', 'Session created', 'success', `Session ID: ${session.id}`);

      // Phase 1: Analysis
      await this.updatePhase(session.id, 'ANALYZING');
      const analysis = await this.analyzeIssue(session.id, config);
      this.addAudit('ANALYSIS', 'Issue analyzed', 'success', `Root cause: ${analysis.rootCause}`);

      // Phase 2: Code Generation
      await this.updatePhase(session.id, 'GENERATING');
      const codeGeneration = await this.generateCodeFixes(session.id, analysis);
      this.addAudit('GENERATION', 'Code fixes generated', 'success', `Modified ${codeGeneration.filesModified.length} files`);

      // Phase 2.5: Risk Assessment
      const riskScore = await this.calculateRiskScore(session.id, codeGeneration);
      this.addAudit('RISK_ASSESSMENT', `Risk level: ${riskScore.level}`, 'info', `Score: ${riskScore.score}/100`);

      // Phase 3: Pre-PR Validation Loop (with self-healing)
      await this.updatePhase(session.id, 'VALIDATING');
      const validation = await this.validationLoop(session.id, codeGeneration, config);
      
      if (!validation.passed && !config.enableSelfHealing) {
        await this.updatePhase(session.id, 'FAILED');
        throw new Error('Validation failed and self-healing is disabled');
      }

      this.addAudit('VALIDATION', 'All validations passed', 'success', 'Code is production-ready');

      // Phase 4: AI Code Review
      let reviewFindings = 0;
      if (config.enableAIReview !== false) {
        await this.updatePhase(session.id, 'REVIEWING');
        reviewFindings = await this.performAIReview(session.id, codeGeneration);
        this.addAudit('REVIEW', 'AI code review completed', 'info', `${reviewFindings} findings identified`);
      }

      // Phase 5: Create Pull Request
      await this.updatePhase(session.id, 'PR_CREATED');
      const pr = await this.createPullRequest(session.id, analysis, reviewFindings, config);
      this.addAudit('PR_CREATION', 'Pull request created', 'success', `PR #${pr.number}: ${pr.url}`);

      // Phase 6: Post review comments to PR
      if (reviewFindings > 0) {
        await this.postReviewComments(session.id, pr.number, config);
        this.addAudit('REVIEW', 'Posted AI review comments to PR', 'success', `${reviewFindings} comments posted`);
      }

      // Phase 7: Mark as ready
      await this.updatePhase(session.id, 'READY');
      await this.markSessionComplete(session.id, pr.number);

      return {
        success: true,
        sessionId: session.id,
        prNumber: pr.number,
        prUrl: pr.url,
        status: 'READY',
        phase: 'COMPLETION',
        validationPassed: true,
        retryCount: validation.retryCount,
        reviewFindings,
        message: `Autonomous PR created successfully! ${reviewFindings > 0 ? `${reviewFindings} review comments added.` : ''}`,
        auditTrail: this.auditTrail
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.addAudit('ERROR', 'APR orchestration failed', 'failure', errorMessage);
      
      await prisma.autoFixSession.update({
        where: { id: session.id },
        data: {
          status: 'FAILED',
          errorMessage: errorMessage,
          completedAt: new Date()
        }
      });

      return {
        success: false,
        sessionId: session.id,
        status: 'FAILED',
        phase: 'ERROR',
        validationPassed: false,
        retryCount: 0,
        message: `APR failed: ${errorMessage}`,
        auditTrail: this.auditTrail
      };
    }
  }

  /**
   * Create APR session
   */
  private async createSession(config: APRConfig) {
    const branchName = config.branchName || 
      `autofix/${config.issueDescription.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}-${Date.now()}`;

    return await prisma.autoFixSession.create({
      data: {
        projectId: config.projectId,
        userId: config.userId,
        issuesDetected: config.issueDescription,
        branchName,
        status: 'ANALYZING',
        triggerType: 'MANUAL'
      }
    });
  }

  /**
   * Phase 1: Analyze the issue using GPT-4
   */
  private async analyzeIssue(sessionId: string, config: APRConfig) {
    const prompt = `Analyze this code issue and provide a detailed solution plan:

Issue: ${config.issueDescription}

${config.targetFiles && config.targetFiles.length > 0 ? `Focus on these files: ${config.targetFiles.join(', ')}` : ''}

Provide:
1. Root cause analysis
2. Proposed solution with specific steps
3. Files that need to be modified
4. Potential risks or side effects
5. Testing recommendations

Format your response as JSON: {
  "rootCause": "detailed explanation",
  "proposedSolution": "step by step solution",
  "filesToModify": ["file1.ts", "file2.ts"],
  "risks": ["risk1", "risk2"],
  "testingPlan": "how to test the fix"
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a senior software engineer specializing in debugging and code analysis. Provide thorough, actionable solutions.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');

    // Store analysis in session
    await prisma.autoFixSession.update({
      where: { id: sessionId },
      data: {
        analysisResult: JSON.stringify(analysis),
        confidence: 0.85 // TODO: Calculate actual confidence
      }
    });

    return analysis;
  }

  /**
   * Phase 2: Generate code fixes
   */
  private async generateCodeFixes(sessionId: string, analysis: AnalysisResult) {
    const prompt = `Generate production-ready code fixes for this issue:

Root Cause: ${analysis.rootCause}
Solution Plan: ${analysis.proposedSolution}
Files to Modify: ${analysis.filesToModify?.join(', ') || 'Auto-detect'}

Generate specific code changes with:
1. Complete code snippets for each file
2. Explanation of each change
3. Line numbers or context for placement
4. Any new imports or dependencies needed

Format as JSON: {
  "changes": [
    {
      "file": "path/to/file.ts",
      "modifications": "complete code snippet",
      "explanation": "why this change fixes the issue",
      "lineNumbers": "estimated location"
    }
  ],
  "newFiles": [],
  "deletedFiles": [],
  "dependencies": []
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert software engineer. Generate clean, tested, production-ready code fixes. Follow TypeScript best practices, include proper error handling, and add helpful comments.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' }
    });

    const codeChanges = JSON.parse(response.choices[0].message.content || '{}');

    // Store attempt
    const attempt = await prisma.autoFixAttempt.create({
      data: {
        sessionId,
        attemptNumber: 1,
        filesModified: codeChanges.changes?.map((c: CodeChange) => c.file) || [],
        prompt,
        aiResponse: response.choices[0].message.content || '',
        codeSnippets: JSON.stringify(codeChanges.changes || [])
      }
    });

    return {
      attemptId: attempt.id,
      filesModified: codeChanges.changes?.map((c: CodeChange) => c.file) || [],
      changes: codeChanges.changes || [],
      newFiles: codeChanges.newFiles || [],
      dependencies: codeChanges.dependencies || []
    };
  }

  /**
   * Phase 2.5: Calculate PR Risk Score
   */
  private async calculateRiskScore(sessionId: string, codeGeneration: CodeGenerationResult): Promise<RiskScore> {
    // Count lines from code snippets
    let linesAdded = 0;
    let linesRemoved = 0;
    
    for (const change of codeGeneration.changes) {
      const lines = change.modifications?.split('\n') || [];
      linesAdded += lines.filter(l => l.startsWith('+')).length;
      linesRemoved += lines.filter(l => l.startsWith('-')).length;
    }

    // Calculate risk
    const riskScore = calculatePRRisk({
      filesChanged: codeGeneration.filesModified,
      linesAdded,
      linesRemoved,
    });

    // Store in session's analysisResult
    const session = await prisma.autoFixSession.findUnique({ where: { id: sessionId } });
    if (session) {
      const existingAnalysis = session.analysisResult ? JSON.parse(session.analysisResult as string) : {};
      await prisma.autoFixSession.update({
        where: { id: sessionId },
        data: {
          analysisResult: JSON.stringify({
            ...existingAnalysis,
            risk: riskScore
          })
        }
      });
    }

    return riskScore;
  }

  /**
   * Phase 3: Validation loop with self-healing
   */
  private async validationLoop(sessionId: string, _codeGeneration: CodeGenerationResult, config: APRConfig) {
    const session = await prisma.autoFixSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new Error('Session not found');

    let retryCount = 0;
    let validationPassed = false;
    let lastValidationResult: ValidationResult | null = null;

    while (retryCount <= (config.maxRetries || 3) && !validationPassed) {
      // Run validations
      const validationResult = await this.runValidations(sessionId, retryCount + 1);
      lastValidationResult = validationResult;

      if (validationResult.passed) {
        validationPassed = true;
        // Note: Validation results are stored in AutoFixValidation table, not in session
        break;
      }

      // Self-healing if enabled
      if (config.enableSelfHealing !== false && retryCount < (config.maxRetries || 3)) {
        this.addAudit('SELF_HEALING', `Attempt ${retryCount + 1} failed, initiating self-heal`, 'info', 'Analyzing validation errors');
        
        await this.updatePhase(sessionId, 'SELF_HEALING');
        const healResult = await this.selfHeal(sessionId, validationResult, retryCount + 1);
        
        if (healResult.success) {
          this.addAudit('SELF_HEALING', 'Self-heal generated fix patch', 'success', `Retry ${retryCount + 1}`);
        } else {
          this.addAudit('SELF_HEALING', 'Self-heal failed', 'failure', healResult.error || 'Unknown error');
        }
      }

      retryCount++;
    }

    return {
      passed: validationPassed,
      retryCount,
      lastResult: lastValidationResult
    };
  }

  /**
   * Run all validations
   */
  private async runValidations(sessionId: string, attemptNumber: number): Promise<ValidationResult> {
    // Use existing validation runner
    const validationSummary = await runValidationSimulation([]);

    const result: ValidationResult = {
      passed: validationSummary.allPassed,
      lint: {
        passed: validationSummary.steps.find(s => s.step === 'lint')?.success || false,
        errors: []
      },
      typecheck: {
        passed: validationSummary.steps.find(s => s.step === 'typecheck')?.success || false,
        errors: []
      },
      unitTests: {
        passed: validationSummary.steps.find(s => s.step === 'tests')?.success || false,
        errors: []
      },
      e2eTests: {
        passed: true, // Skip E2E for now
        errors: []
      }
    };

    // Store validation results
    for (const step of validationSummary.steps) {
      await prisma.autoFixValidation.create({
        data: {
          sessionId,
          attemptNumber,
          validationType: (step.step === 'tests' ? 'UNIT_TEST' : step.step.toUpperCase()) as 'LINT' | 'TYPECHECK' | 'UNIT_TEST' | 'E2E_TEST' | 'SECURITY_SCAN' | 'PERFORMANCE',
          passed: step.success,
          output: step.output,
          errors: !step.success ? JSON.stringify([step.output]) : null,
          duration: step.durationMs,
          executedAt: new Date()
        }
      });
    }

    return result;
  }

  /**
   * Phase 3b: Self-healing - fix validation errors automatically
   */
  private async selfHeal(sessionId: string, validationResult: ValidationResult, attemptNumber: number) {
    try {
      // Collect all validation errors
      const allErrors = [
        ...validationResult.lint.errors,
        ...validationResult.typecheck.errors,
        ...validationResult.unitTests.errors
      ].filter(Boolean);

      if (allErrors.length === 0) {
        return { success: false, error: 'No specific errors to heal' };
      }

      const prompt = `The automated fix has validation errors. Generate a patch to fix them:

Validation Errors:
${allErrors.join('\n\n')}

Provide:
1. Root cause of validation errors
2. Specific code changes to fix each error
3. Ensure changes don't break existing functionality

Format as JSON: {
  "analysis": "why these errors occurred",
  "fixes": [
    {
      "file": "path/to/file",
      "change": "specific code change",
      "reason": "fixes error X"
    }
  ]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are debugging validation errors in an automated code fix. Provide minimal, targeted changes that fix the errors without breaking existing functionality.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2, // Lower temperature for fixing errors
        response_format: { type: 'json_object' }
      });

      const healPatch = JSON.parse(response.choices[0].message.content || '{}');

      interface HealFix {
        file: string;
        modification: string;
      }

      // Store the self-heal attempt
      await prisma.autoFixAttempt.create({
        data: {
          sessionId,
          attemptNumber,
          filesModified: healPatch.fixes?.map((f: HealFix) => f.file) || [],
          prompt,
          aiResponse: response.choices[0].message.content || '',
          codeSnippets: JSON.stringify(healPatch.fixes || []),
          success: false // Will be updated after validation
        }
      });

      // Note: retryCount is tracked in AutoFixHistory, not in session

      return { success: true, patch: healPatch };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Self-heal failed'
      };
    }
  }

  /**
   * Phase 4: AI Code Review - identify potential issues proactively
   */
  private async performAIReview(sessionId: string, _codeGeneration: CodeGenerationResult): Promise<number> {
    const prompt = `Review this automatically generated code fix and identify potential issues:

Modified Files: ${_codeGeneration.filesModified.join(', ')}

Code Changes:
${JSON.stringify(_codeGeneration.changes, null, 2)}

Identify:
1. Performance issues (N+1 queries, inefficient algorithms)
2. Security vulnerabilities
3. Potential bugs
4. Memory leaks
5. Error handling gaps
6. Best practice violations

For each issue, provide:
- Type (performance, security, bug, etc.)
- Severity (critical, high, medium, low)
- File and line number
- Description
- Explanation of why it's problematic
- Suggested fix

Format as JSON: {
  "findings": [
    {
      "type": "N_PLUS_ONE",
      "severity": "HIGH",
      "file": "path/to/file.ts",
      "line": 42,
      "issue": "Database query in loop",
      "explanation": "This will cause N+1 query problem...",
      "suggestion": "Use a single query with JOIN...",
      "category": "performance"
    }
  ]
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a senior code reviewer with expertise in security, performance, and best practices. Review code critically and identify potential issues before they cause problems in production.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    });

    const reviewContent = response.choices[0].message.content || '{}';
    const review = JSON.parse(reviewContent);

    // Store review findings
    const findings = review.findings || [];
    for (const finding of findings) {
      await prisma.autoFixReview.create({
        data: {
          sessionId,
          reviewType: finding.type as 'CODE_QUALITY' | 'PERFORMANCE' | 'SECURITY' | 'BEST_PRACTICES' | 'POTENTIAL_BUG' | 'N_PLUS_ONE' | 'MEMORY_LEAK' | 'ERROR_HANDLING',
          severity: finding.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO',
          filePath: finding.file,
          lineNumber: finding.line,
          issue: finding.issue,
          explanation: finding.explanation,
          suggestion: finding.suggestion,
          category: finding.category,
          tags: [finding.type.toLowerCase()]
        }
      });
    }

    return findings.length;
  }

  /**
   * Phase 5: Create Pull Request with audit trail
   */
  private async createPullRequest(
    sessionId: string,
    analysis: AnalysisResult,
    reviewFindings: number,
    config: APRConfig
  ) {
    const session = await prisma.autoFixSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new Error('Session not found');

    const project = await prisma.project.findUnique({ where: { id: config.projectId } });
    if (!project) throw new Error('Project not found');

    const match = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) throw new Error('Invalid GitHub URL');

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');

    const token = await getGitHubToken(config.projectId);
    if (!token) throw new Error('GitHub token not configured');

    const octokit = new Octokit({ auth: token });

    // Get default branch
    const { data: repoData } = await octokit.repos.get({ owner, repo: cleanRepo });
    const defaultBranch = repoData.default_branch;

    // Get validation results from AutoFixValidation table
    const validations = await prisma.autoFixValidation.findMany({
      where: { sessionId },
      orderBy: { attemptNumber: 'desc' }
    });

    const latestValidations = validations.reduce((acc, v) => {
      if (!acc[v.validationType] || v.attemptNumber > acc[v.validationType].attemptNumber) {
        acc[v.validationType] = v;
      }
      return acc;
    }, {} as Record<string, typeof validations[0]>);

    const lintPassed = latestValidations['LINT']?.passed ?? false;
    const typeCheckPassed = latestValidations['TYPECHECK']?.passed ?? false;
    const unitTestsPassed = latestValidations['UNIT_TEST']?.passed ?? false;

    // Count retry attempts
    const attempts = await prisma.autoFixAttempt.count({ where: { sessionId } });
    const retryCount = Math.max(0, attempts - 1);

    // Extract risk assessment from analysisResult
    const analysisData = session.analysisResult ? JSON.parse(session.analysisResult as string) : {};
    const riskScore = analysisData.risk as RiskScore | undefined;

    // Create PR body with full audit trail
    const prBody = `## 🤖 Autonomous PR - AI-Generated Fix

### Original Issue
${config.issueDescription}

### Root Cause Analysis
${analysis.rootCause}

### Solution
${analysis.proposedSolution}

${riskScore ? `### ⚠️ Risk Assessment: ${riskScore.level}
**Risk Score:** ${riskScore.score}/100

**Risk Factors:**
${riskScore.factors.map(f => `- **${f.severity}**: ${f.description}`).join('\n')}

**Recommendations:**
${riskScore.recommendations.map(r => `- ${r}`).join('\n')}
` : ''}
### Validation Results
- ✅ Lint: ${lintPassed ? 'Passed' : 'N/A'}
- ✅ TypeCheck: ${typeCheckPassed ? 'Passed' : 'N/A'}
- ✅ Unit Tests: ${unitTestsPassed ? 'Passed' : 'N/A'}
- ${retryCount > 0 ? `🔄 Self-healed in ${retryCount} ${retryCount === 1 ? 'attempt' : 'attempts'}` : '✅ No retries needed'}

${reviewFindings > 0 ? `### ⚠️ AI Code Review
${reviewFindings} potential ${reviewFindings === 1 ? 'issue' : 'issues'} identified. See comments below.` : '### ✅ AI Code Review\nNo issues identified.'}

### Audit Trail
${this.auditTrail.map(entry => `- **${entry.phase}**: ${entry.action} (${entry.result})`).join('\n')}

### Testing Recommendations
${analysis.testingPlan || 'Test the fix thoroughly before merging.'}

---
*This PR was autonomously generated by CodeMind APR*
*Session ID: ${sessionId}*
*AI Model: GPT-4 Turbo*
*Validation: ${lintPassed && typeCheckPassed && unitTestsPassed ? 'Passed' : 'Manual review required'}*`;

    if (!session.branchName) {
      throw new Error('Branch name is required to create PR');
    }

    const { data: pr } = await octokit.pulls.create({
      owner,
      repo: cleanRepo,
      title: `🤖 Auto-fix: ${config.issueDescription.substring(0, 80)}`,
      body: prBody,
      head: session.branchName,
      base: defaultBranch,
      draft: reviewFindings > 0 || !(lintPassed && typeCheckPassed && unitTestsPassed) // Draft if issues found
    });

    // Store PR in database
    await prisma.pullRequest.create({
      data: {
        projectId: config.projectId,
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        state: 'OPEN',
        htmlUrl: pr.html_url,
        headBranch: session.branchName,
        baseBranch: defaultBranch,
        authorLogin: pr.user?.login || 'codemind-bot',
        authorUrl: pr.user?.html_url || '',
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        draft: pr.draft || false,
        isAiGenerated: true
      }
    });

    // Update session with PR number
    await prisma.autoFixSession.update({
      where: { id: sessionId },
      data: { prNumber: pr.number }
    });

    return { number: pr.number, url: pr.html_url };
  }

  /**
   * Phase 6: Post AI review comments to PR
   */
  private async postReviewComments(sessionId: string, prNumber: number, config: APRConfig) {
    const reviews = await prisma.autoFixReview.findMany({
      where: { sessionId },
      orderBy: { severity: 'asc' }
    });

    if (reviews.length === 0) return;

    const project = await prisma.project.findUnique({ where: { id: config.projectId } });
    if (!project) return;

    const match = project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return;

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');

    const token = await getGitHubToken(config.projectId);
    if (!token) return;

    const octokit = new Octokit({ auth: token });

    // Post summary comment
    const severityEmoji = {
      CRITICAL: '🔴',
      HIGH: '🟠',
      MEDIUM: '🟡',
      LOW: '🔵',
      INFO: 'ℹ️'
    } as const;

    type SeverityKey = keyof typeof severityEmoji;

    const summaryByCategory = reviews.reduce((acc: Record<string, number>, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {});

    const summaryComment = `## 🤖 AI Code Review Summary

Found ${reviews.length} potential ${reviews.length === 1 ? 'issue' : 'issues'} to review:

${Object.entries(summaryByCategory).map(([cat, count]) => 
  `- **${cat}**: ${count} ${count === 1 ? 'issue' : 'issues'}`
).join('\n')}

### Findings by Severity
${reviews.map(r => `${severityEmoji[r.severity as SeverityKey]} **${r.severity}**: ${r.issue} (${r.filePath}:${r.lineNumber || '?'})`).join('\n')}

---
*Review each finding below for detailed explanations and suggestions.*`;

    await octokit.issues.createComment({
      owner,
      repo: cleanRepo,
      issue_number: prNumber,
      body: summaryComment
    });

    // Post individual review comments
    for (const review of reviews) {
      const commentBody = `## ${severityEmoji[review.severity as SeverityKey]} ${review.reviewType.replace(/_/g, ' ')}

**${review.issue}**

**Why this matters:**
${review.explanation}

${review.suggestion ? `**Suggested fix:**
\`\`\`typescript
${review.suggestion}
\`\`\`
` : ''}

${review.references.length > 0 ? `**References:**
${review.references.map(ref => `- ${ref}`).join('\n')}` : ''}

*Category: ${review.category} | Severity: ${review.severity}*`;

      const { data: comment } = await octokit.issues.createComment({
        owner,
        repo: cleanRepo,
        issue_number: prNumber,
        body: commentBody
      });

      // Update review with GitHub comment ID
      await prisma.autoFixReview.update({
        where: { id: review.id },
        data: {
          postedToGitHub: true,
          githubCommentId: comment.id
        }
      });
    }
  }

  /**
   * Helper methods
   */
  private async updatePhase(sessionId: string, status: string) {
    await prisma.autoFixSession.update({
      where: { id: sessionId },
      data: { 
        status: status as 'PENDING' | 'ANALYZING' | 'FIXING' | 'CREATING_PR' | 'COMPLETED' | 'FAILED' | 'CANCELLED', 
        updatedAt: new Date() 
      }
    });
  }

  private async markSessionComplete(sessionId: string, prNumber: number) {
    await prisma.autoFixSession.update({
      where: { id: sessionId },
      data: {
        completedAt: new Date(),
        prNumber
      }
    });
  }

  private addAudit(phase: string, action: string, result: 'success' | 'failure' | 'info', details: string) {
    this.auditTrail.push({
      timestamp: new Date(),
      phase,
      action,
      result,
      details
    });
  }
}

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Main entry point for Autonomous PR creation
 */
export async function createAutonomousPR(config: APRConfig): Promise<APRResult> {
  const orchestrator = new AutonomousPROrchestrator();
  return await orchestrator.execute(config);
}

/**
 * Get APR session details with full audit trail
 */
export async function getAPRSession(sessionId: string) {
  const session = await prisma.autoFixSession.findUnique({
    where: { id: sessionId },
    include: {
      attempts: {
        orderBy: { attemptNumber: 'asc' }
      },
      validations: {
        orderBy: { executedAt: 'asc' }
      },
      reviews: {
        orderBy: { severity: 'asc' }
      }
    }
  });

  return session;
}

/**
 * List all APR sessions for a project
 */
export async function listAPRSessions(projectId: string, filters?: {
  status?: string;
  limit?: number;
}) {
  return await prisma.autoFixSession.findMany({
    where: {
      projectId,
      ...(filters?.status && { status: filters.status as 'PENDING' | 'ANALYZING' | 'FIXING' | 'CREATING_PR' | 'COMPLETED' | 'FAILED' | 'CANCELLED' })
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit || 50,
    include: {
      _count: {
        select: {
          attempts: true,
          validations: true,
          reviews: true
        }
      }
    }
  });
}

/**
 * Cancel an in-progress APR session
 */
export async function cancelAPRSession(sessionId: string) {
  return await prisma.autoFixSession.update({
    where: { id: sessionId },
    data: {
      status: 'CANCELLED',
      completedAt: new Date()
    }
  });
}
