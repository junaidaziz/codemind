import { Tool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from './logger';

// Input schema for GitHub file operations
export const GitHubFileInputSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  path: z.string().min(1, 'File path is required'),
  ref: z.string().optional().default('main'), // branch, tag, or commit SHA
});

export const GitHubDirectoryInputSchema = z.object({
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  path: z.string().default(''), // empty string for root directory
  ref: z.string().optional().default('main'),
  recursive: z.boolean().default(false),
});

// Response schemas
export const GitHubFileContentSchema = z.object({
  name: z.string(),
  path: z.string(),
  content: z.string(),
  size: z.number(),
  sha: z.string(),
  encoding: z.string(),
  downloadUrl: z.string().nullable(),
  language: z.string().optional(),
});

export const GitHubDirectoryItemSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['file', 'dir']),
  size: z.number().optional(),
  sha: z.string(),
  downloadUrl: z.string().nullable(),
});

export type GitHubFileInput = z.infer<typeof GitHubFileInputSchema>;
export type GitHubDirectoryInput = z.infer<typeof GitHubDirectoryInputSchema>;
export type GitHubFileContent = z.infer<typeof GitHubFileContentSchema>;
export type GitHubDirectoryItem = z.infer<typeof GitHubDirectoryItemSchema>;

/**
 * GitHub API client for file operations
 */
