/**
 * Multi-Organization Management System
 * 
 * Manages multiple GitHub organizations within a workspace, providing
 * unified access to repositories, teams, and settings across organizations.
 * Enables enterprise-level workspace management with cross-org capabilities.
 * 
 * Features:
 * - Organization discovery and enrollment
 * - Cross-org repository access
 * - Organization-level settings management
 * - Team and member synchronization
 * - Multi-org analytics and insights
 * - Organization switching and context management
 * 
 * @module OrgManager
 */

import { Octokit } from '@octokit/rest';
import prisma from '@/lib/db';

/**
 * Organization information
 */
export interface Organization {
  id: number;
  login: string;
  name: string | null;
  description: string | null;
  avatar_url: string;
  html_url: string;
  type: 'Organization' | 'User';
  created_at: string;
  updated_at: string;
  public_repos: number;
  total_private_repos?: number;
  owned_private_repos?: number;
  members_count?: number;
  teams_count?: number;
  plan?: {
    name: string;
    space: number;
    private_repos: number;
    collaborators: number;
  };
}

/**
 * Organization membership role
 */
export type OrgRole = 'admin' | 'member';

/**
 * Organization member information
 */
export interface OrgMember {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  role: OrgRole;
  type: 'User' | 'Bot';
}

/**
 * Organization team information
 */
export interface OrgTeam {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  privacy: 'secret' | 'closed';
  permission: 'pull' | 'push' | 'admin' | 'maintain' | 'triage';
  members_count: number;
  repos_count: number;
  html_url: string;
}

/**
 * Workspace organization configuration
 */
export interface WorkspaceOrg {
  workspace_id: string;
  org_login: string;
  org_id: number;
  role: OrgRole;
  enabled: boolean;
  settings: {
    auto_sync_repos: boolean;
    sync_interval_hours: number;
    include_private: boolean;
    repo_filters: string[]; // Glob patterns
    team_sync: boolean;
  };
  last_sync_at: string | null;
  created_at: string;
}

/**
 * Multi-org statistics
 */
export interface MultiOrgStats {
  workspace_id: string;
  total_orgs: number;
  active_orgs: number;
  total_repositories: number;
  total_members: number;
  total_teams: number;
  organizations: {
    login: string;
    name: string | null;
    repos: number;
    members: number;
    teams: number;
    role: OrgRole;
  }[];
}

/**
 * Organization Manager
 * 
 * Manages multiple GitHub organizations within a workspace.
 */
export class OrgManager {
  private octokit: Octokit;

  constructor(githubToken: string) {
    this.octokit = new Octokit({
      auth: githubToken,
    });
  }

  /**
   * List all organizations accessible to the authenticated user
   * 
   * @returns Array of organizations
   */
  async listAccessibleOrgs(): Promise<Organization[]> {
    try {
      const response = await this.octokit.orgs.listForAuthenticatedUser({
        per_page: 100,
      });

      const orgs: Organization[] = [];

      for (const org of response.data) {
        try {
          // Get detailed org information
          const detailResponse = await this.octokit.orgs.get({
            org: org.login,
          });

          orgs.push({
            id: detailResponse.data.id,
            login: detailResponse.data.login,
            name: detailResponse.data.name || null,
            description: detailResponse.data.description || null,
            avatar_url: detailResponse.data.avatar_url,
            html_url: detailResponse.data.html_url,
            type: 'Organization',
            created_at: detailResponse.data.created_at || '',
            updated_at: detailResponse.data.updated_at || '',
            public_repos: detailResponse.data.public_repos || 0,
            total_private_repos: detailResponse.data.total_private_repos,
            owned_private_repos: detailResponse.data.owned_private_repos,
            plan: detailResponse.data.plan
              ? {
                  name: detailResponse.data.plan.name,
                  space: detailResponse.data.plan.space,
                  private_repos: detailResponse.data.plan.private_repos,
                  collaborators: 0, // Not available in API response
                }
              : undefined,
          });
        } catch (error) {
          console.error(`Error fetching details for org ${org.login}:`, error);
          // Continue with basic info
          orgs.push({
            id: org.id,
            login: org.login,
            name: null,
            description: null,
            avatar_url: org.avatar_url,
            html_url: org.url,
            type: 'Organization',
            created_at: '',
            updated_at: '',
            public_repos: 0,
          });
        }
      }

      return orgs;
    } catch (error) {
      console.error('Error listing organizations:', error);
      throw error;
    }
  }

  /**
   * Get organization membership information
   * 
   * @param orgLogin - Organization login
   * @param username - Username to check
   * @returns Membership role or null
   */
  async getOrgMembership(
    orgLogin: string,
    username: string
  ): Promise<OrgRole | null> {
    try {
      const response = await this.octokit.orgs.getMembershipForUser({
        org: orgLogin,
        username,
      });

      return response.data.role as OrgRole;
    } catch (error: unknown) {
      const err = error as { status?: number };
      if (err.status === 404) {
        return null;
      }
      console.error(`Error checking org membership:`, error);
      throw error;
    }
  }

