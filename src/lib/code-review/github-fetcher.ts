/**
 * GitHub API Helper for fetching PR data
 */

import type { PRAnalysis, FileChange } from '@/types/code-review';
import crypto from 'crypto';

export interface GitHubPRData {
  number: number;
  title: string;
  body: string | null;
  html_url?: string;
  user: { login: string };
  head: { ref: string; sha?: string };
  base: { ref: string };
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubFileData {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export class GitHubFetcher {
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN || '';
  }

  /**
   * Fetch PR details and files from GitHub
   */
  async fetchPRDetails(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<PRAnalysis> {
    const [prData, filesData] = await Promise.all([
      this.fetchPR(owner, repo, prNumber),
      this.fetchPRFiles(owner, repo, prNumber),
    ]);

    return this.transformToPRAnalysis(owner, repo, prData, filesData);
  }

  /**
   * Fetch PR data from GitHub API
   */
  private async fetchPR(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitHubPRData> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch PR files from GitHub API
   */
  private async fetchPRFiles(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitHubFileData[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Transform GitHub data to our PRAnalysis format
   */
  private transformToPRAnalysis(
    owner: string,
    repo: string,
    prData: GitHubPRData,
    filesData: GitHubFileData[]
  ): PRAnalysis {
    const filesChanged: FileChange[] = filesData.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch,
      previousFilename: file.previous_filename,
      language: this.detectLanguage(file.filename),
    }));

    return {
      prNumber: prData.number,
      repository: `${owner}/${repo}`,
      title: prData.title,
      description: prData.body || undefined,
      author: prData.user.login,
      headBranch: prData.head.ref,
      baseBranch: prData.base.ref,
      headSha: prData.head.sha,
      url: prData.html_url,
      filesChanged,
      totalAdditions: prData.additions,
      totalDeletions: prData.deletions,
      commits: prData.commits,
      analyzedAt: new Date(),
    };
  }

  /**
   * Detect programming language from filename
   */
  private detectLanguage(filename: string): string | undefined {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      cs: 'csharp',
      cpp: 'cpp',
      c: 'c',
      swift: 'swift',
      kt: 'kotlin',
    };

    return ext ? languageMap[ext] : undefined;
  }

  /**
   * Get headers for GitHub API requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CodeMind-Review-Bot',
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    return headers;
  }

  /**
   * Verify webhook signature from GitHub
   */
  static verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    if (!signature) return false;

    try {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(payload).digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Post a comment to a PR (issues comments API)
   */
  async postComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string
  ): Promise<{ id: number; url: string } | null> {
    if (!this.token) {
      console.warn('[GitHubFetcher] Missing token, skipping comment post');
      return null;
    }
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });
    if (!response.ok) {
      console.error('[GitHubFetcher] Failed to post comment', response.status, response.statusText);
      return null;
    }
    const data = await response.json();
    return { id: data.id, url: data.html_url };
  }
}
