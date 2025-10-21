/**
 * Cross-Repository Linker
 * 
 * Manages cross-repository issue and PR linking, tracking dependencies
 * and related work across multiple repositories in a workspace.
 * 
 * @module multi-repo/cross-repo-linker
 */

import { Octokit } from '@octokit/rest';

/**
 * Types of cross-repository references
 */
export enum ReferenceType {
  ISSUE = 'issue',
  PULL_REQUEST = 'pull_request',
  COMMIT = 'commit',
  DISCUSSION = 'discussion',
}

/**
 * Status of linked items
 */
export enum LinkStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  MERGED = 'merged',
  DRAFT = 'draft',
}

/**
 * Represents a cross-repository reference
 */
export interface CrossRepoReference {
  id: string;
  sourceRepo: string; // owner/repo format
  sourceType: ReferenceType;
  sourceNumber: number;
  sourceTitle: string;
  targetRepo: string; // owner/repo format
  targetType: ReferenceType;
  targetNumber: number;
  targetTitle: string;
  relationship: 'blocks' | 'blocked-by' | 'relates-to' | 'duplicates' | 'depends-on';
  createdAt: Date;
  updatedAt: Date;
  status: LinkStatus;
}

/**
 * Issue or PR with cross-repo context
 */
export interface LinkedItem {
  repository: string;
  type: ReferenceType;
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
  labels: string[];
  crossRepoLinks: CrossRepoReference[];
}

/**
 * Workspace-level tracking of cross-repo work
 */
export interface WorkspaceLinks {
  workspaceId: string;
  totalLinks: number;
  repositories: string[];
  linksByType: Record<ReferenceType, number>;
  linksByRelationship: Record<string, number>;
  recentLinks: CrossRepoReference[];
}

/**
 * Link detection pattern
 */
interface LinkPattern {
  pattern: RegExp;
  relationship: 'blocks' | 'blocked-by' | 'relates-to' | 'duplicates' | 'depends-on';
}

/**
 * Manages cross-repository issue and PR linking
 */
export class CrossRepoLinker {
  private octokit: Octokit;
  private workspaceId: string;
  