  /**
   * List members of an organization
   * 
   * @param orgLogin - Organization login
   * @returns Array of organization members
   */
  async listOrgMembers(orgLogin: string): Promise<OrgMember[]> {
    try {
      const response = await this.octokit.orgs.listMembers({
        org: orgLogin,
        per_page: 100,
      });

      const members: OrgMember[] = [];

      for (const member of response.data) {
        try {
          const role = await this.getOrgMembership(orgLogin, member.login);

          members.push({
            id: member.id,
            login: member.login,
            avatar_url: member.avatar_url,
            html_url: member.html_url,
            role: role || 'member',
            type: member.type as 'User' | 'Bot',
          });
        } catch (error) {
          console.error(`Error fetching role for ${member.login}:`, error);
          members.push({
            id: member.id,
            login: member.login,
            avatar_url: member.avatar_url,
            html_url: member.html_url,
            role: 'member',
            type: member.type as 'User' | 'Bot',
          });
        }
      }

      return members;
    } catch (error) {
      console.error(`Error listing org members for ${orgLogin}:`, error);
      throw error;
    }
  }

  /**
   * List teams in an organization
   * 
   * @param orgLogin - Organization login
   * @returns Array of teams
   */
  async listOrgTeams(orgLogin: string): Promise<OrgTeam[]> {
    try {
      const response = await this.octokit.teams.list({
        org: orgLogin,
        per_page: 100,
      });

      return response.data.map((team) => ({
        id: team.id,
        name: team.name,
        slug: team.slug,
        description: team.description || null,
        privacy: team.privacy as 'secret' | 'closed',
        permission: team.permission as 'pull' | 'push' | 'admin' | 'maintain' | 'triage',
        members_count: 0, // Need separate API call to get member count
        repos_count: 0, // Need separate API call to get repo count
        html_url: team.html_url,
      }));
    } catch (error) {
      console.error(`Error listing teams for ${orgLogin}:`, error);
      throw error;
    }
  }

  /**
   * List repositories for an organization
   * 
   * @param orgLogin - Organization login
   * @param includePrivate - Include private repositories
   * @returns Array of repository names
   */
  async listOrgRepositories(
    orgLogin: string,
    includePrivate: boolean = true
  ): Promise<string[]> {
    try {
      const repos: string[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await this.octokit.repos.listForOrg({
          org: orgLogin,
          type: includePrivate ? 'all' : 'public',
          per_page: 100,
          page,
        });

        for (const repo of response.data) {
          repos.push(repo.full_name);
        }

        hasMore = response.data.length === 100;
        page++;
      }

      return repos;
    } catch (error) {
      console.error(`Error listing repositories for ${orgLogin}:`, error);
      throw error;
    }
  }

