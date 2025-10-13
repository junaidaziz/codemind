// GitHub Tree API service for repository synchronization
import { logger } from '../app/lib/logger';

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export interface GitHubCommit {
  sha: string;
  tree: {
    sha: string;
  };
  author: {
    name: string;
    email: string;
    date: string;
  };
  message: string;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
}

export interface RepoInfo {
  owner: string;
  repo: string;
  branch?: string;
}

/**
 * GitHub Tree API service for fetching repository structure
 */
export class GitHubTreeService {
  private readonly baseUrl = 'https://api.github.com';
  private readonly token?: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || process.env.GITHUB_CLIENT_SECRET;
  }

  /**
   * Parse GitHub URL to extract owner and repo
   */
  parseGitHubUrl(githubUrl: string): RepoInfo {
    try {
      // Handle different GitHub URL formats
      const cleanUrl = githubUrl.replace(/\.git$/, '');
      const match = cleanUrl.match(/github\.com[/:]([\w-]+)\/([\w.-]+)/);
      
      if (!match) {
        throw new Error(`Invalid GitHub URL format: ${githubUrl}`);
      }

      return {
        owner: match[1],
        repo: match[2],
      };
    } catch (error) {
      logger.error('Failed to parse GitHub URL', { githubUrl }, error as Error);
      throw error;
    }
  }

  /**
   * Get the latest commit SHA for a branch
   */
  async getLatestCommitSha(owner: string, repo: string, branch: string = 'main'): Promise<string> {
    if (!this.token) {
      throw new Error('GitHub token not configured');
    }

    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/branches/${branch}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CodeMind-Scanner/1.0',
        },
      });

      if (!response.ok) {
        // Try 'main' if 'master' failed, or vice versa
        if (branch === 'main') {
          return await this.getLatestCommitSha(owner, repo, 'master');
        } else if (branch === 'master') {
          return await this.getLatestCommitSha(owner, repo, 'main');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get branch info: ${response.status} ${errorData.message || 'Unknown error'}`);
      }

      const branchData = await response.json() as GitHubBranch;
      return branchData.commit.sha;
      
    } catch (error) {
      logger.error('Failed to get latest commit SHA', { owner, repo, branch }, error as Error);
      throw error;
    }
  }

  /**
   * Get repository tree structure
   */
  async getRepositoryTree(
    owner: string, 
    repo: string, 
    treeSha?: string, 
    recursive: boolean = true
  ): Promise<GitHubTree> {
    if (!this.token) {
      throw new Error('GitHub token not configured');
    }

    try {
      // If no tree SHA provided, get it from the default branch
      if (!treeSha) {
        const latestCommitSha = await this.getLatestCommitSha(owner, repo);
        const commit = await this.getCommit(owner, repo, latestCommitSha);
        treeSha = commit.tree.sha;
      }

      const url = `${this.baseUrl}/repos/${owner}/${repo}/git/trees/${treeSha}`;
      const params = new URLSearchParams();
      if (recursive) {
        params.append('recursive', '1');
      }

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CodeMind-Scanner/1.0',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get repository tree: ${response.status} ${errorData.message || 'Unknown error'}`);
      }

      const treeData = await response.json() as GitHubTree;
      
      logger.info('Repository tree fetched', {
        owner,
        repo,
        treeSha,
        totalItems: treeData.tree.length,
        truncated: treeData.truncated,
      });

      return treeData;
      
    } catch (error) {
      logger.error('Failed to get repository tree', { owner, repo, treeSha }, error as Error);
      throw error;
    }
  }

  /**
   * Get commit information
   */
  async getCommit(owner: string, repo: string, sha: string): Promise<GitHubCommit> {
    if (!this.token) {
      throw new Error('GitHub token not configured');
    }

    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/git/commits/${sha}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CodeMind-Scanner/1.0',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get commit: ${response.status} ${errorData.message || 'Unknown error'}`);
      }

      return await response.json() as GitHubCommit;
      
    } catch (error) {
      logger.error('Failed to get commit', { owner, repo, sha }, error as Error);
      throw error;
    }
  }

  /**
   * Get file content from GitHub
   */
  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<{
    content: string;
    sha: string;
    size: number;
    encoding: string;
  }> {
    if (!this.token) {
      throw new Error('GitHub token not configured');
    }

    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
      const params = new URLSearchParams();
      if (ref) {
        params.append('ref', ref);
      }

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CodeMind-Scanner/1.0',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get file content: ${response.status} ${errorData.message || 'Unknown error'}`);
      }

      const fileData = await response.json();
      
      // Decode base64 content
      let content = '';
      if (fileData.encoding === 'base64' && fileData.content) {
        content = Buffer.from(fileData.content, 'base64').toString('utf-8');
      }

      return {
        content,
        sha: fileData.sha,
        size: fileData.size,
        encoding: fileData.encoding,
      };
      
    } catch (error) {
      logger.error('Failed to get file content', { owner, repo, path }, error as Error);
      throw error;
    }
  }

  /**
   * Compare commits to find changed files
   */
  async getChangedFiles(
    owner: string, 
    repo: string, 
    baseSha: string, 
    headSha: string
  ): Promise<Array<{
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
    additions: number;
    deletions: number;
    changes: number;
    sha?: string;
  }>> {
    if (!this.token) {
      throw new Error('GitHub token not configured');
    }

    try {
      const url = `${this.baseUrl}/repos/${owner}/${repo}/compare/${baseSha}...${headSha}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CodeMind-Scanner/1.0',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to compare commits: ${response.status} ${errorData.message || 'Unknown error'}`);
      }

      const compareData = await response.json() as {
        files: Array<{
          filename: string;
          status: string;
          additions: number;
          deletions: number;
          changes: number;
          sha?: string;
        }>;
      };
      
      return compareData.files.map((file) => ({
        filename: file.filename,
        status: file.status as 'added' | 'removed' | 'modified' | 'renamed',
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        sha: file.sha,
      }));
      
    } catch (error) {
      logger.error('Failed to get changed files', { owner, repo, baseSha, headSha }, error as Error);
      throw error;
    }
  }

  /**
   * Filter tree items to get only supported files
   */
  filterSupportedFiles(treeItems: GitHubTreeItem[]): GitHubTreeItem[] {
    const supportedExtensions = [
      '.ts', '.tsx', '.js', '.jsx', 
      '.json', '.md', '.css', '.scss',
      '.yaml', '.yml', '.env'
    ];

    const excludePatterns = [
      'node_modules/',
      '.git/',
      '.next/',
      'dist/',
      'build/',
      '.turbo/',
      'coverage/',
      '.nyc_output/',
      'out/',
      '.vercel/',
      '.cache/',
    ];

    return treeItems.filter(item => {
      // Only process blobs (files), not trees (directories)
      if (item.type !== 'blob') {
        return false;
      }

      // Check if file has supported extension
      const hasValidExtension = supportedExtensions.some(ext => item.path.endsWith(ext));
      if (!hasValidExtension) {
        return false;
      }

      // Check if file is in excluded directory
      const isExcluded = excludePatterns.some(pattern => item.path.startsWith(pattern));
      if (isExcluded) {
        return false;
      }

      // Skip hidden files/directories (starting with .) unless they're config files
      const fileName = item.path.split('/').pop() || '';
      if (fileName.startsWith('.') && !fileName.match(/\.(ts|js|json|md|env)$/)) {
        return false;
      }

      return true;
    });
  }
}

export const githubTreeService = new GitHubTreeService();