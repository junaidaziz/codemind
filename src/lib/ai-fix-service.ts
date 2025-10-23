import { aiModelService } from './ai-model-service';
import { GitHubService } from './github-service';
import { AnalyticsTracker } from './analytics-tracker';
import prisma from '../app/lib/db';

interface FixContext {
  issueTitle: string;
  issueBody: string;
  labels: string[];
  repository: {
    owner: string;
    name: string;
    language?: string;
  };
  relatedFiles?: string[];
}

interface FixSuggestion {
  confidence: number;
  description: string;
  changes: Array<{
    filePath: string;
    content: string;
    explanation: string;
  }>;
  testSuggestions?: string[];
  prTitle: string;
  prDescription: string;
}

export class AIFixService {
  private githubService: GitHubService;
  private projectId?: string;
  private userId?: string;

  constructor(openaiApiKey: string, githubAccessToken: string, projectId?: string, userId?: string) {
    // AI model service is now used instead of direct OpenAI client
    this.githubService = new GitHubService(githubAccessToken);
    this.projectId = projectId;
    this.userId = userId;
  }

  /**
   * Analyze an issue and generate AI fix suggestions
   */
  async analyzeIssue(issueId: string): Promise<FixSuggestion | null> {
    const startTime = Date.now();
    
    try {
      // Track analytics event - AI fix started
      await AnalyticsTracker.trackEvent({
        eventType: 'ai_fix_started',
        projectId: '', // Will be filled after we get the project
        issueId,
        metadata: {
          timestamp: new Date(),
        },
      });

      // Get issue from database
      const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        include: { Project: true },
      });

      if (!issue) {
        throw new Error(`Issue ${issueId} not found`);
      }