  /**
   * Sync organization repositories to workspace
   * 
   * @param workspaceId - Workspace ID
   * @param orgLogin - Organization login
   * @param settings - Organization settings
   */
  async syncOrgRepositories(
    workspaceId: string,
    orgLogin: string,
    settings: WorkspaceOrg['settings']
  ): Promise<void> {
    try {
      // Get workspace
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }

      // Fetch org repositories
      const repos = await this.listOrgRepositories(
        orgLogin,
        settings.include_private
      );

      // Apply filters if specified
      let filteredRepos = repos;
      if (settings.repo_filters.length > 0) {
        filteredRepos = repos.filter((repo) =>
          settings.repo_filters.some((filter) =>
            this.matchesPattern(repo, filter)
          )
        );
      }

      // Parse existing repositories
      const existingRepos = Array.isArray(workspace.repositories)
        ? workspace.repositories
        : [];

      // Merge with existing repositories (avoid duplicates)
      const existingRepoNames = new Set(
        existingRepos.map((r) =>
          typeof r === 'string' ? r : (r as { fullName?: string }).fullName
        )
      );

      const newRepos = filteredRepos.filter((repo) => !existingRepoNames.has(repo));

      if (newRepos.length > 0) {
        // Update workspace with new repositories
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            repositories: [...existingRepos, ...newRepos.map((r) => ({ fullName: r }))],
            updatedAt: new Date(),
          },
        });

        console.log(`Synced ${newRepos.length} repositories from ${orgLogin}`);
      }
    } catch (error) {
      console.error(`Error syncing repositories for ${orgLogin}:`, error);
      throw error;
    }
  }

  /**
   * Match repository name against glob pattern
   * 
   * @param repoName - Repository full name
   * @param pattern - Glob pattern
   * @returns True if matches
   */
  private matchesPattern(repoName: string, pattern: string): boolean {
    const regex = new RegExp(
      `^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`
    );
    return regex.test(repoName);
  }

  /**
   * Get multi-org statistics for a workspace
   * 
   * @param workspaceId - Workspace ID
   * @param workspaceOrgs - Array of workspace organization configurations
   * @returns Multi-org statistics
   */
  async getMultiOrgStats(
    workspaceId: string,
    workspaceOrgs: WorkspaceOrg[]
  ): Promise<MultiOrgStats> {
    const activeOrgs = workspaceOrgs.filter((org) => org.enabled);
    const orgStats = [];

    let totalRepos = 0;
    let totalMembers = 0;
    let totalTeams = 0;

    for (const workspaceOrg of activeOrgs) {
      try {
        // Get org details
        const orgResponse = await this.octokit.orgs.get({
          org: workspaceOrg.org_login,
        });

        // Count repositories
        const repos = await this.listOrgRepositories(
          workspaceOrg.org_login,
          workspaceOrg.settings.include_private
        );

        // Count members
        const members = await this.listOrgMembers(workspaceOrg.org_login);

        // Count teams if enabled
        let teams: OrgTeam[] = [];
        if (workspaceOrg.settings.team_sync) {
          teams = await this.listOrgTeams(workspaceOrg.org_login);
        }

        const repoCount = repos.length;
        const memberCount = members.length;
        const teamCount = teams.length;

        totalRepos += repoCount;
        totalMembers += memberCount;
        totalTeams += teamCount;

        orgStats.push({
          login: workspaceOrg.org_login,
          name: orgResponse.data.name || null,
          repos: repoCount,
          members: memberCount,
          teams: teamCount,
          role: workspaceOrg.role,
        });
      } catch (error) {
        console.error(`Error fetching stats for ${workspaceOrg.org_login}:`, error);
        // Continue with other orgs
        orgStats.push({
          login: workspaceOrg.org_login,
          name: null,
          repos: 0,
          members: 0,
          teams: 0,
          role: workspaceOrg.role,
        });
      }
    }

    return {
      workspace_id: workspaceId,
      total_orgs: workspaceOrgs.length,
      active_orgs: activeOrgs.length,
      total_repositories: totalRepos,
      total_members: totalMembers,
      total_teams: totalTeams,
      organizations: orgStats,
    };
  }

  /**
   * Add organization to workspace
   * 
   * @param workspaceId - Workspace ID
   * @param orgLogin - Organization login
   * @param username - Username for role check
   * @param settings - Organization settings
   * @returns Workspace organization configuration
   */
  async addOrgToWorkspace(
    workspaceId: string,
    orgLogin: string,
    username: string,
    settings: WorkspaceOrg['settings']
  ): Promise<WorkspaceOrg> {
    try {
      // Get org details
      const orgResponse = await this.octokit.orgs.get({
        org: orgLogin,
      });

      // Check user's role
      const role = await this.getOrgMembership(orgLogin, username);
      if (!role) {
        throw new Error(`User ${username} is not a member of ${orgLogin}`);
      }

      // Create workspace org configuration
      const workspaceOrg: WorkspaceOrg = {
        workspace_id: workspaceId,
        org_login: orgLogin,
        org_id: orgResponse.data.id,
        role,
        enabled: true,
        settings,
        last_sync_at: null,
        created_at: new Date().toISOString(),
      };

      // Sync repositories if auto-sync is enabled
      if (settings.auto_sync_repos) {
        await this.syncOrgRepositories(workspaceId, orgLogin, settings);
        workspaceOrg.last_sync_at = new Date().toISOString();
      }

      return workspaceOrg;
    } catch (error) {
      console.error(`Error adding org ${orgLogin} to workspace:`, error);
      throw error;
    }
  }

  /**
   * Remove organization from workspace
   * 
   * @param workspaceId - Workspace ID
   * @param orgLogin - Organization login
   * @param removeRepos - Whether to remove org repositories from workspace
   */
  async removeOrgFromWorkspace(
    workspaceId: string,
    orgLogin: string,
    removeRepos: boolean = false
  ): Promise<void> {
    try {
      if (removeRepos) {
        // Get workspace
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
        });

        if (!workspace) {
          throw new Error(`Workspace ${workspaceId} not found`);
        }

        // Parse repositories
        const existingRepos = Array.isArray(workspace.repositories)
          ? workspace.repositories
          : [];

        // Filter out org repositories
        const filteredRepos = existingRepos.filter((repo) => {
          const fullName = typeof repo === 'string' ? repo : (repo as { fullName?: string }).fullName;
          return !fullName?.startsWith(`${orgLogin}/`);
        });

        // Update workspace
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            repositories: filteredRepos,
            updatedAt: new Date(),
          },
        });
      }
    } catch (error) {
      console.error(`Error removing org ${orgLogin} from workspace:`, error);
      throw error;
    }
  }
}
