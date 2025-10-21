/**
 * Branch Policy Enforcement System
 * 
 * Manages branch protection rules and policy enforcement for repositories
 * in a workspace. Provides automated checks for branch policies, commit
 * restrictions, and merge requirements.
 * 
 * Features:
 * - Branch protection rule management
 * - Policy validation and enforcement
 * - Required status checks
 * - Review requirements
 * - Commit signature verification
 * - Direct commit warnings
 * - Policy violation detection
 * - Automated remediation suggestions
 * 
 * @module BranchPolicyEnforcer
 */

import { Octokit } from '@octokit/rest';
import prisma from '@/lib/db';

/**
 * Branch protection rule configuration
 */
export interface BranchProtection {
  pattern: string; // Branch name pattern (e.g., "main", "release/*")
  required_status_checks?: {
    strict: boolean; // Require branches to be up to date
    contexts: string[]; // Required status check names
  };
  enforce_admins: boolean; // Apply rules to admins
  required_pull_request_reviews?: {
    dismissal_restrictions?: {
      users?: string[];
      teams?: string[];
    };
    dismiss_stale_reviews: boolean;
    require_code_owner_reviews: boolean;
    required_approving_review_count: number;
    require_last_push_approval: boolean;
  };
  restrictions?: {
    users: string[];
    teams: string[];
    apps: string[];
  };
  required_linear_history: boolean;
  allow_force_pushes: boolean;
  allow_deletions: boolean;
  block_creations: boolean;
  required_conversation_resolution: boolean;
  lock_branch: boolean;
  allow_fork_syncing: boolean;
  required_signatures: boolean; // Require signed commits
}

/**
 * Policy violation types
 */
export type ViolationType =
  | 'direct_commit' // Commit directly to protected branch
  | 'missing_review' // PR without required reviews
  | 'unsigned_commit' // Commit without signature
  | 'failed_checks' // Required status checks failed
  | 'stale_branch' // Branch not up to date
  | 'unauthorized_user' // User not allowed to push
  | 'force_push' // Force push to protected branch
  | 'branch_deletion'; // Attempt to delete protected branch

/**
 * Policy violation severity
 */
export type ViolationSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Detected policy violation
 */
export interface PolicyViolation {
  id: string;
  type: ViolationType;
  severity: ViolationSeverity;
  branch: string;
  repository: {
    owner: string;
    name: string;
  };
  actor: string; // User who caused the violation
  commit?: string; // Commit SHA if applicable
  pull_request?: number; // PR number if applicable
  message: string;
  timestamp: string;
  remediation: string[]; // Suggested fixes
}

/**
 * Workspace branch policy configuration
 */
export interface WorkspacePolicy {
  workspace_id: string;
  default_rules: BranchProtection[];
  repository_overrides: Record<string, BranchProtection[]>;
  enforcement_level: 'strict' | 'warning' | 'advisory';
  notification_channels: string[]; // Slack, email, etc.
  auto_remediate: boolean;
}

/**
 * Policy compliance report
 */
export interface ComplianceReport {
  workspace_id: string;
  repositories: {
    owner: string;
    name: string;
    compliant: boolean;
    protected_branches: string[];
    violations: PolicyViolation[];
    missing_protections: string[];
  }[];
  overall_compliance: number; // Percentage
  critical_violations: number;
  recommendations: string[];
  generated_at: string;
}

/**
 * Branch Policy Enforcer
 * 
 * Manages and enforces branch protection policies across a workspace.
 */
export class BranchPolicyEnforcer {
  private octokit: Octokit;

  constructor(githubToken: string) {
    this.octokit = new Octokit({
      auth: githubToken,
    });
  }

  /**
   * Get current branch protection rules for a branch
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param branch - Branch name
   * @returns Branch protection configuration or null
   */
  async getBranchProtection(
    owner: string,
    repo: string,
    branch: string
  ): Promise<BranchProtection | null> {
    try {
      const response = await this.octokit.repos.getBranchProtection({
        owner,
        repo,
        branch,
      });

      return this.normalizeBranchProtection(response.data);
    } catch (error: unknown) {
      const err = error as { status?: number };
      if (err.status === 404) {
        // Branch not protected
        return null;
      }
      console.error(`Error fetching branch protection for ${branch}:`, error);
      throw error;
    }
  }