      // Extract repository info from GitHub URL
      const repoMatch = issue.Project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!repoMatch) {
        throw new Error('Invalid GitHub URL format');
      }

      const [, owner, repo] = repoMatch;

      // Build context for AI analysis
      const context: FixContext = {
        issueTitle: issue.title,
        issueBody: issue.body || '',
        labels: Array.isArray(issue.labels) 
          ? (issue.labels as Array<string | { name: string }>).map(label => typeof label === 'string' ? label : label.name)
          : [],
        repository: {
          owner,
          name: repo.replace('.git', ''),
        },
      };

      // Identify relevant files based on issue content
      context.relatedFiles = await this.identifyRelatedFiles(context);

      // Generate fix suggestions using OpenAI
      const fixSuggestion = await this.generateFixSuggestion(context, owner, repo);

      // Track successful analysis
      const timeTaken = (Date.now() - startTime) / 1000; // Convert to seconds
      await AnalyticsTracker.trackAIFixSession({
        projectId: issue.Project.id,
        issueId,
        confidence: fixSuggestion?.confidence || 0,
        timeTaken,
        success: fixSuggestion !== null,
        errorMessage: fixSuggestion === null ? 'Failed to generate fix suggestion' : undefined,
      });

      return fixSuggestion;
    } catch (error) {
      // Track failed analysis
      const timeTaken = (Date.now() - startTime) / 1000;
      await AnalyticsTracker.trackAIFixSession({
        projectId: '', // May not have project info in error case
        issueId,
        confidence: 0,
        timeTaken,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }).catch(trackingError => {
        console.warn('Failed to track analytics:', trackingError);
      });

      console.error('Error analyzing issue:', error);
      throw new Error(`Failed to analyze issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate and apply AI fix for an issue
   */
  async generateAndApplyFix(issueId: string): Promise<{
    pullRequestUrl: string;
    branchName: string;
    confidence: number;
  }> {
    try {
      const fixSuggestion = await this.analyzeIssue(issueId);
      
      if (!fixSuggestion || fixSuggestion.confidence < 0.6) {
        throw new Error(`Confidence too low (${fixSuggestion?.confidence || 0}) to auto-generate fix`);
      }

      // Get issue details
      const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        include: { Project: true },
      });

      if (!issue) {
        throw new Error(`Issue ${issueId} not found`);
      }

      const repoMatch = issue.Project.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!repoMatch) {
        throw new Error('Invalid GitHub URL format');
      }

      const [, owner, repo] = repoMatch;
      const repoName = repo.replace('.git', '');

      // Create branch name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const branchName = `ai-fix/issue-${issue.number}-${timestamp}`;

      // Create new branch
      await this.githubService.createBranch(owner, repoName, branchName);

      // Apply changes to the branch
      await this.githubService.commitChanges(
        owner,
        repoName,
        branchName,
        fixSuggestion.changes.map(change => ({
          path: change.filePath,
          content: change.content,
          message: change.explanation,
        })),
        `AI Fix: ${fixSuggestion.prTitle}\n\nResolves #${issue.number}\n\n${fixSuggestion.description}`
      );

      // Create pull request
      const pullRequest = await this.githubService.createFixPullRequest(owner, repoName, {
        title: fixSuggestion.prTitle,
        body: this.generatePRBody(fixSuggestion, issue.number),
        head: branchName,
        base: 'main',
        draft: fixSuggestion.confidence < 0.8, // Mark as draft if confidence is not very high
      });

      // Track PR creation event
      await AnalyticsTracker.trackPullRequestEvent({
        projectId: issue.Project.id,
        pullRequestId: pullRequest.number.toString(),
        issueId,
        eventType: 'pr_created',
        metadata: {
          confidence: fixSuggestion.confidence,
          isDraft: fixSuggestion.confidence < 0.8,
          prUrl: pullRequest.html_url,
          title: fixSuggestion.prTitle,
        },
      });

      // Note: AI fix PR created (reference stored in AutoFixSession if needed)

      // Add comment to issue
      await this.githubService.addIssueComment(
        owner,
        repoName,
        issue.number,
        `🤖 **AI Fix Generated**\n\nI've analyzed this issue and generated a potential fix with ${(fixSuggestion.confidence * 100).toFixed(1)}% confidence.\n\n**Pull Request**: ${pullRequest.html_url}\n\nPlease review the changes and test thoroughly before merging.`
      );

      // Add AI-fix label
      await this.githubService.addIssueLabels(owner, repoName, issue.number, ['ai-fix-generated']);

      return {
        pullRequestUrl: pullRequest.html_url,
        branchName,
        confidence: fixSuggestion.confidence,
      };
    } catch (error) {
      console.error('Error generating and applying fix:', error);
      throw new Error(`Failed to generate and apply fix: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async identifyRelatedFiles(context: FixContext): Promise<string[]> {
    // Note: owner and repo parameters were unused and removed
    const relatedFiles: string[] = [];

    // Use AI to identify potentially relevant files based on issue content
    try {
      const completion = await aiModelService.chatCompletion({
        projectId: this.projectId,
        userId: this.userId,
        operation: 'identify-fix-files',
        messages: [
          {
            role: 'system',
            content: `You are a code analysis expert. Given an issue description, identify the most likely files that would need to be modified to fix it. Return only file paths, one per line, focusing on the most relevant files (max 5).`,
          },
          {
            role: 'user',
            content: `Issue Title: ${context.issueTitle}\n\nIssue Description: ${context.issueBody}\n\nLabels: ${context.labels.join(', ')}\n\nRepository: ${context.repository.owner}/${context.repository.name}`,
          },
        ],
        maxTokens: 200,
        temperature: 0.3,
      });

      const suggestedFiles = completion.content?.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.includes('.'))
        .slice(0, 5) || [];

      relatedFiles.push(...suggestedFiles);
    } catch (error) {
      console.error('Error identifying related files:', error);
    }

    return relatedFiles;
  }

  private async generateFixSuggestion(context: FixContext, owner: string, repo: string): Promise<FixSuggestion> {
    // Get file contents for context
    const fileContents: Array<{ path: string; content: string }> = [];
    
    for (const filePath of context.relatedFiles || []) {
      try {
        const fileContent = await this.githubService.getFileContent(owner, repo, filePath);
        fileContents.push({
          path: filePath,
          content: fileContent.content,
        });
      } catch {
        console.log(`Could not fetch file ${filePath}, skipping...`);
      }
    }

    const completion = await aiModelService.chatCompletion({
      projectId: this.projectId,
      userId: this.userId,
      operation: 'generate-fix-suggestion',
      messages: [
        {
          role: 'system',
          content: `You are a senior software engineer specializing in automated code fixes. Analyze the given issue and provide a comprehensive solution.

CRITICAL REQUIREMENTS:
1. Only modify existing files, never create new ones
2. Provide complete file content, not just snippets
3. Ensure all syntax is correct and maintainable
4. Rate your confidence (0.0-1.0) honestly based on issue clarity and solution complexity
5. Focus on minimal, targeted changes

Response format (JSON):
{
  "confidence": 0.85,
  "description": "Clear explanation of the fix",
  "changes": [
    {
      "filePath": "src/example.ts",
      "content": "complete file content here",
      "explanation": "What was changed and why"
    }
  ],
  "testSuggestions": ["Test case descriptions"],
  "prTitle": "Fix: Brief description",
  "prDescription": "Detailed PR description with context"
}`,
        },
        {
          role: 'user',
          content: `
ISSUE ANALYSIS:
Title: ${context.issueTitle}
Description: ${context.issueBody}
Labels: ${context.labels.join(', ')}
Repository: ${context.repository.owner}/${context.repository.name}

RELATED FILES:
${fileContents.map(f => `
--- ${f.path} ---
${f.content}
`).join('\n')}

Generate a fix for this issue.`,
        },
      ],
      maxTokens: 4000,
      temperature: 0.2,
    });

    const responseContent = completion.content;
    if (!responseContent) {
      throw new Error('No response from AI service');
    }

    try {
      const fixSuggestion = JSON.parse(responseContent) as FixSuggestion;
      
      // Validate the response
      if (!fixSuggestion.confidence || !fixSuggestion.changes || !fixSuggestion.description) {
        throw new Error('Invalid fix suggestion format');
      }

      return fixSuggestion;
    } catch (error) {
      console.error('Error parsing AI response:', responseContent);
      throw new Error(`Failed to parse AI fix suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generatePRBody(fixSuggestion: FixSuggestion, issueNumber: number): string {
    return `## 🤖 AI-Generated Fix

**Resolves:** #${issueNumber}
**Confidence:** ${(fixSuggestion.confidence * 100).toFixed(1)}%

### Description
${fixSuggestion.prDescription}

### Changes Made
${fixSuggestion.changes.map(change => 
  `- **${change.filePath}**: ${change.explanation}`
).join('\n')}

${fixSuggestion.testSuggestions && fixSuggestion.testSuggestions.length > 0 ? `
### Suggested Tests
${fixSuggestion.testSuggestions.map(test => `- ${test}`).join('\n')}
` : ''}

### ⚠️ Review Required
This is an AI-generated fix. Please:
- [ ] Review all code changes carefully
- [ ] Test the changes locally
- [ ] Ensure no breaking changes
- [ ] Verify the fix addresses the original issue

---
*Generated by CodeMind AI*`;
  }
}

export default AIFixService;