  // Patterns for detecting cross-repo references in issue/PR bodies
  private readonly linkPatterns: LinkPattern[] = [
    { pattern: /blocks\s+([a-zA-Z0-9\-_]+\/[a-zA-Z0-9\-_]+)#(\d+)/gi, relationship: 'blocks' },
    { pattern: /blocked\s+by\s+([a-zA-Z0-9\-_]+\/[a-zA-Z0-9\-_]+)#(\d+)/gi, relationship: 'blocked-by' },
    { pattern: /depends\s+on\s+([a-zA-Z0-9\-_]+\/[a-zA-Z0-9\-_]+)#(\d+)/gi, relationship: 'depends-on' },
    { pattern: /related\s+to\s+([a-zA-Z0-9\-_]+\/[a-zA-Z0-9\-_]+)#(\d+)/gi, relationship: 'relates-to' },
    { pattern: /duplicate\s+of\s+([a-zA-Z0-9\-_]+\/[a-zA-Z0-9\-_]+)#(\d+)/gi, relationship: 'duplicates' },
  ];

  constructor(githubToken: string, workspaceId: string) {
    this.octokit = new Octokit({ auth: githubToken });
    this.workspaceId = workspaceId;
  }

  /**
   * Scans an issue or PR body for cross-repo references
   */
  private extractCrossRepoReferences(
    text: string,
    sourceRepo: string
  ): Array<{
    targetRepo: string;
    targetNumber: number;
    relationship: string;
  }> {
    const references: Array<{
      targetRepo: string;
      targetNumber: number;
      relationship: string;
    }> = [];

    for (const { pattern, relationship } of this.linkPatterns) {
      const matches = text.matchAll(pattern);
      
      for (const match of matches) {
        const targetRepo = match[1];
        const targetNumber = parseInt(match[2], 10);
        
        // Only add if it's a different repository
        if (targetRepo !== sourceRepo) {
          references.push({
            targetRepo,
            targetNumber,
            relationship,
          });
        }
      }
    }

    return references;
  }

  /**
   * Fetches all issues and PRs from a repository
   */
  async fetchRepositoryItems(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      since?: Date;
      labels?: string[];
    } = {}
  ): Promise<LinkedItem[]> {
    try {
      const { state = 'all', since } = options;
      const items: LinkedItem[] = [];

      // Fetch issues
      const issuesResponse = await this.octokit.issues.listForRepo({
        owner,
        repo,
        state,
        since: since?.toISOString(),
        per_page: 100,
      });

      for (const issue of issuesResponse.data) {
        // Skip PRs (they come as issues too)
        if (issue.pull_request) continue;

        const crossRepoLinks = this.extractCrossRepoReferences(
          issue.body || '',
          `${owner}/${repo}`
        );

        items.push({
          repository: `${owner}/${repo}`,
          type: ReferenceType.ISSUE,
          number: issue.number,
          title: issue.title,
          body: issue.body || '',
          state: issue.state,
          author: issue.user?.login || 'unknown',
          createdAt: new Date(issue.created_at),
          updatedAt: new Date(issue.updated_at),
          labels: issue.labels.map(l => typeof l === 'string' ? l : l.name || ''),
          crossRepoLinks: crossRepoLinks.map(ref => ({
            id: `${owner}/${repo}#${issue.number}->${ref.targetRepo}#${ref.targetNumber}`,
            sourceRepo: `${owner}/${repo}`,
            sourceType: ReferenceType.ISSUE,
            sourceNumber: issue.number,
            sourceTitle: issue.title,
            targetRepo: ref.targetRepo,
            targetType: ReferenceType.ISSUE, // Will be determined later
            targetNumber: ref.targetNumber,
            targetTitle: '', // Will be fetched later
            relationship: ref.relationship as 'blocks' | 'blocked-by' | 'relates-to' | 'duplicates' | 'depends-on',
            createdAt: new Date(issue.created_at),
            updatedAt: new Date(issue.updated_at),
            status: issue.state === 'open' ? LinkStatus.OPEN : LinkStatus.CLOSED,
          })),
        });
      }

      // Fetch PRs
      const prsResponse = await this.octokit.pulls.list({
        owner,
        repo,
        state,
        per_page: 100,
      });

      for (const pr of prsResponse.data) {
        const crossRepoLinks = this.extractCrossRepoReferences(
          pr.body || '',
          `${owner}/${repo}`
        );

        items.push({
          repository: `${owner}/${repo}`,
          type: ReferenceType.PULL_REQUEST,
          number: pr.number,
          title: pr.title,
          body: pr.body || '',
          state: pr.state,
          author: pr.user?.login || 'unknown',
          createdAt: new Date(pr.created_at),
          updatedAt: new Date(pr.updated_at),
          labels: pr.labels.map(l => typeof l === 'string' ? l : l.name || ''),
          crossRepoLinks: crossRepoLinks.map(ref => ({
            id: `${owner}/${repo}#${pr.number}->${ref.targetRepo}#${ref.targetNumber}`,
            sourceRepo: `${owner}/${repo}`,
            sourceType: ReferenceType.PULL_REQUEST,
            sourceNumber: pr.number,
            sourceTitle: pr.title,
            targetRepo: ref.targetRepo,
            targetType: ReferenceType.PULL_REQUEST, // Will be determined later
            targetNumber: ref.targetNumber,
            targetTitle: '', // Will be fetched later
            relationship: ref.relationship as 'blocks' | 'blocked-by' | 'relates-to' | 'duplicates' | 'depends-on',
            createdAt: new Date(pr.created_at),
            updatedAt: new Date(pr.updated_at),
            status: pr.merged_at 
              ? LinkStatus.MERGED 
              : pr.draft 
                ? LinkStatus.DRAFT 
                : pr.state === 'open' 
                  ? LinkStatus.OPEN 
                  : LinkStatus.CLOSED,
          })),
        });
      }

      return items;
    } catch (error) {
      console.error(`Error fetching items from ${owner}/${repo}:`, error);
      return [];
    }
  }

  /**
   * Enriches cross-repo references with target information
   */
  async enrichCrossRepoReferences(
    references: CrossRepoReference[]
  ): Promise<CrossRepoReference[]> {
    const enriched: CrossRepoReference[] = [];

    for (const ref of references) {
      try {
        const [owner, repo] = ref.targetRepo.split('/');
        
        // Try to fetch as issue first
        try {
          const issue = await this.octokit.issues.get({
            owner,
            repo,
            issue_number: ref.targetNumber,
          });

          enriched.push({
            ...ref,
            targetTitle: issue.data.title,
            targetType: issue.data.pull_request 
              ? ReferenceType.PULL_REQUEST 
              : ReferenceType.ISSUE,
          });
        } catch {
          // If failed, keep original reference
          enriched.push(ref);
        }
      } catch (error) {
        console.error(`Error enriching reference ${ref.id}:`, error);
        enriched.push(ref);
      }
    }

    return enriched;
  }

  /**
   * Scans all repositories in a workspace for cross-repo links
   */
  async scanWorkspace(
    repositories: Array<{ owner: string; name: string }>,
    options: {
      state?: 'open' | 'closed' | 'all';
      since?: Date;
    } = {}
  ): Promise<WorkspaceLinks> {
    const allLinks: CrossRepoReference[] = [];
    const repoSet = new Set<string>();

    // Fetch items from all repositories
    for (const { owner, name } of repositories) {
      const items = await this.fetchRepositoryItems(owner, name, options);
      repoSet.add(`${owner}/${name}`);
      
      for (const item of items) {
        allLinks.push(...item.crossRepoLinks);
      }
    }

    // Enrich references with target information
    const enrichedLinks = await this.enrichCrossRepoReferences(allLinks);

    // Calculate statistics
    const linksByType: Record<ReferenceType, number> = {
      [ReferenceType.ISSUE]: 0,
      [ReferenceType.PULL_REQUEST]: 0,
      [ReferenceType.COMMIT]: 0,
      [ReferenceType.DISCUSSION]: 0,
    };

    const linksByRelationship: Record<string, number> = {};

    for (const link of enrichedLinks) {
      linksByType[link.sourceType]++;
      linksByRelationship[link.relationship] = 
        (linksByRelationship[link.relationship] || 0) + 1;
    }

    // Sort by most recent
    enrichedLinks.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return {
      workspaceId: this.workspaceId,
      totalLinks: enrichedLinks.length,
      repositories: Array.from(repoSet),
      linksByType,
      linksByRelationship,
      recentLinks: enrichedLinks.slice(0, 50), // Top 50 most recent
    };
  }

  /**
   * Finds all items blocking a specific issue/PR
   */
  async findBlockers(
    owner: string,
    repo: string,
    number: number
  ): Promise<CrossRepoReference[]> {
    try {
      const issue = await this.octokit.issues.get({
        owner,
        repo,
        issue_number: number,
      });

      const body = issue.data.body || '';
      const blockers = this.extractCrossRepoReferences(
        body,
        `${owner}/${repo}`
      ).filter(ref => ref.relationship === 'blocked-by');

      return this.enrichCrossRepoReferences(
        blockers.map(ref => ({
          id: `${owner}/${repo}#${number}->${ref.targetRepo}#${ref.targetNumber}`,
          sourceRepo: `${owner}/${repo}`,
          sourceType: ReferenceType.ISSUE,
          sourceNumber: number,
          sourceTitle: issue.data.title,
          targetRepo: ref.targetRepo,
          targetType: ReferenceType.ISSUE,
          targetNumber: ref.targetNumber,
          targetTitle: '',
          relationship: ref.relationship as 'blocks' | 'blocked-by' | 'relates-to' | 'duplicates' | 'depends-on',
          createdAt: new Date(issue.data.created_at),
          updatedAt: new Date(issue.data.updated_at),
          status: issue.data.state === 'open' ? LinkStatus.OPEN : LinkStatus.CLOSED,
        }))
      );
    } catch (error) {
      console.error(`Error finding blockers for ${owner}/${repo}#${number}:`, error);
      return [];
    }
  }

  /**
   * Finds all items blocked by a specific issue/PR
   */
  async findDependents(
    owner: string,
    repo: string,
    number: number,
    repositories: Array<{ owner: string; name: string }>
  ): Promise<CrossRepoReference[]> {
    const dependents: CrossRepoReference[] = [];
    const targetRepo = `${owner}/${repo}`;

    // Search all repositories for items that reference this one
    for (const repository of repositories) {
      const items = await this.fetchRepositoryItems(
        repository.owner,
        repository.name,
        { state: 'all' }
      );

      for (const item of items) {
        for (const link of item.crossRepoLinks) {
          if (
            link.targetRepo === targetRepo &&
            link.targetNumber === number &&
            (link.relationship === 'blocked-by' || link.relationship === 'depends-on')
          ) {
            dependents.push(link);
          }
        }
      }
    }

    return dependents;
  }

  /**
   * Creates a bidirectional link between two issues/PRs
   */
  async createCrossRepoLink(
    source: { owner: string; repo: string; number: number },
    target: { owner: string; repo: string; number: number },
    relationship: 'blocks' | 'relates-to' | 'depends-on'
  ): Promise<boolean> {
    try {
      // Get current issue/PR
      const sourceIssue = await this.octokit.issues.get({
        owner: source.owner,
        repo: source.repo,
        issue_number: source.number,
      });

      // Add reference to body
      const linkText = `\n\n---\n${relationship} ${target.owner}/${target.repo}#${target.number}`;
      const newBody = (sourceIssue.data.body || '') + linkText;

      // Update issue/PR
      await this.octokit.issues.update({
        owner: source.owner,
        repo: source.repo,
        issue_number: source.number,
        body: newBody,
      });

      // Optionally add comment to target
      const reverseRelationship = 
        relationship === 'blocks' ? 'blocked by' :
        relationship === 'depends-on' ? 'dependency of' :
        'related to';

      await this.octokit.issues.createComment({
        owner: target.owner,
        repo: target.repo,
        issue_number: target.number,
        body: `This is ${reverseRelationship} ${source.owner}/${source.repo}#${source.number}`,
      });

      return true;
    } catch (error) {
      console.error('Error creating cross-repo link:', error);
      return false;
    }
  }

  /**
   * Generates a dependency graph visualization
   */
  generateDependencyMap(links: CrossRepoReference[]): {
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ from: string; to: string; label: string }>;
  } {
    const nodes = new Map<string, { id: string; label: string; type: string }>();
    const edges: Array<{ from: string; to: string; label: string }> = [];

    for (const link of links) {
      const sourceId = `${link.sourceRepo}#${link.sourceNumber}`;
      const targetId = `${link.targetRepo}#${link.targetNumber}`;

      // Add source node
      if (!nodes.has(sourceId)) {
        nodes.set(sourceId, {
          id: sourceId,
          label: `${link.sourceTitle} (#${link.sourceNumber})`,
          type: link.sourceType,
        });
      }

      // Add target node
      if (!nodes.has(targetId)) {
        nodes.set(targetId, {
          id: targetId,
          label: link.targetTitle 
            ? `${link.targetTitle} (#${link.targetNumber})`
            : `#${link.targetNumber}`,
          type: link.targetType,
        });
      }

      // Add edge
      edges.push({
        from: sourceId,
        to: targetId,
        label: link.relationship,
      });
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }
}
