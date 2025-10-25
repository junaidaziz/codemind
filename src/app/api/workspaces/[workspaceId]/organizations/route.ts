/**
 * Multi-Organization Management API
 * 
 * REST API endpoints for managing multiple GitHub organizations
 * within a workspace, including org discovery, synchronization,
 * and cross-org operations.
 * 
 * Endpoints:
 * - GET: List organizations and fetch org details
 * - POST: Manage organizations (add, remove, sync)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  OrgManager,
  type WorkspaceOrg,
} from '@/lib/multi-repo/org-manager';
import prisma from '@/lib/db';
// import { cookies } from 'next/headers'; // reserved for future cookie-based session retrieval
import { createClient } from '@supabase/supabase-js';

async function getSessionUserId(): Promise<string | null> {
  try {
  // const cookieStore = cookies(); // reserved for cookie-based session retrieval
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) return null;
    const supabase = createClient(supabaseUrl, supabaseAnon, { auth: { persistSession: false } });
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  } catch (e) {
    console.warn('Supabase session retrieval failed:', e);
    return null;
  }
}

/**
 * GET handler - List organizations and fetch details
 * 
 * Query Parameters:
 * - action: "list_accessible" | "workspace_orgs" | "org_details" | "org_stats"
 * - org_login: Organization login (required for "org_details")
 * 
 * @param request - Next.js request object
 * @param params - URL parameters with workspaceId
 * @returns Organization information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'workspace_orgs';
    
    // Extract user ID from header or session fallback
    let userId = request.headers.get('x-user-id');
    if (!userId) {
      userId = await getSessionUserId();
    }
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

    const orgManager = new OrgManager(githubToken);

    switch (action) {
      case 'list_accessible': {
        // List all organizations accessible to the user
        const orgs = await orgManager.listAccessibleOrgs();

        return NextResponse.json({
          action: 'list_accessible',
          total: orgs.length,
          organizations: orgs,
        });
      }

      case 'workspace_orgs': {
        // Get organizations configured in the workspace
        // This would typically be stored in a separate table or workspace settings
        // For now, we'll parse from workspace.settings
        const settings = typeof workspace.settings === 'object' 
          ? workspace.settings as { organizations?: WorkspaceOrg[] }
          : { organizations: [] };

        const workspaceOrgs = settings.organizations || [];

        return NextResponse.json({
          action: 'workspace_orgs',
          workspace_id: workspaceId,
          total: workspaceOrgs.length,
          organizations: workspaceOrgs,
        });
      }

      case 'org_details': {
        // Get detailed information about a specific organization
        const orgLogin = searchParams.get('org_login');
        if (!orgLogin) {
          return NextResponse.json(
            { error: 'org_login parameter required' },
            { status: 400 }
          );
        }

        // Fetch org details, members, and teams
        const orgs = await orgManager.listAccessibleOrgs();
        const org = orgs.find((o) => o.login === orgLogin);

        if (!org) {
          return NextResponse.json(
            { error: `Organization ${orgLogin} not found or not accessible` },
            { status: 404 }
          );
        }

        const members = await orgManager.listOrgMembers(orgLogin);
        const teams = await orgManager.listOrgTeams(orgLogin);
        const repos = await orgManager.listOrgRepositories(orgLogin, true);

        return NextResponse.json({
          action: 'org_details',
          organization: org,
          members: {
            total: members.length,
            admins: members.filter((m) => m.role === 'admin').length,
            members: members.filter((m) => m.role === 'member').length,
            list: members,
          },
          teams: {
            total: teams.length,
            list: teams,
          },
          repositories: {
            total: repos.length,
            list: repos,
          },
        });
      }

      case 'org_stats': {
        // Get multi-org statistics for the workspace
        const settings = typeof workspace.settings === 'object'
          ? workspace.settings as { organizations?: WorkspaceOrg[] }
          : { organizations: [] };

        const workspaceOrgs = settings.organizations || [];
        const stats = await orgManager.getMultiOrgStats(workspaceId, workspaceOrgs);

        return NextResponse.json({
          action: 'org_stats',
          stats,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error fetching organization information:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization information', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST handler - Manage organizations
 * 
 * Request Body:
 * {
 *   "action": "add_org" | "remove_org" | "sync_org" | "update_settings",
 *   "org_login": string,                    // Required for all actions
 *   "username"?: string,                    // Required for "add_org"
 *   "settings"?: WorkspaceOrg['settings'], // Required for "add_org" and "update_settings"
 *   "remove_repos"?: boolean               // Optional for "remove_org"
 * }
 * 
 * Actions:
 * - add_org: Add organization to workspace
 * - remove_org: Remove organization from workspace
 * - sync_org: Sync organization repositories
 * - update_settings: Update organization settings
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
    const { action, org_login, username, settings, remove_repos } = body;

    // Extract user ID from header or session fallback
    let userId = request.headers.get('x-user-id');
    if (!userId) {
      userId = await getSessionUserId();
    }
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

    if (!org_login) {
      return NextResponse.json(
        { error: 'org_login is required' },
        { status: 400 }
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

    const orgManager = new OrgManager(githubToken);

    // Parse workspace settings
    const workspaceSettings = typeof workspace.settings === 'object'
      ? workspace.settings as { organizations?: WorkspaceOrg[] }
      : { organizations: [] };

    const workspaceOrgs = workspaceSettings.organizations || [];

    switch (action) {
      case 'add_org': {
        // Add organization to workspace
        if (!username || !settings) {
          return NextResponse.json(
            { error: 'username and settings are required for add_org' },
            { status: 400 }
          );
        }

        // Check if org already exists
        if (workspaceOrgs.some((org) => org.org_login === org_login)) {
          return NextResponse.json(
            { error: `Organization ${org_login} already exists in workspace` },
            { status: 409 }
          );
        }

        const workspaceOrg = await orgManager.addOrgToWorkspace(
          workspaceId,
          org_login,
          username,
          settings as WorkspaceOrg['settings']
        );

        // Update workspace settings
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            settings: {
              ...(workspaceSettings as object),
              organizations: workspaceOrgs.map((org) => JSON.parse(JSON.stringify(org))),
            },
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({
          action: 'add_org',
          result: {
            status: 'added',
            organization: workspaceOrg,
          },
        });
      }

      case 'remove_org': {
        // Remove organization from workspace
        const orgIndex = workspaceOrgs.findIndex((org) => org.org_login === org_login);
        if (orgIndex === -1) {
          return NextResponse.json(
            { error: `Organization ${org_login} not found in workspace` },
            { status: 404 }
          );
        }

        // Remove repositories if requested
        if (remove_repos) {
          await orgManager.removeOrgFromWorkspace(
            workspaceId,
            org_login,
            true
          );
        }

        // Remove from workspace settings
        workspaceOrgs.splice(orgIndex, 1);
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            settings: {
              ...(workspaceSettings as object),
              organizations: workspaceOrgs.map((org) => JSON.parse(JSON.stringify(org))),
            },
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({
          action: 'remove_org',
          result: {
            status: 'removed',
            org_login,
            repos_removed: remove_repos || false,
          },
        });
      }

      case 'sync_org': {
        // Sync organization repositories
        const orgConfig = workspaceOrgs.find((org) => org.org_login === org_login);
        if (!orgConfig) {
          return NextResponse.json(
            { error: `Organization ${org_login} not found in workspace` },
            { status: 404 }
          );
        }

        await orgManager.syncOrgRepositories(
          workspaceId,
          org_login,
          orgConfig.settings
        );

        // Update last sync time
        orgConfig.last_sync_at = new Date().toISOString();
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            settings: {
              ...(workspaceSettings as object),
              organizations: workspaceOrgs.map((org) => JSON.parse(JSON.stringify(org))),
            },
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({
          action: 'sync_org',
          result: {
            status: 'synced',
            org_login,
            last_sync_at: orgConfig.last_sync_at,
          },
        });
      }

      case 'update_settings': {
        // Update organization settings
        if (!settings) {
          return NextResponse.json(
            { error: 'settings are required for update_settings' },
            { status: 400 }
          );
        }

        const orgConfig = workspaceOrgs.find((org) => org.org_login === org_login);
        if (!orgConfig) {
          return NextResponse.json(
            { error: `Organization ${org_login} not found in workspace` },
            { status: 404 }
          );
        }

        // Update settings
        orgConfig.settings = settings as WorkspaceOrg['settings'];

        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            settings: {
              ...(workspaceSettings as object),
              organizations: workspaceOrgs.map((org) => JSON.parse(JSON.stringify(org))),
            },
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({
          action: 'update_settings',
          result: {
            status: 'updated',
            org_login,
            settings: orgConfig.settings,
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
    console.error('Error managing organization:', error);
    return NextResponse.json(
      { error: 'Failed to manage organization', details: String(error) },
      { status: 500 }
    );
  }
}
