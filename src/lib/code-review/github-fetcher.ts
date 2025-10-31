/**
 * GitHub API Helper for fetching PR data
 */

import type { PRAnalysis, FileChange } from '@/types/code-review';
import crypto from 'crypto';

interface CacheEntry<T> {
  data: T;
  expires: number; // epoch ms
}

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
  // Simple in-memory TTL cache (instance-scoped)
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheTTLPR: number;
  private cacheTTLFiles: number;
  // Basic rate-limit tracking
  private remaining: number = Infinity;
  private resetAt: number = 0; // epoch ms for rate limit reset
  // Adaptive rate limiting queue
  private queue: Array<() => Promise<Response>> = [];
  private processing = false;
  private lowRemainingThreshold = 10; // when remaining < threshold, enter throttled mode
  private baseDelayMs = 300; // base delay between requests under throttling
  private maxDelayMs = 5000; // cap delay
  private consecutiveThrottled = 0; // count consecutive throttled dispatches for backoff

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN || '';
    // Allow override via env (ms). Defaults chosen to balance freshness vs API savings.
    this.cacheTTLPR = this.parseTTL(process.env.GITHUB_FETCH_CACHE_TTL_PR, 30_000); // 30s default
    this.cacheTTLFiles = this.parseTTL(process.env.GITHUB_FETCH_CACHE_TTL_FILES, 60_000); // 60s default
  }

  /** Parse TTL value from env string */
  private parseTTL(raw: string | undefined, fallback: number): number {
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  /** Public helper to clear cache (useful for tests) */
  clearCache() {
    this.cache.clear();
  }

  /** Build a cache key */
  private key(kind: string, owner: string, repo: string, pr: number): string {
    return `${kind}:${owner}/${repo}#${pr}`;
  }

  /** Generic getter from cache */
  private fromCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  /** Store into cache with TTL */
  private toCache<T>(key: string, data: T, ttl: number) {
    this.cache.set(key, { data, expires: Date.now() + ttl });
    // Lightweight LRU cleanup (trim if > 500 entries)
    if (this.cache.size > 500) {
      // Remove the oldest by expires ordering
      const oldestKey = [...this.cache.entries()].sort((a, b) => a[1].expires - b[1].expires)[0]?.[0];
      if (oldestKey) this.cache.delete(oldestKey);
    }
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
    const cacheKey = this.key('pr', owner, repo, prNumber);
    const cached = this.fromCache<GitHubPRData>(cacheKey);
    if (cached) return cached;

    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const response = await this.guardedFetch(url, { headers: this.getHeaders() });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    const data: GitHubPRData = await response.json();
    this.toCache(cacheKey, data, this.cacheTTLPR);
    return data;
  }

  /**
   * Fetch PR files from GitHub API
   */
  private async fetchPRFiles(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitHubFileData[]> {
    const cacheKey = this.key('files', owner, repo, prNumber);
    const cached = this.fromCache<GitHubFileData[]>(cacheKey);
    if (cached) return cached;

    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;
    const response = await this.guardedFetch(url, { headers: this.getHeaders() });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    const data: GitHubFileData[] = await response.json();
    this.toCache(cacheKey, data, this.cacheTTLFiles);
    return data;
  }

  /** Rate-limit aware fetch wrapper */
  private async guardedFetch(url: string, init: RequestInit): Promise<Response> {
    return this.enqueue(() => fetch(url, init));
  }

  /** Enqueue a request respecting adaptive throttling */
  private async enqueue(fn: () => Promise<Response>): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      this.queue.push(async (): Promise<Response> => {
        try {
          // Pre-dispatch wait if under hard exhaustion condition
          if (this.remaining <= 2 && this.resetAt > Date.now()) {
            const waitMs = this.resetAt - Date.now();
            console.warn(`[GitHubFetcher] Hard rate limit exhaustion, waiting ${waitMs}ms until reset`);
            await this.delay(waitMs);
          } else if (this.remaining < this.lowRemainingThreshold) {
            // Adaptive backoff delay grows with consecutive throttled dispatches
            const delayFactor = Math.min(this.consecutiveThrottled + 1, 10);
            const dynamicDelay = Math.min(this.baseDelayMs * delayFactor, this.maxDelayMs);
            await this.delay(dynamicDelay);
            this.consecutiveThrottled++;
          } else {
            // Reset throttled counter when healthy
            this.consecutiveThrottled = 0;
          }

          const response = await fn();
          this.captureRateLimitHeaders(response);
          // If we receive a secondary 403 rate limit response without remaining header, try exponential backoff once
          if (response.status === 403 && this.remaining < this.lowRemainingThreshold) {
            const retryDelay = Math.min(this.baseDelayMs * Math.pow(2, this.consecutiveThrottled), this.maxDelayMs);
            console.warn(`[GitHubFetcher] 403 rate limit encountered, retrying after ${retryDelay}ms`);
            await this.delay(retryDelay);
            const retryResp = await fn();
            this.captureRateLimitHeaders(retryResp);
            resolve(retryResp);
            return retryResp;
          }
          resolve(response);
          return response;
        } catch (err) {
          reject(err);
          throw err;
        }
      });
      this.processQueue();
    });
  }

  /** Start processing queued requests if not already */
  private async processQueue() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) continue;
  await task();
    }
    this.processing = false;
  }

  /** Update internal rate limit counters from response headers */
  private captureRateLimitHeaders(response: Response) {
    const rlRemaining = response.headers.get('X-RateLimit-Remaining');
    const rlReset = response.headers.get('X-RateLimit-Reset');
    if (rlRemaining) {
      const remainingNum = Number(rlRemaining);
      if (!isNaN(remainingNum)) this.remaining = remainingNum;
    }
    if (rlReset) {
      const resetEpochSec = Number(rlReset);
      if (!isNaN(resetEpochSec)) this.resetAt = resetEpochSec * 1000;
    }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    const response = await this.guardedFetch(url, {
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

  /**
   * Post inline review comments for a PR.
   * Each comment requires path, line (new file line number), body.
   */
  async postInlineComments(
    owner: string,
    repo: string,
    prNumber: number,
    commitSha: string,
    comments: Array<{ path: string; line: number; body: string }>
  ): Promise<Array<{ path: string; line: number; githubId?: number }>> {
    const results: Array<{ path: string; line: number; githubId?: number }> = [];
    if (!this.token) {
      console.warn('[GitHubFetcher] Missing token, skipping inline comment post');
      return results;
    }
    for (const c of comments) {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/comments`;
      const payload = {
        body: c.body,
        commit_id: commitSha,
        path: c.path,
        line: c.line,
        side: 'RIGHT' as const,
      };
      try {
        const response = await this.guardedFetch(url, {
          method: 'POST',
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          console.error('[GitHubFetcher] Failed inline comment', response.status, response.statusText);
          results.push({ path: c.path, line: c.line });
          continue;
        }
        const data = await response.json();
        results.push({ path: c.path, line: c.line, githubId: data.id });
      } catch (err) {
        console.error('[GitHubFetcher] Error posting inline comment', err);
        results.push({ path: c.path, line: c.line });
      }
    }
    return results;
  }
}
