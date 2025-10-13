// GitHub API integration service for CI hooks
import { logger } from './logger';

export interface GitHubCommentOptions {
  owner: string;
  repo: string;
  pullNumber: number;
  body: string;
  updateExisting?: boolean; // Update existing CodeMind comment
}

export interface GitHubFileChange {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface GitHubPRAnalysis {
  pullRequestUrl: string;
  pullNumber: number;
  title: string;
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  riskScore: number; // 1-10 risk assessment
  keyChanges: string[];
  codeQuality: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  affectedComponents: string[];
  testCoverage?: {
    hasTests: boolean;
    testFiles: string[];
    recommendations: string[];
  };
}

export class GitHubAPIService {
  private readonly baseUrl = 'https://api.github.com';
  private readonly token?: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || process.env.GITHUB_CLIENT_SECRET;
  }

  /**
   * Post a comment to a GitHub pull request
   */
  async postPRComment(options: GitHubCommentOptions): Promise<{ success: boolean; commentId?: number; error?: string }> {
    if (!this.token) {
      logger.warn('GitHub token not configured, skipping PR comment');
      return { success: false, error: 'GitHub token not configured' };
    }

    try {
      const { owner, repo, pullNumber, body, updateExisting } = options;

      // If updateExisting is true, try to find and update existing CodeMind comment
      if (updateExisting) {
        const existingComment = await this.findExistingComment(owner, repo, pullNumber);
        if (existingComment) {
          return await this.updateComment(owner, repo, existingComment.id, body);
        }
      }

      const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${pullNumber}/comments`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'CodeMind-CI-Bot/1.0',
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Failed to post GitHub comment', {
          status: response.status,
          error: errorData,
          owner,
          repo,
          pullNumber,
        });
        return { success: false, error: `HTTP ${response.status}: ${errorData.message || 'Unknown error'}` };
      }

      const commentData = await response.json();
      logger.info('Successfully posted GitHub PR comment', {
        owner,
        repo,
        pullNumber,
        commentId: commentData.id,
      });

      return { success: true, commentId: commentData.id };

    } catch (error) {
      logger.error('Error posting GitHub PR comment', {
        owner: options.owner,
        repo: options.repo,
        pullNumber: options.pullNumber,
      }, error as Error);

      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get pull request files and changes
   */
  async getPRFiles(owner: string, repo: string, pullNumber: number): Promise<GitHubFileChange[]> {
    if (!this.token) {
      logger.warn('GitHub token not configured, cannot fetch PR files');
      return [];
    }

    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/files`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CodeMind-CI-Bot/1.0',
        },
      });

      if (!response.ok) {
        logger.error('Failed to fetch PR files', {
          status: response.status,
          owner,
          repo,
          pullNumber,
        });
        return [];
      }

      const files = await response.json() as Array<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        changes: number;
        patch?: string;
      }>;
      return files.map((file) => ({
        filename: file.filename,
        status: file.status as 'added' | 'modified' | 'removed' | 'renamed',
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
      }));

    } catch (error) {
      logger.error('Error fetching PR files', { owner, repo, pullNumber }, error as Error);
      return [];
    }
  }

  /**
   * Analyze pull request and generate summary
   */
  async analyzePullRequest(
    owner: string, 
    repo: string, 
    pullNumber: number,
    prData: { title?: string; [key: string]: unknown }
  ): Promise<GitHubPRAnalysis> {
    const files = await this.getPRFiles(owner, repo, pullNumber);
    
    // Calculate basic metrics
    const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0);
    const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0);
    
    // Simple risk assessment based on change size and file types
    let riskScore = 1;
    if (totalAdditions + totalDeletions > 1000) riskScore += 3;
    else if (totalAdditions + totalDeletions > 500) riskScore += 2;
    else if (totalAdditions + totalDeletions > 100) riskScore += 1;
    
    // Check for critical file changes
    const criticalFiles = files.filter(file => 
      file.filename.includes('package.json') ||
      file.filename.includes('Dockerfile') ||
      file.filename.includes('.env') ||
      file.filename.includes('schema') ||
      file.filename.includes('migration') ||
      file.filename.endsWith('.sql')
    );
    
    if (criticalFiles.length > 0) riskScore += 2;
    riskScore = Math.min(riskScore, 10);

    // Identify key changes
    const keyChanges: string[] = [];
    if (criticalFiles.length > 0) {
      keyChanges.push(`${criticalFiles.length} critical configuration file(s) modified`);
    }
    
    const codeFiles = files.filter(file => 
      file.filename.endsWith('.ts') || 
      file.filename.endsWith('.js') || 
      file.filename.endsWith('.tsx') || 
      file.filename.endsWith('.jsx')
    );
    
    if (codeFiles.length > 0) {
      keyChanges.push(`${codeFiles.length} code file(s) modified`);
    }

    // Identify affected components
    const componentSet = new Set(
      files
        .map(file => {
          const parts = file.filename.split('/');
          if (parts.includes('components')) return 'UI Components';
          if (parts.includes('api')) return 'API Layer';
          if (parts.includes('lib')) return 'Core Libraries';
          if (parts.includes('hooks')) return 'React Hooks';
          if (parts.includes('types')) return 'Type Definitions';
          if (parts.includes('app')) return 'Application Logic';
          if (parts.includes('prisma')) return 'Database Schema';
          return parts[0] || 'Root';
        })
        .filter(Boolean)
    );
    const affectedComponents = Array.from(componentSet);

    // Check for tests
    const testFiles = files.filter(file => 
      file.filename.includes('.test.') || 
      file.filename.includes('.spec.') ||
      file.filename.includes('__tests__')
    );

    const testCoverage = {
      hasTests: testFiles.length > 0,
      testFiles: testFiles.map(f => f.filename),
      recommendations: testFiles.length === 0 ? ['Consider adding tests for the modified functionality'] : [],
    };

    // Simple code quality assessment
    const codeQuality = {
      score: Math.max(1, 10 - Math.floor(riskScore / 2)), // Inverse relationship with risk
      issues: [] as string[],
      recommendations: [] as string[],
    };

    if (totalAdditions > totalDeletions * 3) {
      codeQuality.issues.push('Large number of additions compared to deletions');
      codeQuality.recommendations.push('Consider reviewing code for potential optimization');
    }

    if (files.some(f => f.changes > 200)) {
      codeQuality.issues.push('Some files have extensive changes (>200 lines)');
      codeQuality.recommendations.push('Consider breaking large changes into smaller commits');
    }

    return {
      pullRequestUrl: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
      pullNumber,
      title: prData.title || 'Pull Request',
      totalFiles: files.length,
      totalAdditions,
      totalDeletions,
      riskScore,
      keyChanges,
      codeQuality,
      affectedComponents,
      testCoverage,
    };
  }

  /**
   * Generate a formatted comment for PR analysis
   */
  generateAnalysisComment(analysis: GitHubPRAnalysis): string {
    const riskEmoji = analysis.riskScore <= 3 ? '🟢' : analysis.riskScore <= 6 ? '🟡' : '🔴';
    const qualityEmoji = analysis.codeQuality.score >= 8 ? '🟢' : analysis.codeQuality.score >= 6 ? '🟡' : '🔴';

    let comment = `## 🧠 CodeMind Analysis\n\n`;
    
    comment += `### 📊 Summary\n`;
    comment += `- **Files Changed**: ${analysis.totalFiles}\n`;
    comment += `- **Lines Added**: +${analysis.totalAdditions}\n`;
    comment += `- **Lines Deleted**: -${analysis.totalDeletions}\n`;
    comment += `- **Risk Score**: ${riskEmoji} ${analysis.riskScore}/10\n`;
    comment += `- **Code Quality**: ${qualityEmoji} ${analysis.codeQuality.score}/10\n\n`;

    if (analysis.keyChanges.length > 0) {
      comment += `### 🔍 Key Changes\n`;
      analysis.keyChanges.forEach(change => {
        comment += `- ${change}\n`;
      });
      comment += `\n`;
    }

    if (analysis.affectedComponents.length > 0) {
      comment += `### 🏗️ Affected Components\n`;
      analysis.affectedComponents.forEach(component => {
        comment += `- ${component}\n`;
      });
      comment += `\n`;
    }

    if (analysis.codeQuality.issues.length > 0) {
      comment += `### ⚠️ Potential Issues\n`;
      analysis.codeQuality.issues.forEach(issue => {
        comment += `- ${issue}\n`;
      });
      comment += `\n`;
    }

    if (analysis.codeQuality.recommendations.length > 0 || (analysis.testCoverage?.recommendations.length ?? 0) > 0) {
      comment += `### 💡 Recommendations\n`;
      [...analysis.codeQuality.recommendations, ...(analysis.testCoverage?.recommendations ?? [])].forEach(rec => {
        comment += `- ${rec}\n`;
      });
      comment += `\n`;
    }

    comment += `### 🧪 Test Coverage\n`;
    if (analysis.testCoverage?.hasTests) {
      comment += `✅ Tests found: ${analysis.testCoverage.testFiles.length} test file(s)\n`;
    } else {
      comment += `❌ No test files detected in this PR\n`;
    }

    comment += `\n---\n`;
    comment += `*This analysis was generated automatically by CodeMind. For questions or issues, please contact the development team.*`;

    return comment;
  }

  /**
   * Find existing CodeMind comment in PR
   */
  private async findExistingComment(owner: string, repo: string, pullNumber: number): Promise<{ id: number } | null> {
    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${pullNumber}/comments`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CodeMind-CI-Bot/1.0',
        },
      });

      if (!response.ok) return null;

      const comments = await response.json() as Array<{
        id: number;
        body?: string;
        user?: { login: string };
      }>;
      const codeMindComment = comments.find((comment) => 
        comment.body?.includes('🧠 CodeMind Analysis') && 
        comment.user?.login === 'github-actions[bot]' // Adjust based on your bot setup
      );

      return codeMindComment ? { id: codeMindComment.id } : null;
    } catch (error) {
      logger.error('Error finding existing comment', { owner, repo, pullNumber }, error as Error);
      return null;
    }
  }

  /**
   * Update an existing comment
   */
  private async updateComment(owner: string, repo: string, commentId: number, body: string): Promise<{ success: boolean; commentId?: number; error?: string }> {
    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/comments/${commentId}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'CodeMind-CI-Bot/1.0',
        },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: `HTTP ${response.status}: ${errorData.message || 'Unknown error'}` };
      }

      logger.info('Successfully updated GitHub PR comment', {
        owner,
        repo,
        commentId,
      });

      return { success: true, commentId };

    } catch (error) {
      logger.error('Error updating GitHub comment', { owner, repo, commentId }, error as Error);
      return { success: false, error: (error as Error).message };
    }
  }
}

export const githubAPI = new GitHubAPIService();