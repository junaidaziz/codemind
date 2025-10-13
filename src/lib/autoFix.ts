// Auto Fix & Pull Request System for CodeMind
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { logger } from '../app/lib/logger';
import { env } from '../types/env';
import {
  GitHubAuthConfig,
  AutoFixConfig,
  AutoFixRepositoryInfo,
  FileChange,
  AutoFixResult,
  DetectedIssue,

  extractRepositoryInfo,
  GitHubAuthConfigSchema,
  AutoFixConfigSchema,
  FileChangeSchema,
  AutoFixResultSchema,
} from '../types/github';

/**
 * Enhanced GitHub API service with write access for auto-fix functionality
 */
export class GitHubAutoFixService {
  private octokit: Octokit;
  private config: AutoFixConfig;
  private authConfig: GitHubAuthConfig;

  constructor(config: Partial<AutoFixConfig> = {}) {
    // Set up authentication
    this.authConfig = this.setupAuthentication();
    this.octokit = this.createOctokitInstance();
    this.config = AutoFixConfigSchema.parse(config);

    logger.info('GitHubAutoFixService initialized', {
      authType: this.authConfig.type,
      config: {
        enabled: this.config.enabled,
        requireApproval: this.config.requireApproval,
        maxFixesPerHour: this.config.maxFixesPerHour,
      },
    });
  }

  /**
   * Setup GitHub authentication configuration
   */
  private setupAuthentication(): GitHubAuthConfig {
    // Try GitHub App authentication first
    if (env.GITHUB_APP_ID && env.GITHUB_PRIVATE_KEY && env.GITHUB_INSTALLATION_ID) {
      return GitHubAuthConfigSchema.parse({
        type: 'app',
        appId: env.GITHUB_APP_ID,
        privateKey: env.GITHUB_PRIVATE_KEY,
        installationId: env.GITHUB_INSTALLATION_ID,
      });
    }

    // Fall back to Personal Access Token
    if (env.GITHUB_TOKEN) {
      return GitHubAuthConfigSchema.parse({
        type: 'token',
        token: env.GITHUB_TOKEN,
      });
    }

    // Use existing OAuth token as fallback
    if (env.GITHUB_CLIENT_SECRET) {
      logger.warn('Using GitHub OAuth token for auto-fix - limited functionality');
      return GitHubAuthConfigSchema.parse({
        type: 'token',
        token: env.GITHUB_CLIENT_SECRET,
      });
    }

    throw new Error('No GitHub authentication configured for auto-fix functionality');
  }