class GitHubAPIClient {
  private baseUrl = 'https://api.github.com';
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  private async makeRequest(url: string): Promise<Response> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CodeMind-Bot/1.0',
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response;
  }

  async getFileContent(input: GitHubFileInput): Promise<GitHubFileContent> {
    const { owner, repo, path, ref } = input;
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;

    try {
      const response = await this.makeRequest(url);
      const data = await response.json();

      // Handle directory case
      if (Array.isArray(data)) {
        throw new Error(`Path '${path}' is a directory, not a file`);
      }

      // Decode content if base64 encoded
      let content = data.content || '';
      if (data.encoding === 'base64') {
        content = Buffer.from(content, 'base64').toString('utf-8');
      }

      // Detect language from file extension
      const language = this.detectLanguage(path);

      return GitHubFileContentSchema.parse({
        name: data.name,
        path: data.path,
        content,
        size: data.size,
        sha: data.sha,
        encoding: data.encoding,
        downloadUrl: data.download_url,
        language,
      });

    } catch (error) {
      logger.error('Failed to fetch GitHub file', { owner, repo, path, ref }, error as Error);
      throw error;
    }
  }

  async getDirectoryContents(input: GitHubDirectoryInput): Promise<GitHubDirectoryItem[]> {
    const { owner, repo, path, ref, recursive } = input;
    const url = `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;

    try {
      const response = await this.makeRequest(url);
      const data = await response.json();

      // Handle single file case
      if (!Array.isArray(data)) {
        throw new Error(`Path '${path}' is a file, not a directory`);
      }

      const items: GitHubDirectoryItem[] = [];

      for (const item of data) {
        const directoryItem = GitHubDirectoryItemSchema.parse({
          name: item.name,
          path: item.path,
          type: item.type === 'dir' ? 'dir' : 'file',
          size: item.size,
          sha: item.sha,
          downloadUrl: item.download_url,
        });

        items.push(directoryItem);

        // Recursively get subdirectory contents if requested
        if (recursive && item.type === 'dir') {
          try {
            const subItems = await this.getDirectoryContents({
              owner,
              repo,
              path: item.path,
              ref,
              recursive: true,
            });
            items.push(...subItems);
          } catch (error) {
            logger.warn('Failed to fetch subdirectory', { path: item.path }, error as Error);
          }
        }
      }

      return items;

    } catch (error) {
      logger.error('Failed to fetch GitHub directory', { owner, repo, path, ref }, error as Error);
      throw error;
    }
  }

  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'fish': 'shell',
      'ps1': 'powershell',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'toml': 'toml',
      'ini': 'ini',
      'md': 'markdown',
      'markdown': 'markdown',
      'txt': 'text',
    };

    return languageMap[extension || ''] || 'text';
  }
}

/**
 * LangChain Tool for reading GitHub files
 */
export class GitHubFileReaderTool extends Tool {
  name = 'github_file_reader';
  description = `Read file contents from GitHub repositories. 
  Input should be a JSON string with: {"owner": "username", "repo": "repository", "path": "file/path.js", "ref": "branch_or_sha"}
  Use this tool when you need to examine specific files in GitHub repositories.`;

  private client: GitHubAPIClient;

  constructor(githubToken?: string) {
    super();
    this.client = new GitHubAPIClient(githubToken);
  }

  async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const validatedInput = GitHubFileInputSchema.parse(parsedInput);
      
      const fileContent = await this.client.getFileContent(validatedInput);
      
      // Return formatted content with metadata
      return JSON.stringify({
        success: true,
        file: {
          name: fileContent.name,
          path: fileContent.path,
          language: fileContent.language,
          size: fileContent.size,
          content: fileContent.content,
        },
        metadata: {
          sha: fileContent.sha,
          encoding: fileContent.encoding,
          downloadUrl: fileContent.downloadUrl,
        },
      }, null, 2);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('GitHubFileReaderTool execution failed', { input }, error as Error);
      
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
}

/**
 * LangChain Tool for browsing GitHub directories
 */
export class GitHubDirectoryBrowserTool extends Tool {
  name = 'github_directory_browser';
  description = `Browse directory contents in GitHub repositories.
  Input should be a JSON string with: {"owner": "username", "repo": "repository", "path": "directory/path", "ref": "branch_or_sha", "recursive": false}
  Use this tool to explore repository structure and find relevant files.`;

  private client: GitHubAPIClient;

  constructor(githubToken?: string) {
    super();
    this.client = new GitHubAPIClient(githubToken);
  }

  async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const validatedInput = GitHubDirectoryInputSchema.parse(parsedInput);
      
      const directoryItems = await this.client.getDirectoryContents(validatedInput);
      
      // Organize items by type
      const files = directoryItems.filter(item => item.type === 'file');
      const directories = directoryItems.filter(item => item.type === 'dir');

      return JSON.stringify({
        success: true,
        directory: {
          path: validatedInput.path || '/',
          totalItems: directoryItems.length,
          files: files.length,
          directories: directories.length,
        },
        items: directoryItems.map((item: typeof directoryItems[0]) => ({
          name: item.name,
          path: item.path,
          type: item.type,
          size: item.size,
        })),
      }, null, 2);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('GitHubDirectoryBrowserTool execution failed', { input }, error as Error);
      
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
}

/**
 * LangChain Tool for searching files in GitHub repositories
 */
export class GitHubFileSearchTool extends Tool {
  name = 'github_file_search';
  description = `Search for files in GitHub repositories by name pattern.
  Input should be a JSON string with: {"owner": "username", "repo": "repository", "query": "search_term", "ref": "branch_or_sha"}
  Use this tool to find files matching specific patterns or names.`;

  private client: GitHubAPIClient;

  constructor(githubToken?: string) {
    super();
    this.client = new GitHubAPIClient(githubToken);
  }

  async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);
      const searchInput = z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        query: z.string().min(1),
        ref: z.string().default('main'),
      }).parse(parsedInput);

      // Get all files recursively
      const allItems = await this.client.getDirectoryContents({
        owner: searchInput.owner,
        repo: searchInput.repo,
        path: '',
        ref: searchInput.ref,
        recursive: true,
      });

      // Filter files by query
      const matchingFiles = allItems
        .filter(item => item.type === 'file')
        .filter(item => 
          item.name.toLowerCase().includes(searchInput.query.toLowerCase()) ||
          item.path.toLowerCase().includes(searchInput.query.toLowerCase())
        );

      return JSON.stringify({
        success: true,
        query: searchInput.query,
        totalMatches: matchingFiles.length,
        files: matchingFiles.map((file: typeof matchingFiles[0]) => ({
          name: file.name,
          path: file.path,
          size: file.size,
        })).slice(0, 20), // Limit to first 20 results
      }, null, 2);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('GitHubFileSearchTool execution failed', { input }, error as Error);
      
      return JSON.stringify({
        success: false,
        error: errorMessage,
      }, null, 2);
    }
  }
}

/**
 * Factory function to create GitHub tools with authentication
 */
export function createGitHubTools(githubToken?: string): Tool[] {
  return [
    new GitHubFileReaderTool(githubToken),
    new GitHubDirectoryBrowserTool(githubToken),
    new GitHubFileSearchTool(githubToken),
  ];
}