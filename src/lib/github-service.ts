import { Octokit } from '@octokit/rest';
import prisma from '../app/lib/db';
import { PullRequestState, IssueState } from '@prisma/client';

export class GitHubService {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
  }

  /**
   * Fetch all pull requests for a repository and sync with database
   */
  async syncPullRequests(projectId: string, owner: string, repo: string) {
    try {
      const { data: pullRequests } = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
      });

      const syncResults = await Promise.allSettled(
        pullRequests.map(async (pr) => {
          return await prisma.pullRequest.upsert({
            where: { 
              projectId_number: {
                projectId,
                number: pr.number
              }
            },
            create: {
              projectId,
              number: pr.number,
              title: pr.title,
              body: pr.body || '',
              state: this.mapPRState(pr.state, pr.merged_at),
              htmlUrl: pr.html_url,
              authorLogin: pr.user?.login || 'unknown',
              authorUrl: pr.user?.html_url || '',
              baseBranch: pr.base.ref,
              headBranch: pr.head.ref,
              mergeable: null, // mergeable is only available in individual PR requests, not in list
              draft: pr.draft || false,
              labels: pr.labels?.map(label => typeof label === 'string' ? label : label.name) || [],
              createdAt: new Date(pr.created_at),
              updatedAt: new Date(pr.updated_at),
              mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
              closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
            },
            update: {
              title: pr.title,
              body: pr.body || '',
              state: this.mapPRState(pr.state, pr.merged_at),
              mergeable: null, // mergeable is only available in individual PR requests, not in list
              draft: pr.draft || false,
              labels: pr.labels?.map(label => typeof label === 'string' ? label : label.name) || [],
              updatedAt: new Date(pr.updated_at),
              mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
              closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
            },
          });
        })
      );

      const successful = syncResults.filter(result => result.status === 'fulfilled').length;
      const failed = syncResults.filter(result => result.status === 'rejected').length;

      return { successful, failed, total: pullRequests.length };
    } catch (error) {
      console.error('Error syncing pull requests:', error);
      throw new Error(`Failed to sync pull requests: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch all issues for a repository and sync with database
   */
  async syncIssues(projectId: string, owner: string, repo: string) {
    try {
      // Use manual request to ensure correct endpoint: GET /repos/{owner}/{repo}/issues
      const { data: issues } = await this.octokit.request('GET /repos/{owner}/{repo}/issues', {
        owner,
        repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
      });

      // Filter out pull requests (GitHub API includes PRs in issues endpoint)
      const actualIssues = issues.filter(issue => !issue.pull_request);

      const syncResults = await Promise.allSettled(
        actualIssues.map(async (issue) => {
          return await prisma.issue.upsert({
            where: { 
              projectId_number: {
                projectId,
                number: issue.number
              }
            },
            create: {
              projectId,
              number: issue.number,
              title: issue.title,
              body: issue.body || '',
              state: issue.state === 'open' ? IssueState.OPEN : IssueState.CLOSED,
              htmlUrl: issue.html_url,
              authorLogin: issue.user?.login || 'unknown',
              authorUrl: issue.user?.html_url || '',
              labels: issue.labels.map(label => 
                typeof label === 'string' ? label : label.name || ''
              ),
              assignees: issue.assignees?.map(assignee => assignee.login) || [],
              createdAt: new Date(issue.created_at),
              updatedAt: new Date(issue.updated_at),
              closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
            },
            update: {
              title: issue.title,
              body: issue.body || '',
              state: issue.state === 'open' ? IssueState.OPEN : IssueState.CLOSED,
              labels: issue.labels.map(label => 
                typeof label === 'string' ? label : label.name || ''
              ),
              assignees: issue.assignees?.map(assignee => assignee.login) || [],
              updatedAt: new Date(issue.updated_at),
              closedAt: issue.closed_at ? new Date(issue.closed_at) : null,
            },
          });
        })
      );

      const successful = syncResults.filter(result => result.status === 'fulfilled').length;
      const failed = syncResults.filter(result => result.status === 'rejected').length;

      return { successful, failed, total: actualIssues.length };
    } catch (error) {
      console.error('Error syncing issues:', error);
      throw new Error(`Failed to sync issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new pull request with AI-generated fix
   */
  async createFixPullRequest(
    owner: string,
    repo: string,
    options: {
      title: string;
      body: string;
      head: string;
      base: string;
      draft?: boolean;
    }
  ) {
    try {
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner,
        repo,
        title: options.title,
        body: options.body,
        head: options.head,
        base: options.base,
        draft: options.draft || false,
      });

      return {
        id: pr.id,
        number: pr.number,
        html_url: pr.html_url,
        diff_url: pr.diff_url,
      };
    } catch (error) {
      console.error('Error creating pull request:', error);
      throw new Error(`Failed to create pull request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new branch for AI fixes
   */
  async createBranch(owner: string, repo: string, branchName: string, sourceBranch: string = 'main') {
    try {
      // Get the SHA of the source branch
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${sourceBranch}`,
      });

      // Create new branch
      await this.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: ref.object.sha,
      });

      return { branchName, sha: ref.object.sha };
    } catch (error) {
      console.error('Error creating branch:', error);
      throw new Error(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Commit file changes to a branch
   */
  async commitChanges(
    owner: string,
    repo: string,
    branch: string,
    changes: Array<{
      path: string;
      content: string;
      message?: string;
    }>,
    commitMessage: string
  ) {
    try {
      // Get the current commit SHA
      const { data: ref } = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });

      // Get the tree SHA of the current commit
      const { data: commit } = await this.octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: ref.object.sha,
      });

      // Create blobs for each file change
      const blobs = await Promise.all(
        changes.map(async (change) => {
          const { data: blob } = await this.octokit.rest.git.createBlob({
            owner,
            repo,
            content: Buffer.from(change.content).toString('base64'),
            encoding: 'base64',
          });
          return {
            path: change.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha,
          };
        })
      );

      // Create new tree
      const { data: newTree } = await this.octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: commit.tree.sha,
        tree: blobs,
      });

      // Create new commit
      const { data: newCommit } = await this.octokit.rest.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: newTree.sha,
        parents: [ref.object.sha],
        author: {
          name: 'CodeMind AI',
          email: 'ai@codemind.dev',
        },
      });

      // Update branch reference
      await this.octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
      });

      return { commitSha: newCommit.sha };
    } catch (error) {
      console.error('Error committing changes:', error);
      throw new Error(`Failed to commit changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get repository file content
   */
  async getFileContent(owner: string, repo: string, path: string, ref?: string) {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        throw new Error(`Path ${path} is not a file`);
      }

      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return {
        content,
        sha: data.sha,
        size: data.size,
      };
    } catch (error) {
      console.error(`Error getting file content for ${path}:`, error);
      throw new Error(`Failed to get file content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add comment to an issue
   */
  async addIssueComment(owner: string, repo: string, issueNumber: number, body: string) {
    try {
      const { data } = await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });

      return { id: data.id, html_url: data.html_url };
    } catch (error) {
      console.error('Error adding issue comment:', error);
      throw new Error(`Failed to add issue comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add label to an issue
   */
  async addIssueLabels(owner: string, repo: string, issueNumber: number, labels: string[]) {
    try {
      await this.octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels,
      });
    } catch (error) {
      console.error('Error adding issue labels:', error);
      throw new Error(`Failed to add issue labels: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch all commits for a repository and sync with database
   */
  async syncCommits(projectId: string, owner: string, repo: string, since?: Date) {
    try {
      const params: {
        owner: string;
        repo: string;
        per_page: number;
        since?: string;
      } = {
        owner,
        repo,
        per_page: 100,
      };

      if (since) {
        params.since = since.toISOString();
      }

      const { data: commits } = await this.octokit.rest.repos.listCommits(params);

      const syncResults = await Promise.allSettled(
        commits.map(async (commit) => {
          return await prisma.commit.upsert({
            where: { 
              sha: commit.sha
            },
            create: {
              projectId,
              sha: commit.sha,
              message: commit.commit.message,
              author: commit.author?.login || commit.commit.author?.name || 'unknown',
              authorEmail: commit.commit.author?.email || '',
              date: new Date(commit.commit.author?.date || new Date()),
              url: commit.html_url,
              additions: commit.stats?.additions || 0,
              deletions: commit.stats?.deletions || 0,
            },
            update: {
              message: commit.commit.message,
              author: commit.author?.login || commit.commit.author?.name || 'unknown',
              authorEmail: commit.commit.author?.email || '',
              date: new Date(commit.commit.author?.date || new Date()),
              additions: commit.stats?.additions || 0,
              deletions: commit.stats?.deletions || 0,
            },
          });
        })
      );

      const successful = syncResults.filter(result => result.status === 'fulfilled').length;
      const failed = syncResults.filter(result => result.status === 'rejected').length;

      return { successful, failed, total: commits.length };
    } catch (error) {
      console.error('Error syncing commits:', error);
      throw new Error(`Failed to sync commits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch and sync contributors for a repository
   */
  async syncContributors(projectId: string, owner: string, repo: string) {
    try {
      const { data: contributors } = await this.octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 100,
      });

      const syncResults = await Promise.allSettled(
        contributors.map(async (contributor) => {
          return await prisma.contributor.upsert({
            where: { 
              projectId_username: {
                projectId,
                username: contributor.login || 'unknown'
              }
            },
            create: {
              projectId,
              githubId: contributor.id?.toString(),
              username: contributor.login || 'unknown',
              avatarUrl: contributor.avatar_url || '',
              name: contributor.name || contributor.login || 'unknown',
              totalCommits: contributor.contributions || 0,
            },
            update: {
              githubId: contributor.id?.toString(),
              avatarUrl: contributor.avatar_url || '',
              name: contributor.name || contributor.login || 'unknown',
              totalCommits: contributor.contributions || 0,
            },
          });
        })
      );

      const successful = syncResults.filter(result => result.status === 'fulfilled').length;
      const failed = syncResults.filter(result => result.status === 'rejected').length;

      return { successful, failed, total: contributors.length };
    } catch (error) {
      console.error('Error syncing contributors:', error);
      throw new Error(`Failed to sync contributors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get repository statistics and insights
   */
  async getRepositoryStats(owner: string, repo: string) {
    try {
      const [repoData, languagesData, activityData] = await Promise.all([
        this.octokit.rest.repos.get({ owner, repo }),
        this.octokit.rest.repos.listLanguages({ owner, repo }),
        this.octokit.rest.repos.getCommitActivityStats({ owner, repo })
      ]);

      return {
        repository: {
          name: repoData.data.name,
          description: repoData.data.description,
          stargazersCount: repoData.data.stargazers_count,
          forksCount: repoData.data.forks_count,
          openIssuesCount: repoData.data.open_issues_count,
          defaultBranch: repoData.data.default_branch,
          createdAt: new Date(repoData.data.created_at),
          updatedAt: new Date(repoData.data.updated_at),
          pushedAt: repoData.data.pushed_at ? new Date(repoData.data.pushed_at) : null,
        },
        languages: languagesData.data,
        weeklyActivity: activityData.data || []
      };
    } catch (error) {
      console.error('Error fetching repository stats:', error);
      throw new Error(`Failed to fetch repository stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private mapPRState(state: string, mergedAt: string | null): PullRequestState {
    if (mergedAt) return PullRequestState.MERGED;
    return state === 'open' ? PullRequestState.OPEN : PullRequestState.CLOSED;
  }
}

export default GitHubService;