  /**
   * Create Octokit instance with proper authentication
   */
  private createOctokitInstance(): Octokit {
    if (this.authConfig.type === 'app') {
      return new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: this.authConfig.appId!,
          privateKey: this.authConfig.privateKey!,
          installationId: this.authConfig.installationId!,
        },
        userAgent: 'CodeMind-AutoFix/1.0',
      });
    } else {
      return new Octokit({
        auth: this.authConfig.token!,
        userAgent: 'CodeMind-AutoFix/1.0',
      });
    }
  }

  /**
   * Get repository information from GitHub URL
   */
  private parseRepositoryUrl(githubUrl: string): AutoFixRepositoryInfo {
    const repoInfo = extractRepositoryInfo(githubUrl);
    
    return {
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      branch: 'main', // Default, will be updated with actual default branch
      fullName: repoInfo.fullName,
      cloneUrl: githubUrl,
    };
  }

  /**
   * Get the default branch for a repository
   */
  private async getDefaultBranch(owner: string, repo: string): Promise<string> {
    try {
      const { data: repository } = await this.octokit.repos.get({
        owner,
        repo,
      });
      return repository.default_branch || 'main';
    } catch (error) {
      logger.warn('Failed to get default branch, using "main"', {
        owner,
        repo,
        error: (error as Error).message,
      });
      return 'main';
    }
  }

  /**
   * Create a new branch for auto-fix changes
   */
  private async createFixBranch(
    repositoryInfo: AutoFixRepositoryInfo,
    issueType: string
  ): Promise<string> {
    const { owner, repo } = repositoryInfo;
    const defaultBranch = await this.getDefaultBranch(owner, repo);
    
    // Generate branch name
    const timestamp = Date.now();
    const branchName = `${this.config.branchPrefix}/${issueType}-${timestamp}`;

    // Get the SHA of the default branch
    const { data: ref } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });

    // Create new branch
    await this.octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });

    logger.info('Created auto-fix branch', {
      owner,
      repo,
      branchName,
      baseSha: ref.object.sha,
    });

    return branchName;
  }

  /**
   * Commit changes to the fix branch
   */
  private async commitChanges(
    repositoryInfo: AutoFixRepositoryInfo,
    branchName: string,
    changes: FileChange[],
    commitMessage: string
  ): Promise<string> {
    const { owner, repo } = repositoryInfo;

    try {
      // Get the current commit SHA from the branch
      const { data: ref } = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });

      // Get the tree SHA from the commit
      const { data: commit } = await this.octokit.git.getCommit({
        owner,
        repo,
        commit_sha: ref.object.sha,
      });

      // Create blobs for each changed file
      const tree: Array<{
        path: string;
        mode: '100644' | '100755' | '120000';
        type: 'blob';
        sha?: string;
        content?: string;
      }> = [];

      for (const change of changes) {
        const validatedChange = FileChangeSchema.parse(change);
        
        if (validatedChange.encoding === 'base64') {
          // Create blob from base64 content
          const { data: blob } = await this.octokit.git.createBlob({
            owner,
            repo,
            content: validatedChange.content,
            encoding: 'base64',
          });
          
          tree.push({
            path: validatedChange.path,
            mode: validatedChange.mode,
            type: 'blob',
            sha: blob.sha,
          });
        } else {
          // Create blob from text content
          tree.push({
            path: validatedChange.path,
            mode: validatedChange.mode,
            type: 'blob',
            content: validatedChange.content,
          });
        }
      }

      // Create new tree
      const { data: newTree } = await this.octokit.git.createTree({
        owner,
        repo,
        base_tree: commit.tree.sha,
        tree,
      });

      // Create new commit
      const { data: newCommit } = await this.octokit.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: newTree.sha,
        parents: [ref.object.sha],
        author: {
          name: 'CodeMind Auto Fix',
          email: 'autofix@codemind.app',
        },
        committer: {
          name: 'CodeMind Auto Fix',
          email: 'autofix@codemind.app',
        },
      });

      // Update the branch reference
      await this.octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
        sha: newCommit.sha,
      });

      logger.info('Committed auto-fix changes', {
        owner,
        repo,
        branchName,
        commitSha: newCommit.sha,
        filesChanged: changes.length,
      });

      return newCommit.sha;
    } catch (error) {
      logger.error('Failed to commit auto-fix changes', {
        owner,
        repo,
        branchName,
        filesChanged: changes.length,
      }, error as Error);
      throw error;
    }
  }

  /**
   * Create a pull request for the fix
   */
  private async createPullRequest(
    repositoryInfo: AutoFixRepositoryInfo,
    branchName: string,
    title: string,
    body: string
  ): Promise<{ url: string; number: number }> {
    const { owner, repo } = repositoryInfo;
    const defaultBranch = await this.getDefaultBranch(owner, repo);

    try {
      const { data: pr } = await this.octokit.pulls.create({
        owner,
        repo,
        title,
        body,
        head: branchName,
        base: defaultBranch,
        draft: this.config.requireApproval, // Create as draft if approval required
      });

      logger.info('Created auto-fix pull request', {
        owner,
        repo,
        prNumber: pr.number,
        prUrl: pr.html_url,
        draft: this.config.requireApproval,
      });

      return {
        url: pr.html_url,
        number: pr.number,
      };
    } catch (error) {
      logger.error('Failed to create pull request', {
        owner,
        repo,
        branchName,
        title,
      }, error as Error);
      throw error;
    }
  }

  /**
   * Generate commit message from issues and changes
   */
  private generateCommitMessage(issues: DetectedIssue[], changes: FileChange[]): string {
    const primaryIssue = issues[0];
    const issueType = primaryIssue?.type.replace('_', ' ') || 'code issue';
    
    let message = `${this.config.commitPrefix}${issueType}`;
    
    if (primaryIssue?.file) {
      message += ` in ${primaryIssue.file}`;
    }
    
    if (issues.length > 1) {
      message += ` and ${issues.length - 1} other issue${issues.length === 2 ? '' : 's'}`;
    }

    // Add details in commit body
    const details = [];
    
    if (issues.length > 0) {
      details.push('\nIssues fixed:');
      issues.forEach((issue, index) => {
        details.push(`${index + 1}. ${issue.message}`);
        if (issue.file) {
          details.push(`   File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
        }
      });
    }

    if (changes.length > 0) {
      details.push('\nFiles modified:');
      changes.forEach((change) => {
        details.push(`- ${change.path}`);
      });
    }

    details.push('\nThis commit was automatically generated by CodeMind Auto Fix.');

    return message + details.join('\n');
  }

  /**
   * Generate pull request title and body
   */
  private generatePullRequestContent(issues: DetectedIssue[], changes: FileChange[]): {
    title: string;
    body: string;
  } {
    const primaryIssue = issues[0];
    const issueDescription = primaryIssue ? 
      `${primaryIssue.type.replace('_', ' ')} - ${primaryIssue.message}` :
      'Multiple code issues';

    const title = this.config.prTitle.replace('{issue}', issueDescription);

    // Generate changes summary
    const changesList = changes.map(change => `- \`${change.path}\``).join('\n');
    
    // Generate issue analysis
    const analysisItems = issues.map(issue => {
      let item = `- **${issue.type.replace('_', ' ')}** (${issue.severity}): ${issue.message}`;
      if (issue.file) {
        item += `\n  - File: \`${issue.file}\`${issue.line ? ` (Line ${issue.line})` : ''}`;
      }
      if (issue.suggestion) {
        item += `\n  - Suggestion: ${issue.suggestion}`;
      }
      return item;
    }).join('\n');

    const body = this.config.prBody
      .replace('{changes}', changesList)
      .replace('{analysis}', analysisItems);

    return { title, body };
  }

  /**
   * Check if auto-fix is allowed for this project (rate limiting)
   */
  private async checkRateLimit(projectId: string): Promise<boolean> {
    // TODO: Implement rate limiting check against database
    // For now, always allow but add logging
    logger.info('Rate limit check for auto-fix', {
      projectId,
      maxFixesPerHour: this.config.maxFixesPerHour,
    });
    
    return true;
  }

  /**
   * Main method to apply auto-fix for detected issues
   */
  public async applyAutoFix(
    projectId: string,
    githubUrl: string,
    issues: DetectedIssue[],
    fixes: FileChange[],
    userId?: string
  ): Promise<AutoFixResult> {
    logger.info('Starting auto-fix process', {
      projectId,
      issuesCount: issues.length,
      fixesCount: fixes.length,
      userId,
    });

    try {
      // Check if auto-fix is enabled and allowed
      if (!this.config.enabled) {
        return AutoFixResultSchema.parse({
          success: false,
          message: 'Auto-fix is disabled',
          filesChanged: [],
          error: 'Auto-fix functionality is disabled in configuration',
        });
      }

      // Check rate limits
      const rateLimitPassed = await this.checkRateLimit(projectId);
      if (!rateLimitPassed) {
        return AutoFixResultSchema.parse({
          success: false,
          message: 'Rate limit exceeded',
          filesChanged: [],
          error: `Rate limit exceeded: maximum ${this.config.maxFixesPerHour} fixes per hour`,
        });
      }

      // Validate inputs
      if (issues.length === 0) {
        return AutoFixResultSchema.parse({
          success: false,
          message: 'No issues to fix',
          filesChanged: [],
          error: 'No issues provided for auto-fix',
        });
      }

      if (fixes.length === 0) {
        return AutoFixResultSchema.parse({
          success: false,
          message: 'No fixes provided',
          filesChanged: [],
          error: 'No file changes provided for auto-fix',
        });
      }

      // Parse repository information
      const repositoryInfo = this.parseRepositoryUrl(githubUrl);
      
      // Determine issue type for branch naming
      const primaryIssueType = issues[0].type;
      
      // Create fix branch
      const branchName = await this.createFixBranch(repositoryInfo, primaryIssueType);
      
      // Generate commit message
      const commitMessage = this.generateCommitMessage(issues, fixes);
      
      // Commit changes
      const commitSha = await this.commitChanges(
        repositoryInfo,
        branchName,
        fixes,
        commitMessage
      );
      
      // Generate PR content
      const { title, body } = this.generatePullRequestContent(issues, fixes);
      
      // Create pull request
      const pr = await this.createPullRequest(
        repositoryInfo,
        branchName,
        title,
        body
      );
      
      const result = AutoFixResultSchema.parse({
        success: true,
        message: `Successfully created auto-fix PR #${pr.number}`,
        prUrl: pr.url,
        prNumber: pr.number,
        commitSha,
        branchName,
        filesChanged: fixes.map(f => f.path),
      });

      logger.info('Auto-fix completed successfully', {
        projectId,
        prNumber: pr.number,
        prUrl: pr.url,
        branchName,
        commitSha,
        filesChanged: fixes.length,
      });

      return result;
      
    } catch (error) {
      logger.error('Auto-fix process failed', {
        projectId,
        githubUrl,
        issuesCount: issues.length,
        fixesCount: fixes.length,
      }, error as Error);

      return AutoFixResultSchema.parse({
        success: false,
        message: 'Auto-fix process failed',
        filesChanged: [],
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get current GitHub API rate limit status
   */
  public async getRateLimit(): Promise<{
    core: { limit: number; used: number; remaining: number; reset: Date };
    search: { limit: number; used: number; remaining: number; reset: Date };
  }> {
    try {
      const { data } = await this.octokit.rateLimit.get();
      
      return {
        core: {
          limit: data.resources.core.limit,
          used: data.resources.core.used,
          remaining: data.resources.core.remaining,
          reset: new Date(data.resources.core.reset * 1000),
        },
        search: {
          limit: data.resources.search.limit,
          used: data.resources.search.used,
          remaining: data.resources.search.remaining,
          reset: new Date(data.resources.search.reset * 1000),
        },
      };
    } catch (error) {
      logger.error('Failed to get GitHub rate limit', {}, error as Error);
      throw error;
    }
  }

  /**
   * Test GitHub authentication
   */
  public async testAuthentication(): Promise<{
    success: boolean;
    user?: string;
    permissions?: string[];
    error?: string;
  }> {
    try {
      if (this.authConfig.type === 'app') {
        // Test App authentication
        const { data: installation } = await this.octokit.apps.getInstallation({
          installation_id: parseInt(this.authConfig.installationId!),
        });

        return {
          success: true,
          user: `GitHub App Installation (${installation.account && 'login' in installation.account ? installation.account.login : 'Unknown'})`,
          permissions: installation.permissions ? Object.keys(installation.permissions) : [],
        };
      } else {
        // Test token authentication
        const { data: user } = await this.octokit.users.getAuthenticated();
        
        return {
          success: true,
          user: user.login,
          permissions: ['repo'], // Assume basic repo permissions with PAT
        };
      }
    } catch (error) {
      logger.error('GitHub authentication test failed', {
        authType: this.authConfig.type,
      }, error as Error);

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}

// Default instance for easy usage
let defaultAutoFixService: GitHubAutoFixService | null = null;

/**
 * Get the default GitHubAutoFixService instance
 */
export function getAutoFixService(config?: Partial<AutoFixConfig>): GitHubAutoFixService {
  if (!defaultAutoFixService) {
    defaultAutoFixService = new GitHubAutoFixService(config);
  }
  return defaultAutoFixService;
}

/**
 * Quick method to apply auto-fix with default service
 */
export async function applyAutoFix(
  projectId: string,
  githubUrl: string,
  issues: DetectedIssue[],
  fixes: FileChange[],
  userId?: string
): Promise<AutoFixResult> {
  const service = getAutoFixService();
  return service.applyAutoFix(projectId, githubUrl, issues, fixes, userId);
}

/**
 * Test GitHub authentication with default service
 */
export async function testGitHubAuth(): Promise<{
  success: boolean;
  user?: string;
  permissions?: string[];
  error?: string;
}> {
  try {
    const service = getAutoFixService();
    return await service.testAuthentication();
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}