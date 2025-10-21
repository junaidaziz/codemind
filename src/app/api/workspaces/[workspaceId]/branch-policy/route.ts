/**
 * Branch Policy Management API
 * 
 * REST API endpoints for managing branch protection rules and
 * policy enforcement across workspace repositories.
 * 
 * Endpoints:
 * - GET: Fetch branch protections and compliance status
 * - POST: Apply policies and generate reports
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  BranchPolicyEnforcer,
  type BranchProtection,
  type WorkspacePolicy,
} from '@/lib/multi-repo/branch-policy';
import prisma from '@/lib/db';

/**
 * GET handler - Fetch branch protection status
 * 
 * Query Parameters:
 * - owner: Repository owner (required for specific repo)
 * - repo: Repository name (required for specific repo)
 * - branch: Branch name (optional, defaults to main branches)
 * 
 * @param request - Next.js request object
 * @param params - URL parameters with workspaceId
 * @returns Branch protection status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const searchParams = request.nextUrl.searchParams;
    
    // Extract user ID from request
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 401 }
      );
    }

    // Verify workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    // Get GitHub token from environment
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    const enforcer = new BranchPolicyEnforcer(githubToken);

    // Check if fetching for specific repository
    const owner = searchParams.get('owner');
    const repo = searchParams.get('repo');
    const branch = searchParams.get('branch') || 'main';

    if (owner && repo) {
      // Fetch protection for specific branch
      const protection = await enforcer.getBranchProtection(owner, repo, branch);

      return NextResponse.json({
        repository: { owner, repo },
        branch,
        protected: protection !== null,
        protection,
      });
    } else {
      // Fetch protection status for all repositories
      const repositories = Array.isArray(workspace.repositories)
        ? workspace.repositories
        : [];

      const repoStatuses = [];

      for (const repoData of repositories) {
        const fullName = typeof repoData === 'string' 
          ? repoData 
          : (repoData as { fullName?: string }).fullName;
        
        if (!fullName || !fullName.includes('/')) continue;

        const [repoOwner, repoName] = fullName.split('/');

        try {
          const mainProtection = await enforcer.getBranchProtection(
            repoOwner,
            repoName,
            'main'
          );

          repoStatuses.push({
            owner: repoOwner,
            name: repoName,
            protected: mainProtection !== null,
            main_branch_protection: mainProtection,
          });
        } catch (error) {
          console.error(`Error fetching protection for ${fullName}:`, error);
          repoStatuses.push({
            owner: repoOwner,
            name: repoName,
            protected: false,
            error: 'Failed to fetch protection status',
          });
        }
      }

      return NextResponse.json({
        workspace_id: workspaceId,
        repositories: repoStatuses,
      });
    }
  } catch (error) {
    console.error('Error fetching branch protection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branch protection', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST handler - Apply policies and manage protection
 * 
 * Request Body:
 * {
 *   "action": "set_protection" | "detect_violations" | "generate_report" | "apply_defaults",
 *   "owner"?: string,             // Required for "set_protection"
 *   "repo"?: string,              // Required for "set_protection"
 *   "branch"?: string,            // Required for "set_protection"
 *   "protection"?: BranchProtection, // Required for "set_protection"
 *   "policy"?: WorkspacePolicy    // Required for policy-based actions
 * }
 * 
 * Actions:
 * - set_protection: Set branch protection rules
 * - detect_violations: Detect policy violations
 * - generate_report: Generate compliance report
 * - apply_defaults: Apply default protections to all repos
 * 
 * @param request - Next.js request object
 * @param params - URL parameters with workspaceId
 * @returns Action result
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const body = await request.json();
    const { action, owner, repo, branch, protection, policy } = body;

    // Extract user ID from request
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID required' },
        { status: 401 }
      );
    }

    // Verify workspace access
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found or access denied' },
        { status: 404 }
      );
    }

    // Get GitHub token from environment
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub token not configured' },
        { status: 500 }
      );
    }

    const enforcer = new BranchPolicyEnforcer(githubToken);

    switch (action) {
      case 'set_protection': {
        // Set branch protection rules
        if (!owner || !repo || !branch || !protection) {
          return NextResponse.json(
            { error: 'owner, repo, branch, and protection are required' },
            { status: 400 }
          );
        }

        await enforcer.setBranchProtection(
          owner,
          repo,
          branch,
          protection as BranchProtection
        );

        return NextResponse.json({
          action: 'set_protection',
          result: {
            repository: { owner, repo },
            branch,
            status: 'protected',
          },
        });
      }

      case 'detect_violations': {
        // Detect policy violations
        if (!policy) {
          return NextResponse.json(
            { error: 'policy configuration is required' },
            { status: 400 }
          );
        }

        const workspacePolicy = policy as WorkspacePolicy;
        const repositories = Array.isArray(workspace.repositories)
          ? workspace.repositories
          : [];

        const allViolations = [];

        for (const repoData of repositories) {
          const fullName = typeof repoData === 'string'
            ? repoData
            : (repoData as { fullName?: string }).fullName;

          if (!fullName || !fullName.includes('/')) continue;

          const [repoOwner, repoName] = fullName.split('/');

          try {
            const violations = await enforcer.detectViolations(
              repoOwner,
              repoName,
              workspacePolicy
            );
            allViolations.push(...violations);
          } catch (error) {
            console.error(`Error detecting violations for ${fullName}:`, error);
          }
        }

        return NextResponse.json({
          action: 'detect_violations',
          result: {
            total_violations: allViolations.length,
            critical: allViolations.filter((v) => v.severity === 'critical').length,
            high: allViolations.filter((v) => v.severity === 'high').length,
            medium: allViolations.filter((v) => v.severity === 'medium').length,
            low: allViolations.filter((v) => v.severity === 'low').length,
            violations: allViolations,
          },
        });
      }

      case 'generate_report': {
        // Generate compliance report
        if (!policy) {
          return NextResponse.json(
            { error: 'policy configuration is required' },
            { status: 400 }
          );
        }

        const workspacePolicy = policy as WorkspacePolicy;
        const report = await enforcer.generateComplianceReport(
          workspaceId,
          workspacePolicy
        );

        return NextResponse.json({
          action: 'generate_report',
          result: report,
        });
      }

      case 'apply_defaults': {
        // Apply default protections to all repositories
        if (!policy) {
          return NextResponse.json(
            { error: 'policy configuration is required' },
            { status: 400 }
          );
        }

        const workspacePolicy = policy as WorkspacePolicy;
        await enforcer.applyDefaultProtections(workspaceId, workspacePolicy);

        return NextResponse.json({
          action: 'apply_defaults',
          result: {
            status: 'completed',
            message: 'Default protections applied to all repositories',
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error managing branch policy:', error);
    return NextResponse.json(
      { error: 'Failed to manage branch policy', details: String(error) },
      { status: 500 }
    );
  }
}