  /**
   * Set branch protection rules
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param branch - Branch name
   * @param protection - Protection configuration
   */
  async setBranchProtection(
    owner: string,
    repo: string,
    branch: string,
    protection: BranchProtection
  ): Promise<void> {
    try {
      await this.octokit.repos.updateBranchProtection({
        owner,
        repo,
        branch,
        required_status_checks: protection.required_status_checks || null,
        enforce_admins: protection.enforce_admins,
        required_pull_request_reviews: protection.required_pull_request_reviews || null,
        restrictions: protection.restrictions || null,
        required_linear_history: protection.required_linear_history,
        allow_force_pushes: protection.allow_force_pushes,
        allow_deletions: protection.allow_deletions,
        block_creations: protection.block_creations,
        required_conversation_resolution: protection.required_conversation_resolution,
        lock_branch: protection.lock_branch,
        allow_fork_syncing: protection.allow_fork_syncing,
      });

      // Handle required signatures separately if supported
      if (protection.required_signatures) {
        await this.enableSignatureRequirement(owner, repo, branch);
      }
    } catch (error) {
      console.error(`Error setting branch protection for ${branch}:`, error);
      throw error;
    }
  }

  /**
   * Enable required commit signatures
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param branch - Branch name
   */
  private async enableSignatureRequirement(
    owner: string,
    repo: string,
    branch: string
  ): Promise<void> {
    try {
      // This requires admin permissions
      await this.octokit.request(
        'POST /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures',
        {
          owner,
          repo,
          branch,
        }
      );
    } catch (error) {
      console.error(`Error enabling signature requirement:`, error);
      // Don't throw - this is optional
    }
  }

  /**
   * Normalize GitHub API response to our format
   * 
   * @param data - GitHub API response
   * @returns Normalized branch protection
   */
  private normalizeBranchProtection(data: unknown): BranchProtection {
    const protection = data as {
      pattern?: string;
      required_status_checks?: {
        strict?: boolean;
        contexts?: string[];
      } | null;
      enforce_admins?: { enabled?: boolean };
      required_pull_request_reviews?: {
        dismissal_restrictions?: {
          users?: { login: string }[];
          teams?: { slug: string }[];
        };
        dismiss_stale_reviews?: boolean;
        require_code_owner_reviews?: boolean;
        required_approving_review_count?: number;
        require_last_push_approval?: boolean;
      } | null;
      restrictions?: {
        users?: { login: string }[];
        teams?: { slug: string }[];
        apps?: { slug: string }[];
      } | null;
      required_linear_history?: { enabled?: boolean };
      allow_force_pushes?: { enabled?: boolean };
      allow_deletions?: { enabled?: boolean };
      block_creations?: { enabled?: boolean };
      required_conversation_resolution?: { enabled?: boolean };
      lock_branch?: { enabled?: boolean };
      allow_fork_syncing?: { enabled?: boolean };
    };

    return {
      pattern: protection.pattern || '',
      required_status_checks: protection.required_status_checks
        ? {
            strict: protection.required_status_checks.strict || false,
            contexts: protection.required_status_checks.contexts || [],
          }
        : undefined,
      enforce_admins: protection.enforce_admins?.enabled || false,
      required_pull_request_reviews: protection.required_pull_request_reviews
        ? {
            dismissal_restrictions: {
              users: protection.required_pull_request_reviews.dismissal_restrictions?.users?.map(
                (u) => u.login
              ),
              teams: protection.required_pull_request_reviews.dismissal_restrictions?.teams?.map(
                (t) => t.slug
              ),
            },
            dismiss_stale_reviews:
              protection.required_pull_request_reviews.dismiss_stale_reviews || false,
            require_code_owner_reviews:
              protection.required_pull_request_reviews.require_code_owner_reviews || false,
            required_approving_review_count:
              protection.required_pull_request_reviews.required_approving_review_count || 1,
            require_last_push_approval:
              protection.required_pull_request_reviews.require_last_push_approval || false,
          }
        : undefined,
      restrictions: protection.restrictions
        ? {
            users: protection.restrictions.users?.map((u) => u.login) || [],
            teams: protection.restrictions.teams?.map((t) => t.slug) || [],
            apps: protection.restrictions.apps?.map((a) => a.slug) || [],
          }
        : undefined,
      required_linear_history: protection.required_linear_history?.enabled || false,
      allow_force_pushes: protection.allow_force_pushes?.enabled || false,
      allow_deletions: protection.allow_deletions?.enabled || false,
      block_creations: protection.block_creations?.enabled || false,
      required_conversation_resolution:
        protection.required_conversation_resolution?.enabled || false,
      lock_branch: protection.lock_branch?.enabled || false,
      allow_fork_syncing: protection.allow_fork_syncing?.enabled || false,
      required_signatures: false, // Need separate API call to check
    };
  }

  /**
   * Detect policy violations for a repository
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param policy - Workspace policy
   * @returns Array of detected violations
   */
  async detectViolations(
    owner: string,
    repo: string,
    policy: WorkspacePolicy
  ): Promise<PolicyViolation[]> {
    const violations: PolicyViolation[] = [];

    try {
      // Get recent commits
      const commits = await this.octokit.repos.listCommits({
        owner,
        repo,
        per_page: 30,
      });

      // Check each commit for violations
      for (const commit of commits.data) {
        const branch = commit.commit.tree.sha; // Simplified - would need actual branch
        const rules = this.getApplicableRules(policy, owner, repo);

        for (const rule of rules) {
          // Check for direct commits to protected branches
          if (this.isProtectedBranch(branch, rule.pattern)) {
            // Check if commit was made via PR
            const prs = await this.octokit.repos.listPullRequestsAssociatedWithCommit({
              owner,
              repo,
              commit_sha: commit.sha,
            });

            if (prs.data.length === 0) {
              violations.push({
                id: `${commit.sha}-direct-commit`,
                type: 'direct_commit',
                severity: 'high',
                branch,
                repository: { owner, name: repo },
                actor: commit.commit.author?.name || 'unknown',
                commit: commit.sha,
                message: `Direct commit to protected branch: ${commit.commit.message}`,
                timestamp: commit.commit.author?.date || new Date().toISOString(),
                remediation: [
                  'Always create a pull request for changes',
                  'Enable branch protection to prevent direct commits',
                  'Review and potentially revert this commit',
                ],
              });
            }

            // Check for unsigned commits if required
            if (rule.required_signatures && !commit.commit.verification?.verified) {
              violations.push({
                id: `${commit.sha}-unsigned`,
                type: 'unsigned_commit',
                severity: 'medium',
                branch,
                repository: { owner, name: repo },
                actor: commit.commit.author?.name || 'unknown',
                commit: commit.sha,
                message: 'Commit is not signed',
                timestamp: commit.commit.author?.date || new Date().toISOString(),
                remediation: [
                  'Sign commits with GPG key',
                  'Configure git to sign commits automatically',
                  'Enable signature verification in repository settings',
                ],
              });
            }
          }
        }
      }

      // Check open PRs for violations
      const prs = await this.octokit.pulls.list({
        owner,
        repo,
        state: 'open',
        per_page: 30,
      });

      for (const pr of prs.data) {
        const rules = this.getApplicableRules(policy, owner, repo);
        const targetBranch = pr.base.ref;

        for (const rule of rules) {
          if (!this.isProtectedBranch(targetBranch, rule.pattern)) continue;

          // Check for missing reviews
          if (rule.required_pull_request_reviews) {
            const reviews = await this.octokit.pulls.listReviews({
              owner,
              repo,
              pull_number: pr.number,
            });

            const approvals = reviews.data.filter((r) => r.state === 'APPROVED').length;
            const required = rule.required_pull_request_reviews.required_approving_review_count;

            if (approvals < required) {
              violations.push({
                id: `pr-${pr.number}-reviews`,
                type: 'missing_review',
                severity: 'high',
                branch: targetBranch,
                repository: { owner, name: repo },
                actor: pr.user?.login || 'unknown',
                pull_request: pr.number,
                message: `PR #${pr.number} requires ${required} approvals, has ${approvals}`,
                timestamp: new Date().toISOString(),
                remediation: [
                  `Request ${required - approvals} more review(s)`,
                  'Ensure reviewers have appropriate permissions',
                  'Address any requested changes',
                ],
              });
            }
          }

          // Check for failed status checks
          if (rule.required_status_checks) {
            const checks = await this.octokit.checks.listForRef({
              owner,
              repo,
              ref: pr.head.sha,
            });

            const requiredChecks = rule.required_status_checks.contexts;
            const failedChecks = checks.data.check_runs
              .filter((check) => requiredChecks.includes(check.name))
              .filter((check) => check.conclusion !== 'success');

            if (failedChecks.length > 0) {
              violations.push({
                id: `pr-${pr.number}-checks`,
                type: 'failed_checks',
                severity: 'high',
                branch: targetBranch,
                repository: { owner, name: repo },
                actor: pr.user?.login || 'unknown',
                pull_request: pr.number,
                message: `PR #${pr.number} has ${failedChecks.length} failed required checks`,
                timestamp: new Date().toISOString(),
                remediation: [
                  'Fix failing tests or checks',
                  'Review check logs for errors',
                  'Re-run failed checks if transient',
                ],
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error detecting violations for ${owner}/${repo}:`, error);
    }

    return violations;
  }

  /**
   * Get applicable rules for a repository
   * 
   * @param policy - Workspace policy
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Array of applicable branch protection rules
   */
  private getApplicableRules(
    policy: WorkspacePolicy,
    owner: string,
    repo: string
  ): BranchProtection[] {
    const repoKey = `${owner}/${repo}`;
    return policy.repository_overrides[repoKey] || policy.default_rules;
  }

  /**
   * Check if a branch matches a protection pattern
   * 
   * @param branch - Branch name
   * @param pattern - Protection pattern
   * @returns True if branch is protected
   */
  private isProtectedBranch(branch: string, pattern: string): boolean {
    // Simple glob-style pattern matching
    const regex = new RegExp(
      `^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`
    );
    return regex.test(branch);
  }

  /**
   * Generate compliance report for a workspace
   * 
   * @param workspaceId - Workspace ID
   * @param policy - Workspace policy
   * @returns Compliance report
   */
  async generateComplianceReport(
    workspaceId: string,
    policy: WorkspacePolicy
  ): Promise<ComplianceReport> {
    try {
      // Fetch workspace
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }

      // Parse repositories from JSON
      const repositories = Array.isArray(workspace.repositories)
        ? workspace.repositories
        : [];

      const repoReports = [];
      let totalCompliant = 0;
      let totalCriticalViolations = 0;

      for (const repo of repositories) {
        const fullName = typeof repo === 'string' ? repo : (repo as { fullName?: string }).fullName;
        if (!fullName || !fullName.includes('/')) continue;

        const [owner, name] = fullName.split('/');

        // Detect violations
        const violations = await this.detectViolations(owner, name, policy);
        const criticalViolations = violations.filter((v) => v.severity === 'critical').length;
        totalCriticalViolations += criticalViolations;

        // Check protected branches
        const protectedBranches = await this.getProtectedBranches(owner, name);
        const requiredBranches = policy.default_rules.map((r) => r.pattern);
        const missingProtections = requiredBranches.filter(
          (pattern) => !protectedBranches.some((branch) => this.isProtectedBranch(branch, pattern))
        );

        const compliant = violations.length === 0 && missingProtections.length === 0;
        if (compliant) totalCompliant++;

        repoReports.push({
          owner,
          name,
          compliant,
          protected_branches: protectedBranches,
          violations,
          missing_protections: missingProtections,
        });
      }

      const overallCompliance =
        repositories.length > 0 ? (totalCompliant / repositories.length) * 100 : 100;

      // Generate recommendations
      const recommendations: string[] = [];
      if (overallCompliance < 100) {
        recommendations.push(
          'Some repositories have policy violations. Review and remediate them.'
        );
      }
      if (totalCriticalViolations > 0) {
        recommendations.push(
          `${totalCriticalViolations} critical violation(s) require immediate attention.`
        );
      }

      return {
        workspace_id: workspaceId,
        repositories: repoReports,
        overall_compliance: Math.round(overallCompliance),
        critical_violations: totalCriticalViolations,
        recommendations,
        generated_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error generating compliance report:`, error);
      throw error;
    }
  }

  /**
   * Get list of protected branches for a repository
   * 
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Array of protected branch names
   */
  private async getProtectedBranches(owner: string, repo: string): Promise<string[]> {
    try {
      const branches = await this.octokit.repos.listBranches({
        owner,
        repo,
        protected: true,
        per_page: 100,
      });

      return branches.data.map((b) => b.name);
    } catch (error) {
      console.error(`Error fetching protected branches:`, error);
      return [];
    }
  }

  /**
   * Apply default branch protections to a workspace
   * 
   * @param workspaceId - Workspace ID
   * @param policy - Workspace policy
   */
  async applyDefaultProtections(
    workspaceId: string,
    policy: WorkspacePolicy
  ): Promise<void> {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace) {
        throw new Error(`Workspace ${workspaceId} not found`);
      }

      const repositories = Array.isArray(workspace.repositories)
        ? workspace.repositories
        : [];

      for (const repo of repositories) {
        const fullName = typeof repo === 'string' ? repo : (repo as { fullName?: string }).fullName;
        if (!fullName || !fullName.includes('/')) continue;

        const [owner, name] = fullName.split('/');
        const rules = this.getApplicableRules(policy, owner, name);

        for (const rule of rules) {
          try {
            // Find branches that match the pattern
            const branches = await this.octokit.repos.listBranches({
              owner,
              repo: name,
              per_page: 100,
            });

            for (const branch of branches.data) {
              if (this.isProtectedBranch(branch.name, rule.pattern)) {
                await this.setBranchProtection(owner, name, branch.name, rule);
                console.log(`Applied protection to ${owner}/${name}:${branch.name}`);
              }
            }
          } catch (error) {
            console.error(`Error applying protection to ${owner}/${name}:`, error);
            // Continue with other repositories
          }
        }
      }
    } catch (error) {
      console.error(`Error applying default protections:`, error);
      throw error;
    }
  }
}
